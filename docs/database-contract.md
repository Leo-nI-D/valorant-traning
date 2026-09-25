# VALTRAIN data contract

The browser application uses Supabase as the single source of truth. The repository layer keeps the UI independent from Supabase table details and validates data before writes.

## Core entities

- `trainings`
- `exercises`
- `results`
- `daily_completions`
- authenticated user metadata for the profile/sensitivity fields

Stable training/exercise IDs are preserved when data is migrated or imported. Result history is attached to exercise IDs and is not rewritten when an exercise is canonicalized.

The browser may cache loaded training data in localStorage for faster rendering, but this cache is disposable and is never treated as the database.
