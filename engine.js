/** Public Node/browser API. Domain factories share functions, never a mutable singleton save. */
(function (root, factory) {
  const names = [
    'definitions',
    'dependencies',
    'job-catalog',
    'service-catalog',
    'room-supply',
    'state',
    'economy',
    'building',
    'central',
    'hardware',
    'gpu',
    'service-resources',
    'service-metrics',
    'services',
    'metrics',
    'hardware-quotes',
    'racks',
    'recovery-quotes',
    'resilience',
    'agents',
    'contracts',
    'incidents',
    'maintenance',
    'simulation',
    'actions-infrastructure',
    'actions-workforce',
    'actions-progression',
    'actions-recovery',
    'actions',
    'save-legacy',
    'save-v2',
    'save-v3',
    'save-business',
    'save-v4',
    'saves',
  ];
  const modules = names.map((name) =>
    typeof module === 'object' && module.exports
      ? require('./engine/' + name + '.js')
      : root.RootEngineModules?.[name],
  );
  if (modules.some((create) => typeof create !== 'function'))
    throw new Error('ROOT engine modules are missing. Reload the current application.');
  const api = factory(modules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RootEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (modules) {
  'use strict';
  const context = {};
  Object.assign(
    context,
    modules[0]((state) => context.getMetrics(state)),
  );
  for (const create of modules.slice(1)) Object.assign(context, create(context));
  return {
    catalog: context.catalog,
    createState: context.createState,
    normalizeState: context.normalizeState,
    getMetrics: context.getMetrics,
    getResilience: context.getResilience,
    getAgentOperations: context.getAgentOperations,
    getRackModel: context.getRackModel,
    getFacilityLayout: context.getFacilityLayout,
    getBuildingModel: context.getBuildingModel,
    getConstructionProject: context.getConstructionProject,
    getCentralInfrastructure: context.getCentralInfrastructure,
    getBusinessModel: context.getBusinessModel,
    quoteService: context.serviceQuote,
    quoteSupply: context.supplyQuote,
    jobResources: context.jobResources,
    jobsFit: context.jobsFit,
    jobProfiles: context.JOB_PROFILES,
    quoteHardware: context.quoteHardware,
    advance: context.advance,
    act: context.act,
    cost: context.cost,
  };
});
