import test from 'node:test';
import assert from 'node:assert/strict';
import { masonryPositions } from '../src/masonry.js';

test('masonry packs uneven cards in source order without overlaps or trailing space', () => {
  const heights = [120, 300, 90, 150, 60, 230, 140];
  const { positions, height } = masonryPositions(heights, 3, 14);
  assert.deepEqual(positions.slice(0, 4), [
    { column: 0, top: 0 }, { column: 1, top: 0 }, { column: 2, top: 0 }, { column: 2, top: 104 },
  ]);
  positions.forEach((position, index) => {
    assert.ok(index === 0 || position.top >= positions[index - 1].top);
    positions.slice(0, index).forEach((previous, previousIndex) => {
      if (previous.column === position.column) assert.ok(position.top >= previous.top + heights[previousIndex] + 14);
    });
  });
  assert.equal(height, Math.max(...positions.map((position, index) => position.top + heights[index])));
});

test('masonry reflows filtered cards, resized media, and single-column screens', () => {
  const initial = masonryPositions([200, 100, 80], 2, 12);
  const resized = masonryPositions([200, 300, 80], 2, 12);
  assert.deepEqual(initial.positions[2], { column: 1, top: 112 });
  assert.deepEqual(resized.positions[2], { column: 0, top: 212 });
  assert.deepEqual(masonryPositions([80], 2, 12), { positions: [{ column: 0, top: 0 }], height: 80 });
  assert.deepEqual(masonryPositions([200, 100], 1, 12), { positions: [{ column: 0, top: 0 }, { column: 0, top: 212 }], height: 312 });
  assert.deepEqual(masonryPositions([], 3, 12), { positions: [], height: 0 });
});
