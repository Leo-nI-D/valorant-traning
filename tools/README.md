# Maintenance tools

## Supabase read-only backup exporter

Open `tools/migration/export-supabase.html` through a local static web server or the deployed site, sign in, and export the current user-owned Supabase data as JSON. The exporter only reads rows protected by Supabase RLS; it does not write or delete data.

Keep exported JSON outside the public Git repository.
