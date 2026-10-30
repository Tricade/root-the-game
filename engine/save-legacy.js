/** Save legacy: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-legacy'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const {
      catalog,
      HARDWARE,
      FIRST_DEVICE_UNIT,
      LAST_DEVICE_UNIT,
      MAX_RACK_LEVEL,
      RACKS_PER_ROOM,
      CENTRAL_DEFAULTS,
      clamp,
      finite,
    } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const legacyBuilding = (...args) => context.legacyBuilding(...args);
    const serverDemandMbps = (...args) => context.serverDemandMbps(...args);
    const specPowerW = (...args) => context.specPowerW(...args);

    function migrateV1(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1)
        throw new Error('Ungültiger Netzwerkstand.');
      const time = finite(input.time) && input.time >= 0 ? input.time : 0;
      const oldPolicies =
        input.policies && typeof input.policies === 'object' ? input.policies : {};
      const events = Array.isArray(input.events)
        ? input.events.map((e) => {
            if (!e || e.kind !== 'decision') return e;
            return {
              ...e,
              kind: 'signal',
              choices: [
                {
                  label: e.choices && e.choices[0] ? e.choices[0].label : 'Untersuchen',
                  description: 'Neue Erkenntnisse sichern.',
                  key: 'signal_analyze',
                },
                {
                  label: e.choices && e.choices[1] ? e.choices[1].label : 'Datensatz lizenzieren',
                  description: 'Eine sichere Vergütung erhalten.',
                  key: 'signal_license',
                },
              ],
            };
          })
        : input.events;
      return {
        ...input,
        version: 2,
        achievementUnlocks: Object.fromEntries(catalog.achievements.map((a) => [a.id, false])),
        servers: Array.isArray(input.servers)
          ? input.servers.map((server) => ({
              ...server,
              condition: 100,
              status: 'online',
              fault: null,
            }))
          : input.servers,
        agents: Array.isArray(input.agents)
          ? input.agents.map((agent) => ({ ...agent, assignment: null, cooldownUntil: 0 }))
          : input.agents,
        events,
        policies: { ...oldPolicies, autobackup: true, repairBudget: 300, reserve: 250 },
        resilience: {
          graceUntil: time + 600,
          budgetWindowStart: Math.floor(time / 3600) * 3600,
          budgetSpent: 0,
          parts: 3,
          backupCooldownUntil: 0,
          autoBackupNextAt: time + 900,
          backup: null,
          operation: null,
          incident: null,
          corrupted: false,
          integrity: 100,
          agentEffects: { diagnoseRemaining: 0, optimizeRemaining: 0 },
        },
      };
    }

    function packLegacyHardware(state) {
      const racks = [];
      const reservedIds = new Set(
        [
          ...state.servers,
          ...state.agents,
          ...state.jobs,
          ...state.offers,
          ...state.events,
          ...state.log,
        ].map((x) => x.id),
      );
      if (state.resilience.incident) reservedIds.add(state.resilience.incident.id);
      let rackNumber = 1,
        cursor = FIRST_DEVICE_UNIT;
      const createRack = () => {
        let id;
        do {
          id = `rack-migrated-${rackNumber++}`;
        } while (reservedIds.has(id));
        reservedIds.add(id);
        const rack = {
          id,
          name: `Rack ${String(racks.length + 1).padStart(2, '0')}`,
          switchLevel: 1,
          powerLevel: 1,
          coolingLevel: 1,
          disabledPorts: [],
        };
        racks.push(rack);
        cursor = FIRST_DEVICE_UNIT;
        return rack;
      };
      let rack = createRack(),
        port = 1;
      for (const server of state.servers) {
        const size = HARDWARE[server.type].units;
        if (cursor + size - 1 > LAST_DEVICE_UNIT || port > 16) {
          rack = createRack();
          port = 1;
        }
        server.rackId = rack.id;
        server.unit = cursor;
        server.port = port++;
        server.powered = true;
        server.bootRemaining = 0;
        cursor += size;
      }
      const aggregateLoad = state.jobs.reduce((sum, job) => sum + job.load, 0);
      const aggregateCapacity = state.servers.reduce(
        (sum, server) => sum + catalog.servers[server.type].capacity * Math.pow(server.level, 0.82),
        0,
      );
      const workload = aggregateCapacity > 0 ? clamp(aggregateLoad / aggregateCapacity, 0, 1) : 0;
      for (const r of racks) {
        const assigned = state.servers.filter((server) => server.rackId === r.id);
        const requiredW = assigned.reduce(
          (sum, server) => sum + specPowerW(server, state.policies.power),
          42,
        );
        // Legacy fleets receive enough headroom to avoid a new thermal penalty.
        r.powerLevel = Math.min(MAX_RACK_LEVEL, Math.max(1, Math.ceil(requiredW / 1800)));
        r.coolingLevel = Math.min(MAX_RACK_LEVEL, Math.max(1, Math.ceil(requiredW / 1600)));
        const demands = assigned.map((server) => serverDemandMbps(server, workload));
        if (assigned.length > 8) r.switchLevel = 2;
        if (
          demands.some((demand) => demand > 1000) ||
          demands.reduce((sum, demand) => sum + demand, 0) > 2500
        )
          r.switchLevel = 2;
        if (
          demands.some((demand) => demand > 10000) ||
          demands.reduce((sum, demand) => sum + demand, 0) > 25000
        )
          r.switchLevel = 3;
      }
      const building = legacyBuilding(racks, state.sector);
      racks.forEach(
        (rack, index) => (rack.roomId = building.rooms[Math.floor(index / RACKS_PER_ROOM)].id),
      );
      state.facility = {
        racks,
        operation: null,
        central: { ...CENTRAL_DEFAULTS },
        centralOperation: null,
        building,
      };
      state.version = 3;
      return state;
    }
    return { migrateV1, packLegacyHardware };
  };
});
