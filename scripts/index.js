'use strict';

const STORAGE_KEY = 'valtrain_data_v1';
const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);

const state = {
  trainings: [],
  editingExercises: [],
  user: null,
  authMode: 'login'
};

const EXERCISE_PRESETS = [
  '50 ботов', '30 ботов', '20 ботов', '10 ботов', 'Флики', 'Трекинг',
  'Спидклик', 'Точность', 'Стрельба по ботам', 'Deathmatch',
  'Counter-strafe', 'Movement', 'Разминка', 'Другое'
];

const WEAPONS = [
  'Без оружия', 'Classic', 'Shorty', 'Frenzy', 'Ghost', 'Sheriff',
  'Stinger', 'Spectre', 'Bucky', 'Judge', 'Bulldog', 'Guardian',
  'Phantom', 'Vandal', 'Marshal', 'Outlaw', 'Operator', 'Ares', 'Odin'
];

const RESULT_TYPES = [
  ['time', 'Время'],
  ['count', 'Количество'],
  ['score', 'Счёт A / B'],
  ['placement', 'Место'],
  ['scorePlacement', 'Счёт + место'],
  ['text', 'Текст']
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

function todayKey() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function dateToIso(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toISOString();
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(new Date(value));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[character]);
}

function readLocalData() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function cacheData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trainings));
}

function getTraining(id) {
  return state.trainings.find(training => training.id === id);
}

function getExercise(training, id) {
  return training?.exercises.find(exercise => exercise.id === id);
}

function resultLabel(exercise, result) {
  if (!result) return '—';
  switch (exercise.resultType) {
    case 'time': return `${result.value} сек`;
    case 'count': return String(result.value ?? '');
    case 'score': return `${result.valueA} / ${result.valueB}`;
    case 'placement': return `${result.value} место`;
    case 'scorePlacement': return `${result.valueA} / ${result.valueB}, ${result.placement} место`;
    default: return result.value || 'Выполнено';
  }
}

function getBest(exercise) {
  const history = exercise.history || [];
  if (!history.length) return null;

  if (['time', 'placement'].includes(exercise.resultType)) {
    return history.reduce((best, item) => Number(item.value) < Number(best.value) ? item : best);
  }
  if (exercise.resultType === 'count') {
    return history.reduce((best, item) => Number(item.value) > Number(best.value) ? item : best);
  }
  if (exercise.resultType === 'score') {
    return history.reduce((best, item) =>
      Number(item.valueA) + Number(item.valueB) > Number(best.valueA) + Number(best.valueB) ? item : best
    );
  }
  if (exercise.resultType === 'scorePlacement') {
    return history.reduce((best, item) => Number(item.valueA) > Number(best.valueA) ? item : best);
  }
  return history.at(-1);
}

async function loadCloud() {
  const { data: trainings, error: trainingError } = await supabaseClient
    .from('trainings')
    .select('*')
    .order('sort_order');
  if (trainingError) throw trainingError;

  const trainingIds = (trainings || []).map(training => training.id);
  let exercises = [];
  let results = [];
  let completions = [];

  if (trainingIds.length) {
    const exerciseResponse = await supabaseClient
      .from('exercises')
      .select('*')
      .in('training_id', trainingIds)
      .order('sort_order');
    if (exerciseResponse.error) throw exerciseResponse.error;
    exercises = exerciseResponse.data || [];

    const exerciseIds = exercises.map(exercise => exercise.id);
    if (exerciseIds.length) {
      const resultResponse = await supabaseClient
        .from('results')
        .select('*')
        .in('exercise_id', exerciseIds)
        .order('result_date');
      if (resultResponse.error) throw resultResponse.error;
      results = resultResponse.data || [];
    }

    const completionResponse = await supabaseClient
      .from('daily_completions')
      .select('*')
      .eq('completion_date', todayKey())
      .eq('user_id', state.user.id);
    if (completionResponse.error) throw completionResponse.error;
    completions = completionResponse.data || [];
  }

  state.trainings = (trainings || []).map(training => ({
    id: training.id,
    name: training.name,
    description: training.description || '',
    exercises: exercises
      .filter(exercise => exercise.training_id === training.id)
      .map(exercise => ({
        id: exercise.id,
        name: exercise.name,
        weapon: exercise.weapon || '',
        resultType: exercise.result_type,
        unit: exercise.unit || 'сек',
        goal: exercise.goal || '',
        completed: completions.some(item => item.exercise_id === exercise.id),
        history: results
          .filter(result => result.exercise_id === exercise.id)
          .map(result => ({
            id: result.id,
            date: result.result_date,
            value: result.value,
            valueA: result.value_a,
            valueB: result.value_b,
            placement: result.placement
          }))
      }))
  }));

  cacheData();
}

async function ensureAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    state.user = session.user;
    await enterApp();
  }

  supabaseClient.auth.onAuthStateChange(async (_event, sessionState) => {
    if (sessionState) {
      state.user = sessionState.user;
      await enterApp();
      return;
    }

    state.user = null;
    $('#app').classList.add('hidden');
    $('#authScreen').classList.remove('hidden');
  });
}

async function enterApp() {
  $('#authScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#accountEmail').textContent = state.user.email || '';

  try {
    await loadCloud();
    renderTrainings();
    renderProgress();
  } catch (error) {
    console.error(error);
    alert('Не удалось загрузить данные из Supabase. Проверь SQL и ключи проекта.');
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
  $('#authError').textContent = '';

  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  const response = state.authMode === 'login'
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({ email, password });

  if (response.error) {
    $('#authError').textContent = response.error.message;
    return;
  }

  if (state.authMode === 'signup' && !response.data.session) {
    $('#authError').textContent = 'Аккаунт создан. Проверь почту для подтверждения, затем войди.';
  }
}

function renderTrainings() {
  const root = $('#trainingList');

  if (!state.trainings.length) {
    root.innerHTML = `
      <article class="empty">
        <h2>Тренировок пока нет</h2>
        <p>Создай первую тренировку и добавь в неё упражнения.</p>
        <button class="button button--primary" type="button" data-action="create-training">+ Создать тренировку</button>
      </article>`;
    return;
  }

  root.innerHTML = state.trainings.map(training => {
    const total = training.exercises.length;
    const completed = training.exercises.filter(exercise => exercise.completed).length;
    const progress = total ? Math.round(completed / total * 100) : 0;

    return `
      <article class="training-card">
        <header class="training-card__top">
          <div>
            <h2>${escapeHtml(training.name)}</h2>
            <p class="training-card__meta">${total} упражнений</p>
          </div>
          <strong aria-label="Прогресс ${progress} процентов">${progress}%</strong>
        </header>
        <p class="muted">${escapeHtml(training.description || 'Без описания')}</p>
        <div class="progress-bar" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Прогресс тренировки">
          <span style="width:${progress}%"></span>
        </div>
        <footer class="card-actions">
          <button class="button button--primary" type="button" data-action="run-training" data-id="${training.id}">Открыть</button>
          <button class="button" type="button" data-action="edit-training" data-id="${training.id}">Изменить</button>
        </footer>
      </article>`;
  }).join('');
}

function renderProgress() {
  const root = $('#progressList');
  const exercises = state.trainings.flatMap(training =>
    training.exercises.map(exercise => ({ ...exercise, trainingName: training.name }))
  );
  const withHistory = exercises.filter(exercise => exercise.history?.length);

  if (!withHistory.length) {
    root.innerHTML = `
      <article class="empty">
        <h2>Истории пока нет</h2>
        <p>Выполни хотя бы одно упражнение — результаты появятся здесь.</p>
      </article>`;
    return;
  }

  root.innerHTML = withHistory.map(exercise => {
    const sorted = [...exercise.history].sort((a, b) => new Date(b.date) - new Date(a.date));
    return `
      <article class="progress-card">
        <header class="progress-card__head">
          <div>
            <p class="eyebrow">${escapeHtml(exercise.trainingName)}</p>
            <h2>${escapeHtml(exercise.name)}</h2>
            <p class="muted">${escapeHtml(exercise.weapon || '')}</p>
          </div>
          <p class="best">Лучший: ${escapeHtml(resultLabel(exercise, getBest(exercise)))}</p>
        </header>
        <div class="history" aria-label="История результатов">
          ${sorted.map(result => `
            <div class="history-row">
              <time datetime="${escapeHtml(result.date)}">${formatDate(result.date)}</time>
              <strong>${escapeHtml(resultLabel(exercise, result))}</strong>
            </div>`).join('')}
        </div>
      </article>`;
  }).join('');
}

function openTrainingDialog(id = null) {
  const training = getTraining(id);
  $('#trainingId').value = id || '';
  $('#trainingName').value = training?.name || '';
  $('#trainingDescription').value = training?.description || '';
  state.editingExercises = training ? structuredClone(training.exercises) : [];

  if (!state.editingExercises.length) addExercise(false);
  else renderExerciseEditor();

  $('#modalTitle').textContent = training ? 'Изменить тренировку' : 'Новая тренировка';
  openDialog('trainingModal');
}

function addExercise(render = true) {
  state.editingExercises.push({
    id: uid('ex'), name: '', weapon: '', resultType: 'time', unit: 'сек', goal: '', history: [], completed: false
  });
  if (render) renderExerciseEditor();
}

function optionList(options, current = '') {
  const values = [...options];
  if (current && !values.includes(current)) values.push(current);
  return `<option value="">Выбрать...</option>${values.map(value =>
    `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(value)}</option>`
  ).join('')}`;
}

function renderExerciseEditor() {
  $('#exerciseEditor').innerHTML = state.editingExercises.map((exercise, index) => `
    <article class="exercise-editor" data-index="${index}">
      <header class="exercise-editor__head">
        <h4>Упражнение ${index + 1}</h4>
        <button class="remove-exercise" type="button" data-action="remove-exercise" data-index="${index}">Удалить</button>
      </header>
      <div class="exercise-editor__grid">
        <div class="form-field">
          <label for="exercise-name-${index}">Название</label>
          <select id="exercise-name-${index}" data-field="name">${optionList(EXERCISE_PRESETS, exercise.name)}</select>
        </div>
        <div class="form-field">
          <label for="exercise-weapon-${index}">Оружие</label>
          <select id="exercise-weapon-${index}" data-field="weapon">${optionList(WEAPONS, exercise.weapon)}</select>
        </div>
        <div class="form-field">
          <label for="exercise-result-${index}">Тип результата</label>
          <select id="exercise-result-${index}" data-field="resultType">
            ${RESULT_TYPES.map(([value, label]) => `<option value="${value}" ${exercise.resultType === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="exercise-goal-${index}">Цель / условие</label>
          <input id="exercise-goal-${index}" data-field="goal" value="${escapeHtml(exercise.goal)}" placeholder="50 ботов">
        </div>
      </div>
    </article>`).join('');
}

async function saveTrainingCloud(training) {
  const sortOrder = state.trainings.findIndex(item => item.id === training.id);
  const trainingRow = {
    id: training.id,
    user_id: state.user.id,
    name: training.name,
    description: training.description,
    sort_order: sortOrder < 0 ? state.trainings.length : sortOrder,
    updated_at: new Date().toISOString()
  };

  let response = await supabaseClient.from('trainings').upsert(trainingRow);
  if (response.error) throw response.error;

  const existingResponse = await supabaseClient
    .from('exercises').select('id').eq('training_id', training.id);
  if (existingResponse.error) throw existingResponse.error;

  const wantedIds = training.exercises.map(exercise => exercise.id);
  const removedIds = (existingResponse.data || [])
    .map(item => item.id)
    .filter(id => !wantedIds.includes(id));

  if (removedIds.length) {
    response = await supabaseClient.from('exercises').delete().in('id', removedIds);
    if (response.error) throw response.error;
  }

  if (training.exercises.length) {
    response = await supabaseClient.from('exercises').upsert(
      training.exercises.map((exercise, index) => ({
        id: exercise.id,
        training_id: training.id,
        user_id: state.user.id,
        name: exercise.name,
        weapon: exercise.weapon,
        result_type: exercise.resultType,
        unit: exercise.unit || 'сек',
        goal: exercise.goal || '',
        sort_order: index,
        updated_at: new Date().toISOString()
      }))
    );
    if (response.error) throw response.error;
  }
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

  try {
    if (existing) Object.assign(existing, training);
    else state.trainings.push(training);

    await saveTrainingCloud(training);
    cacheData();
    closeDialog('trainingModal');
    renderTrainings();
    renderProgress();
  } catch (error) {
    console.error(error);
    alert('Не удалось сохранить тренировку.');
  }
}

function resultInputMarkup(exercise, prefix = 'result') {
  const id = `${prefix}_${exercise.id}`;
  const common = 'class="result-input"';

  if (['score', 'scorePlacement'].includes(exercise.resultType)) {
    return `
      <input ${common} type="number" step="any" id="${id}_a" placeholder="Результат A" aria-label="Результат A">
      <input ${common} type="number" step="any" id="${id}_b" placeholder="Результат B" aria-label="Результат B">
      ${exercise.resultType === 'scorePlacement'
        ? `<input ${common} type="number" min="1" step="1" id="${id}_p" placeholder="Место" aria-label="Место">`
        : ''}`;
  }

  if (exercise.resultType === 'text') {
    return `<input ${common} type="text" id="${id}" placeholder="Результат" aria-label="Результат">`;
  }

  const placeholder = exercise.resultType === 'time' ? 'Секунды'
    : exercise.resultType === 'placement' ? 'Место' : 'Количество';
  const minimum = exercise.resultType === 'placement' ? 'min="1"' : '';
  return `<input ${common} type="number" step="any" ${minimum} id="${id}" placeholder="${placeholder}" aria-label="${placeholder}">`;
}

function collectResult(exercise, prefix = 'result') {
  const result = {};
  const base = `${prefix}_${exercise.id}`;

  if (['score', 'scorePlacement'].includes(exercise.resultType)) {
    result.valueA = $(`#${base}_a`).value.trim();
    result.valueB = $(`#${base}_b`).value.trim();
    if (exercise.resultType === 'scorePlacement') result.placement = $(`#${base}_p`).value.trim();
  } else {
    result.value = $(`#${base}`).value.trim();
  }

  return result;
}

function hasResultValue(result) {
  return Object.values(result).some(value => String(value ?? '').trim() !== '');
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

function renderRunExercise(exercise, index) {
  const latest = [...(exercise.history || [])].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const historyMarkup = latest ? `
    <section class="history hidden" data-history-for="${exercise.id}" aria-label="История ${escapeHtml(exercise.name)}">
      ${[...(exercise.history || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map(result => `
        <div class="history-row">
          <time datetime="${escapeHtml(result.date)}">${formatDate(result.date)}</time>
          <strong>${escapeHtml(resultLabel(exercise, result))}</strong>
          <span class="history-row__actions">
            <button class="text-button" type="button" data-action="edit-history" data-id="${result.id}" data-result-id="${result.id}" data-exercise-id="${exercise.id}">Изменить</button>
            <button class="text-button text-button--danger" type="button" data-action="delete-history" data-id="${result.id}" data-result-id="${result.id}" data-exercise-id="${exercise.id}">Удалить</button>
          </span>
        </div>`).join('')}
    </section>` : '';

  return `
    <article class="run-item ${exercise.completed ? 'is-done' : ''}" data-exercise-id="${exercise.id}">
      <header class="run-item__head">
        <div>
          <h3>${index + 1}. ${escapeHtml(exercise.name || 'Упражнение')}</h3>
          <p class="run-item__meta">${escapeHtml(exercise.weapon || '')}${exercise.goal ? ` · Цель: ${escapeHtml(exercise.goal)}` : ''}</p>
        </div>
        ${exercise.completed ? '<strong class="best">✓ Выполнено</strong>' : ''}
      </header>
      <fieldset>
        <legend class="sr-only">Результат упражнения</legend>
        <div class="result-fields">${resultInputMarkup(exercise)}</div>
      </fieldset>
      <label class="check-row">
        <input type="checkbox" data-complete-check ${exercise.completed ? 'checked' : ''}>
        <span>Отметить выполненным</span>
      </label>
      <footer class="run-item__actions">
        ${latest ? `<button class="button button--ghost" type="button" data-action="toggle-history" data-id="${exercise.id}" aria-expanded="false">Показать историю</button>` : ''}
        <button class="button button--ghost" type="button" data-action="add-history" data-id="${exercise.id}">+ Старый результат</button>
        <button class="button button--primary" type="button" data-action="save-result" data-id="${exercise.id}">Сохранить результат</button>
      </footer>
      ${historyMarkup}
    </article>`;
}

async function completeExercise(trainingId, exerciseId, item) {
  const training = getTraining(trainingId);
  const exercise = getExercise(training, exerciseId);
  if (!exercise) return;

  const result = collectResult(exercise);
  const completed = $('[data-complete-check]', item).checked;
  if (!hasResultValue(result) && !completed) return;

  try {
    if (hasResultValue(result)) {
      const response = await supabaseClient.from('results').insert({
        exercise_id: exercise.id,
        user_id: state.user.id,
        result_date: new Date().toISOString(),
        value: result.value || null,
        value_a: result.valueA || null,
        value_b: result.valueB || null,
        placement: result.placement || null
      }).select().single();
      if (response.error) throw response.error;

      exercise.history.push({
        id: response.data.id,
        date: response.data.result_date,
        value: response.data.value,
        valueA: response.data.value_a,
        valueB: response.data.value_b,
        placement: response.data.placement
      });
      exercise.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    const completionPayload = {
      exercise_id: exercise.id,
      user_id: state.user.id,
      completion_date: todayKey()
    };

    const response = completed
      ? await supabaseClient.from('daily_completions').upsert(completionPayload, { onConflict: 'exercise_id,completion_date' })
      : await supabaseClient.from('daily_completions').delete()
        .eq('exercise_id', exercise.id)
        .eq('completion_date', todayKey());
    if (response.error) throw response.error;

    exercise.completed = completed;
    cacheData();
    renderTrainings();
    renderProgress();
    openRunDialog(trainingId);
  } catch (error) {
    console.error(error);
    alert('Не удалось сохранить результат.');
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
    const response = await supabaseClient.from('results').delete().eq('id', resultId).eq('user_id', state.user.id);
    if (response.error) throw response.error;

    exercise.history = (exercise.history || []).filter(result => String(result.id) !== String(resultId));
    cacheData();
    renderProgress();
    openRunDialog(trainingId);
  } catch (error) {
    console.error(error);
    alert('Не удалось удалить результат.');
  }
}

async function handleHistorySubmit(event) {
  event.preventDefault();
  const training = getTraining($('#historyTrainingId').value);
  const exercise = getExercise(training, $('#historyExerciseId').value);
  if (!exercise) return;

  const result = collectResult(exercise, 'history');
  if (!hasResultValue(result)) return;

  try {
    const resultDate = dateToIso($('#historyDate').value);
    const resultId = $('#historyResultId').value;
    const payload = {
      exercise_id: exercise.id,
      user_id: state.user.id,
      result_date: resultDate,
      value: result.value || null,
      value_a: result.valueA || null,
      value_b: result.valueB || null,
      placement: result.placement || null
    };

    let response;
    if (resultId) {
      response = await supabaseClient.from('results').update(payload).eq('id', resultId).eq('user_id', state.user.id).select().single();
    } else {
      response = await supabaseClient.from('results').insert(payload).select().single();
    }
    if (response.error) throw response.error;

    const saved = {
      id: response.data.id,
      date: response.data.result_date,
      value: response.data.value,
      valueA: response.data.value_a,
      valueB: response.data.value_b,
      placement: response.data.placement
    };

    if (resultId) {
      const index = exercise.history.findIndex(item => String(item.id) === String(resultId));
      if (index !== -1) exercise.history[index] = saved;
    } else {
      exercise.history.push(saved);
    }
    exercise.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    cacheData();
    closeDialog('historyModal');
    renderProgress();
    openRunDialog(training.id);
  } catch (error) {
    console.error(error);
    alert('Не удалось добавить старый результат.');
  }
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog.open) dialog.showModal();
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog.open) dialog.close();
}

function exportLocal() {
  const blob = new Blob([JSON.stringify(readLocalData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `valtrain-backup-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeImported(data) {
  const trainings = Array.isArray(data) ? data : [];
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
    const parsed = normalizeImported(JSON.parse(await file.text()));
    if (!parsed.length) throw new Error('В файле нет тренировок.');

    for (const training of parsed) {
      await saveTrainingCloud(training);
      for (const exercise of training.exercises) {
        if (!exercise.history?.length) continue;
        const rows = exercise.history.map(result => ({
          exercise_id: exercise.id,
          user_id: state.user.id,
          result_date: result.date || new Date().toISOString(),
          value: result.value || null,
          value_a: result.valueA || null,
          value_b: result.valueB || null,
          placement: result.placement || null
        }));
        const response = await supabaseClient.from('results').insert(rows);
        if (response.error) throw response.error;
      }
    }

    await loadCloud();
    closeDialog('migrationModal');
    renderTrainings();
    renderProgress();
    alert('Данные успешно импортированы.');
  } catch (error) {
    console.error(error);
    $('#migrationError').textContent = `Не удалось импортировать данные: ${error.message}`;
  }
}

function setView(view) {
  const isTrainings = view === 'trainings';
  $('#trainingsView').classList.toggle('hidden', !isTrainings);
  $('#progressView').classList.toggle('hidden', isTrainings);

  $$('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  if (!isTrainings) renderProgress();
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
        renderExerciseEditor();
        return;
      case 'save-result':
        completeExercise(trainingId, id, actionElement.closest('.run-item'));
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
  state.editingExercises[Number(card.dataset.index)][field.dataset.field] = field.value;
});

$('#authToggle').addEventListener('click', () => setAuthMode(state.authMode === 'login' ? 'signup' : 'login'));
$('#authForm').addEventListener('submit', handleAuthSubmit);
$('#logoutButton').addEventListener('click', () => supabaseClient.auth.signOut());
$('#newTrainingButton').addEventListener('click', () => openTrainingDialog());
$('#addExerciseButton').addEventListener('click', () => addExercise());
$('#trainingForm').addEventListener('submit', handleTrainingSubmit);
$('#historyForm').addEventListener('submit', handleHistorySubmit);
$('#exportDataButton').addEventListener('click', exportLocal);
$('#importDataOpen').addEventListener('click', () => openDialog('migrationModal'));
$('#importDataButton').addEventListener('click', importLocalData);

$$('[data-view]').forEach(button => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

$('#runModal').addEventListener('close', () => { $('#runContent').dataset.trainingId = ''; });

setAuthMode('login');
ensureAuth();
