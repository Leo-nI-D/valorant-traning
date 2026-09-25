import { RESULT_TYPES } from './constants.js';
import { ENTITY_LIMITS } from './data-contract.js';

const RESULT_TYPE_SET = new Set(RESULT_TYPES.map(([value]) => value));
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T|$)/;

export function validationError(message, details = null) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function assertValidTraining(training) {
  if (!training || typeof training !== 'object') throw validationError('Некорректная тренировка.');
  if (!String(training.id || '').trim()) throw validationError('У тренировки отсутствует идентификатор.');
  if (!String(training.name || '').trim()) throw validationError('Название тренировки не может быть пустым.');
  if (String(training.name).length > 200) throw validationError('Название тренировки слишком длинное.');
  if (String(training.description || '').length > 2000) throw validationError('Описание тренировки слишком длинное.');
  if (!Array.isArray(training.exercises)) throw validationError('У тренировки некорректный список упражнений.');
  if (training.exercises.length > ENTITY_LIMITS.exercisesPerTraining) throw validationError('Слишком много упражнений в одной тренировке.');
  training.exercises.forEach(assertValidExercise);
  return true;
}

export function assertValidExercise(exercise) {
  if (!exercise || typeof exercise !== 'object') throw validationError('Некорректное упражнение.');
  if (!String(exercise.id || '').trim()) throw validationError('У упражнения отсутствует идентификатор.');
  if (!String(exercise.name || '').trim()) throw validationError('Название упражнения не может быть пустым.');
  if (String(exercise.name).length > 200) throw validationError('Название упражнения слишком длинное.');
  if (!RESULT_TYPE_SET.has(exercise.resultType)) throw validationError('Недопустимый тип результата упражнения.');
  if (String(exercise.weapon || '').length > 100) throw validationError('Название оружия слишком длинное.');
  if (String(exercise.goal || '').length > 500) throw validationError('Цель упражнения слишком длинная.');
  if (Array.isArray(exercise.history) && exercise.history.length > ENTITY_LIMITS.resultsPerExercise) {
    throw validationError('Слишком много результатов у упражнения.');
  }
  return true;
}

function finiteNumber(value) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function assertDate(value) {
  if (!DATE_RE.test(String(value || ''))) throw validationError('Дата результата имеет неверный формат.');
  if (!Number.isFinite(new Date(value).getTime())) throw validationError('Дата результата некорректна.');
}

export function assertValidResult(exercise, result) {
  if (!exercise || !result || typeof result !== 'object') throw validationError('Некорректный результат.');
  assertDate(result.date);

  switch (exercise.resultType) {
    case 'time':
    case 'count':
    case 'placement':
      if (!finiteNumber(result.value) || Number(result.value) < 0) throw validationError('Результат должен быть неотрицательным числом.');
      if (exercise.resultType === 'placement' && (!Number.isInteger(Number(result.value)) || Number(result.value) < 1)) {
        throw validationError('Место должно быть целым числом не меньше 1.');
      }
      break;
    case 'score':
    case 'scorePlacement':
      if (!finiteNumber(result.valueA) || Number(result.valueA) < 0) throw validationError('Результат A должен быть неотрицательным числом.');
      if (!finiteNumber(result.valueB) || Number(result.valueB) < 0) throw validationError('Результат B должен быть неотрицательным числом.');
      if (exercise.resultType === 'scorePlacement' && (!finiteNumber(result.placement) || !Number.isInteger(Number(result.placement)) || Number(result.placement) < 1)) {
        throw validationError('Место должно быть целым числом не меньше 1.');
      }
      break;
    case 'text':
      if (String(result.value || '').length > 2000) throw validationError('Текст результата слишком длинный.');
      break;
    default:
      throw validationError('Недопустимый тип результата.');
  }
  return true;
}

export function assertValidResultBatch(rows) {
  if (!Array.isArray(rows)) throw validationError('Некорректный список результатов.');
  if (rows.length > 5000) throw validationError('Слишком много результатов в одной операции.');
  rows.forEach(row => {
    if (!row || typeof row !== 'object') throw validationError('В пакетном результате есть некорректная запись.');
    if (!String(row.exerciseId || '').trim()) throw validationError('У результата отсутствует exerciseId.');
    if (row.date !== undefined && row.date !== null && row.date !== '') assertDate(row.date);
  });
  return true;
}
