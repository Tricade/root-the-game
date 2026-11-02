/** One read model feeds both the web dashboard and physical control-room instruments. */
export function dashboardModel(
  E,
  state,
  metrics = E.getMetrics(state),
  resilience = null,
  agents = null,
) {
  const customers = E.getCustomers(state, { summaryOnly: true });
  const protection = resilience || E.getResilience(state, null, metrics);
  const personnel = agents || E.getAgentOperations(state);
  const project = state.lab.project ? E.getResearch(state, metrics).project : null;
  const supply = metrics.serviceUnits ? metrics.serviceDelivered / metrics.serviceUnits : null;
  const activeAgents = personnel.agents.filter((a) => !a.assignment && !a.absent).length;
  const workingAgents = personnel.agents.filter((a) => a.assignment).length;
  const absentAgents = personnel.agents.filter((a) => a.absent).length;
  const actions = [];
  if (protection.incident)
    actions.push({
      id: 'incident',
      route: 'resilience',
      label: 'Vorfall braucht eine Entscheidung',
      detail: protection.incident.title,
      severity: 'urgent',
    });
  else if (protection.failed)
    actions.push({
      id: 'repairs',
      route: 'resilience',
      label: 'Defekte Server reparieren',
      count: protection.failed,
      severity: 'warning',
    });
  if (customers.notices)
    actions.push({
      id: 'notices',
      route: 'business',
      label: 'Kündigungsfristen beachten',
      count: customers.notices,
      severity: 'warning',
    });
  if (customers.attention)
    actions.push({
      id: 'support',
      route: 'business',
      label: 'Kundenfälle bearbeiten',
      count: customers.attention,
      severity: 'warning',
    });
  if (supply !== null && supply < 0.95)
    actions.push({
      id: 'supply',
      route: 'facility',
      label: 'Versorgungsdefizit prüfen',
      severity: 'warning',
    });
  if (metrics.incomePerSecond < 0)
    actions.push({
      id: 'margin',
      route: 'business',
      label: 'Laufender Saldo ist negativ',
      severity: 'warning',
    });
  if (customers.waitingAgents)
    actions.push({
      id: 'staff',
      route: 'business',
      label: 'Kundeneinsätze warten auf Agenten',
      count: customers.waitingAgents,
      severity: 'normal',
    });
  if (customers.leads.length)
    actions.push({
      id: 'enquiries',
      route: 'business',
      label: 'Kundenanfragen prüfen',
      count: customers.leads.length,
      severity: 'normal',
    });
  if (!project)
    actions.push({
      id: 'research',
      route: 'research',
      label: 'Nächstes Forschungsprojekt planen',
      severity: 'normal',
    });
  return {
    customers,
    protection,
    project,
    supply,
    activeAgents,
    workingAgents,
    absentAgents,
    gross: metrics.serviceIncome * 60,
    upkeep: metrics.upkeep * 60,
    net: metrics.incomePerSecond * 60,
    queue: state.operations.queue.length,
    deliveries: state.operations.orders.length,
    actions: actions.slice(0, 6),
  };
}
