/** Incidents: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['incidents'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, RESILIENCE_MAX } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (...args) => context.addLog(...args);
    const getMetrics = (...args) => context.getMetrics(...args);
    const rand = (...args) => context.rand(...args);
    const serverLinkState = (...args) => context.serverLinkState(...args);
    const uid = (...args) => context.uid(...args);

    function workLosses(s, fraction) {
      return s.jobs.map((j) => ({ id: j.id, amount: j.work * fraction }));
    }

    function chooseAffected(s, count = 1) {
      const online = s.servers.filter((x) => serverLinkState(s, x));
      const result = [];
      while (online.length && result.length < count)
        result.push(online.splice(Math.floor(rand(s) * online.length), 1)[0]);
      return result;
    }

    function openMinorFailure(s) {
      const failed = s.servers.filter((x) => x.status === 'failed').length;
      if (failed >= RESILIENCE_MAX.incidentAffected) return false;
      const candidates = s.servers.filter((x) => serverLinkState(s, x));
      if (!candidates.length) return false;
      const server = candidates[Math.floor(rand(s) * candidates.length)];
      server.condition = Math.min(server.condition, 42);
      server.status = 'failed';
      server.fault = 'Hardwarefehler';
      addLog(
        s,
        'warning',
        `${server.name}: Hardwarefehler erkannt. Aufträge laufen auf verbleibenden Knoten weiter.`,
      );
      return true;
    }

    function openMajorIncident(s) {
      const available = s.servers.filter((x) => serverLinkState(s, x));
      const failedCount = s.servers.filter((x) => x.status === 'failed').length;
      if (!available.length || failedCount >= RESILIENCE_MAX.incidentAffected) return false;
      const remainingAffected = RESILIENCE_MAX.incidentAffected - failedCount;
      const upsCoverage = getMetrics(s).upsCoverage;
      const powerReduction = 0.65 * upsCoverage;
      // This makes the published reduction match the actual power-incident
      // probability after normalizing the power, cooling, and corruption weights.
      const powerWeight = (2 * (1 - powerReduction)) / (2 + powerReduction);
      const draw = rand(s) * (2 + powerWeight);
      const kind = draw < powerWeight ? 'power' : draw < powerWeight + 1 ? 'cooling' : 'corruption';
      let affected;
      if (kind === 'cooling') {
        affected = available
          .slice()
          .sort(
            (a, b) =>
              catalog.servers[b.type].power * b.level - catalog.servers[a.type].power * a.level,
          )
          .slice(0, Math.min(remainingAffected, available.length));
      } else
        affected = chooseAffected(
          s,
          kind === 'power'
            ? Math.min(
                remainingAffected,
                available.length,
                upsCoverage >= 0.95 ? 1 : remainingAffected,
              )
            : 1,
        );
      const content = {
        power: {
          title: 'Stromversorgung ausgefallen',
          description:
            'Eine Schutzschaltung hat mehrere Knoten getrennt. Die betroffenen Server bleiben offline, bis eine sichere Umschaltung abgeschlossen ist.',
          consequence:
            'Aufträge pausieren bis zur Entscheidung; Wiederanlauf braucht eine gewählte Schaltmaßnahme.',
        },
        cooling: {
          title: 'Kühlkreislauf überhitzt',
          description:
            'Die Temperaturgrenze wurde überschritten. Betroffene Knoten wurden zum Schutz vor Folgeschäden abgeschaltet.',
          consequence: 'Aufträge pausieren; ohne Reparatur bleibt die Kapazität reduziert.',
        },
        corruption: {
          title: 'Datenintegrität beschädigt',
          description:
            'Prüfsummenfehler haben den Betriebsbestand beeinträchtigt. Änderungen bleiben angehalten, bis eine Wiederherstellung gewählt ist.',
          consequence:
            'Forschung und Auftragsstände sind gefährdet; ein gespeicherter Betriebsstand kann ungesicherte Fortschritte kosten.',
        },
      }[kind];
      for (const server of affected) {
        server.condition = Math.min(
          server.condition,
          kind === 'cooling' ? 24 : kind === 'power' ? 35 + 20 * upsCoverage : 35,
        );
        server.status = 'failed';
        server.fault =
          kind === 'power'
            ? 'Stromausfall'
            : kind === 'cooling'
              ? 'Kühlungsstörung'
              : 'Datenfehler';
      }
      if (kind === 'corruption') {
        s.resilience.corrupted = true;
        s.resilience.integrity = Math.min(s.resilience.integrity, 38);
      }
      const id = uid(s, 'incident');
      s.resilience.incident = {
        id,
        kind,
        title: content.title,
        description: content.description,
        consequence: content.consequence,
        affected: affected.map((x) => x.id),
        resolution: null,
      };
      addLog(
        s,
        'critical',
        `${content.title}: betroffene Knoten ${affected.map((x) => x.name).join(', ')}. Die Maßnahme wartet auf deine Entscheidung.`,
      );
      return true;
    }
    return { workLosses, chooseAffected, openMinorFailure, openMajorIncident };
  };
});
