export const DATA_FORMAT = 'valtrain-backup';
export const DATA_VERSION = 2;

export const ENTITY_LIMITS = Object.freeze({
  trainings: 100,
  exercisesPerTraining: 100,
  resultsPerExercise: 100000
});

function text(value, fallback = '') {
  return value === null || value === undefined ? fallback : String(value);
}

export function normalizeResult(result = {}) {
  return {
    id: result.id ?? null,
    date: text(result.date || result.result_date),
    value: result.value ?? null,
    valueA: result.valueA ?? result.value_a ?? null,
    valueB: result.valueB ?? result.value_b ?? null,
    placement: result.placement ?? null,
    created_at: result.created_at ?? result.createdAt ?? null
  };
}

export function normalizeExercise(exercise = {}) {
  return {
    id: text(exercise.id),
    name: text(exercise.name).trim(),
    weapon: text(exercise.weapon).trim(),
    resultType: text(exercise.resultType || exercise.result_type || 'time'),
    unit: text(exercise.unit || 'сек'),
    goal: text(exercise.goal).trim(),
    created_at: exercise.created_at ?? exercise.createdAt ?? null,
    updated_at: exercise.updated_at ?? exercise.updatedAt ?? null,
    completed: Boolean(exercise.completed),
    history: Array.isArray(exercise.history) ? exercise.history.map(normalizeResult) : []
  };
}

export function normalizeTraining(training = {}) {
  return {
    id: text(training.id),
    name: text(training.name).trim(),
    description: text(training.description).trim(),
    created_at: training.created_at ?? training.createdAt ?? null,
    updated_at: training.updated_at ?? training.updatedAt ?? null,
    exercises: Array.isArray(training.exercises)
      ? training.exercises.map(normalizeExercise)
      : []
  };
}

export function extractTrainingsFromBackup(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload?.format !== DATA_FORMAT) throw new Error('Неподдерживаемый формат резервной копии.');
  return Array.isArray(payload.data?.trainings) ? payload.data.trainings : [];
}

export function createBackupPayload(trainings, extra = {}) {
  return {
    format: DATA_FORMAT,
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      trainings: trainings.map(normalizeTraining),
      ...extra
    }
  };
}
