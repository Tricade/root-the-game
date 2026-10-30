/** Central: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['central'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { MAX_RACK_LEVEL, CENTRAL_SYSTEMS, CENTRAL_DEFAULTS } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const cashReason = (...args) => context.cashReason(...args);
    const getMetrics = (...args) => context.getMetrics(...args);
    const hardwareSnapshot = (...args) => context.hardwareSnapshot(...args);

    function centralLevels(s) {
      return { ...CENTRAL_DEFAULTS, ...((s.facility && s.facility.central) || {}) };
    }

    function centralOperatingCost(levels, powerW, policy) {
      return (
        (powerW / 1000) * (policy === 'eco' ? 0.035 : policy === 'performance' ? 0.105 : 0.064) +
        levels.cooling * 0.04 +
        levels.ups * 0.035 +
        levels.distribution * 0.025
      );
    }

    function activeRackIds(s) {
      if (s.resilience.incident) return new Set();
      return new Set(
        s.servers
          .filter(
            (server) =>
              server.powered &&
              server.bootRemaining <= 0 &&
              server.status === 'online' &&
              server.condition > 0 &&
              !(s.facility.operation && s.facility.operation.rackId === server.rackId),
          )
          .map((server) => server.rackId),
      );
    }

    function centralQuote(s, system) {
      const levels = centralLevels(s),
        level = levels[system.id],
        targetLevel = level + 1;
      const price = Math.ceil(
        system.baseCost *
          Math.pow(targetLevel, 1.55) *
          (1 + Math.max(0, s.sector - system.unlockSector) * 0.12),
      );
      const duration = Math.min(300, system.duration + (targetLevel - 1) * 30);
      const locked = Boolean(
        s.resilience.incident ||
        s.resilience.operation ||
        s.facility.operation ||
        s.facility.centralOperation,
      );
      let reason =
        s.sector < system.unlockSector
          ? `Freischaltung ab Sektor ${system.unlockSector}.`
          : !context.serviceRoomOwned(s, system.id)
            ? 'Baue zuerst den zugehörigen Technikraum unter Gebäude.'
            : level >= system.maxLevel
              ? 'Höchste Ausbaustufe erreicht.'
              : locked
                ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.'
                : cashReason(s, price);
      const step = system.id === 'cooling' ? 3500 : system.id === 'ups' ? 3000 : 6000;
      const capacityAfterW = Math.min(targetLevel, system.maxLevel) * step,
        capacityGainW = capacityAfterW - level * step;
      const active = activeRackIds(s).size > 0,
        powerIncreaseW = system.id === 'cooling' && active && capacityGainW > 0 ? 500 : 0;
      const nextLevels = { ...levels, [system.id]: Math.min(targetLevel, system.maxLevel) };
      const beforePowerW = active ? levels.cooling * 500 : 0;
      const upkeepIncrease =
        centralOperatingCost(nextLevels, beforePowerW + powerIncreaseW, s.policies.power) -
        centralOperatingCost(levels, beforePowerW, s.policies.power);
      const effect =
        system.id === 'cooling'
          ? `${capacityGainW} W zusätzliche Kühlleistung; danach ${capacityAfterW} W zentral. Auf aktive Racks verteilt.`
          : system.id === 'ups'
            ? `${capacityGainW} W zusätzliche USV-Leistung; danach ${capacityAfterW} W gesamt. Bei passender Lastabdeckung sinkt die Chance schwerer Stromausfälle um bis zu 65 %; deren Folgen werden gemindert.`
            : `${capacityGainW} W zusätzliche Gesamtreserve; danach ${capacityAfterW} W zentral. Gleichmäßig auf aktive Racks verteilt.`;
      return {
        label: `${system.name} ausbauen`,
        description: `${price} Credits; ${duration} Sekunden Wartung. ${effect} Laufende Mehrkosten: ${upkeepIncrease.toFixed(3).replace('.', ',')} CR/s; zusätzliche Leistungsaufnahme: ${powerIncreaseW} W.`,
        cost: price,
        duration,
        enabled: !reason,
        reason,
        capacityGainW,
        capacityAfterW,
        upkeepIncrease,
        powerIncreaseW,
      };
    }

    function rackComponentQuote(s, rack, component) {
      const level = rack[component + 'Level'];
      const step = component === 'switch' ? 45 : component === 'power' ? 60 : 90;
      const base = component === 'switch' ? 360 : component === 'power' ? 300 : 280;
      const maxLevel = component === 'switch' ? 3 : MAX_RACK_LEVEL;
      const costValue = Math.ceil(
        base * Math.pow(level, 1.52) * (1 + Math.max(0, s.sector - 1) * 0.3),
      );
      const locked = Boolean(
        s.resilience.incident ||
        s.resilience.operation ||
        s.facility.operation ||
        s.facility.centralOperation,
      );
      const reason = locked
        ? 'Während einer Krise oder laufenden Infrastrukturmaßnahme nicht verfügbar.'
        : level >= maxLevel
          ? 'Höchste Ausbaustufe erreicht.'
          : cashReason(s, costValue);
      return {
        label:
          component === 'switch'
            ? 'Switch-Ausbau'
            : component === 'power'
              ? 'Stromversorgung ausbauen'
              : 'Kühlung ausbauen',
        description: `${costValue} Credits; ${step} Sekunden Wartung. Rack und angeschlossene Server sind währenddessen nicht verfügbar.`,
        cost: costValue,
        duration: step,
        enabled: !reason,
        reason,
      };
    }

    function getCentralInfrastructure(s, providedMetrics = null) {
      const levels = centralLevels(s),
        hardware = hardwareSnapshot(s),
        metrics = providedMetrics || getMetrics(s),
        activeRackCount = activeRackIds(s).size;
      const systems = CENTRAL_SYSTEMS.map((system) => {
        const level = levels[system.id];
        const common = {
          id: system.id,
          name: system.name,
          unlockSector: system.unlockSector,
          level,
          maxLevel: system.maxLevel,
          unlocked: s.sector >= system.unlockSector,
          roomOwned: context.serviceRoomOwned(s, system.id),
          available: s.sector >= system.unlockSector && context.serviceRoomOwned(s, system.id),
          active: level > 0,
          status:
            s.sector < system.unlockSector
              ? 'locked'
              : !context.serviceRoomOwned(s, system.id)
                ? 'room-required'
                : level > 0
                  ? 'active'
                  : 'available',
          quote: centralQuote(s, system),
        };
        if (system.id === 'cooling')
          return {
            ...common,
            totalCoolingW: level * 3500,
            allocatedCoolingW: [...hardware.values()].reduce(
              (sum, row) => sum + row.centralCoolingW,
              0,
            ),
            activeRackCount,
          };
        if (system.id === 'ups')
          return {
            ...common,
            upsCapacityW: metrics.upsCapacityW,
            coverage: metrics.upsCoverage,
            powerRiskReductionPct: metrics.powerRiskReductionPct,
          };
        return {
          ...common,
          distributionCapacityW: metrics.centralDistributionCapacityW,
          additionalPowerWPerRack: metrics.centralDistributionWPerRack,
          totalAdditionalPowerW: metrics.centralDistributionWPerRack * activeRackCount,
          activeRackCount,
        };
      });
      const operation = s.facility.centralOperation
        ? {
            ...s.facility.centralOperation,
            name: CENTRAL_SYSTEMS.find((system) => system.id === s.facility.centralOperation.system)
              .name,
            label: `${CENTRAL_SYSTEMS.find((system) => system.id === s.facility.centralOperation.system).name} ausbauen`,
          }
        : null;
      return {
        systems,
        operation,
        upkeep: metrics.centralUpkeep,
        powerW: metrics.centralPowerW,
        coolingCapacityW: metrics.centralCoolingW,
        activeRackCount,
        upsCapacityW: metrics.upsCapacityW,
        upsCoverage: metrics.upsCoverage,
        powerRiskReductionPct: metrics.powerRiskReductionPct,
        distributionCapacityW: metrics.centralDistributionCapacityW,
        distributionCapacityWPerRack: metrics.centralDistributionWPerRack,
      };
    }
    return {
      centralLevels,
      centralOperatingCost,
      activeRackIds,
      centralQuote,
      rackComponentQuote,
      getCentralInfrastructure,
    };
  };
});
