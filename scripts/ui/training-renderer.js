import { EXERCISE_PRESETS, WEAPONS, RESULT_TYPES } from '../core/constants.js';
import { escapeHtml, formatDate } from '../core/utils.js';
import { isDeathmatchExercise, resultLabel } from '../core/result-metrics.js';

export function renderTrainings(root, trainings) {
  if (!trainings.length) {
    root.innerHTML = `
      <section class="empty">
        <h2>Тренировок пока нет</h2>
        <p>Создай первую тренировку и добавь в неё упражнения.</p>
        <button class="button button--primary" type="button" data-action="create-training">+ Создать тренировку</button>
      </section>`;
    return;
  }

  root.innerHTML = trainings.map(training => {
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
        <div class="training-card__progress-head">
          <span class="training-card__progress-label">Выполнение</span>
          <strong class="training-card__progress-value">${completed}/${total}</strong>
        </div>
        <div class="progress-bar">
          <progress value="${progress}" max="100" aria-label="Прогресс тренировки: ${progress}%">
            ${progress}%
          </progress>
        </div>
        <footer class="card-actions">
          <button class="button button--primary" type="button" data-action="run-training" data-id="${escapeHtml(training.id)}">Открыть</button>
          <button class="button" type="button" data-action="edit-training" data-id="${escapeHtml(training.id)}">Изменить</button>
        </footer>
      </article>`;
  }).join('');
}

function optionList(options, current = '') {
  const values = [...options];
  if (current && !values.includes(current)) values.push(current);
  return `<option value="">Выбрать...</option>${values.map(value =>
    `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(value)}</option>`
  ).join('')}`;
}

export function renderExerciseEditor(root, exercises) {
  root.innerHTML = exercises.map((exercise, index) => `
    <fieldset class="exercise-editor" data-index="${index}">
      <legend class="sr-only">Упражнение ${index + 1}</legend>
      <header class="exercise-editor__head">
        <h4 aria-hidden="true">Упражнение ${index + 1}</h4>
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
    </fieldset>`).join('');
}

export function resultInputMarkup(exercise, prefix = 'result') {
  const id = `${prefix}_${exercise.id}`;
  const safeId = escapeHtml(id);
  const common = 'class="result-input"';

  if (['score', 'scorePlacement'].includes(exercise.resultType)) {
    const isDm = isDeathmatchExercise(exercise);
    const firstLabel = isDm ? 'Убийства' : 'Результат A';
    const secondLabel = isDm ? 'Смерти' : 'Результат B';
    return `
      <div class="result-field">
        <label class="sr-only" for="${safeId}_a">${escapeHtml(firstLabel)}</label>
        <input ${common} type="number" step="any" min="0" id="${safeId}_a" placeholder="${escapeHtml(firstLabel)}">
      </div>
      <div class="result-field">
        <label class="sr-only" for="${safeId}_b">${escapeHtml(secondLabel)}</label>
        <input ${common} type="number" step="any" min="0" id="${safeId}_b" placeholder="${escapeHtml(secondLabel)}">
      </div>
      ${exercise.resultType === 'scorePlacement'
        ? `<div class="result-field"><label class="sr-only" for="${safeId}_p">Место</label><input ${common} type="number" min="1" step="1" id="${safeId}_p" placeholder="Место"></div>`
        : ''}`;
  }

  if (exercise.resultType === 'text') {
    return `<div class="result-field"><label class="sr-only" for="${safeId}">Результат</label><input ${common} type="text" id="${safeId}" placeholder="Результат"></div>`;
  }

  const placeholder = exercise.resultType === 'time' ? 'Секунды'
    : exercise.resultType === 'placement' ? 'Место' : 'Количество';
  const minimum = exercise.resultType === 'placement' ? 'min="1"' : '';
  return `<div class="result-field"><label class="sr-only" for="${safeId}">${escapeHtml(placeholder)}</label><input ${common} type="number" step="any" ${minimum} id="${safeId}" placeholder="${escapeHtml(placeholder)}"></div>`;
}

export function renderRunExercise(exercise, index) {
  const latest = [...(exercise.history || [])].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const historyMarkup = latest ? `
    <section class="history hidden" data-history-for="${escapeHtml(exercise.id)}" aria-label="История ${escapeHtml(exercise.name)}">
      ${[...(exercise.history || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).map(result => `
        <div class="history-row">
          <time datetime="${escapeHtml(result.date)}">${formatDate(result.date)}</time>
          <strong>${escapeHtml(resultLabel(exercise, result))}</strong>
          <span class="history-row__actions">
            <button class="text-button" type="button" data-action="edit-history" data-id="${escapeHtml(result.id)}" data-result-id="${escapeHtml(result.id)}" data-exercise-id="${escapeHtml(exercise.id)}">Изменить</button>
            <button class="text-button text-button--danger" type="button" data-action="delete-history" data-id="${escapeHtml(result.id)}" data-result-id="${escapeHtml(result.id)}" data-exercise-id="${escapeHtml(exercise.id)}">Удалить</button>
          </span>
        </div>`).join('')}
    </section>` : '';

  return `
    <article class="run-item ${exercise.completed ? 'is-done' : ''}" data-exercise-id="${escapeHtml(exercise.id)}">
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
        ${latest ? `<button class="button button--ghost" type="button" data-action="toggle-history" data-id="${escapeHtml(exercise.id)}" aria-expanded="false">Показать историю</button>` : ''}
        <button class="button button--ghost" type="button" data-action="add-history" data-id="${escapeHtml(exercise.id)}">+ Старый результат</button>
        <button class="button button--primary" type="button" data-action="save-result" data-id="${escapeHtml(exercise.id)}">Сохранить результат</button>
      </footer>
      ${historyMarkup}
    </article>`;
}
