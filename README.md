# VALTRAIN

Personal Valorant training tracker. The PC build is a lightweight static frontend backed by Supabase.

## PC run

1. Push the project to GitHub.
2. Open the GitHub Pages site.
3. Sign in with your VALTRAIN account.

There is no local server or local database in the PC build. Your training data stays in your Supabase project; the browser may keep a small local cache for faster rendering, but Supabase is the source of truth.

## Project structure

```text
assets/        static images and font storage
css/           compiled CSS
docs/          technical documentation and Supabase SQL
scss/          SCSS source
scripts/       frontend application code
tests/         automated checks
tools/         maintenance and read-only migration utilities
```

## Validation

The release includes checks for JavaScript syntax, application logic, UI renderer behavior, HTML/ARIA relationships, dynamic markup safety, asset placement, CSS/SCSS synchronization, local references and release-tree hygiene.

Run the full check with:

```text
npm run test:all
```

## Data and updates

Small code or UI updates only require a normal Git commit/push. There is no local server restart and no SQLite file to migrate on the PC.

Supabase remains the single data backend for the PC and future mobile client.

## Supabase data maintenance

The live Supabase training structure is maintained with the SQL patch in `docs/supabase/006_sync_current_training_structure.sql`. Keep a JSON export backup before destructive data changes.

## v13.10 changes

- Removed the local SQLite/Python backend from the PC release.
- Removed local backend selection and local-only authentication branches.
- PC now always uses Supabase for authentication and data.
- Simplified startup/update flow: GitHub Pages is the only PC runtime.
- Kept the browser-side cache as a performance aid, not as a separate database.
