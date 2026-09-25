import assert from 'node:assert/strict';
import { DATA_FORMAT, DATA_VERSION, createBackupPayload, normalizeTraining } from '../scripts/core/data-contract.js';
import { EXERCISE_PRESET_DEFAULTS, EXERCISE_PRESETS } from '../scripts/core/constants.js';
import { assertValidResult, assertValidTraining } from '../scripts/core/validation.js';
import { userErrorMessage } from '../scripts/core/errors.js';
import { kdValue, getBestResult, progressMetric, progressGroupKey, progressCategory, normalizeExerciseForMetrics, buildProgressChart } from '../scripts/core/result-metrics.js';

const training = normalizeTraining({
  id: 't1',
  name: 'Aim',
  exercises: [{ id: 'e1', name: '50 ботов', result_type: 'time', history: [{ id: 1, result_date: '2026-09-19T10:00:00Z', value: '63' }] }]
});
assert.equal(training.exercises[0].resultType, 'time');
assert.equal(training.exercises[0].history[0].value, '63');
assertValidTraining(training);

assert.doesNotThrow(() => assertValidResult({ resultType: 'time' }, { date: '2026-09-19T10:00:00Z', value: '63' }));
assert.doesNotThrow(() => assertValidResult({ resultType: 'placement' }, { date: '2026-09-19', value: '4' }));
assert.throws(() => assertValidResult({ resultType: 'placement' }, { date: '2026-09-19', value: '0' }));
assert.throws(() => assertValidResult({ resultType: 'time' }, { date: 'bad-date', value: '63' }));
assert.throws(() => assertValidTraining({ id: 't1', name: '', exercises: [] }));

const backup = createBackupPayload([training]);
assert.equal(backup.format, DATA_FORMAT);
assert.equal(backup.version, DATA_VERSION);
assert.equal(backup.data.trainings.length, 1);
assert.equal(userErrorMessage({ code: '23503' }), 'Связанная запись не найдена.');
assert.equal(userErrorMessage({}), 'Произошла ошибка. Попробуй ещё раз.');
assert.equal(kdValue({ valueA: '20', valueB: '17' }).toFixed(2), '1.18');
assert.equal(kdValue({ valueA: '20', valueB: '0' }), null);
assert.equal(progressGroupKey({ name: '50 ботов', weapon: 'Vandal', resultType: 'time' }), 'streak — eliminate 50::vandal::time');
assert.equal(progressGroupKey({ name: '30 ботов', weapon: 'Vandal', resultType: 'count' }), 'speed — hard::vandal::count');
assert.equal(normalizeExerciseForMetrics({ name: '30 ботов', resultType: 'time', unit: 'сек' }).resultType, 'count');
assert.equal(normalizeExerciseForMetrics({ name: '30 ботов', resultType: 'time', unit: 'сек' }).unit, 'ботов');
assert.deepEqual(progressCategory({ name: 'Streak — Eliminate 50', resultType: 'time' }), { key: 'eliminate', label: 'Eliminate', order: 0 });
assert.deepEqual(progressCategory({ name: 'Speed — Hard', resultType: 'count' }), { key: 'speed', label: 'Speed', order: 1 });
assert.deepEqual(progressCategory({ name: 'Deathmatch', resultType: 'score' }), { key: 'deathmatch', label: 'Deathmatch', order: 2 });
assert.equal(progressCategory({ name: 'Трекинг', resultType: 'text' }), null);
const eliminateChart = buildProgressChart({ name: 'Streak — Eliminate 50', resultType: 'time' }, [
  { result: { date: '2026-09-20', value: '50' } },
  { result: { date: '2026-09-21', value: '40' } }
]);
assert.ok(!eliminateChart.includes('Меньше = лучше'));
assert.ok(!eliminateChart.includes('Больше = лучше'));
const pointsMatch = eliminateChart.match(/<polyline points=\"([^\"]+)/);
assert.ok(pointsMatch);
const pointPairs = pointsMatch[1].split(' ');
const firstY = Number(pointPairs[0].split(',')[1]);
const secondY = Number(pointPairs[1].split(',')[1]);
assert.ok(secondY < firstY, 'Lower Eliminate time should plot higher as an improvement.');
assert.equal(getBestResult({ resultType: 'time', history: [
  { value: 'bad' }, { value: '63' }, { value: '61' }
]}).value, '61');
assert.equal(progressMetric({ name: 'Deathmatch', resultType: 'score' }, { valueA: '20', valueB: '17' }).toFixed(2), '1.18');
assert.deepEqual(EXERCISE_PRESET_DEFAULTS['Speed — Hard'], { resultType: 'count', unit: 'ботов' });
assert.deepEqual(EXERCISE_PRESETS, [
  'Speed — Easy',
  'Speed — Medium',
  'Speed — Hard',
  'Streak — Eliminate 50',
  'Streak — Eliminate 100',
  'Bots — Strafe',
  'Bots — Reset',
  'Deathmatch'
]);


console.log('VALTRAIN tests: OK');
