# Supabase data maintenance

VALTRAIN uses Supabase as the single backend for the PC application.

Before applying a destructive data migration, keep a fresh read-only JSON export. The current legacy-training normalization is in `006_sync_current_training_structure.sql`.

The patch normalizes the existing personal dataset:
- `30 ботов` → `Speed — Hard` (`count` / `ботов`);
- `50 ботов` → `Streak — Eliminate 50` (`time` / `сек`);
- legacy `Другое` exercises are removed with their dependent history/completions.
