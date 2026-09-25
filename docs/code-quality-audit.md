# VALTRAIN code-quality audit

The PC release is a static frontend backed by Supabase. The audit covers: 

- JavaScript syntax and module imports;
- HTML semantics, unique IDs, labels and ARIA relationships;
- dynamic UI renderer output;
- CSS parser validity and SCSS/CSS synchronization;
- asset placement and local references;
- release-tree hygiene;
- application logic and UI regression tests.

Private databases, backups and migration JSON are excluded from the public source tree.
