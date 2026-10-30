'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const I18N = require('../i18n.js');

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');

test('an empty owned room stays selected and rack purchase targets that room', async () => {
  const { createRacks } = await import('../rack-ui.js');
  let state = E.createState(730);
  state.credits = 1e9;
  state.resilience.graceUntil = 1e9;
  assert.ok(E.act(state, 'buildRoom', { floor: 1 }).ok);
  E.advance(state, state.facility.building.project.total);
  const ui = createRacks({
    E,
    getState: () => state,
    fmt: String,
    dec: String,
    duration: String,
    icon: () => '',
    esc,
  });
  assert.ok(ui.selectRoom('room-2'));
  let html = ui.view();
  assert.match(html, /Raum 2 ist bereit/);
  assert.match(html, /data-hw-payload="\{&quot;roomId&quot;:&quot;room-2&quot;\}"/);
  assert.doesNotMatch(html, /data-rack-command="add-server"/);
  assert.match(ui.shop({}), /kein Rack|zuerst.*Rack/i);
  assert.equal(ui.selectRoom('room-does-not-exist'), false);
  assert.match(ui.view(), /Raum 2 ist bereit/);
  // A state replacement is read through the supplied getter, not a captured save.
  state = E.normalizeState(JSON.parse(JSON.stringify(state)));
  const result = E.act(state, 'buyRack', { roomId: 'room-2' });
  assert.ok(result.ok);
  const rack = state.facility.racks.find((item) => item.roomId === 'room-2');
  assert.ok(rack);
  html = ui.view();
  assert.match(html, new RegExp(`data-rack-id="${rack.id}"`));
  assert.doesNotMatch(html, /Raum 2 ist bereit/);
  assert.equal(ui.select(state.facility.racks[0].id, 'invalid-server'), false);
});

test('construction confirmations expose full payment and delayed ownership before starting', async () => {
  const { createRacks } = await import('../rack-ui.js');
  const state = E.createState(731);
  state.credits = 1e9;
  const ui = createRacks({
    E,
    getState: () => state,
    fmt: String,
    dec: String,
    duration: String,
    icon: () => '',
    esc,
  });
  const html = ui.modal('hardware-confirm', { action: 'buildFloor', payload: {} });
  assert.match(html, /500000000/);
  assert.match(html, /volle Betrag/);
  assert.match(html, /erst nach Fertigstellung/);
  assert.match(html, /Reparaturen laufen/);
  assert.equal(state.facility.building.project, null);
});

test('construction, recovery and achievement feedback has English copy without changing names or numbers', () => {
  for (const [de, en] of [
    ['Hardware verwalten', 'Manage hardware'],
    ['Erneut verbinden', 'Reconnect'],
    ['Aktuellen Stand laden', 'Load current save'],
    ['Speichern fehlgeschlagen', 'Save failed'],
    ['Server in CUSTOM-RACK ab U12 einbauen', 'Install a server in CUSTOM-RACK from U12'],
    ['Betriebsmodus CUSTOM-SERVER', 'Operating mode CUSTOM-SERVER'],
    ['24 Kerne', '24 cores'],
    ['8.0 TB · 4 Einschübe', '8.0 TB · 4 bays'],
    ['Details öffnen', 'View details'],
    [
      'Bauauftrag vergeben. Der vorhandene Betrieb läuft weiter.',
      'Construction project started. Existing operations continue.',
    ],
    [
      'Raum 2 auf Untergeschoss 3 fertiggestellt. Sechs Rackplätze sind verfügbar.',
      'Room 2 on Basement 3 completed. Six rack slots are available.',
    ],
    ['4 Erfolge warten auf dich', '4 achievements are waiting for you'],
    [
      '4 Erfolge freigeschaltet. Belohnungen warten in der Forschung.',
      '4 achievements unlocked. Rewards are waiting in Research.',
    ],
    ['Erfolg freigeschaltet: Stabiles Netz', 'Achievement unlocked: Stable network'],
  ])
    assert.equal(I18N.translate(de, 'en'), en);
  assert.equal(I18N.translate('CUSTOM-RACK-42', 'en'), 'CUSTOM-RACK-42');
});

test('simultaneous completion and achievement notices remain visible and expire independently', async () => {
  const { createNotificationsUI } = await import('../ui/notifications.js');
  const root = { innerHTML: '' },
    timers = new Map();
  let sequence = 0;
  const platform = {
    setTimeout(callback) {
      timers.set(++sequence, callback);
      return sequence;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const ui = createNotificationsUI(
    {
      $: () => root,
      icon: () => '',
      esc,
      seenAchievements: new Set(),
      pendingAchievements: () => [{ id: 'first', name: 'Erster Auftrag' }],
    },
    platform,
  );
  ui.toast('Raum 2 fertiggestellt.', false, 'facility');
  ui.announceAchievements();
  assert.match(root.innerHTML, /Raum 2 fertiggestellt/);
  assert.match(root.innerHTML, /Erfolg freigeschaltet/);
  ui.announceAchievements();
  assert.equal(timers.size, 2, 'the same achievement is not announced twice');
  timers.get(1)();
  assert.doesNotMatch(root.innerHTML, /Raum 2 fertiggestellt/);
  assert.match(root.innerHTML, /Erfolg freigeschaltet/);
  timers.get(2)();
  assert.equal(root.innerHTML, '');
});

test('3D update shares one model snapshot and releases it after actions and errors', async () => {
  const { createRoomTelemetry } = await import('../room/telemetry.js');
  const { roomLocation } = await import('../room-navigation.js');
  const state = E.createState(732),
    counts = new Map();
  const engine = Object.fromEntries(
    Object.entries(E).map(([name, value]) => [
      name,
      typeof value !== 'function'
        ? value
        : (...args) => {
            counts.set(name, (counts.get(name) || 0) + 1);
            return value(...args);
          },
    ]),
  );
  const context = {
    E: engine,
    getState: () => state,
    locationId: 'control',
    selectedFloor: 2,
    readingSnapshot: false,
    snapshot: null,
    roomLocation,
    keys: new Set(['w']),
    eyeHeight: 2.25,
    facilityLayout: () =>
      context.readingSnapshot ? context.snapshot.layout : engine.getFacilityLayout(state),
    centralModel: () =>
      context.readingSnapshot ? context.snapshot.central : engine.getCentralInfrastructure(state),
    visibleRacks: (racks) => racks,
    getStructureSignature: () => '',
    updatePlaceNavigation() {
      for (let i = 0; i < 3; i++) {
        context.facilityLayout();
        context.centralModel();
      }
    },
    stationSystem: {
      update(delta, snapshot) {
        assert.equal(snapshot.layout, context.facilityLayout());
        assert.equal(snapshot.central, context.centralModel());
      },
    },
  };
  const ui = createRoomTelemetry(context);
  ui.update();
  assert.equal(counts.get('getMetrics'), 1);
  assert.equal(counts.get('getFacilityLayout'), 1);
  assert.equal(counts.get('getCentralInfrastructure'), 1);
  assert.equal(context.readingSnapshot, false);
  assert.equal(context.snapshot, null);
  assert.equal(context.locationId, 'hall');
  assert.equal(context.selectedFloor, 1);
  assert.equal(context.keys.size, 0, 'invalid saved destinations also release movement');
  state.facility.building.floors = 2;
  assert.equal(
    context.facilityLayout().floorCount,
    2,
    'in-place changes cannot reuse the previous snapshot',
  );
  context.updatePlaceNavigation = () => {
    throw new Error('scene failure');
  };
  assert.throws(() => ui.update(), /scene failure/);
  assert.equal(context.readingSnapshot, false);
  assert.equal(context.snapshot, null);
});

test('physical facility screens show the current construction progress in both languages', async () => {
  const { facilityReadout } = await import('../room-instruments.js');
  const state = E.createState(733);
  state.credits = 1e9;
  assert.ok(E.act(state, 'buildFloor').ok);
  state.facility.building.project.remaining = 3600;
  const metrics = E.getMetrics(state),
    model = E.getRackModel(state, metrics);
  const data = {
    location: { id: 'hall', floor: 1 },
    layout: E.getFacilityLayout(state),
    central: E.getCentralInfrastructure(state, metrics),
    model,
    metrics,
    resilience: E.getResilience(state, model, metrics),
    construction: E.getConstructionProject(state),
  };
  const en = facilityReadout(data, 'en'),
    de = facilityReadout(data, 'de');
  assert.equal(en.status, 'CONSTRUCTION');
  assert.equal(de.status, 'BAUSTELLE');
  assert.equal(en.operation.label, 'Build Basement 2');
  assert.equal(de.operation.label, 'Untergeschoss 2 bauen');
  assert.equal(en.operation.progress, 0.5);
  assert.equal(en.operation.remaining, 3600);
});
