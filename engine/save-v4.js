/** Schema boundary: legacy progress migrates once; v4 requires its business plan. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-v4'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function normalizeV4(input) {
      const s = ctx.normalizeV3({ ...input, version: 3 });
      s.business = ctx.normalizeBusiness(input.business, s);
      const incident = input.resilience.incident;
      if (incident?.scope !== undefined) {
        const rack = s.facility.racks.find((r) => r.id === incident.rackId);
        if (
          !['nodes', 'rack', 'room', 'central'].includes(incident.scope) ||
          !rack ||
          rack.roomId !== incident.roomId
        )
          throw new Error('Ungültiger Ausfallbereich.');
        const byRack = new Map(s.facility.racks.map((r) => [r.id, r]));
        for (const id of incident.affected) {
          const server = s.servers.find((n) => n.id === id);
          if (
            (incident.scope === 'rack' && server.rackId !== rack.id) ||
            (incident.scope === 'room' && byRack.get(server.rackId).roomId !== incident.roomId)
          )
            throw new Error('Ausfall außerhalb des betroffenen Bereichs.');
        }
        Object.assign(s.resilience.incident, {
          scope: incident.scope,
          rackId: incident.rackId,
          roomId: incident.roomId,
        });
        if (incident.scope === 'central') {
          if (!['cooling', 'power'].includes(incident.system))
            throw new Error('Ungültiger Zentralanlagenausfall.');
          s.resilience.incident.system = incident.system;
        }
      }
      for (const key of ['jobs', 'offers'])
        s[key].forEach((job, i) => {
          const specialty = input[key][i].specialty;
          if (specialty !== undefined) {
            if (
              job.kind !== 'ai' ||
              !['training', 'inference', 'evaluation', 'tuning'].includes(specialty)
            )
              throw new Error('Ungültiges KI-Projektprofil.');
            job.specialty = specialty;
          }
        });
      s.version = 4;
      return s;
    }
    return { normalizeV4 };
  };
});
