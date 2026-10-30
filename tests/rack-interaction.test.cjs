const test = require('node:test'),
  assert = require('node:assert/strict');

test('rack access opens the door before dispatching hardware controls and waits for the leaf to clear', async () => {
  const { rackInteraction, createRoomInput } = await import('../room/input.js');
  const cabinet = { doorOpen: false, doors: [{ rotation: { y: 0 } }] },
    calls = [];
  const context = {
    rackInteraction,
    rackRefs: new Map([['rack-1', { cabinet, asset: true }]]),
    updateNavigationTelemetry: () => calls.push('door:rack-1'),
    openServer: (rack, id) => calls.push('server:' + id),
    openRack: (id) => calls.push('rack:' + id),
  };
  Object.assign(context, createRoomInput(context));
  context.activateTarget('rack-1', 'server-1');
  assert.deepEqual(calls, ['door:rack-1']);
  context.activateTarget('rack-1', 'server-1');
  assert.equal(calls.length, 1, 'hardware remains covered during the swing');
  cabinet.doors[0].rotation.y = -1.5;
  context.activateTarget('rack-1', 'server-1');
  assert.deepEqual(calls, ['door:rack-1', 'server:server-1']);
  assert.equal(rackInteraction(cabinet, true), 'close-door');
  context.activateTarget('rack-1', null);
  assert.equal(calls.at(-1), 'rack:rack-1');
});
