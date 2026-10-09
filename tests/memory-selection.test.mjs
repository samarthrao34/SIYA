import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectMemoriesForConsolidation, CONSOLIDATION_MEMORY_LIMIT } from '../server/memory.ts';

const memory = (id, text, updatedAt = '2026-01-01T00:00:00Z') => ({ id, category: 'preference', text, createdAt: updatedAt, updatedAt });

test('small memory sets are sent unchanged', () => {
  const memories = [memory('a', 'The user likes tea'), memory('b', 'The user studies physics')];
  assert.deepEqual(selectMemoriesForConsolidation(memories, [{ role: 'user', text: 'hi' }]), memories);
});

test('large sets send only the memories related to the conversation, up to the limit', () => {
  const filler = Array.from({ length: 60 }, (_, i) => memory(`f${i}`, `Unrelated fact number ${i} about gardening`));
  const related = memory('rel', 'The user is learning to play the violin');
  const selected = selectMemoriesForConsolidation([...filler, related], [{ role: 'user', text: 'My violin lesson went badly today' }]);
  assert.equal(selected.length, CONSOLIDATION_MEMORY_LIMIT);
  assert.equal(selected[0].id, 'rel');
});

test('ties are broken by most recently updated', () => {
  const old = Array.from({ length: 40 }, (_, i) => memory(`o${i}`, `Fact ${i}`, '2025-01-01T00:00:00Z'));
  const recent = memory('new', 'Fresh fact', '2026-06-01T00:00:00Z');
  const selected = selectMemoriesForConsolidation([...old, recent], [{ role: 'user', text: 'nothing in common' }], 5);
  assert.equal(selected.length, 5);
  assert.equal(selected[0].id, 'new');
});

test('corrections send every memory so a stale fact can be updated', () => {
  const filler = Array.from({ length: 60 }, (_, i) => memory(`f${i}`, `Unrelated fact number ${i} about gardening`));
  const stale = memory('paris', 'The user lives in Paris');
  for (const said of ['I moved last month', 'Actually I quit that job', 'Forget what I said about the trip', 'Ab nahi rehta wahan', 'गलत है']) {
    const selected = selectMemoriesForConsolidation([...filler, stale], [{ role: 'user', text: said }]);
    assert.equal(selected.length, 61, said);
  }
});

test('SIYA\'s own words do not trigger the full list', () => {
  const filler = Array.from({ length: 60 }, (_, i) => memory(`f${i}`, `Fact ${i}`));
  const selected = selectMemoriesForConsolidation(filler, [{ role: 'model', text: 'Actually, you moved?' }, { role: 'user', text: 'hello' }]);
  assert.equal(selected.length, CONSOLIDATION_MEMORY_LIMIT);
});
