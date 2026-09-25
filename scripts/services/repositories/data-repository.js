import { STORAGE_KEY } from '../../core/constants.js';
import { todayKey } from '../../core/utils.js';
import {
  normalizeExercise,
  normalizeResult,
  normalizeTraining,
  ENTITY_LIMITS
} from '../../core/data-contract.js';
import { assertValidTraining, assertValidResult, assertValidResultBatch } from '../../core/validation.js';

function assertUserId(userId) {
  if (!String(userId || '').trim()) throw new Error('VALTRAIN: user id is required.');
}

function mapResult(result) {
  return normalizeResult(result);
}

export function createDataRepository(adapter) {
  function readLocalData() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(value) ? value.map(normalizeTraining) : [];
    } catch {
      return [];
    }
  }

  function cacheTrainings(trainings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trainings.map(normalizeTraining)));
      return true;
    } catch (error) {
      console.warn('[VALTRAIN] Local cache unavailable:', error);
      return false;
    }
  }

  async function loadTrainings(userId) {
    assertUserId(userId);

    const trainingResponse = await adapter.fetchTrainings();
    if (trainingResponse.error) throw trainingResponse.error;
    const trainings = trainingResponse.data || [];
    if (trainings.length > ENTITY_LIMITS.trainings) {
      throw new Error('VALTRAIN: too many trainings returned by backend.');
    }

    const trainingIds = trainings.map(training => training.id);
    let exercises = [];
    let results = [];
    let completions = [];

    if (trainingIds.length) {
      const exerciseResponse = await adapter.fetchExercises(trainingIds);
      if (exerciseResponse.error) throw exerciseResponse.error;
      exercises = exerciseResponse.data || [];

      const exerciseIds = exercises.map(exercise => exercise.id);
      if (exerciseIds.length) {
        const resultResponse = await adapter.fetchResults(exerciseIds);
        if (resultResponse.error) throw resultResponse.error;
        results = resultResponse.data || [];
      }

      const completionResponse = await adapter.fetchTodayCompletions(userId, todayKey());
      if (completionResponse.error) throw completionResponse.error;
      completions = completionResponse.data || [];
    }

    const exercisesByTraining = new Map();
    for (const exercise of exercises) {
      const list = exercisesByTraining.get(exercise.training_id) || [];
      list.push(exercise);
      exercisesByTraining.set(exercise.training_id, list);
    }

    const resultsByExercise = new Map();
    for (const result of results) {
      const list = resultsByExercise.get(result.exercise_id) || [];
      list.push(result);
      resultsByExercise.set(result.exercise_id, list);
    }

    const completedIds = new Set(completions.map(item => item.exercise_id));

    const mapped = trainings.map(training => ({
      id: training.id,
      name: training.name,
      description: training.description || '',
      exercises: (exercisesByTraining.get(training.id) || [])
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
        .map(exercise => normalizeExercise({
          ...exercise,
          completed: completedIds.has(exercise.id),
          history: (resultsByExercise.get(exercise.id) || [])
            .sort((a, b) => new Date(a.result_date) - new Date(b.result_date))
            .map(mapResult)
        }))
    }));

    cacheTrainings(mapped);
    return mapped;
  }

  async function saveTraining(training, userId, allTrainings) {
    assertUserId(userId);
    assertValidTraining(training);

    const sortOrder = allTrainings.findIndex(item => item.id === training.id);
    const now = new Date().toISOString();

    if (typeof adapter.upsertTrainingBundle === 'function') {
      const response = await adapter.upsertTrainingBundle({
        training,
        userId,
        sortOrder: sortOrder < 0 ? allTrainings.length : sortOrder,
        now
      });
      if (response.error) throw response.error;
      return;
    }

    const trainingResponse = await adapter.upsertTraining({
      id: training.id,
      user_id: userId,
      name: training.name,
      description: training.description,
      sort_order: sortOrder < 0 ? allTrainings.length : sortOrder,
      updated_at: now
    });
    if (trainingResponse.error) throw trainingResponse.error;

    const existingResponse = await adapter.fetchExerciseIds(training.id);
    if (existingResponse.error) throw existingResponse.error;

    const wantedIds = new Set(training.exercises.map(exercise => exercise.id));
    const removedIds = (existingResponse.data || [])
      .map(item => item.id)
      .filter(id => !wantedIds.has(id));

    if (removedIds.length) {
      const deleteResponse = await adapter.deleteExercises(removedIds);
      if (deleteResponse.error) throw deleteResponse.error;
    }

    if (training.exercises.length) {
      const exerciseResponse = await adapter.upsertExercises(
        training.exercises.map((exercise, index) => ({
          id: exercise.id,
          training_id: training.id,
          user_id: userId,
          name: exercise.name,
          weapon: exercise.weapon,
          result_type: exercise.resultType,
          unit: exercise.unit || 'сек',
          goal: exercise.goal || '',
          sort_order: index,
          updated_at: now
        }))
      );
      if (exerciseResponse.error) throw exerciseResponse.error;
    }
  }

  async function saveResult(exerciseId, result, userId, resultId = null) {
    assertUserId(userId);
    if (!String(exerciseId || '').trim()) throw new Error('VALTRAIN: exercise id is required.');
    assertValidResult({ resultType: result.resultType }, result);

    const payload = {
      exercise_id: exerciseId,
      user_id: userId,
      result_date: result.date,
      value: result.value || null,
      value_a: result.valueA || null,
      value_b: result.valueB || null,
      placement: result.placement || null
    };

    const response = resultId
      ? await adapter.updateResult(resultId, userId, payload)
      : await adapter.insertResult(payload);

    if (response.error) throw response.error;
    if (!response.data) throw new Error('VALTRAIN: backend did not return saved result.');
    return mapResult(response.data);
  }

  async function loadProfile(userId) {
    assertUserId(userId);
    if (typeof adapter.fetchProfile === 'function') {
      const response = await adapter.fetchProfile();
      if (response.error) throw response.error;
      return response.data || null;
    }
    return null;
  }

  async function saveProfile(profile, userId) {
    assertUserId(userId);
    const payload = {
      aim: String(profile?.aim ?? '').trim(),
      scoped: String(profile?.scoped ?? '').trim(),
      ads: String(profile?.ads ?? '').trim(),
      dpi: String(profile?.dpi ?? '').trim(),
      recordedAt: profile?.recordedAt || new Date().toISOString()
    };
    if (typeof adapter.upsertProfile !== 'function') throw new Error('VALTRAIN: profile storage is unavailable.');
    const response = await adapter.upsertProfile(payload);
    if (response.error) throw response.error;
    return response.data || null;
  }

  async function getBackupData(userId) {
    assertUserId(userId);
    if (typeof adapter.fetchBackup === 'function') {
      const response = await adapter.fetchBackup();
      if (response.error) throw response.error;
      return response.data;
    }
    return {
      schemaVersion: 2,
      trainings: readLocalData()
    };
  }

  async function importBackup(payload, userId) {
    assertUserId(userId);
    if (typeof adapter.importBackup === 'function') {
      const response = await adapter.importBackup(payload);
      if (response.error) throw response.error;
      return response.data || null;
    }
    throw new Error('VALTRAIN: backend import is unavailable.');
  }

  return {
    readLocalData,
    cacheTrainings,
    loadTrainings,
    saveTraining,
    saveResult: (exerciseId, result, userId, resultId = null) => saveResult(exerciseId, result, userId, resultId),
    createResult: (exerciseId, result, userId) => saveResult(exerciseId, { ...result, date: new Date().toISOString() }, userId),
    deleteResult: async (resultId, userId) => {
      assertUserId(userId);
      if (resultId === null || resultId === undefined || resultId === '') throw new Error('VALTRAIN: result id is required.');
      const response = await adapter.deleteResult(resultId, userId);
      if (response.error) throw response.error;
    },
    setDailyCompletion: async (exerciseId, completed, userId) => {
      assertUserId(userId);
      if (!String(exerciseId || '').trim()) throw new Error('VALTRAIN: exercise id is required.');
      const date = todayKey();
      const row = { exercise_id: exerciseId, user_id: userId, completion_date: date };
      const response = completed
        ? await adapter.upsertCompletion(row)
        : await adapter.deleteCompletion(exerciseId, date);
      if (response.error) throw response.error;
    },
    createResults: async (rows, userId) => {
      assertUserId(userId);
      assertValidResultBatch(rows);
      if (!rows.length) return;
      const response = await adapter.insertResults(rows.map(result => ({
        exercise_id: result.exerciseId,
        user_id: userId,
        result_date: result.date || new Date().toISOString(),
        value: result.value || null,
        value_a: result.valueA || null,
        value_b: result.valueB || null,
        placement: result.placement || null
      })));
      if (response.error) throw response.error;
    },
    loadProfile,
    saveProfile,
    getBackupData,
    importBackup
  };
}
