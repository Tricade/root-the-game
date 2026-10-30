(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RootEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const catalog = {
    servers: {
      edge: { name: 'Edge-Knoten', model: 'ROOT R120', units: 1, cores: 8, ramGB: 32, storageTB: 4, driveBays: 2, description: 'Liefert schnelle, verlässliche Grundlast und verbindet neue Standorte.', baseCost: 420, capacity: 18, power: 2.2, color: '#65d6c4' },
      compute: { name: 'Rechenknoten', model: 'ROOT C240', units: 2, cores: 24, ramGB: 128, storageTB: 8, driveBays: 4, description: 'Viel Durchsatz für anspruchsvolle Aufträge und Forschung.', baseCost: 760, capacity: 34, power: 5.2, color: '#8b9cff' },
      storage: { name: 'Speicherknoten', model: 'ROOT S360', units: 3, cores: 12, ramGB: 64, storageTB: 24, driveBays: 8, description: 'Günstige Kapazität mit niedriger Last und stabiler Grundversorgung.', baseCost: 610, capacity: 28, power: 2.8, color: '#f1bd72' },
      ai: { name: 'KI-Beschleuniger', model: 'ROOT A480', units: 4, cores: 32, ramGB: 256, storageTB: 8, driveBays: 4, gpuCount: 4, vramGB: 320, description: 'Vier simulierte Beschleuniger mit je 80 GB VRAM für begrenzte KI-Inferenz und Training; hoher Strom- und Uplinkbedarf.', baseCost: 2450, capacity: 19, power: 15, color: '#be91ff' }
    },
    roles: {
      operator: { name: 'Operator', description: 'Hält Aufträge am Laufen und steigert die Netzwerkerlöse.', baseCost: 260, color: '#65d6c4' },
      analyst: { name: 'Analyst', description: 'Verwandelt laufende Arbeit in zusätzliche Forschungspunkte.', baseCost: 320, color: '#8b9cff' },
      engineer: { name: 'Techniker', description: 'Senkt Wartungslast und verbessert Zuverlässigkeit.', baseCost: 380, color: '#f1bd72' }
    },
    research: [
      { id: 'routing', name: 'Adaptives Routing', description: 'Mehr Durchsatz pro Agent. Wiederholbar: +12 Prozentpunkte Arbeitstempo je Stufe.', baseCost: 8, currency: 'research', effect: 'work' },
      { id: 'cooling', name: 'Flüssigkühlung', description: 'Weniger Wärme und Ausfallrisiko. Wiederholbar: −8 % Wärme je Stufe.', baseCost: 10, currency: 'research', effect: 'heat' },
      { id: 'market', name: 'Vertragsanalyse', description: 'Bessere Vergütung für Aufträge. Wiederholbar: +10 % Auftragswert je Stufe.', baseCost: 12, currency: 'research', effect: 'reward' },
      { id: 'automation', name: 'Selbstheilende Abläufe', description: 'Wartung und passive Erlöse werden effizienter. Wiederholbar: +9 % Netzwerkerlös je Stufe.', baseCost: 15, currency: 'research', effect: 'income' },
      { id: 'synthesis', name: 'Wissenssynthese', description: 'Analysen liefern mehr Erkenntnisse. Wiederholbar: +15 % Forschung je Stufe.', baseCost: 18, currency: 'research', effect: 'research' }
    ],
    achievements: [
      { id: 'first_job', name: 'Erster Auftrag', description: 'Schließe den ersten Auftrag ab.', reward: 120, check: s => s.counters.jobs >= 1 },
      { id: 'steady_network', name: 'Stabiles Netz', description: 'Erreiche 90 % Zuverlässigkeit.', reward: 180, check: s => getMetrics(s).reliability >= 90 },
      { id: 'three_servers', name: 'Dreifach redundant', description: 'Betreibe mindestens drei Server.', reward: 250, check: s => s.servers.length >= 3 },
      { id: 'sector_two', name: 'Neuer Horizont', description: 'Erschließe Sektor 2.', reward: 350, check: s => s.sector >= 2 },
      { id: 'million', name: 'Netzwerkvermögen', description: 'Erwirtschaftete insgesamt 10.000 Credits.', reward: 500, check: s => s.lifetimeCredits >= 10000 }
    ]
  };

  const SERVER_TYPES = Object.keys(catalog.servers);
  const HARDWARE = {
    edge: { model: 'ROOT R120', units: 1, cores: 8, ramGB: 32, driveBays: 2, storageTB: 4 },
    compute: { model: 'ROOT C240', units: 2, cores: 24, ramGB: 128, driveBays: 4, storageTB: 8 },
    storage: { model: 'ROOT S360', units: 3, cores: 12, ramGB: 64, driveBays: 8, storageTB: 24 },
    ai: { model: 'ROOT A480', units: 4, cores: 32, ramGB: 256, driveBays: 4, storageTB: 8, gpuCount: 4, vramGB: 320 }
  };
  // These are implementation ceilings, separate from sector unlocks. The
  // sector progression itself does not stop at the old six-rack / 32-server cap.
  const RACK_UNITS = 18, FIRST_DEVICE_UNIT = 2, LAST_DEVICE_UNIT = 17, MAX_RACKS = 10000, MAX_RACK_LEVEL = 100;
  const ROLES = Object.keys(catalog.roles);
  const FOCI = ['income', 'research', 'maintenance'];
  const MODES = ['balanced', 'performance', 'eco'];
  const JOB_KINDS = ['monitoring', 'migration', 'audit', 'optimization', 'recovery', 'research', 'ai'];
  const MAX = { servers: 10000, agents: 12, jobs: 8, offers: 6, events: 3, log: 80, history: 60 };
  const MAX_RESEARCH_LEVEL = 1000;
  const MAX_CONDITION = 100;
  const RESILIENCE_MAX = { parts: 20, incidentAffected: 2, backupJobs: MAX.jobs };
  const CENTRAL_SYSTEMS = [
    { id: 'cooling', name: 'Zentrale Klimaanlage', unlockSector: 4, baseCost: 4800, duration: 120, maxLevel: 5 },
    { id: 'ups', name: 'Unterbrechungsfreie Stromversorgung', unlockSector: 6, baseCost: 6200, duration: 150, maxLevel: 5 },
    { id: 'distribution', name: 'Zentrale Stromverteilung', unlockSector: 8, baseCost: 8400, duration: 180, maxLevel: 5 }
  ];
  const CENTRAL_DEFAULTS = { cooling: 0, ups: 0, distribution: 0 };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const safeNum = (n, fallback, lo = 0, hi = 1e12) => finite(n) ? clamp(n, lo, hi) : fallback;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function rand(s) {
    let x = (s.rng >>> 0) || 0x6d2b79f5;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    s.rng = x >>> 0;
    return s.rng / 4294967296;
  }
  function hasId(s, id) {
    return s.servers.some(x => x.id === id) || s.agents.some(x => x.id === id) || s.jobs.some(x => x.id === id) || s.offers.some(x => x.id === id) || s.events.some(x => x.id === id) || s.log.some(x => x.id === id) || Boolean(s.resilience && s.resilience.incident && s.resilience.incident.id === id) || Boolean(s.facility && s.facility.racks.some(x => x.id === id));
  }
  function uid(s, prefix) {
    let id;
    do { id = prefix + '-' + (s.nextId++); } while (hasId(s, id));
    return id;
  }
  function addLog(s, type, message) {
    s.log.unshift({ id: uid(s, 'log'), time: s.time, type, message: String(message).slice(0, 180) });
    if (s.log.length > MAX.log) s.log.length = MAX.log;
  }
  function createState(seed = 12345) {
    const nseed = (Number.isInteger(seed) ? seed : 12345) >>> 0;
    const s = {
      version: 3, seed: nseed, rng: nseed || 0x6d2b79f5, networkName: 'Mein Netzwerk', savedAt: Date.now(),
      time: 0, credits: 800, research: 12, reputation: 12, lifetimeCredits: 0, sector: 1,
      servers: [{ id: 'server-1', type: 'edge', name: 'Randknoten 01', level: 1, mode: 'balanced', condition: 100, status: 'online', fault: null, rackId: 'rack-1', unit: 2, port: 1, powered: true, bootRemaining: 0 }],
      agents: [
        { id: 'agent-1', name: 'Mira', role: 'operator', level: 1, focus: 'income', trait: 'zuverlässig', assignment: null, cooldownUntil: 0 },
        { id: 'agent-2', name: 'Tarek', role: 'analyst', level: 1, focus: 'research', trait: 'neugierig', assignment: null, cooldownUntil: 0 }
      ],
      jobs: [{ id: 'job-1', title: 'Telemetrie prüfen', client: 'Nordlicht Mobilität', kind: 'monitoring', totalWork: 84, work: 0, reward: 210, science: 5, rep: 3, load: 3.5 }],
      offers: [], events: [], log: [], upgrades: {},
      policies: { power: 'balanced', autocontract: false, autorepair: true, priority: 'balanced', autobackup: true, repairBudget: 300, reserve: 250 },
      resilience: { graceUntil: 600, budgetWindowStart: 0, budgetSpent: 0, parts: 3, backupCooldownUntil: 0, autoBackupNextAt: 900, backup: null, operation: null, incident: null, corrupted: false, integrity: 100, agentEffects: { diagnoseRemaining: 0, optimizeRemaining: 0 } },
      facility: { racks: [{ id: 'rack-1', name: 'Rack 01', switchLevel: 1, powerLevel: 1, coolingLevel: 1, disabledPorts: [] }], operation: null, central: { ...CENTRAL_DEFAULTS }, centralOperation: null },
      history: [], achievements: {}, achievementUnlocks: Object.fromEntries(catalog.achievements.map(a => [a.id, false])), counters: { jobs: 0, events: 0, serversBought: 0, agentsHired: 0, sectors: 1 },
      timers: { offer: 22, event: 95, history: 30 }, nextId: 3
    };
    s.nextId = 3;
    s.offers.push(makeJob(s), makeJob(s));
    addLog(s, 'system', 'ROOT ist bereit. Dein erster Überwachungsauftrag läuft.');
    updateAchievementUnlocks(s);
    return s;
  }

  function cost(s, kind, id) {
    const sectorScale = 1 + Math.max(0, s.sector - 1) * 0.42;
    if (kind === 'server' && own(catalog.servers, id)) return Math.ceil(catalog.servers[id].baseCost * sectorScale * (1 + s.servers.filter(x => x.type === id).length * 0.68));
    if (kind === 'serverUpgrade') {
      const x = s.servers.find(v => v.id === id); return x ? Math.ceil(catalog.servers[x.type].baseCost * 0.58 * Math.pow(x.level, 1.72) * sectorScale) : Infinity;
    }
    if (kind === 'agent' && own(catalog.roles, id)) return Math.ceil(catalog.roles[id].baseCost * sectorScale * (1 + s.agents.filter(x => x.role === id).length * 0.55));
    if (kind === 'agentUpgrade') {
      const x = s.agents.find(v => v.id === id); return x ? Math.ceil(catalog.roles[x.role].baseCost * 0.48 * Math.pow(x.level, 1.82) * sectorScale) : Infinity;
    }
    if (kind === 'research') {
      const u = catalog.research.find(v => v.id === id); return u ? Math.ceil(Math.min(1e300, u.baseCost * Math.pow(1.48, s.upgrades[id] || 0) * (1 + (s.sector - 1) * 0.12))) : Infinity;
    }
    if (kind === 'sector') return Math.ceil(1800 * Math.pow(s.sector, 1.62));
    return Infinity;
  }

  function rackLimit(s) { return Math.min(MAX_RACKS, Math.max(1, s.sector + 1)); }
  function rackPrice(s) { return Math.ceil(1100 * (1 + Math.max(0, s.sector - 1) * 0.42) * (1 + Math.max(0, s.facility.racks.length - 1) * 0.28)); }
  function centralLevels(s) { return { ...CENTRAL_DEFAULTS, ...(s.facility && s.facility.central || {}) }; }
  function centralOperatingCost(levels, powerW, policy) {
    return powerW / 1000 * (policy === 'eco' ? 0.035 : policy === 'performance' ? 0.105 : 0.064) + levels.cooling * 0.04 + levels.ups * 0.035 + levels.distribution * 0.025;
  }
  function activeRackIds(s) {
    if (s.resilience.incident) return new Set();
    return new Set(s.servers.filter(server => server.powered && server.bootRemaining <= 0 && server.status === 'online' && server.condition > 0 && !(s.facility.operation && s.facility.operation.rackId === server.rackId)).map(server => server.rackId));
  }
  function centralQuote(s, system) {
    const levels = centralLevels(s), level = levels[system.id], targetLevel = level + 1;
    const price = Math.ceil(system.baseCost * Math.pow(targetLevel, 1.55) * (1 + Math.max(0, s.sector - system.unlockSector) * 0.12));
    const duration = Math.min(300, system.duration + (targetLevel - 1) * 30);
    const locked = Boolean(s.resilience.incident || s.resilience.operation || s.facility.operation || s.facility.centralOperation);
    let reason = s.sector < system.unlockSector ? `Freischaltung ab Sektor ${system.unlockSector}.` : level >= system.maxLevel ? 'Höchste Ausbaustufe erreicht.' : locked ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.' : cashReason(s, price);
    const step = system.id === 'cooling' ? 3500 : system.id === 'ups' ? 3000 : 6000;
    const capacityAfterW = Math.min(targetLevel, system.maxLevel) * step, capacityGainW = capacityAfterW - level * step;
    const active = activeRackIds(s).size > 0, powerIncreaseW = system.id === 'cooling' && active && capacityGainW > 0 ? 500 : 0;
    const nextLevels = { ...levels, [system.id]: Math.min(targetLevel, system.maxLevel) };
    const beforePowerW = active ? levels.cooling * 500 : 0;
    const upkeepIncrease = centralOperatingCost(nextLevels, beforePowerW + powerIncreaseW, s.policies.power) - centralOperatingCost(levels, beforePowerW, s.policies.power);
    const effect = system.id === 'cooling' ? `${capacityGainW} W zusätzliche Kühlleistung; danach ${capacityAfterW} W zentral. Auf aktive Racks verteilt.` : system.id === 'ups' ? `${capacityGainW} W zusätzliche USV-Leistung; danach ${capacityAfterW} W gesamt. Bei passender Lastabdeckung sinkt die Chance schwerer Stromausfälle um bis zu 65 %; deren Folgen werden gemindert.` : `${capacityGainW} W zusätzliche Gesamtreserve; danach ${capacityAfterW} W zentral. Gleichmäßig auf aktive Racks verteilt.`;
    return { label: `${system.name} ausbauen`, description: `${price} Credits; ${duration} Sekunden Wartung. ${effect} Laufende Mehrkosten: ${upkeepIncrease.toFixed(3).replace('.', ',')} CR/s; zusätzliche Leistungsaufnahme: ${powerIncreaseW} W.`, cost: price, duration, enabled: !reason, reason, capacityGainW, capacityAfterW, upkeepIncrease, powerIncreaseW };
  }
  function rackComponentQuote(s, rack, component) {
    const level = rack[component + 'Level'];
    const step = component === 'switch' ? 45 : component === 'power' ? 60 : 90;
    const base = component === 'switch' ? 360 : component === 'power' ? 300 : 280;
    const maxLevel = component === 'switch' ? 3 : MAX_RACK_LEVEL;
    const costValue = Math.ceil(base * Math.pow(level, 1.52) * (1 + Math.max(0, s.sector - 1) * 0.3));
    const locked = Boolean(s.resilience.incident || s.resilience.operation || s.facility.operation || s.facility.centralOperation);
    const reason = locked ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.' : level >= maxLevel ? 'Höchste Ausbaustufe erreicht.' : cashReason(s, costValue);
    return { label: component === 'switch' ? 'Switch-Ausbau' : component === 'power' ? 'Stromversorgung ausbauen' : 'Kühlung ausbauen', description: `${costValue} Credits; ${step} Sekunden Wartung. Rack und angeschlossene Server sind währenddessen nicht verfügbar.`, cost: costValue, duration: step, enabled: !reason, reason };
  }
  function serverDemandMbps(server, loadFraction = 0.15) {
    const base = server.type === 'ai' ? 4200 : server.type === 'compute' ? 1800 : server.type === 'storage' ? 1000 : 550;
    return Math.max(60, base * Math.pow(server.level, 0.72) * (0.2 + clamp(loadFraction, 0, 1) * 0.8));
  }
  function hardwareSnapshot(s) {
    const rackRows = new Map();
    const aggregateLoad = s.jobs.reduce((sum, job) => sum + job.load, 0);
    const aggregateCapacity = s.servers.reduce((sum, server) => sum + catalog.servers[server.type].capacity * Math.pow(server.level, 0.82), 0);
    const workload = aggregateCapacity > 0 ? clamp(aggregateLoad / aggregateCapacity, 0, 1) : 0;
    const central = centralLevels(s), activeRacks = activeRackIds(s), activeCount = activeRacks.size;
    const centralCoolingBudget = central.cooling * 3500;
    const centralCoolingPerRack = activeCount ? centralCoolingBudget / activeCount : 0;
    const centralPowerDrawW = central.cooling * 500;
    const centralPowerPerRack = activeCount ? centralPowerDrawW / activeCount : 0;
    const centralDistributionBudgetW = central.distribution * 6000;
    const centralDistributionPerRack = activeCount ? centralDistributionBudgetW / activeCount : 0;
    for (const rack of s.facility.racks) {
      const active = activeRacks.has(rack.id);
      rackRows.set(rack.id, { rack, servers: [], powerW: 42 + (active ? centralPowerPerRack : 0), coolingW: rack.coolingLevel * 2000 + (active ? centralCoolingPerRack : 0), centralCoolingW: active ? centralCoolingPerRack : 0, centralPowerW: active ? centralPowerPerRack : 0, centralPowerCapacityW: active ? centralDistributionPerRack : 0, temperature: 22, demand: 0, uplink: rack.switchLevel === 1 ? 2500 : rack.switchLevel === 2 ? 25000 : 100000, portSpeed: rack.switchLevel === 1 ? 1000 : rack.switchLevel === 2 ? 10000 : 25000 });
    }
    for (const server of s.servers) {
      const row = rackRows.get(server.rackId);
      if (!row) continue;
      const rawW = specPowerW(server, s.policies.power);
      const available = server.powered && server.bootRemaining <= 0 && server.status === 'online' && server.condition > 0 && !s.resilience.incident && !(s.facility.operation && s.facility.operation.rackId === server.rackId);
      const demand = available && !row.rack.disabledPorts.includes(server.port) ? serverDemandMbps(server, workload) : 0;
      const drawW = available ? rawW : server.powered && server.bootRemaining > 0 && server.status === 'online' ? rawW * 0.3 : 0;
      row.powerW += drawW;
      row.demand += demand;
      row.servers.push({ server, powerW: Math.round(drawW), nominalPowerW: Math.round(rawW), demand, available });
    }
    for (const row of rackRows.values()) {
      row.basePowerCapacityW = row.rack.powerLevel * 2000;
      row.centralPowerCapacityW = row.centralPowerCapacityW || 0;
      row.powerCapacityW = row.basePowerCapacityW + row.centralPowerCapacityW;
      const powerRatio = row.powerCapacityW > 0 ? row.powerW / row.powerCapacityW : 1;
      const thermalRatio = row.coolingW > 0 ? row.powerW / row.coolingW : 1;
      row.targetTemperature = clamp(22 + Math.max(0, thermalRatio - 0.45) * 34 + Math.max(0, powerRatio - 0.88) * 24, 22, 100);
      row.temperature = finite(row.rack.temperature) ? clamp(row.rack.temperature, 22, 100) : row.targetTemperature;
      const uplinkFactor = row.demand <= 0 ? 1 : Math.min(1, row.uplink / row.demand);
      for (const node of row.servers) node.networkFactor = node.demand <= 0 ? 1 : clamp(Math.min(1, row.portSpeed / node.demand, uplinkFactor), 0.08, 1);
      row.networkFactor = row.demand <= 0 ? 1 : clamp(row.servers.reduce((sum, node) => sum + node.demand * Math.min(1, row.portSpeed / Math.max(1, node.demand), uplinkFactor), 0) / row.demand, 0.08, 1);
      row.powerFactor = powerRatio <= 1 ? 1 : clamp(1 / powerRatio, 0.55, 1);
      row.thermalFactor = clamp(1 - Math.max(0, row.temperature - 35) * 0.012, 0.55, 1);
    }
    return rackRows;
  }
  function advanceTemperatures(s, dt) {
    for (const row of hardwareSnapshot(s).values()) {
      const passiveCooling = Boolean(s.facility.operation && s.facility.operation.rackId === row.rack.id);
      const tau = row.targetTemperature > row.temperature ? 45 : passiveCooling ? 180 : 120;
      const next = row.targetTemperature + (row.temperature - row.targetTemperature) * Math.exp(-dt / tau);
      row.rack.temperature = Math.abs(next - row.targetTemperature) < 0.005 ? row.targetTemperature : clamp(next, 22, 100);
    }
  }
  function serverLinkState(s, server, rack = s.facility.racks.find(x => x.id === server.rackId)) {
    return Boolean(rack && server.status === 'online' && server.condition > 0 && server.powered && server.bootRemaining <= 0 && !rack.disabledPorts.includes(server.port) && !(s.facility.operation && s.facility.operation.rackId === rack.id) && !s.resilience.incident);
  }

  function gpuSnapshot(s, hardware = hardwareSnapshot(s)) {
    let installed = 0, capacity = 0;
    for (const server of s.servers) {
      const gpuCount = HARDWARE[server.type].gpuCount || 0;
      if (!gpuCount) continue;
      installed += gpuCount * server.level;
      const rack = hardware.get(server.rackId), node = rack && rack.servers.find(row => row.server.id === server.id);
      if (node && node.available && serverLinkState(s, server, rack.rack)) capacity += gpuCount * server.level * node.networkFactor * rack.powerFactor * rack.thermalFactor;
    }
    let remaining = capacity, used = 0;
    const allocations = {}, blocked = {};
    for (const job of s.jobs) {
      if (job.kind !== 'ai') continue;
      const demand = job.gpuDemand || 1;
      const allocated = Math.min(demand, remaining);
      allocations[job.id] = allocated;
      remaining -= allocated; used += allocated;
      if (allocated + 1e-9 < demand) blocked[job.id] = allocated > 0 ? `GPU-Auftrag gedrosselt: ${allocated.toFixed(1)} von ${demand} GPUs effektiv verfügbar.` : capacity <= 0 ? gpuUnavailableReason(s) : 'GPU-Kapazität ist belegt; der Auftrag wartet auf freie Beschleuniger.';
    }
    return { installed, capacity, used, load: capacity > 0 ? used / capacity : 0, allocations, blocked };
  }
  function gpuUnavailableReason(s) {
    if (s.resilience.incident) return 'KI-Aufträge pausieren während der offenen Versorgungskrise.';
    const aiServers = s.servers.filter(server => server.type === 'ai');
    if (!aiServers.length) return 'Kein ROOT A480 mit verfügbaren GPUs installiert.';
    if (s.facility.operation && aiServers.some(server => server.rackId === s.facility.operation.rackId)) return 'KI-Aufträge pausieren während der Rack-Wartung.';
    if (aiServers.every(server => !server.powered)) return 'KI-Aufträge pausieren: Beschleuniger-Server ist ausgeschaltet.';
    if (aiServers.every(server => server.bootRemaining > 0)) return 'KI-Aufträge pausieren: Beschleuniger-Server startet noch.';
    if (aiServers.every(server => server.status === 'failed' || server.status === 'repairing')) return 'KI-Aufträge pausieren: Beschleuniger-Server ist ausgefallen oder in Wartung.';
    return 'KI-Aufträge pausieren: keine betriebsbereite GPU-Verbindung verfügbar.';
  }

  function getMetrics(s) {
    const upgrades = s.upgrades || {};
    const hardware = hardwareSnapshot(s);
    const gpu = gpuSnapshot(s, hardware);
    const cooling = Math.pow(0.92, Math.min(MAX_RESEARCH_LEVEL, upgrades.cooling || 0));
    const central = centralLevels(s);
    const globalPower = s.policies.power;
    const policyCapacity = globalPower === 'performance' ? 1.15 : globalPower === 'eco' ? 0.9 : 1;
    const policyPower = globalPower === 'performance' ? 1.3 : globalPower === 'eco' ? 0.68 : 1;
    const policyHeat = globalPower === 'performance' ? 1.35 : globalPower === 'eco' ? 0.72 : 1;
    const policyWork = globalPower === 'performance' ? 1.12 : globalPower === 'eco' ? 0.86 : 1;
    let capacity = 0, serverIncome = 0, economicPower = 0, physicalPowerW = 0, heat = 0, onlineServers = 0, failedServers = 0, hardwareWeighted = 0, hardwareWeight = 0;
    for (const server of s.servers) {
      const rack = hardware.get(server.rackId);
      const node = rack && rack.servers.find(x => x.server.id === server.id);
      if (server.status !== 'online' || server.condition <= 0 || !node || !node.available || !serverLinkState(s, server, rack.rack)) {
        if (server.status === 'failed') failedServers++;
        continue;
      }
      onlineServers++;
      const c = catalog.servers[server.type], level = server.level;
      const physicalFactor = node.networkFactor * rack.powerFactor * rack.thermalFactor;
      const mode = server.mode;
      const capFactor = mode === 'performance' ? 1.35 : mode === 'eco' ? 0.78 : 1;
      const powerFactor = mode === 'performance' ? 1.65 : mode === 'eco' ? 0.58 : 1;
      capacity += c.capacity * Math.pow(level, 0.82) * capFactor * policyCapacity * physicalFactor;
      const baseCapacity = c.capacity * Math.pow(level, 0.82) * capFactor * policyCapacity;
      hardwareWeighted += baseCapacity * physicalFactor; hardwareWeight += baseCapacity;
      economicPower += c.power * level * powerFactor * policyPower;
      physicalPowerW += node.powerW;
      serverIncome += (server.type === 'ai' ? 0.62 : server.type === 'compute' ? 0.72 : server.type === 'storage' ? 0.48 : 0.56) * Math.pow(level, 0.72) * (mode === 'eco' ? 1.08 : mode === 'performance' ? 0.92 : 1) * physicalFactor;
      heat += (server.type === 'ai' ? 12 : server.type === 'compute' ? 5.6 : server.type === 'storage' ? 2.2 : 3.1) * level * (mode === 'performance' ? 1.8 : mode === 'eco' ? 0.42 : 1) * policyHeat * (1 + Math.max(0, rack.temperature - 35) / 80);
    }
    physicalPowerW = [...hardware.values()].reduce((sum, row) => sum + row.powerW, 0);
    // A disconnected node still consumes electricity. A powered-off node does not.
    economicPower = [...hardware.values()].reduce((sum, row) => sum + row.servers.reduce((value, node) => value + node.powerW / 100, 0), 0);
    const power = physicalPowerW / 1000;
    const facilityMaintenance = s.facility.racks.reduce((sum, r) => sum + 0.025 * (r.switchLevel + r.powerLevel + r.coolingLevel), 0);
    const centralPowerW = [...hardware.values()].reduce((sum, row) => sum + row.centralPowerW, 0);
    const centralDistributionCapacityW = central.distribution * 6000;
    const centralDistributionWPerRack = activeRackIds(s).size ? [...hardware.values()].reduce((sum, row) => sum + row.centralPowerCapacityW, 0) / activeRackIds(s).size : 0;
    const centralUpkeep = centralOperatingCost(central, centralPowerW, s.policies.power);
    const installedEconomicPower = s.servers.reduce((sum, server) => sum + catalog.servers[server.type].power * server.level, 0);
    const usedCapacity = s.jobs.reduce((a, j) => a + j.load, 0);
    const load = capacity > 0 ? usedCapacity / capacity : 1;
    const hardwareFactor = hardwareWeight > 0 ? hardwareWeighted / hardwareWeight : 0;
    const activeAgents = s.agents.filter(a => !a.assignment);
    const engineers = activeAgents.filter(a => a.role === 'engineer').reduce((v, a) => v + a.level, 0);
    const maintenanceFocus = activeAgents.filter(a => a.focus === 'maintenance').reduce((v, a) => v + a.level, 0);
    heat = Math.max(0, heat * cooling * (1 - Math.min(0.32, engineers * 0.035 + maintenanceFocus * 0.018)) + Math.max(0, load - 0.68) * 20);
    const averageCondition = onlineServers ? s.servers.filter(x => serverLinkState(s, x, hardware.get(x.rackId)?.rack)).reduce((v, x) => v + x.condition, 0) / onlineServers : 25;
    const reliability = clamp(91 - Math.max(0, heat - 8) * 0.55 - Math.max(0, load - 0.8) * 34 + Math.min(10, engineers * 1.4) + (s.policies.autorepair ? 9 : -7) - Math.max(0, 90 - averageCondition) * 0.32, 20, 99.5);
    const upkeep = economicPower * (s.policies.power === 'eco' ? 0.035 : s.policies.power === 'performance' ? 0.105 : 0.064) * Math.max(0.48, 1 - engineers * 0.045) + installedEconomicPower * (s.policies.autorepair ? 0.025 : 0) + facilityMaintenance + centralUpkeep;
    const ops = activeAgents.filter(a => a.role === 'operator').reduce((v, a) => v + a.level, 0);
    const incomeMult = Math.pow(1.09, Math.min(MAX_RESEARCH_LEVEL, upgrades.automation || 0));
    const incomePerSecond = onlineServers === 0 || (s.resilience && s.resilience.incident) ? 0.08 + serverIncome * 0.12 : (0.32 + serverIncome + ops * 0.12 + s.reputation * 0.002) * incomeMult - upkeep;
    const analysts = activeAgents.filter(a => a.role === 'analyst').reduce((v, a) => v + a.level, 0);
    const contained = Boolean(s.resilience && s.resilience.incident);
    const researchPerSecond = (onlineServers > 0 && !contained ? 1 : 0) * hardwareFactor * (0.008 + analysts * 0.026 + activeAgents.filter(a => a.focus === 'research').reduce((v, a) => v + a.level * 0.012, 0)) * Math.pow(1.15, Math.min(MAX_RESEARCH_LEVEL, upgrades.synthesis || 0));
    const workBase = activeAgents.reduce((v, a) => v + (a.role === 'engineer' ? 0.83 : 1) * a.level * (a.focus === 'income' ? 1.08 : 1), 0);
    const modePerformance = s.servers.filter(server => server.status === 'online').reduce((v, a) => v + (a.mode === 'performance' ? 0.03 : a.mode === 'eco' ? -0.015 : 0), 0);
    const heatFactor = clamp(1 - heat / 190, 0.52, 1);
    const loadFactor = clamp(1 - Math.max(0, load - 0.62) * 0.42, 0.55, 1);
    const operationFactor = s.resilience && s.resilience.operation && s.resilience.operation.kind === 'backup' ? 0.5 : 1;
    const agentBoost = s.resilience && s.resilience.agentEffects && s.resilience.agentEffects.optimizeRemaining > 0 ? 1.15 : 1;
    const workPerSecond = onlineServers > 0 && !contained ? workBase * (1 + Math.min(MAX_RESEARCH_LEVEL, upgrades.routing || 0) * 0.12 + modePerformance) * policyWork * heatFactor * loadFactor * Math.max(0.35, reliability / 100) * operationFactor * agentBoost * hardwareFactor : 0;
    const activeLoad = s.jobs.reduce((v, j) => v + j.load, 0);
    const jobRates = {};
    const weightFor = j => s.policies.priority === 'income' ? j.reward / Math.max(1, j.totalWork) : s.policies.priority === 'research' ? j.science / Math.max(1, j.totalWork) : 1;
    const totalWeight = s.jobs.reduce((v, j) => v + weightFor(j), 0);
    for (const j of s.jobs) {
      const gpuFactor = j.kind === 'ai' ? (gpu.allocations[j.id] || 0) / Math.max(1, j.gpuDemand || 1) : 1;
      jobRates[j.id] = totalWeight > 0 ? workPerSecond * weightFor(j) / totalWeight * gpuFactor : 0;
    }
    const jobLimit = Math.min(MAX.jobs, Math.max(2, Math.floor(capacity / 9) + Math.floor(s.sector / 2)));
    const serverLimit = getServerLimit(s);
    const agentLimit = Math.min(MAX.agents, 3 + s.sector * 2);
    const sectorCost = cost(s, 'sector');
    const exposed = s.servers.filter(server => serverLinkState(s, server, hardware.get(server.rackId)?.rack));
    const riskCondition = exposed.length ? exposed.reduce((v, x) => v + (100 - x.condition), 0) / exposed.length : 0;
    const diagnoseBonus = s.resilience && s.resilience.agentEffects && s.resilience.agentEffects.diagnoseRemaining > 0 ? 12 : 0;
    const riskMitigation = Math.min(26, engineers * 2.6 + maintenanceFocus * 1.1 + (s.policies.autorepair ? 4 : 0) + Math.min(3, (upgrades.cooling || 0) * 0.35) + diagnoseBonus);
    const riskPerHour = clamp(24 + Math.max(0, heat - 8) * 0.42 + Math.max(0, load - 0.55) * 24 + riskCondition * 0.48 + (globalPower === 'performance' ? 9 : globalPower === 'eco' ? -7 : 0) + failedServers * 14 - riskMitigation, 4, 96);
    const upsCapacityW = central.ups * 3000;
    const upsCoverage = upsCapacityW > 0 ? clamp(upsCapacityW / Math.max(1, physicalPowerW), 0, 1) : 0;
    const powerRiskReductionPct = upsCoverage * 65;
    const incidentActive = Boolean(s.resilience && s.resilience.incident);
    const safetyMode = incidentActive;
    return { capacity, usedCapacity, load, power, powerW: physicalPowerW, maxRackTemperature: Math.max(22, ...[...hardware.values()].map(row => row.temperature)), heat: clamp(heat, 0, 100), hardwareFactor, reliability, incomePerSecond: Math.max(0.025, incomePerSecond), researchPerSecond, workPerSecond, upkeep, serverLimit, agentLimit, jobLimit, sectorCost, expansionReady: !incidentActive && s.credits >= sectorCost && s.servers.length >= Math.min(serverLimit, 2 + s.sector) && s.counters.jobs >= s.sector * 3, jobRates, activeLoad, onlineServers, failedServers, riskPerHour, upsCapacityW, upsCoverage, powerRiskReductionPct, centralCoolingW: central.cooling * 3500, centralDistributionCapacityW, centralDistributionWPerRack, centralUpkeep, centralPowerW, safetyMode, incidentActive, gpuCapacity: gpu.capacity, gpuInstalled: gpu.installed, gpuUsed: gpu.used, gpuLoad: gpu.load, jobBlockedReasons: gpu.blocked };
  }

  function portCount(rack) { return rack.switchLevel === 1 ? 8 : 16; }
  function fitServer(s, rack, type, requestedUnit, requestedPort, exceptId = null) {
    const size = HARDWARE[type].units;
    const occupied = new Set();
    const usedPorts = new Set();
    for (const server of s.servers) if (server.id !== exceptId && server.rackId === rack.id) {
      usedPorts.add(server.port);
      for (let u = server.unit; u < server.unit + HARDWARE[server.type].units; u++) occupied.add(u);
    }
    const unit = requestedUnit == null ? (() => { for (let u = FIRST_DEVICE_UNIT; u + size - 1 <= LAST_DEVICE_UNIT; u++) { let free = true; for (let v = u; v < u + size; v++) if (occupied.has(v)) free = false; if (free) return u; } return null; })() : requestedUnit;
    const port = requestedPort == null ? (() => { for (let p = 1; p <= portCount(rack); p++) if (!usedPorts.has(p) && !rack.disabledPorts.includes(p)) return p; return null; })() : requestedPort;
    if (!Number.isInteger(unit) || unit < FIRST_DEVICE_UNIT || unit + size - 1 > LAST_DEVICE_UNIT) return { ok: false, reason: 'Das Gerät passt nicht in die freien Höheneinheiten dieses Racks.' };
    for (let u = unit; u < unit + size; u++) if (occupied.has(u)) return { ok: false, reason: `Höheneinheit U${u} ist bereits belegt.` };
    if (!Number.isInteger(port) || port < 1 || port > portCount(rack)) return { ok: false, reason: `Dieser Switch hat ${portCount(rack)} Ports.` };
    if (usedPorts.has(port)) return { ok: false, reason: `Port ${port} ist bereits belegt.` };
    if (rack.disabledPorts.includes(port)) return { ok: false, reason: `Port ${port} ist deaktiviert.` };
    return { ok: true, unit, port };
  }
  function quoteHardware(s, action, payload = {}) {
    payload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const quote = (label, description, costValue = 0, duration = 0, reason = '', warnings = []) => ({ label, description, cost: costValue, duration, enabled: !reason, reason, ...(warnings.length ? { warnings } : {}) });
    const locked = Boolean(s.resilience.incident || s.resilience.operation || s.facility.operation || s.facility.centralOperation);
    if (action === 'upgradeCentral') {
      const system = CENTRAL_SYSTEMS.find(item => item.id === payload.system);
      return system ? centralQuote(s, system) : quote('Zentralanlage ausbauen', 'Unbekanntes zentrales System.', 0, 0, 'Dieses zentrale System ist unbekannt.');
    }
    if (action === 'buyRack') {
      const price = rackPrice(s);
      const reason = s.facility.racks.length >= rackLimit(s) ? 'Die Standortgrenze für Racks ist erreicht.' : locked ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.' : cashReason(s, price);
      return quote('Rack kaufen', `Neues 18-HE-Rack mit 8-Port-Switch, 2-kW-Stromversorgung und 2-kW-Kühlung; ${price} Credits.`, price, 0, reason);
    }
    if (action === 'buyServer') {
      if (!own(catalog.servers, payload.type)) return quote('Server einsetzen', 'Unbekannter Gerätetyp.', 0, 0, 'Dieser Servertyp ist unbekannt.');
      const price = cost(s, 'server', payload.type);
      const rack = payload.rackId ? s.facility.racks.find(r => r.id === payload.rackId) : s.facility.racks.find(r => fitServer(s, r, payload.type, payload.unit, payload.port).ok);
      const placement = rack && fitServer(s, rack, payload.type, payload.unit, payload.port);
      const reason = s.servers.length >= getMetrics(s).serverLimit ? 'Der Sektor hat seine Servergrenze erreicht.' : locked ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.' : !rack ? 'Kein passender freier Rackplatz oder Switch-Port verfügbar.' : !placement.ok ? placement.reason : cashReason(s, price);
      const warnings = rack ? (() => { const row = hardwareSnapshot(s).get(rack.id); return row && row.powerW + specPowerW({ type: payload.type, level: 1, mode: 'balanced' }, s.policies.power) > row.powerCapacityW ? ['Die Rack-Stromlast überschreitet danach die Nennleistung; Knoten werden gedrosselt und wärmer.'] : []; })() : [];
      return quote('Server einsetzen', `${price} Credits; Einbau in ${rack ? rack.name + ' U' + (placement && placement.unit || '?') : 'einen freien Rackplatz'} an Port ${placement && placement.port || '?'}.`, price, 0, reason, warnings);
    }
    if (action === 'upgradeRack') {
      const rack = s.facility.racks.find(r => r.id === payload.rackId);
      if (!rack || !['switch', 'power', 'cooling'].includes(payload.component)) return quote('Rack-Ausbau', 'Rack oder Komponente unbekannt.', 0, 0, 'Rack oder Komponente unbekannt.');
      const q = rackComponentQuote(s, rack, payload.component);
      return { ...q, enabled: q.enabled && !locked, reason: locked ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.' : q.reason };
    }
    if (action === 'setServerPower') {
      const server = s.servers.find(x => x.id === payload.id);
      const reason = !server ? 'Server nicht gefunden.' : locked ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.' : typeof payload.on !== 'boolean' ? 'Schaltzustand ist ungültig.' : server.powered === payload.on ? 'Der Server hat diesen Schaltzustand bereits.' : server.status === 'repairing' || server.status === 'failed' ? 'Ausgefallene oder gewartete Server lassen sich hier nicht schalten.' : '';
      return quote(payload.on ? 'Server einschalten' : 'Server ausschalten', payload.on ? '30 Sekunden Bootzeit; währenddessen keine Produktion.' : 'Sofortige Unterbrechung von Produktion und Verbindung.', 0, payload.on ? 30 : 0, reason);
    }
    if (action === 'setSwitchPort') {
      const rack = s.facility.racks.find(r => r.id === payload.rackId);
      const currently = rack && !rack.disabledPorts.includes(payload.port);
      const reason = !rack ? 'Rack nicht gefunden.' : locked ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.' : !Number.isInteger(payload.port) || payload.port < 1 || payload.port > portCount(rack) ? 'Switch-Port ist ungültig.' : currently === payload.enabled ? 'Der Port hat diesen Schaltzustand bereits.' : typeof payload.enabled !== 'boolean' ? 'Schaltzustand ist ungültig.' : '';
      return quote(payload.enabled ? 'Port aktivieren' : 'Port trennen', payload.enabled ? 'Die Verbindung wird sofort wiederhergestellt.' : 'Angeschlossener Knoten wird sofort vom Netz getrennt.', 0, 0, reason);
    }
    if (action === 'moveServer') {
      const server = s.servers.find(x => x.id === payload.id), rack = s.facility.racks.find(r => r.id === payload.rackId);
      const placement = server && rack && fitServer(s, rack, server.type, payload.unit, payload.port, server.id);
      const price = Math.ceil(60 * (1 + Math.max(0, s.sector - 1) * 0.25));
      const reason = !server ? 'Server nicht gefunden.' : !rack ? 'Ziel-Rack nicht gefunden.' : locked ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.' : server.status !== 'online' || !server.powered || server.bootRemaining > 0 ? 'Nur betriebsbereite Server können umgesetzt werden.' : !placement.ok ? placement.reason : server.rackId === rack.id && server.unit === placement.unit && server.port === placement.port ? 'Der Server befindet sich bereits an diesem Platz.' : cashReason(s, price);
      return quote('Server umsetzen', `${price} Credits; der Server startet am Zielrack mit 30 Sekunden Bootzeit neu.`, price, 30, reason);
    }
    return quote('Infrastruktur', 'Unbekannte Hardwareaktion.', 0, 0, 'Diese Hardwareaktion ist unbekannt.');
  }

  function getRackModel(s, metrics = getMetrics(s)) {
    const rows = hardwareSnapshot(s), all = [];
    const gpu = gpuSnapshot(s, rows);
    const jobLoad = s.jobs.reduce((sum, job) => sum + job.load, 0);
    const activity = clamp(jobLoad / Math.max(1, metrics.capacity), 0, 1);
    const workload = jobLoad / Math.max(1, s.servers.reduce((sum, server) => sum + catalog.servers[server.type].capacity * Math.pow(server.level, 0.82), 0));
    for (const rack of s.facility.racks) {
      const row = rows.get(rack.id);
      const occupied = new Set(), servers = [];
      const portServers = new Map(row.servers.map(node => [node.server.port, node.server]));
      for (const physicalNode of row.servers.slice().sort((a, b) => a.server.unit - b.server.unit)) {
        const server = physicalNode.server;
        const spec = HARDWARE[server.type];
        for (let u = server.unit; u < server.unit + spec.units; u++) occupied.add(u);
        const linked = Boolean(physicalNode.available && !rack.disabledPorts.includes(server.port));
        const networkFactor = linked ? physicalNode.networkFactor : 0;
        const status = s.facility.operation && s.facility.operation.rackId === rack.id ? 'maintenance' : server.status === 'failed' ? 'failed' : server.status === 'repairing' ? 'repairing' : server.bootRemaining > 0 && server.powered ? 'booting' : !server.powered ? 'standby' : !linked ? 'disconnected' : 'online';
        const serverActivity = status === 'online' ? activity : 0;
        const gpuCount = (spec.gpuCount || 0) * server.level;
        const gpuCapacity = physicalNode && physicalNode.available && linked ? gpuCount * networkFactor * row.powerFactor * row.thermalFactor : 0;
        const gpuUsed = gpu.capacity > 0 ? gpu.used * gpuCapacity / gpu.capacity : 0;
        servers.push({ id: server.id, name: server.name, type: server.type, model: spec.model, level: server.level, unit: server.unit, units: spec.units, port: server.port, cores: spec.cores * server.level, ramGB: spec.ramGB * server.level, storageTB: spec.storageTB * server.level, driveBays: spec.driveBays, gpuCount, vramGB: (spec.vramGB || 0) * server.level, gpuCapacity, gpuUsed, gpuLoad: gpuCapacity > 0 ? gpuUsed / gpuCapacity : 0, networkDemandMbps: physicalNode ? Math.round(physicalNode.demand) : 0, powerW: physicalNode ? physicalNode.powerW : 0, temperature: row.temperature, condition: server.condition, powered: server.powered, bootRemaining: server.bootRemaining, status, link: linked, activity: serverActivity, capacity: catalog.servers[server.type].capacity * Math.pow(server.level, 0.82) * (server.mode === "performance" ? 1.35 : server.mode === "eco" ? 0.78 : 1) * (s.policies.power === "performance" ? 1.15 : s.policies.power === "eco" ? 0.9 : 1) * networkFactor * row.powerFactor * row.thermalFactor, networkFactor, warnings: [...(row.powerW > row.powerCapacityW ? ['Rack-Stromlast liegt über der Nennleistung.'] : []), ...(row.temperature > 35 ? ['Hohe Racktemperatur drosselt den Durchsatz.'] : []), ...(!linked && server.status === 'online' ? ['Keine aktive Verbindung zum Switch.'] : [])] });
      }
      const ports = Array.from({ length: portCount(rack) }, (_, index) => {
        const number = index + 1, server = portServers.get(number), enabled = !rack.disabledPorts.includes(number), link = Boolean(server && enabled && serverLinkState(s, server, rack));
        const demand = link ? serverDemandMbps(server, workload) : 0;
        return { number, serverId: server ? server.id : null, enabled, link, speedMbps: row.portSpeed, trafficMbps: link ? Math.min(row.portSpeed, demand * Math.min(1, row.uplink / Math.max(1, row.demand))) : 0 };
      });
      const warnings = [];
      const saturatedPorts = row.servers.filter(node => node.available && serverLinkState(s, node.server, rack) && node.demand > row.portSpeed);
      if (saturatedPorts.length) warnings.push(`${saturatedPorts.length} Switch-Port${saturatedPorts.length > 1 ? 's' : ''} begrenzt: ${row.portSpeed} Mbit/s je Anschluss. Ein Switch-Ausbau erhöht die nutzbare Leistung.`);
      if (row.powerW > row.powerCapacityW) warnings.push(`Last ${Math.round(row.powerW)} W über Nennleistung ${row.powerCapacityW} W; Server werden gedrosselt.`);
      if (row.temperature > 35) warnings.push(`Temperatur ${Math.round(row.temperature)} °C reduziert Leistung.`);
      if (row.demand > row.uplink) warnings.push(`Uplink überlastet: ${Math.round(row.demand)} / ${row.uplink} Mbit/s.`);
      const status = s.facility.operation && s.facility.operation.rackId === rack.id ? 'maintenance' : row.powerW > row.powerCapacityW || row.temperature > 35 || row.demand > row.uplink || saturatedPorts.length > 0 ? 'limited' : 'online';
      all.push({ id: rack.id, name: rack.name, units: RACK_UNITS, usedUnits: occupied.size, freeUnits: LAST_DEVICE_UNIT - FIRST_DEVICE_UNIT + 1 - occupied.size, switchLevel: rack.switchLevel, powerLevel: rack.powerLevel, coolingLevel: rack.coolingLevel, powerW: Math.round(row.powerW), powerCapacityW: row.powerCapacityW, basePowerCapacityW: row.basePowerCapacityW, centralPowerCapacityW: row.centralPowerCapacityW, powerFactor: row.powerFactor, coolingW: row.coolingW, centralCoolingW: row.centralCoolingW, temperature: row.temperature, targetTemperature: row.targetTemperature, networkDemandMbps: Math.round(row.demand), uplinkMbps: row.uplink, networkFactor: row.networkFactor, status, warnings, upgrades: { switch: rackComponentQuote(s, rack, 'switch'), power: rackComponentQuote(s, rack, 'power'), cooling: rackComponentQuote(s, rack, 'cooling') }, ports, servers });
    }
    const totalDemandMbps = all.reduce((n, r) => n + r.networkDemandMbps, 0);
    return { rackLimit: rackLimit(s), buyRack: quoteHardware(s, 'buyRack'), operation: s.facility.operation ? { kind: s.facility.operation.kind, label: s.facility.operation.label, rackId: s.facility.operation.rackId, remaining: s.facility.operation.remaining, total: s.facility.operation.total, targetLevel: s.facility.operation.targetLevel, cost: s.facility.operation.cost } : null, totalUnits: all.length * RACK_UNITS, usedUnits: all.reduce((n, r) => n + r.usedUnits, 0), totalPowerW: Math.round(metrics.powerW), totalCoolingW: all.reduce((n, r) => n + r.coolingW, 0), totalDemandMbps, totalUplinkMbps: all.reduce((n, r) => n + r.uplinkMbps, 0), networkFactor: totalDemandMbps ? clamp(all.reduce((n, r) => n + r.networkDemandMbps * r.networkFactor, 0) / totalDemandMbps, 0, 1) : 1, gpuCapacity: metrics.gpuCapacity, gpuInstalled: metrics.gpuInstalled, gpuUsed: metrics.gpuUsed, gpuLoad: metrics.gpuLoad, racks: all };
  }
  function getServerLimit(s) { return Math.min(MAX.servers, 3 + s.sector * 2); }
  function getFacilityLayout(s) {
    const racksPerRoom = 6, roomsPerFloor = 4;
    const rooms = [];
    const serverCounts = new Map();
    for (const server of s.servers) serverCounts.set(server.rackId, (serverCounts.get(server.rackId) || 0) + 1);
    for (let start = 0; start < s.facility.racks.length; start += racksPerRoom) {
      const index = rooms.length;
      const rackIds = s.facility.racks.slice(start, start + racksPerRoom).map(rack => rack.id);
      rooms.push({ id: `room-${index + 1}`, index, floor: Math.floor(index / roomsPerFloor) + 1, number: index + 1, rackIds, rackCount: rackIds.length, serverCount: rackIds.reduce((sum, id) => sum + (serverCounts.get(id) || 0), 0) });
    }
    const roomCount = rooms.length;
    return { racksPerRoom, roomsPerFloor, roomCount, floorCount: Math.ceil(roomCount / roomsPerFloor), rooms, rackLimit: rackLimit(s), serverLimit: getServerLimit(s) };
  }
  function getCentralInfrastructure(s) {
    const levels = centralLevels(s), hardware = hardwareSnapshot(s), metrics = getMetrics(s), activeRackCount = activeRackIds(s).size;
    const systems = CENTRAL_SYSTEMS.map(system => {
      const level = levels[system.id];
      const common = { id: system.id, name: system.name, unlockSector: system.unlockSector, level, maxLevel: system.maxLevel, available: s.sector >= system.unlockSector, active: level > 0, status: s.sector < system.unlockSector ? 'locked' : level > 0 ? 'active' : 'available', quote: centralQuote(s, system) };
      if (system.id === 'cooling') return { ...common, totalCoolingW: level * 3500, allocatedCoolingW: [...hardware.values()].reduce((sum, row) => sum + row.centralCoolingW, 0), activeRackCount };
      if (system.id === 'ups') return { ...common, upsCapacityW: metrics.upsCapacityW, coverage: metrics.upsCoverage, powerRiskReductionPct: metrics.powerRiskReductionPct };
      return { ...common, distributionCapacityW: metrics.centralDistributionCapacityW, additionalPowerWPerRack: metrics.centralDistributionWPerRack, totalAdditionalPowerW: metrics.centralDistributionWPerRack * activeRackCount, activeRackCount };
    });
    const operation = s.facility.centralOperation ? { ...s.facility.centralOperation, name: CENTRAL_SYSTEMS.find(system => system.id === s.facility.centralOperation.system).name, label: `${CENTRAL_SYSTEMS.find(system => system.id === s.facility.centralOperation.system).name} ausbauen` } : null;
    return { systems, operation, upkeep: metrics.centralUpkeep, powerW: metrics.centralPowerW, coolingCapacityW: metrics.centralCoolingW, activeRackCount, upsCapacityW: metrics.upsCapacityW, upsCoverage: metrics.upsCoverage, powerRiskReductionPct: metrics.powerRiskReductionPct, distributionCapacityW: metrics.centralDistributionCapacityW, distributionCapacityWPerRack: metrics.centralDistributionWPerRack };
  }
  function specPowerW(server, policy = 'balanced') {
    const modeFactor = server.mode === 'performance' ? 1.65 : server.mode === 'eco' ? 0.58 : 1;
    const policyFactor = policy === 'performance' ? 1.3 : policy === 'eco' ? 0.68 : 1;
    return Math.round(catalog.servers[server.type].power * server.level * 100 * modeFactor * policyFactor);
  }
  function updateAchievementUnlocks(s) {
    if (!s.achievementUnlocks) s.achievementUnlocks = Object.fromEntries(catalog.achievements.map(a => [a.id, false]));
    for (const achievement of catalog.achievements) {
      if (s.achievementUnlocks[achievement.id]) continue;
      if (s.achievements[achievement.id] || achievement.check(s)) s.achievementUnlocks[achievement.id] = true;
    }
  }

  function workSnapshot(s) { return s.jobs.map(j => ({ id: j.id, work: j.work })); }
  function cashReason(s, amount) {
    if (amount <= 0) return '';
    return s.credits < amount ? `Benötigt ${Math.ceil(amount)} Credits; verfügbar sind ${Math.floor(s.credits)}.` : '';
  }
  function makeOption({ key, label, description, cost = 0, parts = 0, duration = 0, enabled = true, reason = '', researchLoss = 0, workLoss = 0, researchRestore = 0, workRestore = 0, reputationLoss = 0 }) {
    return { key, label, description, cost, parts, duration, enabled, reason, researchLoss, workLoss, researchRestore, workRestore, reputationLoss };
  }
  function repairQuotes(s, server) {
    const scale = 1 + Math.max(0, s.sector - 1) * 0.18 + Math.max(0, s.servers.length - 1) * 0.03;
    const repairable = server.status === 'failed' || server.condition < 60;
    const locked = s.resilience.operation || s.resilience.incident || s.facility.operation || s.facility.centralOperation;
    const reason = locked ? 'Eine andere Wartungs- oder Krisenmaßnahme läuft.' : repairable ? '' : 'Dieser Server ist ausreichend intakt.';
    const condition = server.condition;
    const options = [
      { key: 'patch', label: 'Schnellreparatur', cost: Math.ceil((78 + Math.max(0, 60 - condition) * 1.7) * scale), parts: 1, duration: 60, result: Math.max(condition, 60), workPct: 0 },
      { key: 'overhaul', label: 'Generalüberholung', cost: Math.ceil((260 + Math.max(0, 100 - condition) * 2.1) * scale), parts: 2, duration: 240, result: 100, workPct: 0 },
      { key: 'manual', label: 'Manuelle Wiederherstellung', cost: 0, parts: 0, duration: 600, result: Math.max(condition, 45), workPct: 0.1 }
    ];
    return options.map(x => {
      const workLoss = s.jobs.reduce((sum, j) => sum + j.work * x.workPct, 0);
      const shortage = s.resilience.parts < x.parts ? `Benötigt ${x.parts} Ersatzteile, vorhanden sind ${s.resilience.parts}.` : cashReason(s, x.cost);
      const disabledReason = reason || shortage;
      return { ...makeOption({ key: x.key, label: x.label, cost: x.cost, parts: x.parts, duration: x.duration, enabled: !disabledReason && repairable, reason: disabledReason, workLoss,
        description: `${x.cost} Credits, ${x.parts} Ersatzteile, ${x.duration} Sekunden Ausfallzeit; Zustand danach ${Math.round(x.result)}%.${workLoss ? ` Dabei gehen ${workLoss.toFixed(1)} Arbeitseinheiten verloren.` : ' Kein Auftragsfortschritt geht verloren.'}` }), condition: x.result };
    });
  }
  function corruptionRestoreQuote(s) {
    const backup = s.resilience.backup;
    const targetResearch = backup ? backup.protectedResearch : 0;
    const byId = new Map(backup ? backup.jobs.map(j => [j.id, j.work]) : []);
    let workLoss = 0, workRestore = 0;
    for (const job of s.jobs) {
      const target = backup && byId.has(job.id) ? byId.get(job.id) : 0;
      workLoss += Math.max(0, job.work - target); workRestore += Math.max(0, target - job.work);
    }
    const researchLoss = Math.max(0, s.research - targetResearch);
    const researchRestore = Math.max(0, targetResearch - s.research);
    return { targetResearch, jobTargets: s.jobs.map(j => ({ id: j.id, work: backup && byId.has(j.id) ? byId.get(j.id) : 0 })), researchLoss, researchRestore, workLoss, workRestore };
  }
  function incidentQuotes(s) {
    const incident = s.resilience.incident;
    if (!incident) return null;
    const locked = Boolean(s.resilience.operation || s.facility.operation || s.facility.centralOperation || incident.resolution);
    const baseReason = s.facility.operation || s.facility.centralOperation ? 'Die laufende Infrastrukturmaßnahme muss zuerst abgeschlossen werden.' : locked ? 'Die Krisenmaßnahme läuft bereits; ihre Folgen sind festgelegt.' : '';
    const scale = 1 + Math.max(0, s.sector - 1) * 0.18;
    let rows;
    if (incident.kind === 'power') rows = [
      { key: 'reroute', label: 'Last umleiten', cost: Math.ceil(150 * scale), parts: 0, duration: 90, condition: 64, reputationLoss: 0, workPct: 0.08, text: 'Leitet die betroffenen Knoten zurück auf einen sicheren Betriebsmodus.' },
      { key: 'replace', label: 'Schaltmodul ersetzen', cost: Math.ceil(280 * scale), parts: 1, duration: 210, condition: 90, reputationLoss: 0, workPct: 0, text: 'Ersetzt das defekte Modul und stellt die volle Netzleistung wieder her.' },
      { key: 'manual', label: 'Manuelle Notumschaltung', cost: 0, parts: 0, duration: 480, condition: 48, reputationLoss: 2, workPct: 0.12, text: 'Kostenfrei, aber langsam; der Kunde erhält eine Gutschrift und laufende Arbeit geht teilweise verloren.' }
    ];
    else if (incident.kind === 'cooling') rows = [
      { key: 'shed_load', label: 'Last abwerfen', cost: 0, parts: 0, duration: 150, condition: 58, reputationLoss: 1, workPct: 0.2, text: 'Schaltet betroffene Knoten vorsichtig wieder frei, senkt aber laufende Auftragsarbeit.' },
      { key: 'cooling_unit', label: 'Kühlaggregat tauschen', cost: Math.ceil(330 * scale), parts: 2, duration: 300, condition: 96, reputationLoss: 0, workPct: 0, text: 'Tauscht das Aggregat und bringt die betroffenen Knoten fast in den Neuzustand.' },
      { key: 'manual', label: 'Notlüftung öffnen', cost: 0, parts: 0, duration: 660, condition: 45, reputationLoss: 3, workPct: 0.16, text: 'Kostenfreie Notlösung mit langem Stillstand und eingeschränkter Leistung.' }
    ];
    else {
      const restore = corruptionRestoreQuote(s);
      rows = [
        { key: 'restore_backup', label: 'Letzte Betriebssicherung laden', cost: Math.ceil(190 * scale), parts: 0, duration: 180, condition: 82, reputationLoss: 0, workPct: 0, text: 'Stellt den letzten validierten Stand wieder her.', researchLoss: restore.researchLoss, researchRestore: restore.researchRestore, workLoss: restore.workLoss, workRestore: restore.workRestore, backupRestore: true },
        { key: 'rebuild', label: 'Datenbestand neu aufbauen', cost: Math.ceil(360 * scale), parts: 1, duration: 420, condition: 90, reputationLoss: 2, workPct: 0.35, text: 'Rekonstruiert den Datenbestand aus aktiven Knoten.' },
        { key: 'manual', label: 'Manuelle Datenrettung', cost: 0, parts: 0, duration: 900, condition: 42, reputationLoss: 6, workPct: 0.6, text: 'Kostenfreie Notrettung; langsam, mit starkem Fortschritts- und Ansehensverlust.' }
      ];
      if (!s.resilience.backup) rows[0].unavailable = 'Es gibt noch keine Betriebssicherung.';
    }
    return rows.map(x => {
      const workLoss = x.backupRestore ? x.workLoss : s.jobs.reduce((sum, j) => sum + j.work * (x.workPct || 0), 0);
      const researchLoss = x.backupRestore ? x.researchLoss : incident.kind === 'corruption' ? s.research * (x.key === 'manual' ? 0.6 : x.key === 'rebuild' ? 0.2 : 0) : 0;
      const shortage = x.unavailable || (s.resilience.parts < x.parts ? `Benötigt ${x.parts} Ersatzteile, vorhanden sind ${s.resilience.parts}.` : cashReason(s, x.cost));
      const reason = baseReason || shortage;
      let detail = `${x.cost} Credits, ${x.parts} Ersatzteile und ${x.duration} Sekunden Krisenbetrieb.`;
      detail += ` Zustand der betroffenen Knoten danach ${x.condition}%.`;
      if (researchLoss) detail += ` Verlust: ${researchLoss.toFixed(1)} Forschung.`;
      if (x.researchRestore) detail += ` Wiederherstellung: ${x.researchRestore.toFixed(1)} Forschung aus der Sicherung.`;
      if (workLoss) detail += ` Verlust: ${workLoss.toFixed(1)} Arbeitseinheiten.`;
      if (x.workRestore) detail += ` Wiederherstellung: ${x.workRestore.toFixed(1)} gespeicherte Arbeitseinheiten.`;
      if (x.reputationLoss) detail += ` Ansehensverlust: ${x.reputationLoss}.`;
      return { ...makeOption({ key: x.key, label: x.label, cost: x.cost, parts: x.parts, duration: x.duration, enabled: !reason, reason, researchLoss, workLoss, researchRestore: x.researchRestore || 0, workRestore: x.workRestore || 0, reputationLoss: x.reputationLoss,
        description: `${x.text} ${detail}` }), condition: x.condition };
    });
  }
  function getResilience(s, rackModel = null, metrics = null) {
    const m = metrics || getMetrics(s), r = s.resilience;
    const now = s.time;
    const incident = r.incident ? { id: r.incident.id, kind: r.incident.kind, title: r.incident.title, description: r.incident.description, consequence: r.incident.consequence, affected: r.incident.affected.slice(), choices: incidentQuotes(s) } : null;
    const backupCost = Math.ceil((125 + s.servers.length * 8) * (1 + Math.max(0, s.sector - 1) * 0.12));
    let backupReason = r.operation || r.incident || r.corrupted || s.facility.operation || s.facility.centralOperation ? 'Eine Krisen- oder Wartungsmaßnahme verhindert gerade eine neue Sicherung.' : '';
    if (!backupReason && now < r.backupCooldownUntil) backupReason = `Die Betriebssicherung ist erst in ${Math.ceil(r.backupCooldownUntil - now)} Sekunden wieder verfügbar.`;
    if (!backupReason) backupReason = cashReason(s, backupCost);
    const backup = makeOption({ key: 'create', label: 'Betriebssicherung erstellen', cost: backupCost, duration: 30, enabled: !backupReason, reason: backupReason,
      description: `${backupCost} Credits und 30 Sekunden mit halbiertem Auftragsdurchsatz; speichert ${s.research.toFixed(1)} Forschung und ${s.jobs.length} aktive Aufträge. Kein Datenverlust.` });
    const partsCost = Math.ceil(220 * (1 + Math.max(0, s.sector - 1) * 0.2));
    const parts = Math.min(3, RESILIENCE_MAX.parts - r.parts), partsReason = r.parts >= RESILIENCE_MAX.parts ? 'Das Ersatzteillager ist bereits voll.' : cashReason(s, partsCost);
    const partsPurchase = makeOption({ key: 'bundle', label: `${parts} Ersatzteil${parts === 1 ? '' : 'e'} kaufen`, cost: partsCost, parts, enabled: !partsReason, reason: partsReason,
      description: `${partsCost} Credits für ${Math.min(parts, RESILIENCE_MAX.parts - r.parts)} Ersatzteile; keine Ausfallzeit.` });
    const displayStatuses = new Map((rackModel || getRackModel(s, m)).racks.flatMap(rack => rack.servers.map(server => [server.id, server.status])));
    const servers = s.servers.map(server => ({ id: server.id, condition: server.condition, status: server.status, displayStatus: displayStatuses.get(server.id) || server.status, fault: server.fault, repairs: repairQuotes(s, server) }));
    const conditions = s.servers.length ? s.servers.reduce((v, x) => v + x.condition, 0) / s.servers.length : 0;
    return {
      online: m.onlineServers, failed: m.failedServers, repairing: s.servers.filter(x => x.status === 'repairing').length,
      condition: conditions, integrity: r.integrity, riskPerHour: m.riskPerHour,
      riskLabel: m.riskPerHour < 28 ? 'niedrig' : m.riskPerHour < 52 ? 'erhöht' : m.riskPerHour < 76 ? 'hoch' : 'kritisch',
      safetyMode: m.safetyMode, graceRemaining: Math.max(0, r.graceUntil - now), parts: r.parts,
      budget: s.policies.repairBudget, spent: r.budgetSpent, reserve: s.policies.reserve, budgetScope: 'Das Stundenbudget gilt für automatische Reparaturen und automatische Betriebssicherungen; manuelle Eingriffe sind ausgenommen.',
      backupAt: r.backup ? r.backup.createdAt : null, backupAge: r.backup ? Math.max(0, now - r.backup.createdAt) : null,
      backupCooldown: Math.max(0, r.backupCooldownUntil - now), backupProtectedResearch: r.backup ? r.backup.protectedResearch : 0,
      backupJobCount: r.backup ? r.backup.jobs.length : 0,
      operation: r.operation ? { kind: r.operation.kind, label: r.operation.label, remaining: r.operation.remaining, total: r.operation.total, serverId: r.operation.serverId } : null,
      incident, servers, backup, partsPurchase
    };
  }

  function getAgentOperations(s) {
    const r = s.resilience, activeEffects = [];
    if (r.agentEffects.diagnoseRemaining > 0) activeEffects.push({ kind: 'diagnose', label: 'Risikodiagnose aktiv', remaining: r.agentEffects.diagnoseRemaining });
    if (r.agentEffects.optimizeRemaining > 0) activeEffects.push({ kind: 'optimize', label: 'Optimierungsprofil aktiv', remaining: r.agentEffects.optimizeRemaining });
    const paused = Boolean(r.incident);
    const agents = s.agents.map(agent => {
      const cooldown = Math.max(0, agent.cooldownUntil - s.time);
      const assignment = agent.assignment ? { kind: agent.assignment.kind, label: agent.assignment.label, remaining: agent.assignment.remaining, total: agent.assignment.total } : null;
      const definitions = [
        { key: 'diagnose', label: 'Netzdiagnose', base: 30, duration: agent.role === 'engineer' ? 90 : 120, result: 'Verringert das Störungsrisiko um bis zu 12 Prozentpunkte pro Stunde für 20 Minuten.' },
        { key: 'optimize', label: 'Last optimieren', base: 60, duration: agent.role === 'operator' ? 120 : 180, result: 'Erhöht den Auftragsdurchsatz um 15% für 15 Minuten.' },
        { key: 'research', label: 'Forschungsauftrag', base: 100, duration: agent.role === 'analyst' ? 240 : 300, result: `${agent.role === 'analyst' ? 8 + 4 * agent.level : 5 + 2 * agent.level} Forschungspunkte bei Abschluss.` }
      ];
      const options = definitions.map(def => {
        const costValue = Math.ceil(def.base * (1 + Math.min(20, Math.max(0, s.sector - 1)) * 0.12));
        let reason = '';
        if (paused) reason = 'Krisenbetrieb: Einsätze beginnen erst nach der Wiederherstellung.';
        else if (assignment) reason = `${agent.name} ist bereits im Einsatz: ${assignment.label}.`;
        else if (cooldown > 0) reason = `Wieder verfügbar in ${Math.ceil(cooldown)} Sekunden.`;
        else if (s.agents.some(other => other.assignment && other.assignment.kind === def.key)) reason = 'Ein gleicher Einsatz läuft bereits; Wirkungen lassen sich nicht stapeln.';
        else if (def.key === 'diagnose' && r.agentEffects.diagnoseRemaining > 0) reason = 'Eine Diagnosewirkung ist bereits aktiv.';
        else if (def.key === 'optimize' && r.agentEffects.optimizeRemaining > 0) reason = 'Eine Optimierungswirkung ist bereits aktiv.';
        else reason = cashReason(s, costValue);
        return { key: def.key, label: def.label, description: `${costValue} Credits, ${def.duration} Sekunden Einsatzzeit, danach 300 Sekunden Abklingzeit. ${def.result} ${agent.name} liefert während des Einsatzes keine normale Betriebsleistung.`, cost: costValue, duration: def.duration, cooldown: 300, enabled: !reason, reason };
      });
      return { id: agent.id, assignment, cooldown, options };
    });
    return { effects: activeEffects, agents, paused, pausedReason: paused ? 'Alle laufenden Agenteneinsätze bleiben angehalten, bis die offene Krise behoben ist.' : '' };
  }

  function makeJob(s, tier = 0) {
    const kinds = [
      ['monitoring', 'Verfügbarkeitsprüfung', 'Nordlicht Mobilität', 65, 150, 4, 2, 3],
      ['migration', 'Datenmigration begleiten', 'Kranich Verlag', 155, 390, 9, 5, 9],
      ['audit', 'Zugriffsrechte auditieren', 'Hanseatische Werkstätten', 120, 330, 12, 4, 6],
      ['optimization', 'Lastspitzen glätten', 'Morgenrot Energie', 190, 520, 8, 7, 12],
      ['recovery', 'Archiv wiederherstellen', 'Stadtarchiv West', 245, 690, 11, 9, 15],
      ['research', 'Anomalien klassifizieren', 'Institut für Umweltfunk', 175, 470, 18, 6, 8]
    ];
    const gpuInstalled = s.servers.reduce((sum, server) => sum + (HARDWARE[server.type].gpuCount || 0) * server.level, 0);
    if (s.sector >= 2 && gpuInstalled > 0 && rand(s) < 0.22) {
      const gpuDemand = 1 + Math.floor(rand(s) * Math.min(4, gpuInstalled));
      const workScale = 0.6 + 0.4 * gpuDemand;
      const rewardScale = workScale * (1 + 0.12 * (gpuDemand - 1));
      const factor = (1 + (s.sector - 1) * 0.38 + tier * 0.12) * (0.85 + rand(s) * 0.3);
      return { id: uid(s, 'job'), title: gpuDemand > 2 ? 'KI-Modell trainieren' : 'KI-Inferenz auswerten', client: 'Institut für angewandte KI', kind: 'ai', gpuDemand, totalWork: Math.round(205 * factor * workScale), work: 0, reward: Math.round(480 * factor * rewardScale), science: Math.max(1, Math.round(15 * factor * workScale)), rep: Math.max(1, Math.round(7 * factor * workScale)), load: Math.round(10 * workScale * (1 + (s.sector - 1) * 0.38) * 10) / 10 };
    }
    const k = kinds[Math.floor(rand(s) * kinds.length)];
    const factor = (1 + (s.sector - 1) * 0.38 + tier * 0.12) * (0.85 + rand(s) * 0.3);
    return { id: uid(s, 'job'), title: k[1], client: k[2], kind: k[0], totalWork: Math.round(k[3] * factor), work: 0, reward: Math.round(k[4] * factor), science: Math.max(1, Math.round(k[5] * factor)), rep: Math.max(1, Math.round(k[6] * factor)), load: Math.round(k[7] * (1 + (s.sector - 1) * 0.38) * 10) / 10 };
  }
  function makeEvent(s) {
    const variants = [
      { kind: 'signal', title: 'Ungewöhnliche Messreihe', description: 'Ein Sensorverbund meldet ein neues Muster. Beide Wege bringen sicheren Nutzen.', choices: [
        { label: 'Muster analysieren', description: '+8 Forschung und +1 Ansehen.', key: 'signal_analyze' }, { label: 'Datensatz lizenzieren', description: '+48 Credits.', key: 'signal_license' }] },
      { kind: 'grant', title: 'Förderfenster geöffnet', description: 'Ein regionales Programm unterstützt offene Infrastruktur oder gemeinsame Forschung.', choices: [
        { label: 'Infrastruktur fördern', description: '+85 Credits.', key: 'grant_funds' }, { label: 'Forschung teilen', description: '+12 Forschung und +2 Ansehen.', key: 'grant_research' }] },
      { kind: 'maintenance', title: 'Wartungsfenster verfügbar', description: 'Ein Partner stellt Zeit für vorsorgliche Pflege oder eine Effizienzstudie bereit.', choices: [
        { label: 'Netzpflege durchführen', description: '+4 Ansehen und +4 Forschung.', key: 'maintenance_care' }, { label: 'Effizienzstudie nutzen', description: '+55 Credits und +1 Ansehen.', key: 'maintenance_study' }] },
      { kind: 'client', title: 'Anfrage aus dem Feld', description: 'Ein Kunde braucht kurzfristige Unterstützung und bietet eine sichere Anschlussleistung an.', choices: [
        { label: 'Soforthilfe leisten', description: '+72 Credits und +1 Ansehen.', key: 'client_help' }, { label: 'Wissen weitergeben', description: '+9 Forschung und +2 Ansehen.', key: 'client_knowledge' }] },
      { kind: 'discovery', title: 'Neue Anomalie entdeckt', description: 'Eine seltene Abweichung lässt sich dokumentieren oder genauer untersuchen.', choices: [
        { label: 'Tiefer untersuchen', description: '+15 Forschung.', key: 'discovery_research' }, { label: 'Befund veröffentlichen', description: '+42 Credits und +3 Ansehen.', key: 'discovery_publish' }] },
      { kind: 'procurement', title: 'Gemeinsame Beschaffung', description: 'Ein Verbundprojekt bietet Mittel für Ausstattung oder technische Evaluation.', choices: [
        { label: 'Beschaffungsbudget sichern', description: '+105 Credits.', key: 'procurement_funds' }, { label: 'Technik evaluieren', description: '+11 Forschung und +2 Ansehen.', key: 'procurement_evaluate' }] }
    ];
    const item = variants[Math.floor(rand(s) * variants.length)];
    return { id: uid(s, 'event'), title: item.title, description: item.description, kind: item.kind, choices: item.choices.map(c => ({ ...c })) };
  }

  function autoContract(s) {
    if (!s.policies.autocontract || s.resilience.incident) return 0;
    let accepted = 0, metrics = getMetrics(s);
    const target = Math.min(metrics.jobLimit, Math.max(1, s.agents.filter(agent => !agent.assignment).length + 1));
    while (s.jobs.length < target && s.offers.length) {
      metrics = getMetrics(s);
      const candidates = s.offers.filter(j => metrics.usedCapacity + j.load <= metrics.capacity * 0.98 && (j.kind !== 'ai' || (j.gpuDemand || 1) <= metrics.gpuCapacity - metrics.gpuUsed + 1e-9));
      if (!candidates.length) break;
      const score = j => s.policies.priority === 'income' ? j.reward / j.totalWork : s.policies.priority === 'research' ? j.science / j.totalWork : 1 / j.totalWork;
      candidates.sort((a, b) => score(b) - score(a));
      const picked = candidates[0]; s.offers = s.offers.filter(j => j.id !== picked.id); s.jobs.push(picked); accepted++;
    }
    return accepted;
  }

  function workLosses(s, fraction) { return s.jobs.map(j => ({ id: j.id, amount: j.work * fraction })); }
  function chooseAffected(s, count = 1) {
    const online = s.servers.filter(x => serverLinkState(s, x));
    const result = [];
    while (online.length && result.length < count) result.push(online.splice(Math.floor(rand(s) * online.length), 1)[0]);
    return result;
  }
  function openMinorFailure(s) {
    const failed = s.servers.filter(x => x.status === 'failed').length;
    if (failed >= RESILIENCE_MAX.incidentAffected) return false;
    const candidates = s.servers.filter(x => serverLinkState(s, x)); if (!candidates.length) return false;
    const server = candidates[Math.floor(rand(s) * candidates.length)];
    server.condition = Math.min(server.condition, 42); server.status = 'failed'; server.fault = 'Hardwarefehler';
    addLog(s, 'warning', `${server.name}: Hardwarefehler erkannt. Aufträge laufen auf verbleibenden Knoten weiter.`);
    return true;
  }
  function openMajorIncident(s) {
    const available = s.servers.filter(x => serverLinkState(s, x));
    const failedCount = s.servers.filter(x => x.status === 'failed').length;
    if (!available.length || failedCount >= RESILIENCE_MAX.incidentAffected) return false;
    const remainingAffected = RESILIENCE_MAX.incidentAffected - failedCount;
    const upsCoverage = getMetrics(s).upsCoverage;
    const powerReduction = 0.65 * upsCoverage;
    // This makes the published reduction match the actual power-incident
    // probability after normalizing the power, cooling, and corruption weights.
    const powerWeight = 2 * (1 - powerReduction) / (2 + powerReduction);
    const draw = rand(s) * (2 + powerWeight);
    const kind = draw < powerWeight ? 'power' : draw < powerWeight + 1 ? 'cooling' : 'corruption';
    let affected;
    if (kind === 'cooling') {
      affected = available.slice().sort((a, b) => catalog.servers[b.type].power * b.level - catalog.servers[a.type].power * a.level).slice(0, Math.min(remainingAffected, available.length));
    } else affected = chooseAffected(s, kind === 'power' ? Math.min(remainingAffected, available.length, upsCoverage >= 0.95 ? 1 : remainingAffected) : 1);
    const content = {
      power: { title: 'Stromversorgung ausgefallen', description: 'Eine Schutzschaltung hat mehrere Knoten getrennt. Die betroffenen Server bleiben offline, bis eine sichere Umschaltung abgeschlossen ist.', consequence: 'Aufträge pausieren bis zur Entscheidung; Wiederanlauf braucht eine gewählte Schaltmaßnahme.' },
      cooling: { title: 'Kühlkreislauf überhitzt', description: 'Die Temperaturgrenze wurde überschritten. Betroffene Knoten wurden zum Schutz vor Folgeschäden abgeschaltet.', consequence: 'Aufträge pausieren; ohne Reparatur bleibt die Kapazität reduziert.' },
      corruption: { title: 'Datenintegrität beschädigt', description: 'Prüfsummenfehler haben den Betriebsbestand beeinträchtigt. Änderungen bleiben angehalten, bis eine Wiederherstellung gewählt ist.', consequence: 'Forschung und Auftragsstände sind gefährdet; ein gespeicherter Betriebsstand kann ungesicherte Fortschritte kosten.' }
    }[kind];
    for (const server of affected) { server.condition = Math.min(server.condition, kind === 'cooling' ? 24 : kind === 'power' ? 35 + 20 * upsCoverage : 35); server.status = 'failed'; server.fault = kind === 'power' ? 'Stromausfall' : kind === 'cooling' ? 'Kühlungsstörung' : 'Datenfehler'; }
    if (kind === 'corruption') { s.resilience.corrupted = true; s.resilience.integrity = Math.min(s.resilience.integrity, 38); }
    const id = uid(s, 'incident');
    s.resilience.incident = { id, kind, title: content.title, description: content.description, consequence: content.consequence, affected: affected.map(x => x.id), resolution: null };
    addLog(s, 'critical', `${content.title}: betroffene Knoten ${affected.map(x => x.name).join(', ')}. Die Maßnahme wartet auf deine Entscheidung.`);
    return true;
  }
  function startOperation(s, operation, automated = false) {
    s.resilience.operation = operation;
    if (automated) s.resilience.budgetSpent += operation.cost || 0;
  }
  function finishOperation(s) {
    const r = s.resilience, op = r.operation;
    if (!op) return;
    if (op.kind === 'backup') {
      r.backup = { createdAt: s.time, research: s.research, protectedResearch: s.research, jobs: workSnapshot(s) };
      r.autoBackupNextAt = s.time + 900;
      addLog(s, 'success', `Betriebssicherung abgeschlossen: ${s.research.toFixed(1)} Forschung und ${s.jobs.length} Auftragsstände geschützt.`);
    } else if (op.kind === 'repair') {
      const server = s.servers.find(x => x.id === op.serverId);
      if (server) { server.condition = op.effect.condition; server.status = 'online'; server.fault = null; }
      applyWorkLosses(s, op.effect.workLosses || []);
      if (op.effect.reputationLoss) s.reputation = Math.max(0, s.reputation - op.effect.reputationLoss);
      addLog(s, 'success', `Wartung abgeschlossen${server ? `: ${server.name} bei ${Math.round(server.condition)}% Zustand` : ''}.`);
    } else {
      const effect = op.effect;
      for (const item of effect.conditions || []) {
        const server = s.servers.find(x => x.id === item.id);
        if (server) { server.condition = item.condition; server.status = 'online'; server.fault = null; }
      }
      if (effect.restoreSnapshot && r.backup) {
        s.research = r.backup.protectedResearch;
        const snapshot = new Map(r.backup.jobs.map(j => [j.id, j.work]));
        for (const job of s.jobs) job.work = snapshot.has(job.id) ? snapshot.get(job.id) : 0;
        r.backup.protectedResearch = s.research;
      } else {
        applyWorkLosses(s, effect.workLosses || []);
        if (finite(effect.research)) s.research = Math.max(0, effect.research);
      }
      if (finite(effect.integrity)) r.integrity = effect.integrity;
      if (effect.clearCorruption) r.corrupted = false;
      if (effect.reputationLoss) s.reputation = Math.max(0, s.reputation - effect.reputationLoss);
      r.incident = null;
      addLog(s, 'success', `Krisenmaßnahme abgeschlossen: ${op.label}. Der geschützte Betrieb ist wieder freigegeben.`);
    }
    r.operation = null;
  }
  function applyWorkLosses(s, rows) {
    for (const row of rows) {
      const job = s.jobs.find(x => x.id === row.id);
      if (job) job.work = Math.max(0, job.work - row.amount);
    }
  }
  function quoteWithinAutoPolicy(s, option) {
    return option.enabled && s.resilience.budgetSpent + option.cost <= s.policies.repairBudget && s.credits - option.cost >= s.policies.reserve && s.resilience.parts >= option.parts;
  }
  function startAutomaticRepair(s) {
    if (!s.policies.autorepair || s.resilience.operation || s.resilience.incident || s.facility.operation || s.facility.centralOperation) return false;
    const server = s.servers.filter(x => x.status === 'failed' && x.fault === 'Hardwarefehler').sort((a, b) => a.condition - b.condition)[0];
    if (!server) return false;
    const option = repairQuotes(s, server).find(x => x.key === 'patch');
    if (!option || !quoteWithinAutoPolicy(s, option)) return false;
    s.credits -= option.cost; s.resilience.parts -= option.parts; server.status = 'repairing';
    startOperation(s, { kind: 'repair', label: 'Automatische Schnellreparatur', remaining: option.duration, total: option.duration, serverId: server.id, cost: option.cost,
      effect: { condition: option.condition, workLosses: [], reputationLoss: 0 } }, true);
    addLog(s, 'system', `Automatische Wartung gestartet: ${server.name}, ${option.cost} Credits und ${option.parts} Ersatzteil.`);
    return true;
  }
  function startAutomaticBackup(s) {
    if (!s.policies.autobackup || s.time < s.resilience.autoBackupNextAt || s.resilience.operation || s.resilience.incident || s.resilience.corrupted || s.facility.operation || s.facility.centralOperation) return false;
    const option = getResilience(s).backup;
    if (!option.enabled || s.credits - option.cost < s.policies.reserve || s.resilience.budgetSpent + option.cost > s.policies.repairBudget) { s.resilience.autoBackupNextAt = s.time + 300; return false; }
    s.credits -= option.cost; s.resilience.backupCooldownUntil = s.time + 300;
    startOperation(s, { kind: 'backup', label: 'Automatische Betriebssicherung', remaining: option.duration, total: option.duration, serverId: null, cost: option.cost, effect: { snapshot: true } }, true);
    addLog(s, 'system', `Automatische Betriebssicherung gestartet: ${option.cost} Credits.`);
    return true;
  }
  function finishAgentMission(s, agent) {
    const assignment = agent.assignment;
    if (!assignment) return;
    if (assignment.kind === 'diagnose') s.resilience.agentEffects.diagnoseRemaining = 1200;
    else if (assignment.kind === 'optimize') s.resilience.agentEffects.optimizeRemaining = 900;
    else if (assignment.kind === 'research') {
      const reward = agent.role === 'analyst' ? 8 + 4 * agent.level : 5 + 2 * agent.level;
      s.research = Math.min(1e15, s.research + reward);
      addLog(s, 'success', `${agent.name} hat den Forschungsauftrag abgeschlossen: +${reward} Forschungspunkte.`);
    }
    if (assignment.kind !== 'research') addLog(s, 'success', `${agent.name} hat den Einsatz „${assignment.label}“ abgeschlossen. Die Wirkung ist aktiv.`);
    agent.assignment = null; agent.cooldownUntil = s.time + 300;
  }

  function advance(s, seconds) {
    let remaining = clamp(finite(seconds) ? seconds : 0, 0, 43200), completed = 0, eventCount = 0;
    const initialCredits = s.credits, initialResearch = s.research;
    const rackById = new Map(s.facility.racks.map(rack => [rack.id, rack]));
    // One-second deterministic slices keep work, rewards, and generated opportunities consistent online/offline.
    while (remaining > 0) {
      const dt = Math.min(1, remaining); remaining -= dt; s.time += dt;
      advanceTemperatures(s, dt);
      const r = s.resilience;
      const incidentAtStart = Boolean(r.incident);
      const budgetWindow = Math.floor(s.time / 3600) * 3600;
      if (budgetWindow > r.budgetWindowStart) { r.budgetWindowStart = budgetWindow; r.budgetSpent = 0; }
      const m = getMetrics(s);
      const earned = m.incomePerSecond * dt;
      s.credits += earned; s.lifetimeCredits += earned;
      s.research += m.researchPerSecond * dt;
      if (s.jobs.length) {
        for (const j of s.jobs) j.work = Math.min(j.totalWork, j.work + (m.jobRates[j.id] || 0) * dt);
        const done = s.jobs.filter(j => j.work >= j.totalWork);
        if (done.length) {
          for (const j of done) {
            const reward = j.reward * (1 + (s.upgrades.market || 0) * 0.1);
            s.credits += reward; s.lifetimeCredits += reward; s.research += j.science; s.reputation = clamp(s.reputation + j.rep, 0, 1e6);
            s.counters.jobs++; completed++; addLog(s, 'success', `${j.title} für ${j.client} abgeschlossen: ${Math.round(reward)} Credits.`);
          }
          s.jobs = s.jobs.filter(j => j.work < j.totalWork);
        }
      }
      s.timers.offer -= dt; s.timers.event -= dt; s.timers.history -= dt;
      if (s.timers.offer <= 0) {
        if (s.offers.length < MAX.offers) s.offers.push(makeJob(s));
        s.timers.offer = 38 + rand(s) * 34;
      }
      autoContract(s);
      if (s.timers.event <= 0) {
        if (s.events.length < MAX.events) { s.events.push(makeEvent(s)); eventCount++; }
        s.timers.event = 145 + rand(s) * 100;
      }
      if (s.timers.history <= 0) {
        const mm = getMetrics(s); s.history.push({ time: s.time, credits: s.credits, income: mm.incomePerSecond, load: mm.load });
        if (s.history.length > MAX.history) s.history.shift();
        s.timers.history = 30;
      }
      let repairedThisStep = null, operationFinished = false;
      if (r.operation) {
        if (r.operation.kind === 'repair' && r.operation.remaining <= dt) repairedThisStep = r.operation.serverId;
        r.operation.remaining = Math.max(0, r.operation.remaining - dt);
        if (r.operation.remaining <= 0) { finishOperation(s); operationFinished = true; }
      }
      for (const server of s.servers) if (server.bootRemaining > 0) server.bootRemaining = Math.max(0, server.bootRemaining - dt);
      if (s.facility.operation) {
        s.facility.operation.remaining = Math.max(0, s.facility.operation.remaining - dt);
        if (s.facility.operation.remaining <= 0) {
          const op = s.facility.operation, rack = s.facility.racks.find(x => x.id === op.rackId);
          if (rack) rack[op.kind + 'Level'] = op.targetLevel;
          addLog(s, 'success', `${op.label} in ${rack ? rack.name : 'Rack'} abgeschlossen. Versorgung und Verbindungen sind wieder verfügbar.`);
          s.facility.operation = null;
        }
      }
      if (s.facility.centralOperation) {
        s.facility.centralOperation.remaining = Math.max(0, s.facility.centralOperation.remaining - dt);
        if (s.facility.centralOperation.remaining <= 0) {
          const op = s.facility.centralOperation, system = CENTRAL_SYSTEMS.find(item => item.id === op.system);
          s.facility.central[op.system] = op.targetLevel;
          addLog(s, 'success', `${system.name} auf Stufe ${op.targetLevel} ausgebaut.`);
          s.facility.centralOperation = null;
        }
      }
      if (!incidentAtStart && !r.incident) {
        r.agentEffects.diagnoseRemaining = Math.max(0, r.agentEffects.diagnoseRemaining - dt);
        r.agentEffects.optimizeRemaining = Math.max(0, r.agentEffects.optimizeRemaining - dt);
        for (const agent of s.agents) {
          if (!agent.assignment) continue;
          agent.assignment.remaining = Math.max(0, agent.assignment.remaining - dt);
          if (agent.assignment.remaining <= 0) finishAgentMission(s, agent);
        }
      }
      if (!incidentAtStart && !r.incident && !operationFinished && s.time >= r.graceUntil) {
        const activeAgents = s.agents.filter(agent => !agent.assignment);
        const engineers = activeAgents.filter(agent => agent.role === 'engineer').reduce((sum, agent) => sum + agent.level, 0);
        const maintenanceFocus = activeAgents.filter(agent => agent.focus === 'maintenance').reduce((sum, agent) => sum + agent.level, 0);
        const coolingLevels = s.upgrades.cooling || 0;
        const wearPerHour = Math.max(0.002, (0.012 + Math.max(0, m.heat - 8) * 0.0015 + Math.max(0, m.load - 0.65) * 0.035 + (s.policies.power === 'performance' ? 0.025 : 0) + (!s.policies.autorepair ? 0.018 : 0)) * Math.max(0.25, 1 - Math.min(0.65, engineers * 0.045 + maintenanceFocus * 0.025 + coolingLevels * 0.008 + (s.policies.power === 'eco' ? 0.18 : 0) + (s.policies.autorepair ? 0.14 : 0))));
        for (const server of s.servers) if (serverLinkState(s, server, rackById.get(server.rackId)) && server.id !== repairedThisStep) server.condition = clamp(server.condition - wearPerHour * dt / 3600, 1, MAX_CONDITION);
        const probability = (1 - Math.pow(1 - m.riskPerHour / 100, dt / 3600));
        if (!r.operation && !s.facility.operation && !s.facility.centralOperation && rand(s) < probability) {
          if (rand(s) < 0.24) openMinorFailure(s); else openMajorIncident(s);
        }
      }
      if (!r.incident) {
        if (!r.operation) startAutomaticRepair(s);
        if (!r.operation) startAutomaticBackup(s);
      }
      s.credits = clamp(s.credits, 0, 1e15); s.research = clamp(s.research, 0, 1e15); s.lifetimeCredits = clamp(s.lifetimeCredits, 0, 1e15);
      updateAchievementUnlocks(s);
    }
    updateAchievementUnlocks(s);
    return { seconds: clamp(finite(seconds) ? seconds : 0, 0, 43200), credits: s.credits - initialCredits, research: s.research - initialResearch, jobsCompleted: completed, eventCount };
  }

  function actInternal(s, action, payload = {}) {
    const fail = message => ({ ok: false, message });
    if (!action || typeof action !== 'string' || !payload || typeof payload !== 'object') return fail('Diese Aktion ist ungültig.');
    const m = getMetrics(s);
    if (action === 'upgradeCentral') {
      const q = quoteHardware(s, 'upgradeCentral', payload);
      if (!q.enabled) return fail(q.reason || 'Der zentrale Ausbau ist derzeit nicht verfügbar.');
      const system = CENTRAL_SYSTEMS.find(item => item.id === payload.system), targetLevel = centralLevels(s)[system.id] + 1;
      s.credits -= q.cost;
      s.facility.centralOperation = { system: system.id, targetLevel, remaining: q.duration, total: q.duration, cost: q.cost };
      addLog(s, 'system', `${q.label} begonnen: ${q.cost} Credits und ${q.duration} Sekunden Wartung.`);
      return { ok: true, message: `${q.label} begonnen.` };
    }
    if (['buyRack', 'upgradeRack', 'setServerPower', 'setSwitchPort', 'moveServer'].includes(action)) {
      const q = quoteHardware(s, action, payload);
      if (!q.enabled) return fail(q.reason || 'Diese Hardwareaktion ist derzeit nicht verfügbar.');
      if (action === 'buyRack') {
        s.credits -= q.cost;
        const id = uid(s, 'rack'), number = s.facility.racks.length + 1;
        s.facility.racks.push({ id, name: `Rack ${String(number).padStart(2, '0')}`, switchLevel: 1, powerLevel: 1, coolingLevel: 1, disabledPorts: [] });
        addLog(s, 'success', `${s.facility.racks[s.facility.racks.length - 1].name} mit Switch, Stromversorgung und Kühlung installiert.`);
        return { ok: true, message: 'Rack installiert.' };
      }
      if (action === 'upgradeRack') {
        const rack = s.facility.racks.find(x => x.id === payload.rackId), component = payload.component, current = rack[component + 'Level'];
        s.credits -= q.cost;
        s.facility.operation = { kind: component, label: q.label, rackId: rack.id, remaining: q.duration, total: q.duration, targetLevel: current + 1, cost: q.cost };
        addLog(s, 'system', `${q.label} begonnen: ${rack.name}; ${q.cost} Credits und ${q.duration} Sekunden Wartung.`);
        return { ok: true, message: `${q.label} begonnen.` };
      }
      if (action === 'setServerPower') {
        const server = s.servers.find(x => x.id === payload.id); server.powered = payload.on; server.bootRemaining = payload.on ? 30 : 0;
        addLog(s, 'system', `${server.name} ${payload.on ? 'startet; Bootzeit 30 Sekunden.' : 'wurde ausgeschaltet.'}`);
        return { ok: true, message: payload.on ? 'Server startet.' : 'Server ausgeschaltet.' };
      }
      if (action === 'setSwitchPort') {
        const rack = s.facility.racks.find(x => x.id === payload.rackId);
        if (payload.enabled) rack.disabledPorts = rack.disabledPorts.filter(port => port !== payload.port);
        else if (!rack.disabledPorts.includes(payload.port)) rack.disabledPorts.push(payload.port);
        addLog(s, 'system', `${rack.name}, Port ${payload.port}: ${payload.enabled ? 'Verbindung aktiviert.' : 'Verbindung getrennt.'}`);
        return { ok: true, message: payload.enabled ? 'Switch-Port aktiviert.' : 'Switch-Port getrennt.' };
      }
      if (action === 'moveServer') {
        const server = s.servers.find(x => x.id === payload.id), rack = s.facility.racks.find(x => x.id === payload.rackId), place = fitServer(s, rack, server.type, payload.unit, payload.port, server.id);
        s.credits -= q.cost; server.rackId = rack.id; server.unit = place.unit; server.port = place.port; server.bootRemaining = 30;
        addLog(s, 'system', `${server.name} nach ${rack.name}, U${place.unit}, Port ${place.port} umgesetzt; Bootzeit 30 Sekunden.`);
        return { ok: true, message: 'Server umgesetzt und startet neu.' };
      }
    }
    if (action === 'buyServer') {
      const q = quoteHardware(s, 'buyServer', payload); if (!q.enabled) return fail(q.reason || 'Server kann derzeit nicht eingesetzt werden.');
      const type = payload.type, rack = payload.rackId ? s.facility.racks.find(r => r.id === payload.rackId) : s.facility.racks.find(r => fitServer(s, r, type).ok), place = fitServer(s, rack, type, payload.unit, payload.port);
      s.credits -= q.cost; const id = uid(s, 'server'); s.servers.push({ id, type, name: catalog.servers[type].name + ' ' + String(s.counters.serversBought + 2).padStart(2, '0'), level: 1, mode: 'balanced', condition: 100, status: 'online', fault: null, rackId: rack.id, unit: place.unit, port: place.port, powered: true, bootRemaining: 0 }); s.counters.serversBought++; addLog(s, 'success', `${catalog.servers[type].name} in ${rack.name}, U${place.unit}, Port ${place.port} eingesetzt.`); return { ok: true, message: 'Server in Betrieb genommen.' };
    }
    if (action === 'upgradeServer') {
      const x = s.servers.find(v => v.id === payload.id); if (!x) return fail('Server nicht gefunden.');
      if (x.status !== 'online') return fail('Ein ausgefallener oder in Wartung befindlicher Server kann nicht ausgebaut werden.');
      if (!serverLinkState(s, x)) return fail('Der Server muss eingeschaltet, hochgefahren und mit dem Switch verbunden sein.');
      if (x.level >= 10000) return fail('Dieser Server hat die höchste Ausbaustufe erreicht.');
      const price = cost(s, 'serverUpgrade', x.id); if (s.credits < price) return fail(`Es fehlen ${Math.ceil(price - s.credits)} Credits.`);
      s.credits -= price; x.level++; addLog(s, 'success', `${x.name} auf Stufe ${x.level} ausgebaut.`); return { ok: true, message: 'Server ausgebaut.' };
    }
    if (action === 'setServerMode') {
      const x = s.servers.find(v => v.id === payload.id); if (!x) return fail('Server nicht gefunden.'); if (!MODES.includes(payload.mode)) return fail('Dieser Betriebsmodus ist ungültig.');
      if (!serverLinkState(s, x)) return fail('Der Server muss eingeschaltet, hochgefahren und mit dem Switch verbunden sein.');
      x.mode = payload.mode; addLog(s, 'system', `${x.name}: Modus ${payload.mode === 'eco' ? 'Öko' : payload.mode === 'performance' ? 'Leistung' : 'Ausgewogen'}.`); return { ok: true, message: 'Betriebsmodus angepasst.' };
    }
    if (action === 'recruitAgent') {
      const role = payload.role; if (!own(catalog.roles, role)) return fail('Diese Agentenrolle ist unbekannt.'); if (s.agents.length >= m.agentLimit) return fail('Der Sektor hat seine Agentengrenze erreicht.');
      const price = cost(s, 'agent', role); if (s.credits < price) return fail(`Es fehlen ${Math.ceil(price - s.credits)} Credits.`);
      s.credits -= price; const names = ['Lea', 'Jonas', 'Nuri', 'Eva', 'Sam', 'Noor', 'Lin']; const id = uid(s, 'agent');
      s.agents.push({ id, name: names[(s.counters.agentsHired + 2) % names.length], role, level: 1, focus: role === 'analyst' ? 'research' : role === 'engineer' ? 'maintenance' : 'income', trait: role === 'analyst' ? 'aufmerksam' : role === 'engineer' ? 'umsichtig' : 'pragmatisch', assignment: null, cooldownUntil: 0 });
      s.counters.agentsHired++; addLog(s, 'success', `${catalog.roles[role].name} dem Team beigetreten.`); return { ok: true, message: 'Agent eingestellt.' };
    }
    if (action === 'setAgentFocus') {
      const x = s.agents.find(v => v.id === payload.id); if (!x) return fail('Agent nicht gefunden.'); if (x.assignment) return fail('Der Agent ist im Einsatz; der Schwerpunkt lässt sich danach wieder ändern.'); if (!FOCI.includes(payload.focus)) return fail('Dieser Schwerpunkt ist ungültig.');
      x.focus = payload.focus; return { ok: true, message: 'Schwerpunkt angepasst.' };
    }
    if (action === 'upgradeAgent') {
      const x = s.agents.find(v => v.id === payload.id); if (!x) return fail('Agent nicht gefunden.'); if (x.assignment) return fail('Der Agent ist im Einsatz und kann erst danach entwickelt werden.'); if (x.level >= 10000) return fail('Dieser Agent hat die höchste Entwicklungsstufe erreicht.'); const price = cost(s, 'agentUpgrade', x.id); if (s.credits < price) return fail(`Es fehlen ${Math.ceil(price - s.credits)} Credits.`);
      s.credits -= price; x.level++; addLog(s, 'success', `${x.name} erreicht Stufe ${x.level}.`); return { ok: true, message: 'Agent entwickelt.' };
    }
    if (action === 'dispatchAgent') {
      const agent = s.agents.find(x => x.id === payload.id); if (!agent) return fail('Agent nicht gefunden.');
      const option = getAgentOperations(s).agents.find(x => x.id === agent.id)?.options.find(x => x.key === payload.mission);
      if (!option) return fail('Dieser Einsatz ist unbekannt.'); if (!option.enabled) return fail(option.reason || 'Dieser Einsatz ist derzeit nicht verfügbar.');
      s.credits -= option.cost; agent.assignment = { kind: option.key, label: option.label, remaining: option.duration, total: option.duration };
      addLog(s, 'system', `${agent.name} beginnt „${option.label}“ für ${option.cost} Credits; normaler Betriebsausstoß ruht für ${option.duration} Sekunden.`);
      return { ok: true, message: `${option.label} für ${agent.name} gestartet.` };
    }
    if (action === 'acceptJob') {
      const j = s.offers.find(v => v.id === payload.id); if (!j) return fail('Dieser Auftrag ist nicht mehr verfügbar.'); if (s.jobs.length >= m.jobLimit) return fail('Alle Auftragsplätze sind belegt.');
      if (s.resilience.incident) return fail('Während einer offenen Krise bleiben neue Aufträge in der Warteschlange.');
      if (m.usedCapacity + j.load > m.capacity * 1.08) return fail('Dafür fehlt derzeit Serverkapazität.');
      if (j.kind === 'ai' && (j.gpuDemand || 1) > m.gpuCapacity - m.gpuUsed + 1e-9) return fail(m.gpuCapacity <= 0 ? gpuUnavailableReason(s) : 'Dafür sind nicht genügend freie GPUs verfügbar.');
      s.offers = s.offers.filter(v => v.id !== j.id); s.jobs.push(j); addLog(s, 'system', `Auftrag angenommen: ${j.title}.`); return { ok: true, message: 'Auftrag angenommen.' };
    }
    if (action === 'declineJob') {
      const j = s.offers.find(v => v.id === payload.id); if (!j) return fail('Dieser Auftrag ist nicht mehr verfügbar.'); s.offers = s.offers.filter(v => v.id !== j.id); addLog(s, 'system', `Auftrag abgelehnt: ${j.title}.`); return { ok: true, message: 'Auftrag aus der Liste entfernt.' };
    }
    if (action === 'buyResearch') {
      const u = catalog.research.find(v => v.id === payload.id); if (!u) return fail('Diese Forschung ist unbekannt.'); if (s.resilience.incident) return fail('Forschung bleibt während der offenen Daten- oder Versorgungskrise gesperrt.'); if ((s.upgrades[u.id] || 0) >= MAX_RESEARCH_LEVEL) return fail('Diese Forschungsreihe hat ihre höchste Stufe erreicht.'); const price = cost(s, 'research', u.id); if (s.research < price) return fail(`Es fehlen ${Math.ceil(price - s.research)} Forschungspunkte.`);
      s.research -= price; if (s.resilience.backup) s.resilience.backup.protectedResearch = Math.max(0, s.resilience.backup.protectedResearch - price); s.upgrades[u.id] = (s.upgrades[u.id] || 0) + 1; addLog(s, 'success', `Forschung abgeschlossen: ${u.name}, Stufe ${s.upgrades[u.id]}.`); return { ok: true, message: 'Forschung abgeschlossen.' };
    }
    if (action === 'setPolicy') {
      const { key, value } = payload;
      const valid = key === 'power' ? ['balanced', 'performance', 'eco'].includes(value) : key === 'priority' ? ['balanced', 'income', 'research'].includes(value) : key === 'autocontract' || key === 'autorepair' || key === 'autobackup' ? typeof value === 'boolean' : key === 'repairBudget' ? [0, 100, 300, 1000].includes(value) : key === 'reserve' ? [0, 250, 1000, 5000].includes(value) : false;
      if (!valid) return fail('Diese Richtlinieneinstellung ist ungültig.'); s.policies[key] = value; addLog(s, 'system', 'Netzwerkrichtlinie aktualisiert.'); if (key === 'autocontract' && value) autoContract(s); return { ok: true, message: 'Richtlinie aktualisiert.' };
    }
    if (action === 'resolveEvent') {
      if (s.resilience.incident) return fail('Ereignisse bleiben während des Krisenbetriebs in der Warteschlange.');
      const e = s.events.find(v => v.id === payload.id); if (!e) return fail('Diese Entscheidung ist nicht mehr verfügbar.'); const index = Number(payload.choice); if (!Number.isInteger(index) || !e.choices[index]) return fail('Diese Auswahl ist ungültig.');
      const choice = e.choices[index];
      const outcomes = {
        signal_analyze: [0, 8, 1], signal_license: [48, 0, 0], grant_funds: [85, 0, 0], grant_research: [0, 12, 2],
        maintenance_care: [0, 4, 4], maintenance_study: [55, 0, 1], client_help: [72, 0, 1], client_knowledge: [0, 9, 2],
        discovery_research: [0, 15, 0], discovery_publish: [42, 0, 3], procurement_funds: [105, 0, 0], procurement_evaluate: [0, 11, 2]
      };
      const outcome = outcomes[choice.key]; if (!outcome) return fail('Diese Auswahl wird nicht unterstützt.');
      s.credits += outcome[0]; s.lifetimeCredits += outcome[0]; s.research += outcome[1]; s.reputation = clamp(s.reputation + outcome[2], 0, 1e6);
      addLog(s, 'success', `${e.title}: ${choice.label} umgesetzt.`);
      s.events = s.events.filter(v => v.id !== e.id); s.counters.events++; return { ok: true, message: 'Entscheidung umgesetzt.' };
    }
    if (action === 'expandSector') {
      if (s.facility.centralOperation) return fail('Während eines zentralen Infrastruktur-Ausbaus kann kein weiterer Sektor erschlossen werden.');
      if (s.sector >= 1e6) return fail('Die maximale Zahl von Sektoren wurde erreicht.');
      const price = cost(s, 'sector'); if (!m.expansionReady) return fail(`Sektor ${s.sector + 1} ist noch nicht bereit. Schließe weitere Aufträge ab und baue das Netz aus.`);
      if (s.credits < price) return fail(`Es fehlen ${Math.ceil(price - s.credits)} Credits.`); s.credits -= price; s.sector++; s.counters.sectors++; addLog(s, 'success', `Sektor ${s.sector} erschlossen. Neue Verträge und Ausbauplätze sind verfügbar.`); return { ok: true, message: `Sektor ${s.sector} erschlossen.` };
    }
    if (action === 'claimAchievement') {
      const a = catalog.achievements.find(v => v.id === payload.id); if (!a) return fail('Dieser Meilenstein ist unbekannt.'); if (s.achievements[a.id]) return fail('Dieser Meilenstein wurde bereits eingelöst.');
      if (!s.achievementUnlocks[a.id] && !a.check(s)) return fail('Dieser Meilenstein ist noch nicht freigeschaltet.');
      s.achievements[a.id] = true; s.achievementUnlocks[a.id] = true; s.credits += a.reward; s.lifetimeCredits += a.reward; addLog(s, 'success', `Meilenstein eingelöst: ${a.name} (+${a.reward} Credits).`); return { ok: true, message: `${a.name}: +${a.reward} Credits.` };
    }
    if (action === 'renameNetwork') {
      const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 36) : ''; if (name.length < 2) return fail('Der Netzwerkname muss mindestens zwei Zeichen lang sein.'); s.networkName = name; return { ok: true, message: 'Netzwerk umbenannt.' };
    }
    if (action === 'repairServer') {
      const server = s.servers.find(x => x.id === payload.id); if (!server) return fail('Server nicht gefunden.');
      const option = getResilience(s).servers.find(x => x.id === server.id)?.repairs.find(x => x.key === payload.method);
      if (!option) return fail('Diese Reparaturmethode ist ungültig.'); if (!option.enabled) return fail(option.reason || 'Diese Reparatur ist derzeit nicht verfügbar.');
      const workTotal = s.jobs.reduce((sum, j) => sum + j.work, 0), fraction = workTotal > 0 ? option.workLoss / workTotal : 0;
      const losses = workLosses(s, fraction);
      if (payload.method === 'manual') applyWorkLosses(s, losses);
      s.credits -= option.cost; s.resilience.parts -= option.parts; server.status = 'repairing';
      s.resilience.operation = { kind: 'repair', label: option.label, remaining: option.duration, total: option.duration, serverId: server.id, cost: option.cost,
        effect: { condition: option.condition, workLosses: payload.method === 'manual' ? [] : losses, reputationLoss: 0 } };
      addLog(s, 'system', `${option.label} gestartet: ${server.name}; ${option.cost} Credits, ${option.parts} Ersatzteile, ${option.duration} Sekunden.`);
      return { ok: true, message: `${option.label} gestartet.` };
    }
    if (action === 'createBackup') {
      const option = getResilience(s).backup; if (!option.enabled) return fail(option.reason || 'Eine Betriebssicherung ist derzeit nicht verfügbar.');
      s.credits -= option.cost; s.resilience.backupCooldownUntil = s.time + 300; s.resilience.autoBackupNextAt = Math.max(s.resilience.autoBackupNextAt, s.time + 900);
      s.resilience.operation = { kind: 'backup', label: 'Betriebssicherung', remaining: option.duration, total: option.duration, serverId: null, cost: option.cost, effect: { snapshot: true } };
      addLog(s, 'system', `Betriebssicherung gestartet: ${option.cost} Credits; Abschluss in ${option.duration} Sekunden.`);
      return { ok: true, message: 'Betriebssicherung wird erstellt.' };
    }
    if (action === 'buyParts') {
      const option = getResilience(s).partsPurchase; if (!option.enabled) return fail(option.reason || 'Ersatzteile sind derzeit nicht verfügbar.');
      const gain = Math.min(3, RESILIENCE_MAX.parts - s.resilience.parts);
      s.credits -= option.cost; s.resilience.parts += gain;
      addLog(s, 'system', `${gain} Ersatzteil${gain === 1 ? '' : 'e'} eingelagert.`);
      return { ok: true, message: 'Ersatzteile eingelagert.' };
    }
    if (action === 'resolveIncident') {
      const incident = s.resilience.incident; if (!incident || incident.id !== payload.id) return fail('Diese Krise ist nicht mehr offen.');
      const option = incidentQuotes(s).find(x => x.key === payload.choice); if (!option) return fail('Diese Krisenmaßnahme ist ungültig.');
      if (!option.enabled) return fail(option.reason || 'Diese Krisenmaßnahme ist derzeit nicht verfügbar.');
      const totalWork = s.jobs.reduce((sum, j) => sum + j.work, 0), fraction = totalWork > 0 ? option.workLoss / totalWork : 0;
      const targetConditions = incident.affected.map(id => ({ id, condition: option.condition }));
      let effect;
      if (incident.kind === 'corruption' && option.key === 'restore_backup') {
        effect = { conditions: targetConditions, integrity: 100, reputationLoss: option.reputationLoss, restoreSnapshot: true, clearCorruption: true, workLosses: [] };
      } else {
        const researchTarget = incident.kind === 'corruption' ? Math.max(0, s.research - option.researchLoss) : null;
        effect = { conditions: targetConditions, integrity: 100, reputationLoss: option.reputationLoss, clearCorruption: incident.kind === 'corruption', workLosses: workLosses(s, fraction) };
        if (researchTarget !== null) effect.research = researchTarget;
      }
      s.credits -= option.cost; s.resilience.parts -= option.parts; incident.resolution = option.key;
      s.resilience.operation = { kind: incident.kind, label: option.label, remaining: option.duration, total: option.duration, serverId: null, cost: option.cost, effect };
      addLog(s, 'critical', `${incident.title}: ${option.label} gewählt. ${option.cost} Credits, ${option.parts} Ersatzteile und ${option.duration} Sekunden bis zur Wiederherstellung.`);
      return { ok: true, message: `${option.label} gestartet.` };
    }
    return fail('Diese Aktion wird nicht unterstützt.');
  }

  function act(s, action, payload = {}) {
    // Capture the temperature before an action changes power or cooling. Failed
    // actions and all read models remain free of state mutations.
    const temperatures = hardwareSnapshot(s);
    const result = actInternal(s, action, payload);
    if (result.ok) {
      for (const row of temperatures.values()) if (!finite(row.rack.temperature)) row.rack.temperature = row.temperature;
      updateAchievementUnlocks(s);
    }
    return result;
  }

  function migrateV1(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1) throw new Error('Ungültiger Netzwerkstand.');
    const time = finite(input.time) && input.time >= 0 ? input.time : 0;
    const oldPolicies = input.policies && typeof input.policies === 'object' ? input.policies : {};
    const events = Array.isArray(input.events) ? input.events.map(e => {
      if (!e || e.kind !== 'decision') return e;
      return { ...e, kind: 'signal', choices: [
        { label: e.choices && e.choices[0] ? e.choices[0].label : 'Untersuchen', description: 'Neue Erkenntnisse sichern.', key: 'signal_analyze' },
        { label: e.choices && e.choices[1] ? e.choices[1].label : 'Datensatz lizenzieren', description: 'Eine sichere Vergütung erhalten.', key: 'signal_license' }
      ] };
    }) : input.events;
    return {
      ...input, version: 2, achievementUnlocks: Object.fromEntries(catalog.achievements.map(a => [a.id, false])),
      servers: Array.isArray(input.servers) ? input.servers.map(server => ({ ...server, condition: 100, status: 'online', fault: null })) : input.servers,
      agents: Array.isArray(input.agents) ? input.agents.map(agent => ({ ...agent, assignment: null, cooldownUntil: 0 })) : input.agents,
      events,
      policies: { ...oldPolicies, autobackup: true, repairBudget: 300, reserve: 250 },
      resilience: { graceUntil: time + 600, budgetWindowStart: Math.floor(time / 3600) * 3600, budgetSpent: 0, parts: 3, backupCooldownUntil: 0, autoBackupNextAt: time + 900, backup: null, operation: null, incident: null, corrupted: false, integrity: 100, agentEffects: { diagnoseRemaining: 0, optimizeRemaining: 0 } }
    };
  }
  function packLegacyHardware(state) {
    const racks = [];
    const reservedIds = new Set([...state.servers, ...state.agents, ...state.jobs, ...state.offers, ...state.events, ...state.log].map(x => x.id));
    if (state.resilience.incident) reservedIds.add(state.resilience.incident.id);
    let rackNumber = 1, cursor = FIRST_DEVICE_UNIT;
    const createRack = () => {
      let id; do { id = `rack-migrated-${rackNumber++}`; } while (reservedIds.has(id)); reservedIds.add(id);
      const rack = { id, name: `Rack ${String(racks.length + 1).padStart(2, '0')}`, switchLevel: 1, powerLevel: 1, coolingLevel: 1, disabledPorts: [] };
      racks.push(rack); cursor = FIRST_DEVICE_UNIT; return rack;
    };
    let rack = createRack(), port = 1;
    for (const server of state.servers) {
      const size = HARDWARE[server.type].units;
      if (cursor + size - 1 > LAST_DEVICE_UNIT || port > 16) { rack = createRack(); port = 1; }
      server.rackId = rack.id; server.unit = cursor; server.port = port++;
      server.powered = true; server.bootRemaining = 0;
      cursor += size;
    }
    const aggregateLoad = state.jobs.reduce((sum, job) => sum + job.load, 0);
    const aggregateCapacity = state.servers.reduce((sum, server) => sum + catalog.servers[server.type].capacity * Math.pow(server.level, 0.82), 0);
    const workload = aggregateCapacity > 0 ? clamp(aggregateLoad / aggregateCapacity, 0, 1) : 0;
    for (const r of racks) {
      const assigned = state.servers.filter(server => server.rackId === r.id);
      const requiredW = assigned.reduce((sum, server) => sum + specPowerW(server, state.policies.power), 42);
      // Legacy fleets receive enough headroom to avoid a new thermal penalty.
      r.powerLevel = Math.min(MAX_RACK_LEVEL, Math.max(1, Math.ceil(requiredW / 1800)));
      r.coolingLevel = Math.min(MAX_RACK_LEVEL, Math.max(1, Math.ceil(requiredW / 1600)));
      const demands = assigned.map(server => serverDemandMbps(server, workload));
      if (assigned.length > 8) r.switchLevel = 2;
      if (demands.some(demand => demand > 1000) || demands.reduce((sum, demand) => sum + demand, 0) > 2500) r.switchLevel = 2;
      if (demands.some(demand => demand > 10000) || demands.reduce((sum, demand) => sum + demand, 0) > 25000) r.switchLevel = 3;
    }
    state.facility = { racks, operation: null, central: { ...CENTRAL_DEFAULTS }, centralOperation: null };
    state.version = 3;
    return state;
  }
  function normalizeState(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ungültiger Netzwerkstand.');
    let state;
    if (input.version === 1) state = packLegacyHardware(normalizeV2(migrateV1(input)));
    else if (input.version === 2) state = packLegacyHardware(normalizeV2(input));
    else if (input.version === 3) state = normalizeV3(input);
    else throw new Error('Diese Netzwerkstand-Version wird nicht unterstützt.');
    updateAchievementUnlocks(state);
    return state;
  }

  function normalizeV3(input) {
    const serverRows = Array.isArray(input.servers) ? input.servers : [];
    const coreInput = { ...input, version: 2, servers: serverRows.map(server => {
      if (!server || typeof server !== 'object') return server;
      const { rackId, unit, port, powered, bootRemaining, ...core } = server;
      return core;
    }) };
    delete coreInput.facility;
    const s = normalizeV2(coreInput), num = (v, key, lo = 0, hi = 1e15) => { if (!finite(v)) throw new Error('Ungültiger Zahlenwert: ' + key); return clamp(v, lo, hi); };
    const intStrict = (v, key, lo, hi) => { if (!Number.isInteger(v) || v < lo || v > hi) throw new Error('Ungültige Ganzzahl: ' + key); return v; };
    const str = (v, key, max = 64) => { if (typeof v !== 'string' || v.length > max) throw new Error('Ungültiger Textwert: ' + key); return v; };
    const facility = input.facility;
    if (!facility || typeof facility !== 'object' || Array.isArray(facility) || !Array.isArray(facility.racks) || facility.racks.length < 1 || facility.racks.length > rackLimit(s)) throw new Error('Ungültige Rackanlage.');
    let central = { ...CENTRAL_DEFAULTS };
    if (facility.central !== undefined) {
      if (!facility.central || typeof facility.central !== 'object' || Array.isArray(facility.central)) throw new Error('Ungültige zentrale Infrastruktur.');
      for (const system of CENTRAL_SYSTEMS) central[system.id] = intStrict(facility.central[system.id], `facility.central.${system.id}`, 0, system.maxLevel);
    }
    const rackIds = new Set(), racks = facility.racks.map((rack, index) => {
      if (!rack || typeof rack !== 'object' || Array.isArray(rack)) throw new Error('Ungültiges Rack.');
      const id = str(rack.id, 'rack.id');
      if (!/^[a-z][a-z0-9-]{0,63}$/i.test(id) || rackIds.has(id)) throw new Error('Ungültige oder doppelte Rack-ID.');
      rackIds.add(id);
      const switchLevel = intStrict(rack.switchLevel, 'rack.switchLevel', 1, 3);
      const powerLevel = intStrict(rack.powerLevel, 'rack.powerLevel', 1, MAX_RACK_LEVEL);
      const coolingLevel = intStrict(rack.coolingLevel, 'rack.coolingLevel', 1, MAX_RACK_LEVEL);
      if (!Array.isArray(rack.disabledPorts) || rack.disabledPorts.length > 16) throw new Error('Ungültige Switch-Ports.');
      const disabledPorts = rack.disabledPorts.map(port => intStrict(port, 'rack.disabledPort', 1, switchLevel === 1 ? 8 : 16));
      if (new Set(disabledPorts).size !== disabledPorts.length) throw new Error('Doppelter deaktivierter Port.');
      const temperature = rack.temperature === undefined ? undefined : num(rack.temperature, 'rack.temperature', 22, 100);
      return { id, name: str(rack.name, 'rack.name', 36), switchLevel, powerLevel, coolingLevel, disabledPorts, ...(temperature === undefined ? {} : { temperature }) };
    });
    const rackMap = new Map(racks.map(r => [r.id, r])), units = new Map(), ports = new Map();
    s.servers = s.servers.map((server, index) => {
      const original = serverRows[index], rackId = str(original && original.rackId, 'server.rackId');
      const rack = rackMap.get(rackId);
      if (!rack) throw new Error('Server verweist auf ein unbekanntes Rack.');
      const unit = intStrict(original.unit, 'server.unit', FIRST_DEVICE_UNIT, LAST_DEVICE_UNIT);
      const size = HARDWARE[server.type].units;
      if (unit + size - 1 > LAST_DEVICE_UNIT) throw new Error('Server überschreitet die Rackhöhe.');
      let occupied = units.get(rackId); if (!occupied) { occupied = new Set(); units.set(rackId, occupied); }
      for (let u = unit; u < unit + size; u++) { if (occupied.has(u)) throw new Error('Rack-Geräte überlappen sich.'); occupied.add(u); }
      const port = intStrict(original.port, 'server.port', 1, portCount(rack));
      let rackPorts = ports.get(rackId); if (!rackPorts) { rackPorts = new Set(); ports.set(rackId, rackPorts); }
      if (rackPorts.has(port)) throw new Error('Switch-Port ist doppelt belegt.'); rackPorts.add(port);
      const powered = original.powered;
      if (typeof powered !== 'boolean') throw new Error('Ungültiger Server-Schaltzustand.');
      const bootRemaining = num(original.bootRemaining, 'server.bootRemaining', 0, 30);
      if (bootRemaining > 0 && (!powered || server.status !== 'online')) throw new Error('Ungültiger Bootvorgang.');
      return { ...server, rackId, unit, port, powered, bootRemaining };
    });
    let operation = null;
    if (facility.operation !== null) {
      const op = facility.operation;
      if (!op || typeof op !== 'object' || !['switch', 'power', 'cooling'].includes(op.kind) || !rackMap.has(op.rackId)) throw new Error('Ungültiger Rack-Ausbau.');
      const rack = rackMap.get(op.rackId), level = rack[op.kind + 'Level'];
      const duration = op.kind === 'switch' ? 45 : op.kind === 'power' ? 60 : 90;
      if (intStrict(op.targetLevel, 'facility.operation.targetLevel', 2, MAX_RACK_LEVEL) !== level + 1 || op.kind === 'switch' && level >= 3) throw new Error('Ungültiges Ausbauziel.');
      const total = num(op.total, 'facility.operation.total', 0.001, 1000), remaining = num(op.remaining, 'facility.operation.remaining', 0, total);
      if (total !== duration || s.resilience.operation) throw new Error('Rack-Ausbau kollidiert mit einem laufenden Betriebseingriff.');
      const q = rackComponentQuote({ ...s, facility: { racks, operation: null } }, rack, op.kind);
      const costValue = num(op.cost, 'facility.operation.cost', 0, 1e9);
      if (costValue !== q.cost) throw new Error('Rack-Ausbaukosten stimmen nicht mit dem Ausbauziel überein.');
      operation = { kind: op.kind, label: str(op.label, 'facility.operation.label', 64), rackId: op.rackId, remaining, total, targetLevel: level + 1, cost: costValue };
    }
    let centralOperation = null;
    if (facility.centralOperation !== undefined && facility.centralOperation !== null) {
      const op = facility.centralOperation;
      const system = op && CENTRAL_SYSTEMS.find(item => item.id === op.system);
      if (!system || !op || typeof op !== 'object' || Array.isArray(op) || s.sector < system.unlockSector) throw new Error('Ungültiger zentraler Ausbau.');
      const level = central[system.id], targetLevel = intStrict(op.targetLevel, 'facility.centralOperation.targetLevel', 1, system.maxLevel);
      if (targetLevel !== level + 1) throw new Error('Ungültiges zentrales Ausbauziel.');
      const duration = Math.min(300, system.duration + (targetLevel - 1) * 30);
      if (!finite(op.total) || op.total !== duration || !finite(op.remaining) || op.remaining < 0 || op.remaining > op.total) throw new Error('Ungültige zentrale Ausbaudauer.');
      const total = op.total, remaining = op.remaining;
      const q = centralQuote({ ...s, facility: { racks, operation, central, centralOperation: null } }, system);
      if (!finite(op.cost) || op.cost < 0 || op.cost > 1e12) throw new Error('Ungültige zentrale Ausbaukosten.');
      const costValue = op.cost;
      if (costValue !== q.cost) throw new Error('Zentrale Ausbaukosten stimmen nicht mit dem Ausbauziel überein.');
      centralOperation = { system: system.id, targetLevel, remaining, total, cost: costValue };
    }
    if ((operation && centralOperation) || (centralOperation && s.resilience.operation)) throw new Error('Zentrale, Rack- und Betriebsmaßnahmen dürfen nicht parallel laufen.');
    s.facility = { racks, operation, central, centralOperation }; s.version = 3;
    const allIds = new Set([...s.servers, ...s.agents, ...s.jobs, ...s.offers, ...s.events, ...s.log].map(x => x.id));
    if (s.resilience.incident) allIds.add(s.resilience.incident.id);
    for (const id of rackIds) { if (allIds.has(id)) throw new Error('Rack-ID kollidiert mit einer Geräte- oder Auftrags-ID.'); allIds.add(id); }
    const maxId = [...allIds].reduce((max, id) => { const match = /-(\d+)$/.exec(id); return match ? Math.max(max, Number(match[1])) : max; }, 0);
    s.nextId = Math.max(s.nextId, maxId + 1);
    if (s.nextId > 1e9) throw new Error('nextId liegt außerhalb des unterstützten Bereichs.');
    return s;
  }
  function normalizeV2(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ungültiger Netzwerkstand.');
    if (input.version !== 2) throw new Error('Diese Netzwerkstand-Version wird nicht unterstützt.');
    const s = createState(12345);
    const num = (v, k, lo = 0, hi = 1e15) => { if (!finite(v)) throw new Error('Ungültiger Zahlenwert: ' + k); return clamp(v, lo, hi); };
    const str = (v, k, max = 180) => { if (typeof v !== 'string' || v.length > max) throw new Error('Ungültiger Textwert: ' + k); return v; };
    const arr = (v, k, max) => { if (!Array.isArray(v) || v.length > max) throw new Error('Ungültige Liste: ' + k); return v; };
    const idCheck = (v, k, seen) => { str(v, k, 64); if (!/^[a-z][a-z0-9-]{0,63}$/i.test(v) || seen.has(v)) throw new Error('Ungültige oder doppelte ID: ' + k); seen.add(v); return v; };
    s.seed = Number.isInteger(input.seed) ? input.seed >>> 0 : 12345; s.rng = Number.isInteger(input.rng) ? input.rng >>> 0 : s.seed || 0x6d2b79f5;
    s.networkName = str(input.networkName ?? s.networkName, 'networkName', 36); if (s.networkName.trim().length < 2) throw new Error('Ungültiger Netzwerkname.');
    s.savedAt = num(input.savedAt ?? Date.now(), 'savedAt', 0, 8.64e15); s.time = num(input.time ?? 0, 'time');
    s.credits = num(input.credits, 'credits'); s.research = num(input.research, 'research'); s.reputation = num(input.reputation ?? 0, 'reputation', 0, 1e6); s.lifetimeCredits = num(input.lifetimeCredits ?? 0, 'lifetimeCredits'); s.sector = Math.floor(num(input.sector ?? 1, 'sector', 1, 1e6));
    const seen = new Set();
    s.servers = arr(input.servers, 'servers', MAX.servers).map(x => {
      if (!x || !own(catalog.servers, x.type)) throw new Error('Ungültiger Servertyp.');
      if (!MODES.includes(x.mode)) throw new Error('Ungültiger Servermodus.');
      if (!['online', 'failed', 'repairing'].includes(x.status) || (x.fault !== null && typeof x.fault !== 'string')) throw new Error('Ungültiger Serverzustand.');
      const condition = num(x.condition, 'server.condition', 0, MAX_CONDITION);
      if (x.status === 'online' && condition <= 0) throw new Error('Ein aktiver Server braucht positiven Zustand.');
      return { id: idCheck(x.id, 'server.id', seen), type: x.type, name: str(x.name, 'server.name', 36), level: Math.floor(num(x.level, 'server.level', 1, 10000)), mode: x.mode, condition, status: x.status, fault: x.fault === null ? null : str(x.fault, 'server.fault', 64) };
    });
    s.agents = arr(input.agents, 'agents', MAX.agents).map(x => {
      if (!x || !ROLES.includes(x.role) || !FOCI.includes(x.focus)) throw new Error('Ungültige Agentenrolle oder Schwerpunkt.');
      let assignment = null;
      if (x.assignment !== null) {
        const a = x.assignment;
        if (!a || typeof a !== 'object' || !['diagnose', 'optimize', 'research'].includes(a.kind)) throw new Error('Ungültiger Agenteneinsatz.');
        const expected = a.kind === 'diagnose' ? (x.role === 'engineer' ? 90 : 120) : a.kind === 'optimize' ? (x.role === 'operator' ? 120 : 180) : (x.role === 'analyst' ? 240 : 300);
        const total = Math.floor(num(a.total, 'agent.assignment.total', 1, 3600));
        if (total !== expected) throw new Error('Unplausible Einsatzdauer.');
        if (num(x.cooldownUntil, 'agent.cooldownUntil', 0, 1e15) > s.time) throw new Error('Agent kann während einer Abklingzeit nicht im Einsatz sein.');
        assignment = { kind: a.kind, label: str(a.label, 'agent.assignment.label', 48), remaining: num(a.remaining, 'agent.assignment.remaining', 0, total), total };
      }
      return { id: idCheck(x.id, 'agent.id', seen), name: str(x.name, 'agent.name', 24), role: x.role, level: Math.floor(num(x.level, 'agent.level', 1, 10000)), focus: x.focus, trait: str(x.trait || '', 'agent.trait', 40), assignment, cooldownUntil: num(x.cooldownUntil, 'agent.cooldownUntil', 0, 1e15) };
    });
    const readJobs = (arrInput, key, max) => arr(arrInput, key, max).map(x => {
      if (!x || !JOB_KINDS.includes(x.kind)) throw new Error('Ungültige Auftragsart.');
      const totalWork = num(x.totalWork, 'job.totalWork', 0.001, 1e12), work = num(x.work, 'job.work', 0, totalWork);
      const gpuDemand = x.kind === 'ai' ? (x.gpuDemand ?? 1) : undefined;
      if (gpuDemand !== undefined && (!Number.isInteger(gpuDemand) || gpuDemand < 1 || gpuDemand > 4)) throw new Error('Ungültiger GPU-Bedarf.');
      return { id: idCheck(x.id, key + '.id', seen), title: str(x.title, 'job.title', 64), client: str(x.client, 'job.client', 64), kind: x.kind, ...(gpuDemand === undefined ? {} : { gpuDemand }), totalWork, work, reward: num(x.reward, 'job.reward'), science: num(x.science, 'job.science', 0, 1e9), rep: num(x.rep, 'job.rep', 0, 1e9), load: num(x.load, 'job.load', 0, 1e9) };
    });
    s.jobs = readJobs(input.jobs, 'jobs', MAX.jobs); s.offers = readJobs(input.offers, 'offers', MAX.offers);
    s.events = arr(input.events, 'events', MAX.events).map(e => {
      const eventKeys = { signal: ['signal_analyze', 'signal_license'], grant: ['grant_funds', 'grant_research'], maintenance: ['maintenance_care', 'maintenance_study'], client: ['client_help', 'client_knowledge'], discovery: ['discovery_research', 'discovery_publish'], procurement: ['procurement_funds', 'procurement_evaluate'] };
      if (!e || !own(eventKeys, e.kind)) throw new Error('Ungültiges Ereignis.');
      const choices = arr(e.choices, 'event.choices', 4).map(c => { if (!c || !eventKeys[e.kind].includes(c.key)) throw new Error('Ungültige Ereignisauswahl.'); return { label: str(c.label, 'choice.label', 48), description: str(c.description, 'choice.description', 120), key: c.key }; });
      if (choices.length < 2) throw new Error('Ereignis ohne Auswahl.');
      return { id: idCheck(e.id, 'event.id', seen), title: str(e.title, 'event.title', 64), description: str(e.description, 'event.description', 180), kind: e.kind, choices };
    });
    s.log = arr(input.log ?? [], 'log', MAX.log).map(l => ({ id: idCheck(l.id, 'log.id', seen), time: num(l.time, 'log.time'), type: str(l.type, 'log.type', 24), message: str(l.message, 'log.message', 180) }));
    const upgradeInput = input.upgrades ?? {}; if (!upgradeInput || typeof upgradeInput !== 'object' || Array.isArray(upgradeInput)) throw new Error('Ungültige Forschung.');
    for (const u of catalog.research) if (own(upgradeInput, u.id)) s.upgrades[u.id] = Math.floor(num(upgradeInput[u.id], 'upgrade', 0, MAX_RESEARCH_LEVEL));
    const p = input.policies || {}; if (!['balanced', 'performance', 'eco'].includes(p.power) || !['balanced', 'income', 'research'].includes(p.priority) || typeof p.autocontract !== 'boolean' || typeof p.autorepair !== 'boolean' || typeof p.autobackup !== 'boolean' || ![0, 100, 300, 1000].includes(p.repairBudget) || ![0, 250, 1000, 5000].includes(p.reserve)) throw new Error('Ungültige Richtlinien.');
    s.policies = { power: p.power, priority: p.priority, autocontract: p.autocontract, autorepair: p.autorepair, autobackup: p.autobackup, repairBudget: p.repairBudget, reserve: p.reserve };
    s.history = arr(input.history ?? [], 'history', MAX.history).map(h => ({ time: num(h.time, 'history.time'), credits: num(h.credits, 'history.credits'), income: num(h.income, 'history.income', -1e9, 1e9), load: num(h.load, 'history.load', 0, 1e6) }));
    const ach = input.achievements || {}; if (!ach || typeof ach !== 'object' || Array.isArray(ach)) throw new Error('Ungültige Meilensteine.');
    for (const a of catalog.achievements) s.achievements[a.id] = ach[a.id] === true;
    const unlocks = input.achievementUnlocks; if (!unlocks || typeof unlocks !== 'object' || Array.isArray(unlocks)) throw new Error('Ungültige Meilensteinfreigaben.');
    s.achievementUnlocks = {};
    for (const a of catalog.achievements) {
      if (typeof unlocks[a.id] !== 'boolean') throw new Error('Ungültige Meilensteinfreigabe: ' + a.id);
      s.achievementUnlocks[a.id] = unlocks[a.id] || s.achievements[a.id];
    }
    const c = input.counters || {}; s.counters = { jobs: Math.floor(num(c.jobs ?? 0, 'counters.jobs')), events: Math.floor(num(c.events ?? 0, 'counters.events')), serversBought: Math.floor(num(c.serversBought ?? 0, 'counters.serversBought')), agentsHired: Math.floor(num(c.agentsHired ?? 0, 'counters.agentsHired')), sectors: Math.floor(num(c.sectors ?? s.sector, 'counters.sectors')) };
    const t = input.timers || {}; s.timers = { offer: num(t.offer ?? 20, 'timers.offer', 0, 1e6), event: num(t.event ?? 90, 'timers.event', 0, 1e6), history: num(t.history ?? 30, 'timers.history', 0, 30) };
    const r = input.resilience;
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('Ungültige Betriebsabsicherung.');
    const snap = r.backup;
    let backup = null;
    if (snap !== null) {
      if (!snap || typeof snap !== 'object' || Array.isArray(snap)) throw new Error('Ungültige Betriebssicherung.');
      const backupIds = new Set();
      const backupJobs = arr(snap.jobs, 'backup.jobs', RESILIENCE_MAX.backupJobs).map(j => {
        if (!j || typeof j.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/i.test(j.id) || backupIds.has(j.id)) throw new Error('Ungültiger gesicherter Auftragsverweis.');
        backupIds.add(j.id); return { id: j.id, work: num(j.work, 'backup.job.work', 0, 1e12) };
      });
      const research = num(snap.research, 'backup.research');
      const protectedResearch = num(snap.protectedResearch, 'backup.protectedResearch', 0, research);
      backup = { createdAt: num(snap.createdAt, 'backup.createdAt', 0, s.time), research, protectedResearch, jobs: backupJobs };
    }
    const readWorkLosses = rows => arr(rows || [], 'operation.workLosses', MAX.jobs).map(row => {
      if (!row || typeof row.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/i.test(row.id)) throw new Error('Ungültiger Auftragsverlust.');
      return { id: row.id, amount: num(row.amount, 'operation.workLoss', 0, 1e12) };
    });
    const readConditions = rows => arr(rows || [], 'operation.conditions', RESILIENCE_MAX.incidentAffected).map(row => {
      if (!row || typeof row.id !== 'string' || !s.servers.some(server => server.id === row.id)) throw new Error('Ungültiger Wiederherstellungsknoten.');
      return { id: row.id, condition: num(row.condition, 'operation.condition', 0, MAX_CONDITION) };
    });
    let incident = null;
    if (r.incident !== null) {
      const e = r.incident;
      const kinds = ['power', 'cooling', 'corruption'];
      if (!e || typeof e !== 'object' || !kinds.includes(e.kind)) throw new Error('Ungültiger Krisenfall.');
      const affected = arr(e.affected, 'incident.affected', RESILIENCE_MAX.incidentAffected).map(id => {
        if (typeof id !== 'string' || !s.servers.some(server => server.id === id)) throw new Error('Ungültiger Krisenknoten.');
        return id;
      });
      if (!affected.length || new Set(affected).size !== affected.length) throw new Error('Krise ohne eindeutige betroffene Knoten.');
      const resolutions = { power: ['reroute', 'replace', 'manual'], cooling: ['shed_load', 'cooling_unit', 'manual'], corruption: ['restore_backup', 'rebuild', 'manual'] };
      const resolution = e.resolution === null ? null : str(e.resolution, 'incident.resolution', 32);
      if (resolution !== null && !resolutions[e.kind].includes(resolution)) throw new Error('Ungültige Krisenmaßnahme.');
      incident = { id: idCheck(e.id, 'incident.id', seen), kind: e.kind, title: str(e.title, 'incident.title', 64), description: str(e.description, 'incident.description', 240), consequence: str(e.consequence, 'incident.consequence', 240), affected, resolution };
    }
    let operation = null;
    if (r.operation !== null) {
      const op = r.operation;
      if (!op || typeof op !== 'object' || !['backup', 'repair', 'power', 'cooling', 'corruption'].includes(op.kind) || !op.effect || typeof op.effect !== 'object' || Array.isArray(op.effect)) throw new Error('Ungültiger Betriebsablauf.');
      const total = num(op.total, 'operation.total', 0.001, 1e9), remaining = num(op.remaining, 'operation.remaining', 0, total);
      const serverId = op.serverId === null ? null : str(op.serverId, 'operation.serverId', 64);
      if (serverId !== null && !s.servers.some(server => server.id === serverId)) throw new Error('Unbekannter Wartungsknoten.');
      let effect;
      if (op.kind === 'backup') {
        if (op.effect.snapshot !== true || serverId !== null) throw new Error('Ungültiger Sicherungsablauf.');
        effect = { snapshot: true };
      } else if (op.kind === 'repair') {
        if (!serverId) throw new Error('Reparatur ohne Zielknoten.');
        effect = { condition: num(op.effect.condition, 'operation.condition', 0, MAX_CONDITION), workLosses: readWorkLosses(op.effect.workLosses), reputationLoss: num(op.effect.reputationLoss, 'operation.reputationLoss', 0, 1e6) };
      } else {
        if (!incident || incident.kind !== op.kind || incident.resolution === null || serverId !== null) throw new Error('Krisenablauf ohne passende offene Krise.');
        effect = { conditions: readConditions(op.effect.conditions), integrity: num(op.effect.integrity, 'operation.integrity', 0, 100), reputationLoss: num(op.effect.reputationLoss, 'operation.reputationLoss', 0, 1e6), clearCorruption: op.effect.clearCorruption === true, workLosses: readWorkLosses(op.effect.workLosses), restoreSnapshot: op.effect.restoreSnapshot === true };
        if (own(op.effect, 'research')) effect.research = num(op.effect.research, 'operation.research');
        if (op.effect.restoreSnapshot && (!backup || op.kind !== 'corruption')) throw new Error('Wiederherstellung ohne gültige Sicherung.');
      }
      operation = { kind: op.kind, label: str(op.label, 'operation.label', 64), remaining, total, serverId, cost: num(op.cost ?? 0, 'operation.cost'), effect };
    }
    if (incident && (incident.resolution !== null) !== Boolean(operation && operation.kind === incident.kind)) throw new Error('Krisenstatus und laufende Maßnahme stimmen nicht überein.');
    if (!incident && operation && !['backup', 'repair'].includes(operation.kind)) throw new Error('Krisenmaßnahme ohne offenen Krisenfall.');
    const repairingServers = s.servers.filter(server => server.status === 'repairing');
    if (repairingServers.length > 1 || (repairingServers.length && (!operation || operation.kind !== 'repair' || operation.serverId !== repairingServers[0].id))) throw new Error('Wartungsstatus und laufender Ablauf stimmen nicht überein.');
    if (operation && operation.kind === 'repair' && !repairingServers.some(server => server.id === operation.serverId)) throw new Error('Reparaturziel ist nicht in Wartung.');
    if (incident && incident.affected.some(id => !s.servers.some(server => server.id === id && server.status === 'failed'))) throw new Error('Betroffener Krisenknoten ist nicht ausgefallen.');
    const budgetWindowStart = num(r.budgetWindowStart, 'resilience.budgetWindowStart', 0, s.time);
    if (s.time - budgetWindowStart >= 3600) throw new Error('Ungültiges Wartungsbudget-Fenster.');
    const agentEffects = r.agentEffects;
    if (!agentEffects || typeof agentEffects !== 'object' || Array.isArray(agentEffects)) throw new Error('Ungültige Agentenwirkungen.');
    s.resilience = {
      graceUntil: num(r.graceUntil, 'resilience.graceUntil', 0, 1e15), budgetWindowStart,
      budgetSpent: num(r.budgetSpent, 'resilience.budgetSpent', 0, 1000), parts: Math.floor(num(r.parts, 'resilience.parts', 0, RESILIENCE_MAX.parts)),
      backupCooldownUntil: num(r.backupCooldownUntil, 'resilience.backupCooldownUntil', 0, 1e15), autoBackupNextAt: num(r.autoBackupNextAt, 'resilience.autoBackupNextAt', 0, 1e15),
      backup, operation, incident, corrupted: r.corrupted === true, integrity: num(r.integrity, 'resilience.integrity', 0, 100),
      agentEffects: { diagnoseRemaining: num(agentEffects.diagnoseRemaining, 'agentEffects.diagnoseRemaining', 0, 1200), optimizeRemaining: num(agentEffects.optimizeRemaining, 'agentEffects.optimizeRemaining', 0, 900) }
    };
    if (typeof r.corrupted !== 'boolean' || s.resilience.corrupted !== Boolean(incident && incident.kind === 'corruption')) throw new Error('Datenintegrität passt nicht zum Krisenstatus.');
    for (const kind of ['diagnose', 'optimize', 'research']) {
      const assignments = s.agents.filter(agent => agent.assignment && agent.assignment.kind === kind).length;
      const active = kind === 'diagnose' ? s.resilience.agentEffects.diagnoseRemaining > 0 : kind === 'optimize' ? s.resilience.agentEffects.optimizeRemaining > 0 : false;
      if (assignments > 1 || (assignments && active)) throw new Error('Agenteneffekte dürfen nicht parallel gestapelt werden.');
    }
    if (s.servers.filter(server => server.status === 'failed').length > RESILIENCE_MAX.incidentAffected) throw new Error('Zu viele ausgefallene Server.');
    s.nextId = Math.floor(num(input.nextId ?? 1, 'nextId', 1, 1e9));
    if (!s.servers.length || !s.agents.length) throw new Error('Ein Netzwerkstand braucht mindestens einen Server und einen Agenten.');
    if (s.servers.length > getServerLimit(s) || s.agents.length > Math.min(MAX.agents, 3 + s.sector * 2)) throw new Error('Netzwerkstand überschreitet Sektorgrenzen.');
    const maxNumericId = [...seen].reduce((max, id) => { const match = /-(\d+)$/.exec(id); return match ? Math.max(max, Number(match[1])) : max; }, 0);
    s.nextId = Math.max(s.nextId, maxNumericId + 1);
    if (s.nextId > 1e9) throw new Error('nextId liegt außerhalb des unterstützten Bereichs.');
    // Only schema fields are copied; unknown outer and nested properties are ignored.
    return s;
  }

  return { catalog, createState, normalizeState, getMetrics, getResilience, getAgentOperations, getRackModel, getFacilityLayout, getCentralInfrastructure, quoteHardware, advance, act, cost };
});
