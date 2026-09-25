# Legacy exercise normalization

The old training dataset used `30 ботов`, `50 ботов` and `Другое`. The live Supabase dataset was normalized to the current Valorant Range structure without changing retained exercise IDs for the canonicalized records.

- `30 ботов` → `Speed — Hard` (`count`, `ботов`)
- `50 ботов` → `Streak — Eliminate 50` (`time`, `сек`)
- legacy `Другое` exercises → removed with their dependent history/completions

The live Supabase SQL patch is kept in `docs/supabase/006_sync_current_training_structure.sql`.
