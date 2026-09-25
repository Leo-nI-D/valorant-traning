import { state } from './core/state.js';
import { $, $$, uid, todayKey, dateToIso, formatDateTime, escapeHtml } from './core/utils.js';
import { extractTrainingsFromBackup } from './core/data-contract.js';
import { showError, showSuccess } from './core/errors.js';
import { authService } from './services/auth.js';
import { renderProgress } from './ui/progress-renderer.js';
import { renderTrainings, renderExerciseEditor, resultInputMarkup, renderRunExercise } from './ui/training-renderer.js';
import { resultLabel } from './core/result-metrics.js';
import { EXERCISE_PRESET_DEFAULTS } from './core/constants.js';
import {
  readLocalData, cacheTrainings, loadTrainings, saveTraining, createResult,
  deleteResult, saveResult, setDailyCompletion, createResults
} from './services/data.js';

async function loadSensitivityProfile() {
  const metadata = state.user?.user_metadata || {};
  state.sensitivity = {
    aim: metadata.sensitivity_aim ?? '',
    scoped: metadata.sensitivity_scoped ?? '',
    ads: metadata.sensitivity_ads ?? '',
    dpi: metadata.dpi ?? '',
    recordedAt: metadata.sensitivity_recorded_at || null
  };
}

async function renderProfile() {
  await loadSensitivityProfile();
  $('#sensitivityAim').value = state.sensitivity.aim;
  $('#scopedSensitivityMultiplier').value = state.sensitivity.scoped;
  $('#adsSensitivityMultiplier').value = state.sensitivity.ads;
  $('#sensitivityDpi').value = state.sensitivity.dpi;

  const recorded = $('#sensitivityRecorded');
  recorded.textContent = state.sensitivity.recordedAt
    ? `Записано: ${formatDateTime(state.sensitivity.recordedAt)}`
    : 'Ещё не записано';
  $('#sensitivityStatus').textContent = '';
}

async function handleSensitivitySubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const aim = $('#sensitivityAim').value.trim();
  const scoped = $('#scopedSensitivityMultiplier').value.trim();
  const ads = $('#adsSensitivityMultiplier').value.trim();
  const dpi = $('#sensitivityDpi').value.trim();
  const recordedAt = new Date().toISOString();
  const button = $('#saveSensitivityButton');
  const status = $('#sensitivityStatus');

  button.disabled = true;
  status.textContent = 'Сохраняю…';

  try {
    const response = await authService.updateUser({
      data: {
        sensitivity_aim: aim,
        sensitivity_scoped: scoped,
        sensitivity_ads: ads,
        dpi,
        sensitivity_recorded_at: recordedAt
      }
    });
    if (response.error) throw response.error;
    state.user = response.data.user;

    await renderProfile();
    $('#sensitivityStatus').textContent = 'Настройки сохранены.';
  } catch (error) {
    status.textContent = `Не удалось сохранить: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function getTraining(id) {
  return state.trainings.find(training => training.id === id);
}

function getExercise(training, id) {
  return training?.exercises.find(exercise => exercise.id === id);
}

async function loadData() {
  state.trainings = await loadTrainings(state.user.id);
}

async function ensureAuth() {
  try {
    const { data: { session } } = await authService.getSession();

  if (session) {
    state.user = session.user;
    await enterApp();
  }

    authService.onAuthStateChange(async (_event, sessionState) => {
      if (sessionState) {
        state.user = sessionState.user;
        await enterApp();
        return;
      }

      state.user = null;
      $('#app').hidden = true;
      $('#authScreen').hidden = false;
      $('#authScreen').removeAttribute('aria-hidden');
    });
  } catch (error) {
    showError(error, 'Не удалось инициализировать приложение.', 'auth-init');
  }
}

async function enterApp() {
  $('#authScreen').hidden = true;
  $('#app').hidden = false;
  $('#accountEmail').textContent = state.user.email || '';
  $('#logoutButton').classList.remove('hidden');
  $('#authScreen').removeAttribute('aria-hidden');

  try {
    await loadData();
    renderTrainings($('#trainingList'), state.trainings);
    renderProgress($('#progressList'), state.trainings);
    await renderProfile();
  } catch (error) {
    showError(error, 'Не удалось загрузить данные. Проверь подключение и попробуй ещё раз.', 'load');
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isLogin = mode === 'login';
  $('#authTitle').textContent = isLogin ? 'Вход' : 'Регистрация';
  $('#authHint').textContent = isLogin
    ? 'Войди, чтобы тренировки и результаты синхронизировались между устройствами.'
    : 'Создай аккаунт. Твои тренировки будут доступны с телефона и компьютера.';
  $('#authSubmit').textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
  $('#authToggle').textContent = isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти';
  $('#authError').textContent = '';
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  $('#authError').textContent = '';
  if (!form.reportValidity()) return;

  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  try {
    const response = state.authMode === 'login'
      ? await authService.signInWithPassword({ email, password })
      : await authService.signUp({ email, password });

    if (response.error) {
      $('#authError').textContent = response.error.message;
      return;
    }

    if (state.authMode === 'signup' && !response.data.session) {
      $('#authError').textContent = 'Аккаунт создан. Проверь почту для подтверждения, затем войди.';
    }
  } catch (error) {
    showError(error, 'Не удалось выполнить вход.', 'auth');
  }
}

function openTrainingDialog(id = null) {
  const training = getTraining(id);
  $('#trainingId').value = id || '';
  $('#trainingName').value = training?.name || '';
  $('#trainingDescription').value = training?.description || '';
  state.editingExercises = training ? structuredClone(training.exercises) : [];

  if (!state.editingExercises.length) addExercise(false);
  else renderExerciseEditor($('#exerciseEditor'), state.editingExercises);

  $('#modalTitle').textContent = training ? 'Изменить тренировку' : 'Новая тренировка';
  openDialog('trainingModal');
}

function addExercise(render = true) {
  state.editingExercises.push({
    id: uid('ex'), name: '', weapon: '', resultType: 'time', unit: 'сек', goal: '', history: [], completed: false
  });
  if (render) renderExerciseEditor($('#exerciseEditor'), state.editingExercises);
}

async function handleTrainingSubmit(event) {
  event.preventDefault();
  const id = $('#trainingId').value || uid('training');
  const existing = getTraining(id);
  const training = {
    id,
    name: $('#trainingName').value.trim(),
    description: $('#trainingDescription').value.trim(),
    exercises: state.editingExercises
  };

  if (!training.name) return;

  const submitButton = event.submitter || $('#trainingForm button[type=submit]');
  const originalLabel = submitButton?.textContent || 'Сохранить тренировку';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Сохраняю…';
  }

  try {
    const nextTrainings = existing
      ? state.trainings.map(item => item.id === id ? training : item)
      : [...state.trainings, training];

    await saveTraining(training, state.user.id, nextTrainings);
    state.trainings = nextTrainings;
    cacheTrainings(state.trainings);
    closeDialog('trainingModal');
    renderTrainings($('#trainingList'), state.trainings);
    renderProgress($('#progressList'), state.trainings);
  } catch (error) {
    showError(error, 'Не удалось сохранить тренировку.', 'save-training');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }
}

function collectResult(exercise, prefix = 'result') {
  const result = { resultType: exercise.resultType };
  const base = `${prefix}_${exercise.id}`;
  const readValue = id => document.getElementById(id)?.value.trim() ?? '';

  if (['score', 'scorePlacement'].includes(exercise.resultType)) {
    result.valueA = readValue(`${base}_a`);
    result.valueB = readValue(`${base}_b`);
    if (exercise.resultType === 'scorePlacement') result.placement = readValue(`${base}_p`);
  } else {
    result.value = readValue(base);
  }

  return result;
}

function hasResultValue(result) {
  return Object.entries(result).some(([key, value]) => key !== 'resultType' && String(value ?? '').trim() !== '');
}

function openRunDialog(id) {
  const training = getTraining(id);
  if (!training) return;

  $('#runContent').dataset.trainingId = id;
  $('#runTitle').textContent = training.name;
  $('#runContent').innerHTML = training.exercises.length
    ? training.exercises.map((exercise, index) => renderRunExercise(exercise, index)).join('')
    : '<p class="muted">В этой тренировке нет упражнений.</p>';
  openDialog('runModal');
}

async function completeExercise(trainingId, exerciseId, item, trigger = null) {
  const training = getTraining(trainingId);
  const exercise = getExercise(training, exerciseId);
  if (!exercise) return;

  const result = collectResult(exercise);
  const completed = $('[data-complete-check]', item).checked;
  if (!hasResultValue(result) && !completed) {
    const firstInput = $('.result-input', item);
    firstInput?.focus();
    return;
  }

  if (trigger?.dataset.busy === 'true') return;
  if (trigger) {
    trigger.dataset.busy = 'true';
    trigger.disabled = true;
    trigger.textContent = 'Сохраняю…';
  }

  try {
    if (hasResultValue(result)) {
      const saved = await createResult(exercise.id, result, state.user.id);
      exercise.history.push(saved);
      exercise.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    await setDailyCompletion(exercise.id, completed, state.user.id);

    exercise.completed = completed;
    cacheTrainings(state.trainings);
    renderTrainings($('#trainingList'), state.trainings);
    renderProgress($('#progressList'), state.trainings);
    openRunDialog(trainingId);
  } catch (error) {
    showError(error, 'Не удалось сохранить результат.', 'save-result');
    if (trigger) {
      trigger.dataset.busy = 'false';
      trigger.disabled = false;
      trigger.textContent = 'Сохранить результат';
    }
  }
}

function historyInputMarkup(exercise) {
  return resultInputMarkup(exercise, 'history');
}

function openHistoryDialog(trainingId, exerciseId, editing = false, resultId = null) {
  const training = getTraining(trainingId);
  const exercise = getExercise(training, exerciseId);
  if (!exercise) return;

  const result = editing
    ? (exercise.history || []).find(item => String(item.id) === String(resultId))
    : null;
  if (editing && !result) return;

  $('#historyTrainingId').value = trainingId;
  $('#historyExerciseId').value = exerciseId;
  $('#historyResultId').value = result?.id || '';
  $('#historyDate').value = result ? result.date.slice(0, 10) : todayKey();
  $('#historyResultFields').innerHTML = historyInputMarkup(exercise);

  if (result) {
    if (exercise.resultType === 'score' || exercise.resultType === 'scorePlacement') {
      $('#history_a').value = result.valueA ?? '';
      $('#history_b').value = result.valueB ?? '';
      if (exercise.resultType === 'scorePlacement') $('#history_p').value = result.placement ?? '';
    } else {
      $('#history').value = result.value ?? '';
    }
  }

  $('#historyModalTitle').textContent = result
    ? `Изменить результат — ${exercise.name || 'упражнение'}`
    : `Старый результат — ${exercise.name || 'упражнение'}`;
  $('#historySubmitButton').textContent = result ? 'Сохранить изменения' : 'Добавить результат';
  openDialog('historyModal');
}

async function deleteHistoryResult(trainingId, resultId) {
  const training = getTraining(trainingId);
  if (!training) return;
  const exercise = training.exercises.find(item => (item.history || []).some(result => String(result.id) === String(resultId)));
  if (!exercise) return;

  if (!window.confirm('Удалить этот результат из истории?')) return;

  try {
    await deleteResult(resultId, state.user.id);

    exercise.history = (exercise.history || []).filter(result => String(result.id) !== String(resultId));
    cacheTrainings(state.trainings);
    renderProgress($('#progressList'), state.trainings);
    openRunDialog(trainingId);
  } catch (error) {
    showError(error, 'Не удалось удалить результат.', 'delete-result');
  }
}

async function handleHistorySubmit(event) {
  event.preventDefault();
  const training = getTraining($('#historyTrainingId').value);
  const exercise = getExercise(training, $('#historyExerciseId').value);
  if (!exercise) return;

  const result = collectResult(exercise, 'history');
  if (!hasResultValue(result)) {
    $('#historyResultFields .result-input')?.focus();
    return;
  }

  const submitButton = event.submitter || $('#historySubmitButton');
  const originalLabel = submitButton?.textContent || 'Сохранить';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Сохраняю…';
  }

  try {
    const resultDate = dateToIso($('#historyDate').value);
    const resultId = $('#historyResultId').value;
    const saved = await saveResult(
      exercise.id,
      { ...result, date: resultDate },
      state.user.id,
      resultId || null
    );

    if (resultId) {
      const index = exercise.history.findIndex(item => String(item.id) === String(resultId));
      if (index !== -1) exercise.history[index] = saved;
    } else {
      exercise.history.push(saved);
    }
    exercise.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    cacheTrainings(state.trainings);
    closeDialog('historyModal');
    renderProgress($('#progressList'), state.trainings);
    openRunDialog(training.id);
  } catch (error) {
    showError(error, 'Не удалось сохранить результат истории.', 'history-result');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }
}

function openDialog(id, opener = document.activeElement) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (opener && opener instanceof HTMLElement) dialog._opener = opener;
  if (!dialog.open) {
    dialog.showModal();
    queueMicrotask(() => {
      const focusTarget = dialog.querySelector('input:not([type=hidden]), select, textarea, button');
      focusTarget?.focus();
    });
  }
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog || !dialog.open) return;
  const opener = dialog._opener;
  dialog.close();
  if (opener instanceof HTMLElement && document.contains(opener) && !opener.disabled) {
    queueMicrotask(() => opener.focus());
  }
}

async function exportLocal() {
  try {
    const source = { schemaVersion: 2, trainings: readLocalData() };
    const payload = {
      format: 'valtrain-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      source: 'supabase-cache',
      data: source
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `valtrain-backup-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    showError(error, 'Не удалось экспортировать данные.', 'export');
  }
}

function normalizeImported(data) {
  const trainings = extractTrainingsFromBackup(data);
  return trainings.map(training => ({
    ...training,
    id: uid('training'),
    exercises: (training.exercises || []).map(exercise => ({
      ...exercise,
      id: uid('ex'),
      history: Array.isArray(exercise.history) ? exercise.history : []
    }))
  }));
}

async function importLocalData() {
  const file = $('#migrationFile').files[0];
  $('#migrationError').textContent = '';
  if (!file) {
    $('#migrationError').textContent = 'Выбери JSON-файл.';
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    const trainings = normalizeImported(parsed);
    if (!trainings.length) throw new Error('В файле нет тренировок.');
    for (const training of trainings) {
      await saveTraining(training, state.user.id, trainings);
      for (const exercise of training.exercises) {
        if (!exercise.history?.length) continue;
        await createResults(exercise.history.map(result => ({
          exerciseId: exercise.id,
          date: result.date,
          value: result.value,
          valueA: result.valueA,
          valueB: result.valueB,
          placement: result.placement
        })), state.user.id);
      }
    }

    await loadData();
    closeDialog('migrationModal');
    renderTrainings($('#trainingList'), state.trainings);
    renderProgress($('#progressList'), state.trainings);
    showSuccess('Данные успешно импортированы.');
  } catch (error) {
    $('#migrationError').textContent = `Не удалось импортировать данные: ${error.message}`;
  }
}

function setView(view) {
  const isTrainings = view === 'trainings';
  const isProgress = view === 'progress';
  $('#trainingsView').hidden = !isTrainings;
  $('#progressView').hidden = !isProgress;
  $('#profileView').hidden = view !== 'profile';

  $$('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  if (isProgress) renderProgress($('#progressList'), state.trainings);
  if (view === 'profile') void renderProfile().catch(error => showError(error, 'Не удалось загрузить профиль.', 'profile'));
}

document.addEventListener('click', event => {
  const actionElement = event.target.closest('[data-action]');

  if (actionElement) {
    event.preventDefault();

    const { action, id, exerciseId } = actionElement.dataset;
    const trainingId = $('#runContent').dataset.trainingId;

    switch (action) {
      case 'create-training':
        openTrainingDialog();
        return;
      case 'run-training':
        openRunDialog(id);
        return;
      case 'edit-training':
        openTrainingDialog(id);
        return;
      case 'remove-exercise':
        state.editingExercises.splice(Number(actionElement.dataset.index), 1);
        renderExerciseEditor($('#exerciseEditor'), state.editingExercises);
        return;
      case 'save-result':
        completeExercise(trainingId, id, actionElement.closest('.run-item'), actionElement);
        return;
      case 'toggle-history': {
        const container = actionElement.closest('.run-item');
        const history = $('[data-history-for]', container);
        if (!history) return;
        const hidden = history.classList.toggle('hidden');
        actionElement.textContent = hidden ? 'Показать историю' : 'Скрыть историю';
        actionElement.setAttribute('aria-expanded', String(!hidden));
        return;
      }
      case 'add-history':
        openHistoryDialog(trainingId, id);
        return;
      case 'edit-history':
        if (exerciseId && id) {
          openHistoryDialog(trainingId, exerciseId, true, id);
        }
        return;
      case 'delete-history':
        if (id) deleteHistoryResult(trainingId, id);
        return;
      default:
        return;
    }
  }

  const closeButton = event.target.closest('[data-close-dialog]');
  if (closeButton) closeDialog(closeButton.dataset.closeDialog);
});

document.addEventListener('input', event => {
  const field = event.target.closest('[data-field]');
  if (!field) return;
  const card = field.closest('.exercise-editor');
  if (!card) return;
  state.editingExercises[Number(card.dataset.index)][field.dataset.field] = field.value;
});

document.addEventListener('change', event => {
  const field = event.target.closest('[data-field]');
  if (!field) return;
  const card = field.closest('.exercise-editor');
  if (!card) return;
  const exercise = state.editingExercises[Number(card.dataset.index)];
  const fieldName = field.dataset.field;
  exercise[fieldName] = field.value;

  if (fieldName === 'name') {
    const preset = EXERCISE_PRESET_DEFAULTS[field.value];
    if (preset) {
      exercise.resultType = preset.resultType;
      exercise.unit = preset.unit;
      renderExerciseEditor($('#exerciseEditor'), state.editingExercises);
    }
  }
});

$('#authToggle').addEventListener('click', () => setAuthMode(state.authMode === 'login' ? 'signup' : 'login'));
$('#authForm').addEventListener('submit', handleAuthSubmit);
async function handleLogout() {
  try {
    const response = await authService.signOut();
    if (response?.error) throw response.error;
  } catch (error) {
    showError(error, 'Не удалось завершить сеанс.', 'logout');
  }
}

$('#logoutButton').addEventListener('click', handleLogout);
$('#newTrainingButton').addEventListener('click', () => openTrainingDialog());
$('#pageNewTrainingButton').addEventListener('click', () => openTrainingDialog());
$('#addExerciseButton').addEventListener('click', () => addExercise());
$('#trainingForm').addEventListener('submit', handleTrainingSubmit);
$('#historyForm').addEventListener('submit', handleHistorySubmit);
$('#sensitivityForm').addEventListener('submit', handleSensitivitySubmit);
$('#exportDataButton').addEventListener('click', exportLocal);
$('#importDataOpen').addEventListener('click', () => openDialog('migrationModal'));
$('#importDataButton').addEventListener('click', importLocalData);

$$('[data-view]').forEach(button => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

$('#runModal').addEventListener('close', () => { $('#runContent').dataset.trainingId = ''; });

setAuthMode('login');
ensureAuth();
