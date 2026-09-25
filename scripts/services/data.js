import { supabaseAdapter } from './adapters/supabase-adapter.js';
import { createDataRepository } from './repositories/data-repository.js';

const dataRepository = createDataRepository(supabaseAdapter);

export const {
  readLocalData,
  cacheTrainings,
  loadTrainings,
  saveTraining,
  createResult,
  deleteResult,
  saveResult,
  setDailyCompletion,
  createResults
} = dataRepository;
