import assert from 'node:assert/strict';
import { renderTrainings, renderExerciseEditor, resultInputMarkup, renderRunExercise } from '../scripts/ui/training-renderer.js';
import { renderProgress } from '../scripts/ui/progress-renderer.js';

function root() {
  return { innerHTML: '' };
}

const unsafe = '<img src=x onerror=alert(1)>';
const exercise = {
  id: unsafe,
  name: 'Deathmatch',
  weapon: 'Vandal',
  resultType: 'score',
  unit: '',
  goal: '',
  completed: false,
  history: [
    { id: unsafe, date: '2026-09-18T10:00:00Z', valueA: '20', valueB: '17' },
    { id: 'r2', date: '2026-09-19T10:00:00Z', valueA: '23', valueB: '17' }
  ]
};
const training = { id: unsafe, name: 'Aim', description: 'Test', exercises: [exercise] };

const trainingRoot = root();
renderTrainings(trainingRoot, [training]);
assert.match(trainingRoot.innerHTML, /data-id="&lt;img/);
assert.doesNotMatch(trainingRoot.innerHTML, /<img src=x/);

const editorRoot = root();
renderExerciseEditor(editorRoot, [exercise]);
assert.match(editorRoot.innerHTML, /<fieldset/);

assert.match(resultInputMarkup(exercise), /Убийства/);
assert.match(resultInputMarkup(exercise), /Смерти/);

const runMarkup = renderRunExercise(exercise, 0);
assert.match(runMarkup, /K\/D 1\.18/);
assert.match(runMarkup, /data-exercise-id="&lt;img/);
assert.doesNotMatch(runMarkup, /<img src=x/);

const progressRoot = root();
renderProgress(progressRoot, [training]);
assert.match(progressRoot.innerHTML, /progress-card/);
assert.match(progressRoot.innerHTML, /K\/D/);
assert.match(progressRoot.innerHTML, /<li class="history-row">/);
assert.doesNotMatch(progressRoot.innerHTML, /<img src=x/);

console.log('UI renderer tests: OK');

const textRoot = root();
renderProgress(textRoot, [{ id: 'text-training', name: 'Text', description: '', exercises: [{ id: 'text-ex', name: 'Заметка', weapon: 'Без оружия', resultType: 'text', unit: '', goal: '', completed: true, history: [{ id: 'text-r', date: '2026-09-19T10:00:00Z', value: 'done' }] }] }]);
assert.doesNotMatch(textRoot.innerHTML, /Заметка/);
assert.match(textRoot.innerHTML, /Истории пока нет/);
