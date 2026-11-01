/** Strict v4 service validation. Unknown fields are never used as executable plans. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['save-business'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function checkedNumber(value, min, max, integer = false) {
      if (
        !Number.isFinite(value) ||
        value < min ||
        value > max ||
        (integer && !Number.isSafeInteger(value))
      )
        throw new Error('Ungültiger Betriebswert.');
      return value;
    }
    function checkedBoolean(value) {
      if (typeof value !== 'boolean') throw new Error('Ungültiger Betriebsplan.');
      return value;
    }
    function checkedRecord(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Ungültiger Betriebsplan.');
      return value;
    }
    function normalizeBusiness(input, s) {
      const b = checkedRecord(input),
        owned = new Set(s.facility.building.rooms.map((r) => r.id));
      if (b.version !== 1 || !Array.isArray(b.rooms) || b.rooms.length !== owned.size)
        throw new Error('Unvollständiger Raumplan.');
      const seen = new Set(),
        managers = new Set(),
        agents = new Set(s.agents.map((a) => a.id));
      const rooms = b.rooms.map((value) => {
        const r = checkedRecord(value);
        if (!owned.has(r.roomId) || seen.has(r.roomId)) throw new Error('Ungültiger Betriebsraum.');
        seen.add(r.roomId);
        if (!Object.hasOwn(ctx.PROFILES, r.profile) || ![0, 0.2, 0.35].includes(r.reserve))
          throw new Error('Ungültiges Raumprofil.');
        if (r.managerId !== null && (!agents.has(r.managerId) || managers.has(r.managerId)))
          throw new Error('Ungültige Teamleitung.');
        if (r.managerId) managers.add(r.managerId);
        const plant = checkedRecord(r.plant),
          kinds = new Set();
        if (!Array.isArray(r.groups) || r.groups.length !== Object.keys(ctx.SERVICES).length)
          throw new Error('Unvollständiger Kundenplan.');
        const groups = r.groups.map((value) => {
          const g = checkedRecord(value);
          if (!Object.hasOwn(ctx.SERVICES, g.kind) || kinds.has(g.kind))
            throw new Error('Ungültige Kundengruppe.');
          kinds.add(g.kind);
          const units = checkedNumber(g.units, 0, 1e6, true),
            pending = checkedNumber(g.pending, 0, 1e6, true),
            onboarding = checkedNumber(g.onboarding, 0, 600);
          if (units + pending > 1e6 || Boolean(pending) !== Boolean(onboarding))
            throw new Error('Ungültige Kundenaufnahme.');
          return {
            kind: g.kind,
            units,
            pending,
            onboarding,
            remaining: checkedNumber(g.remaining, 0, 259200),
            renew: checkedBoolean(g.renew),
            premium: checkedBoolean(g.premium),
          };
        });
        return {
          roomId: r.roomId,
          profile: r.profile,
          reserve: r.reserve,
          crew: checkedNumber(r.crew, 1, 100000, true),
          managerId: r.managerId,
          changeRemaining: checkedNumber(r.changeRemaining, 0, 120),
          plant: Object.fromEntries(
            ['cooling', 'ups', 'distribution'].map((k) => [
              k,
              checkedNumber(plant[k], 0, 10000, true),
            ]),
          ),
          groups,
        };
      });
      return {
        version: 1,
        rooms,
        migrated: checkedBoolean(b.migrated),
        transitionUntil: checkedNumber(b.transitionUntil, 0, s.time + 43200),
        revenue: checkedNumber(b.revenue, 0, 1e15),
        wages: checkedNumber(b.wages, 0, 1e15),
        delivered: checkedNumber(b.delivered, 0, 1e15),
        unserved: checkedNumber(b.unserved, 0, 1e15),
      };
    }
    return { checkedNumber, checkedBoolean, checkedRecord, normalizeBusiness };
  };
});
