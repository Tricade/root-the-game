/** Explicit one-shot plans. No executable text, recursive actions or unbounded queues. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['operation-plans'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function (ctx) {
    function planPayload(action, p) {
      if (action === 'createBackup') return {};
      if (
        action === 'upgradeRack' &&
        typeof p.rackId === 'string' &&
        ['power', 'cooling', 'switch'].includes(p.component)
      )
        return { rackId: p.rackId, component: p.component };
      if (action === 'upgradeCentral' && ['cooling', 'ups', 'distribution'].includes(p.system))
        return { system: p.system };
      if (
        action === 'convertRoomSupply' &&
        typeof p.roomId === 'string' &&
        ['cooling', 'power'].includes(p.system) &&
        Object.hasOwn(ctx.SUPPLY_MODES, p.mode) &&
        !(p.system === 'cooling' && p.mode === 'ups')
      )
        return { roomId: p.roomId, system: p.system, mode: p.mode };
      return null;
    }
    function planQuote(s, item) {
      if (item.action === 'createBackup') return ctx.getResilience(s).backup;
      if (item.action === 'convertRoomSupply') return ctx.supplyQuote(s, item.payload);
      return ctx.quoteHardware(s, item.action, item.payload);
    }
    function applyPlan(s, action, p) {
      const o = s.operations;
      if (action === 'queueOperation') {
        const payload = planPayload(p.action, p.payload || {});
        if (
          !payload ||
          o.queue.length >= 12 ||
          !Number.isSafeInteger(p.ceiling) ||
          p.ceiling < 0 ||
          p.ceiling > 1e12
        )
          return { ok: false, message: 'Ungültiger oder voller Ablaufplan.' };
        const item = {
          id: ctx.uid(s, 'plan'),
          action: p.action,
          payload,
          ceiling: p.ceiling,
          reason: '',
        };
        o.queue.push(item);
        o.nextCheck = s.time;
        return {
          ok: true,
          message: 'Maßnahme eingeplant. Ausführung innerhalb deiner Budgetgrenzen.',
        };
      }
      if (action === 'cancelPlannedOperation') {
        const index = o.queue.findIndex((x) => x.id === p.id);
        if (index < 0) return { ok: false, message: 'Geplante Maßnahme nicht gefunden.' };
        o.queue.splice(index, 1);
        return { ok: true, message: 'Geplante Maßnahme entfernt.' };
      }
      if (action === 'pauseOperations') {
        if (typeof p.value !== 'boolean') return { ok: false, message: 'Ungültiger Ablaufplan.' };
        o.paused = p.value;
        o.nextCheck = s.time;
        return { ok: true, message: 'Ablaufplan gespeichert.' };
      }
      return null;
    }
    function advancePlan(s) {
      const o = s.operations,
        item = o.queue[0];
      if (o.paused || !item) return;
      if (
        s.resilience.operation ||
        s.facility.operation ||
        s.facility.centralOperation ||
        s.business.rooms.some((r) => r.conversion)
      ) {
        item.reason = 'Wartet auf den Abschluss der laufenden Maßnahme.';
        return;
      }
      const q = planQuote(s, item),
        policy = ctx.maintenancePolicy(s);
      if (!q.enabled) {
        item.reason = q.reason;
        return;
      }
      if (q.cost > item.ceiling) {
        item.reason = 'Der aktuelle Preis überschreitet deine Freigabe.';
        return;
      }
      if (o.planSpent + q.cost > policy.plan) {
        item.reason = 'Das Stundenbudget für geplante Maßnahmen reicht nicht aus.';
        return;
      }
      if (s.credits - q.cost < Math.max(policy.reserve, policy.savings)) {
        item.reason = 'Geschützte Reserve oder Sparziel würden unterschritten.';
        return;
      }
      const result = ctx.act(s, item.action, item.payload);
      if (result.ok) {
        o.planSpent += q.cost;
        o.queue.shift();
        ctx.addLog(s, 'system', 'Geplante Maßnahme gestartet.');
      } else item.reason = result.message;
    }
    return { planPayload, planQuote, applyPlan, advancePlan };
  };
});
