import { formatDate, escapeHtml } from '../core/utils.js';
import { normalizeExerciseForMetrics, progressCategory, progressGroupKey, resultLabel, progressMetric, formatProgressMetric, getProgressBest, buildProgressChart, isNumericProgressType } from '../core/result-metrics.js';

export function renderProgress(root, trainings) {
  const groups = new Map();

  for (const training of trainings) {
    for (const rawExercise of training.exercises) {
      if (!rawExercise.history?.length) continue;
      const exercise = normalizeExerciseForMetrics(rawExercise);
      const category = progressCategory(exercise);
      if (!category) continue;
      const key = progressGroupKey(exercise);
      if (!groups.has(key)) {
        groups.set(key, {
          name: exercise.name || 'Упражнение',
          weapon: exercise.weapon || '',
          types: new Set(),
          records: [],
          category
        });
      }
      const group = groups.get(key);
      group.types.add(exercise.resultType);
      for (const result of exercise.history) {
        group.records.push({ result, exercise, trainingName: training.name });
      }
    }
  }

  const withHistory = [...groups.values()]
    .filter(group => group.records.length)
    .sort((a, b) => (a.category.order - b.category.order)
      || a.name.localeCompare(b.name, 'ru')
      || a.weapon.localeCompare(b.weapon, 'ru'));
  if (!withHistory.length) {
    root.innerHTML = `
      <section class="empty">
        <h2>Истории пока нет</h2>
        <p>Выполни хотя бы одно упражнение — результаты появятся здесь.</p>
      </section>`;
    return;
  }

  root.innerHTML = withHistory.map(group => {
    const sorted = [...group.records].sort((a, b) => new Date(b.result.date) - new Date(a.result.date));
    const singleType = group.types.size === 1;
    const exercise = group.records[0].exercise;
    const numericType = singleType && isNumericProgressType(exercise);
    const best = numericType ? getProgressBest(group.records, exercise) : null;
    const numericValues = numericType
      ? group.records.map(record => progressMetric(exercise, record.result)).filter(value => value !== null)
      : [];
    const averageValues = numericValues;
    const average = averageValues.length
      ? averageValues.reduce((sum, value) => sum + value, 0) / averageValues.length
      : null;

    return `
      <article class="progress-card">
        <header class="progress-card__head">
          <div>
            <p class="eyebrow">${escapeHtml(group.category.label)} · ${group.records.length} результатов</p>
            <h2>${escapeHtml(group.name)}</h2>
            <p class="muted">${escapeHtml(group.weapon || 'Без оружия')}</p>
          </div>
          <p class="best">${best ? `Лучший: ${escapeHtml(resultLabel(exercise, best.record.result))}` : (singleType ? 'Нет числовой метрики' : 'Разные типы результата')}</p>
        </header>

        <dl class="progress-stats" aria-label="Сводка статистики">
          <div><dt>Попыток</dt><dd>${group.records.length}</dd></div>
          <div><dt>Средний</dt><dd>${average !== null ? escapeHtml(formatProgressMetric(exercise, average)) : '—'}</dd></div>
          <div><dt>Последний</dt><dd>${escapeHtml(resultLabel(sorted[0].exercise, sorted[0].result))}</dd></div>
        </dl>

        ${numericType ? buildProgressChart(exercise, group.records) : (singleType ? '<p class="chart-empty">Для текстового результата график не строится.</p>' : '<p class="chart-empty">Для этого упражнения сохранены разные типы результата, поэтому общий график не строится.</p>')}

        <details class="progress-history">
          <summary>История результатов</summary>
          <ul class="history" aria-label="История результатов">
            ${sorted.map(record => `
              <li class="history-row">
                <time datetime="${escapeHtml(record.result.date)}">${formatDate(record.result.date)}</time>
                <strong>${escapeHtml(resultLabel(record.exercise, record.result))}</strong>
                <span class="muted">${escapeHtml(record.trainingName)}</span>
              </li>`).join('')}
          </ul>
        </details>
      </article>`;
  }).join('');
}
