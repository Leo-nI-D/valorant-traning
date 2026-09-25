# VALTRAIN technical roadmap — current state

## Completed PC foundation

- Modular core constants/state/utils/errors/validation.
- Data repository boundary between UI and storage.
- Supabase adapter isolated from UI.
- Versioned data contract for export/import.
- Efficient entity grouping with Maps/Sets during data load and progress preparation.
- Input validation and stable error classification.
- Dependency-free Node checks and tests.

## PC backend decision

- The PC build uses Supabase as the single source of truth.
- The previously built local SQLite/Python server was intentionally removed because its update and maintenance cost was too high for a small personal tracker.
- Browser localStorage remains only as a lightweight cache; it is not treated as the database.
- GitHub Pages serves the PC application directly.

## Data migration / current Supabase state

- The original Supabase dataset was exported read-only before migration work.
- Legacy `30 ботов` exercises are normalized to `Speed — Hard` (`count` / `ботов`).
- Legacy `50 ботов` exercises are normalized to `Streak — Eliminate 50` (`time` / `сек`).
- Legacy `Другое` exercises are removed with their dependent history/completions.
- Current live Supabase state was verified with SQL after normalization.

## PC GUI final

- Desktop layout, dialogs, focus states, responsive behavior and result-entry UX refined.
- Profile includes DPI and sensitivity fields.
- Progress is limited to Eliminate, Speed and Deathmatch and uses the intended result direction.
- Asset structure, HTML semantics, ARIA relationships, CSS/SCSS sync and release-tree hygiene audited.

## Later

- Phone/offline/IndexedDB/PWA phase.
