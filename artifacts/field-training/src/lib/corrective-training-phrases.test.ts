import assert from 'node:assert/strict';
import test from 'node:test';
import { correctiveTrainingPhrases, insertCorrectiveTrainingPhrase } from './corrective-training-phrases.js';

test('phrases name the unchecked items in their exact wording and nothing is drafted for an empty box', () => {
  assert.deepEqual(correctiveTrainingPhrases([]), []);
  const phrases = correctiveTrainingPhrases(['Backseat CVS', 'Enroute button', 'Backseat CVS']);
  assert.equal(phrases.length, 5);
  assert.equal(phrases[0]!.text, 'Discussed with the PO the correct procedure for Backseat CVS and Enroute button.');
});

test('a tapped phrase is appended to the FTO text and never replaces it', () => {
  assert.equal(insertCorrectiveTrainingPhrase('', 'One.'), 'One.');
  assert.equal(insertCorrectiveTrainingPhrase('FTO text.  ', 'One.'), 'FTO text. One.');
});
