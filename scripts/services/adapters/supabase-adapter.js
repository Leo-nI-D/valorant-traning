import { supabaseClient } from '../supabase.js';

export const supabaseAdapter = {
  async fetchTrainings() {
    return supabaseClient.from('trainings').select('*').order('sort_order');
  },

  async fetchExercises(trainingIds) {
    return supabaseClient
      .from('exercises')
      .select('*')
      .in('training_id', trainingIds)
      .order('sort_order');
  },

  async fetchResults(exerciseIds) {
    return supabaseClient
      .from('results')
      .select('*')
      .in('exercise_id', exerciseIds)
      .order('result_date');
  },

  async fetchTodayCompletions(userId, date) {
    return supabaseClient
      .from('daily_completions')
      .select('*')
      .eq('completion_date', date)
      .eq('user_id', userId);
  },

  async upsertTraining(row) {
    return supabaseClient.from('trainings').upsert(row);
  },

  async fetchExerciseIds(trainingId) {
    return supabaseClient.from('exercises').select('id').eq('training_id', trainingId);
  },

  async deleteExercises(ids) {
    return supabaseClient.from('exercises').delete().in('id', ids);
  },

  async upsertExercises(rows) {
    return supabaseClient.from('exercises').upsert(rows);
  },

  async insertResult(row) {
    return supabaseClient.from('results').insert(row).select().single();
  },

  async deleteResult(id, userId) {
    return supabaseClient.from('results').delete().eq('id', id).eq('user_id', userId);
  },

  async updateResult(id, userId, row) {
    return supabaseClient.from('results').update(row).eq('id', id).eq('user_id', userId).select().single();
  },

  async upsertCompletion(row) {
    return supabaseClient
      .from('daily_completions')
      .upsert(row, { onConflict: 'exercise_id,completion_date' });
  },

  async deleteCompletion(exerciseId, date) {
    return supabaseClient
      .from('daily_completions')
      .delete()
      .eq('exercise_id', exerciseId)
      .eq('completion_date', date);
  },

  async insertResults(rows) {
    return supabaseClient.from('results').insert(rows);
  }
};
