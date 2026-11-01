/** Actions workforce: internal simulation domain, composed by engine.js. */
(function (root, factory) {
  const create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root) (root.RootEngineModules ||= {})['actions-workforce'] = create;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createDomain(context) {
    const { catalog, FOCI, own } = context;
    // Late domain calls avoid circular module imports; no simulation state is stored here.
    const addLog = (...args) => context.addLog(...args);
    const cost = (...args) => context.cost(...args);
    const getAgentOperations = (...args) => context.getAgentOperations(...args);
    const uid = (...args) => context.uid(...args);

    function applyWorkforce(s, action, payload, m) {
      const fail = (message) => ({ ok: false, message });
      if (action === 'recruitAgent') {
        const role = payload.role;
        if (!own(catalog.roles, role)) return fail('Diese Agentenrolle ist unbekannt.');
        if (s.agents.length >= m.agentLimit)
          return fail('Der Sektor hat seine Agentengrenze erreicht.');
        const price = cost(s, 'agent', role);
        if (s.credits < price) return fail(`Es fehlen ${Math.ceil(price - s.credits)} Credits.`);
        s.credits -= price;
        const names = ['Lea', 'Jonas', 'Nuri', 'Eva', 'Sam', 'Noor', 'Lin'];
        const id = uid(s, 'agent');
        s.agents.push({
          id,
          name: names[(s.counters.agentsHired + 2) % names.length],
          role,
          level: 1,
          focus: role === 'analyst' ? 'research' : role === 'engineer' ? 'maintenance' : 'income',
          trait:
            role === 'analyst' ? 'aufmerksam' : role === 'engineer' ? 'umsichtig' : 'pragmatisch',
          assignment: null,
          cooldownUntil: 0,
        });
        s.counters.agentsHired++;
        addLog(s, 'success', `${catalog.roles[role].name} dem Team beigetreten.`);
        return { ok: true, message: 'Agent eingestellt.' };
      }
      if (action === 'setAgentFocus') {
        const x = s.agents.find((v) => v.id === payload.id);
        if (!x) return fail('Agent nicht gefunden.');
        if (x.assignment || s.operations.projects.some((p) => p.agentId === x.id))
          return fail('Der Agent ist im Einsatz; der Schwerpunkt lässt sich danach wieder ändern.');
        if (!FOCI.includes(payload.focus)) return fail('Dieser Schwerpunkt ist ungültig.');
        x.focus = payload.focus;
        return { ok: true, message: 'Schwerpunkt angepasst.' };
      }
      if (action === 'upgradeAgent') {
        const x = s.agents.find((v) => v.id === payload.id);
        if (!x) return fail('Agent nicht gefunden.');
        if (x.assignment || s.operations.projects.some((p) => p.agentId === x.id))
          return fail('Der Agent ist im Einsatz und kann erst danach entwickelt werden.');
        if (x.level >= 10000)
          return fail('Dieser Agent hat die höchste Entwicklungsstufe erreicht.');
        const price = cost(s, 'agentUpgrade', x.id);
        if (s.credits < price) return fail(`Es fehlen ${Math.ceil(price - s.credits)} Credits.`);
        s.credits -= price;
        x.level++;
        addLog(s, 'success', `${x.name} erreicht Stufe ${x.level}.`);
        return { ok: true, message: 'Agent entwickelt.' };
      }
      if (action === 'dispatchAgent') {
        const agent = s.agents.find((x) => x.id === payload.id);
        if (!agent) return fail('Agent nicht gefunden.');
        const option = getAgentOperations(s)
          .agents.find((x) => x.id === agent.id)
          ?.options.find((x) => x.key === payload.mission);
        if (!option) return fail('Dieser Einsatz ist unbekannt.');
        if (!option.enabled)
          return fail(option.reason || 'Dieser Einsatz ist derzeit nicht verfügbar.');
        s.credits -= option.cost;
        agent.assignment = {
          kind: option.key,
          label: option.label,
          remaining: option.duration,
          total: option.duration,
        };
        addLog(
          s,
          'system',
          `${agent.name} beginnt „${option.label}“ für ${option.cost} Credits; normaler Betriebsausstoß ruht für ${option.duration} Sekunden.`,
        );
        return { ok: true, message: `${option.label} für ${agent.name} gestartet.` };
      }
      return null;
    }
    return { applyWorkforce };
  };
});
