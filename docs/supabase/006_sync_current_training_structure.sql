-- VALTRAIN v13.9: synchronize the live Supabase data with the current training structure.
-- Safe to run in Supabase SQL Editor for the existing personal VALTRAIN dataset.
-- This patch targets the exact legacy exercise IDs from the 2026-09-19 export.
-- Run after keeping the existing JSON export as a backup.

BEGIN;

-- 30 bots -> Speed — Hard (count / bots)
UPDATE public.exercises
SET name = 'Speed — Hard',
    result_type = 'count',
    unit = 'ботов',
    updated_at = now()
WHERE id IN (
  'ex_1789464509680_da87129e',
  'ex_1789464591750_92710fde',
  'ex_1789464609463_d098e66e',
  'ex_1789464609826_69c9a81a',
  'ex_1789464610149_180de771',
  'ex_1789464612187_811de3c4',
  'ex_1789464612516_a316bc01',
  'ex_1789464616595_fb4e9cef',
  'ex_1789812289406_50a08e33'
);

-- 50 bots -> Streak — Eliminate 50 (time / sec)
UPDATE public.exercises
SET name = 'Streak — Eliminate 50',
    result_type = 'time',
    unit = 'сек',
    updated_at = now()
WHERE id IN (
  'ex_1789464487806_38fe0814',
  'ex_1789464572178_425204ab',
  'ex_1789464606144_60fabd5e',
  'ex_1789464609656_95efc169',
  'ex_1789464609988_45eb985c'
);

-- Remove the two legacy "Другое" exercises from the old training.
-- Their dependent results/completions are removed by ON DELETE CASCADE.
DELETE FROM public.exercises
WHERE id IN (
  'ex_1789464611875_2029250a',
  'ex_1789464616822_8c3646af'
);

COMMIT;

-- Verification
SELECT name, result_type, unit, count(*) AS exercises
FROM public.exercises
WHERE id IN (
  'ex_1789464509680_da87129e','ex_1789464591750_92710fde','ex_1789464609463_d098e66e',
  'ex_1789464609826_69c9a81a','ex_1789464610149_180de771','ex_1789464612187_811de3c4',
  'ex_1789464612516_a316bc01','ex_1789464616595_fb4e9cef','ex_1789812289406_50a08e33',
  'ex_1789464487806_38fe0814','ex_1789464572178_425204ab','ex_1789464606144_60fabd5e',
  'ex_1789464609656_95efc169','ex_1789464609988_45eb985c'
)
GROUP BY name, result_type, unit
ORDER BY name;

SELECT count(*) AS legacy_other_remaining
FROM public.exercises
WHERE id IN (
  'ex_1789464611875_2029250a',
  'ex_1789464616822_8c3646af'
);
