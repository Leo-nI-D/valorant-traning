import { supabaseClient } from './supabase.js';

export const authService = {
  getSession() {
    return supabaseClient.auth.getSession();
  },

  onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
  },

  signInWithPassword(credentials) {
    return supabaseClient.auth.signInWithPassword(credentials);
  },

  signUp(credentials) {
    return supabaseClient.auth.signUp(credentials);
  },

  signOut() {
    return supabaseClient.auth.signOut();
  },

  updateUser(attributes) {
    return supabaseClient.auth.updateUser(attributes);
  }
};
