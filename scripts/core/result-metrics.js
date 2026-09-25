import { formatDate, escapeHtml } from './utils.js';

const NUMERIC_RESULT_TYPES = new Set(['time', 'count', 'placement', 'score', 'scorePlacement']);
const K_D_RESULT_TYPES = new Set(['score', 'scorePlacement']);
const LOWER_IS_BETTER_TYPES = new Set(['time', 'placement']);
const LEGACY_EXERCISE_ALIASES = new Map([
  ['30 ботов', { name: 'Speed — Hard', resultType: 'count', unit: 'ботов' }],
  ['50 ботов', { name: 'Streak — Eliminate 50', resultType: 'time', unit: 'сек' }]
]);

export function normalizeExerciseForMetrics(exercise = {}) {
  const name = String(exercise?.name || '').trim();
  const alias = LEGACY_EXERCISE_ALIASES.get(name);
  return alias ? { ...exercise, ...alias } : exercise;
}

export function isDeathmatchExercise(exercise) {
  const name = String(exercise?.name || '').trim().toLocaleLowerCase('ru-RU');
  return name === 'deathmatch' || name === 'дезматч' || name === 'dm'
    || name.includes('deathmatch') || name.includes('дезматч');
}

export function kdValue(result) {
  const kills = Number(result?.valueA);
  const deaths = Number(result?.valueB);
  if (!Number.isFinite(kills) || !Number.isFinite(deaths) || deaths <= 0) return null;
  return kills / deaths;
}

export function resultLabel(exercise, result) {
  if (!result) return '—';

  if (isDeathmatchExercise(exercise) && K_D_RESULT_TYPES.has(exercise.resultType)) {
    const kd = kdValue(result);
    const kdLabel = kd === null ? 'K/D —' : `K/D ${kd.toFixed(2)}`;
    const base = `${result.valueA} / ${result.valueB}`;
    return exercise.resultType === 'scorePlacement'
      ? `${base}, ${result.placement} место · ${kdLabel}`
      : `${base} · ${kdLabel}`;
  }

  switch (exercise.resultType) {
    case 'time': return `${result.value} сек`;
    case 'count': return String(result.value ?? '');
    case 'score': return `${result.valueA} / ${result.valueB}`;
    case 'placement': return `${result.value} место`;
    case 'scorePlacement': return `${result.valueA} / ${result.valueB}, ${result.placement} место`;
    default: return result.value || 'Выполнено';
  }
}

function numericBest(history, metric) {
  const numeric = history.filter(item => metric(item) !== null);
  if (!numeric.length) return null;
  return numeric.reduce((best, item) => metric(item) > metric(best) ? item : best);
}

export function getBestResult(exercise) {
  const history = exercise?.history || [];
  if (!history.length) return null;

  if (LOWER_IS_BETTER_TYPES.has(exercise.resultType)) {
    const numeric = history.filter(item => Number.isFinite(Number(item.value)));
    return numeric.length
      ? numeric.reduce((best, item) => Number(item.value) < Number(best.value) ? item : best)
      : history.at(-1);
  }

  if (exercise.resultType === 'count') {
    const numeric = history.filter(item => Number.isFinite(Number(item.value)));
    return numeric.length
      ? numeric.reduce((best, item) => Number(item.value) > Number(best.value) ? item : best)
      : history.at(-1);
  }

  if (K_D_RESULT_TYPES.has(exercise.resultType)) {
    if (isDeathmatchExercise(exercise)) return numericBest(history, kdValue) || history.at(-1);

    const numeric = history.filter(item => Number.isFinite(Number(item.valueA)));
    if (!numeric.length) return history.at(-1);
    return exercise.resultType === 'score'
      ? numeric.reduce((best, item) => Number(item.valueA) + Number(item.valueB) > Number(best.valueA) + Number(best.valueB) ? item : best)
      : numeric.reduce((best, item) => Number(item.valueA) > Number(best.valueA) ? item : best);
  }

  return history.at(-1);
}

export function progressCategory(exercise) {
  const normalized = normalizeExerciseForMetrics(exercise);
  const name = String(normalized?.name || '').trim().toLocaleLowerCase('ru-RU');

  if (name.startsWith('streak — eliminate')) return { key: 'eliminate', label: 'Eliminate', order: 0 };
  if (name.startsWith('speed —')) return { key: 'speed', label: 'Speed', order: 1 };
  if (isDeathmatchExercise(normalized)) return { key: 'deathmatch', label: 'Deathmatch', order: 2 };
  return null;
}

export function progressGroupKey(exercise) {
  const normalized = normalizeExerciseForMetrics(exercise);
  const name = String(normalized?.name || '').trim().toLocaleLowerCase('ru-RU');
  const weapon = String(normalized?.weapon || '').trim().toLocaleLowerCase('ru-RU');
  const resultType = String(normalized?.resultType || '').trim();
  return `${name}::${weapon}::${resultType}`;
}

export function progressMetric(exercise, result) {
  if (!result) return null;

  if (LOWER_IS_BETTER_TYPES.has(exercise.resultType) || exercise.resultType === 'count') {
    const value = Number(result.value);
    return Number.isFinite(value) ? value : null;
  }

  if (K_D_RESULT_TYPES.has(exercise.resultType)) {
    return isDeathmatchExercise(exercise)
      ? kdValue(result)
      : (Number.isFinite(Number(result.valueA)) ? Number(result.valueA) : null);
  }

  return null;
}

export function progressMetricLabel(exercise) {
  switch (exercise.resultType) {
    case 'time': return 'Время, сек';
    case 'count': return 'Количество';
    case 'placement': return 'Место';
    case 'score':
    case 'scorePlacement': return isDeathmatchExercise(exercise) ? 'K/D' : 'Первая часть счёта';
    default: return '';
  }
}

export function formatProgressMetric(exercise, value) {
  if (!Number.isFinite(value)) return '—';
  if (exercise.resultType === 'time') return `${value} сек`;
  if (exercise.resultType === 'placement') return `${value} место`;
  if (isDeathmatchExercise(exercise) && K_D_RESULT_TYPES.has(exercise.resultType)) return value.toFixed(2);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getProgressBest(records, exercise) {
  const numeric = records
    .map(record => ({ record, value: progressMetric(exercise, record.result) }))
    .filter(item => item.value !== null);
  if (!numeric.length) return null;

  const lowerIsBetter = LOWER_IS_BETTER_TYPES.has(exercise.resultType);
  return numeric.reduce((best, item) => lowerIsBetter
    ? (item.value < best.value ? item : best)
    : (item.value > best.value ? item : best)
  );
}

export function isNumericProgressType(exercise) {
  return NUMERIC_RESULT_TYPES.has(exercise?.resultType);
}

export function buildProgressChart(exercise, records) {
  if (!isNumericProgressType(exercise)) return '';

  const points = records
    .map(record => ({
      date: record.result.date,
      value: progressMetric(exercise, record.result),
      label: resultLabel(exercise, record.result)
    }))
    .filter(point => point.value !== null)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (points.length < 2) {
    return '<p class="chart-empty">Нужно минимум 2 числовых результата, чтобы построить график.</p>';
  }

  const width = 800;
  const height = 240;
  const pad = { top: 22, right: 20, bottom: 42, left: 48 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const values = points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max) * 0.08, 1);
  const yMin = min - spread * 0.12;
  const yMax = max + spread * 0.12;
  const xStep = points.length === 1 ? 0 : plotWidth / (points.length - 1);
  const x = index => pad.left + index * xStep;
  const lowerIsBetter = LOWER_IS_BETTER_TYPES.has(exercise.resultType);
  const y = value => lowerIsBetter
    ? pad.top + ((value - yMin) / (yMax - yMin)) * plotHeight
    : pad.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const linePoints = points.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map(ratio => {
    const gy = pad.top + ratio * plotHeight;
    const value = lowerIsBetter
      ? yMin + ratio * (yMax - yMin)
      : yMax - ratio * (yMax - yMin);
    return `<line x1="${pad.left}" y1="${gy.toFixed(1)}" x2="${width - pad.right}" y2="${gy.toFixed(1)}" class="chart-grid-line"></line>
      <text x="${pad.left - 10}" y="${(gy + 4).toFixed(1)}" text-anchor="end" class="chart-axis-label">${escapeHtml(formatProgressMetric(exercise, value))}</text>`;
  }).join('');
  const circles = points.map((point, index) => `
    <circle cx="${x(index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="4" class="chart-point">
      <title>${escapeHtml(formatDate(point.date))}: ${escapeHtml(point.label)}</title>
    </circle>`).join('');
  const labelIndexes = points.length <= 7
    ? points.map((_, index) => index)
    : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const xLabels = labelIndexes.map(index => `
    <text x="${x(index).toFixed(1)}" y="${height - 14}" text-anchor="middle" class="chart-axis-label">${escapeHtml(formatDate(points[index].date).slice(0, 5))}</text>`).join('');

  return `
    <div class="progress-chart" aria-label="График прогресса ${escapeHtml(exercise.name)}">
      <div class="progress-chart__top">
        <span>Динамика</span>
        <span>${escapeHtml(progressMetricLabel(exercise))}</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Изменение результата по датам">
        ${grid}
        <polyline points="${linePoints}" class="chart-line" fill="none"></polyline>
        ${circles}
        ${xLabels}
      </svg>
    </div>`;
}
