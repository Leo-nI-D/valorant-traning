# VALTRAIN GUI v13.1

Desktop UX final pass. No backend/data model changes.

## Changes
- Added DPI to the profile settings card using the already-supported profile field.
- Improved save states so training/result/history actions cannot be accidentally double-submitted.
- Empty result submissions now return focus to the relevant result field instead of failing silently.
- Dialogs return focus to the control that opened them after closing.
- Replaced the import success `alert()` with the existing in-app notice surface.
- Refined focus rings, text wrapping, modal scrolling behavior, and completed-run styling.
- Updated data labels to `Экспорт данных` / `Импорт данных`.
- Updated style/script cache-busting to v13.1.

## Preserved
- SQLite/API/backend behavior.
- Existing migrated data.
- Supabase project and data.
- Existing training, progress, history and profile workflows.
