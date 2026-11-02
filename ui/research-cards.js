import { workloadArt } from './workload-art.js';

/** A branch shows a root, parallel paths and their join; cross-tree prerequisites remain links. */
export function createResearchCards(ctx) {
  const icons = {
    work: 'globe',
    risk: 'pulse',
    wear: 'shield',
    onboarding: 'agents',
    patience: 'timer',
    serviceEfficiency: 'cpu',
    retentionBonus: 'jobs',
    energy: 'heat',
    research: 'research',
    aiReward: 'cpu',
    inferenceIncome: 'server',
  };
  function researchCard(def, model, position = '') {
    const q = def.quote,
      active = model.project?.id === def.id,
      owned = q.unique && q.level > 0;
    const requirements = q.requires.map((id) => model.technologies.find((n) => n.id === id));
    const icon = q.unique
      ? icons[Object.keys(def.effects)[0]]
      : {
          routing: 'globe',
          cooling: 'heat',
          market: 'jobs',
          automation: 'automation',
          synthesis: 'research',
        }[def.id];
    return `<article class="research-card research-node ${owned ? 'completed' : q.missing?.length ? 'locked' : ''}" ${position ? `style="grid-area:${position}"` : ''} data-research-node="${def.id}">${!q.unique ? workloadArt(def.id, true) : ''}<div class="research-top"><div class="research-icon">${ctx.icon(icon)}</div><span class="tag ${owned ? 'green' : active ? 'blue' : ''}">${ctx.tr(owned ? 'Erforscht' : active ? 'In Arbeit' : q.unique ? 'Technologie' : 'Stufe')} ${q.unique ? '' : q.level}</span></div><h3>${ctx.esc(ctx.tr(def.name))}</h3><p>${ctx.esc(ctx.tr(def.description))}</p><div class="research-prerequisites"><span>Voraussetzungen</span>${requirements.map((node) => `<button class="text-button ${ctx.state.lab.owned.includes(node.id) ? 'positive' : ''}" data-research-focus="${node.id}">${ctx.icon(ctx.state.lab.owned.includes(node.id) ? 'check' : 'layers')}${ctx.esc(ctx.tr(node.name))}</button>`).join('') || `<span>${ctx.tr('Keine Vorforschung erforderlich')}</span>`}${def.sector > 1 ? `<span>${ctx.tr('Ab Sektor')} ${def.sector}</span>` : ''}</div><div class="research-commitment"><strong>${ctx.fmt(q.cost)} ${ctx.tr('FP')}</strong><span>${ctx.duration(q.duration)} ${ctx.tr('Laborzeit')}</span></div><p class="protection-reason" data-research-reason="${def.id}">${owned ? '' : ctx.esc(ctx.tr(q.reason))}</p><button class="button block" data-research-start="${def.id}" ${q.enabled ? '' : 'disabled'}>${ctx.icon(owned ? 'check' : 'research')}${ctx.tr(owned ? 'Dauerhaft aktiv' : 'Forschung prüfen')}</button></article>`;
  }
  function researchBranch(tree, model) {
    const nodes = model.technologies.filter((n) => n.tree === tree.id);
    const map = `<nav class="research-map" aria-label="${ctx.tr('Forschungsübersicht')}"><svg viewBox="0 0 900 200" preserveAspectRatio="none" aria-hidden="true"><path d="M150 100H300V45H450M300 100V155H450M450 45H600V100H750M450 155H600V100"/></svg>${nodes
      .map((n, i) => {
        const owned = ctx.state.lab.owned.includes(n.id),
          active = model.project?.id === n.id;
        return `<button class="research-map-node ${owned ? 'completed' : active ? 'current' : ''}" style="grid-area:${['root', 'left', 'right', 'join'][i] || 'auto'}" data-research-focus="${n.id}"><strong>${ctx.esc(ctx.tr(n.name))}</strong><span>${ctx.tr(owned ? 'Erforscht' : active ? 'In Arbeit' : n.quote.missing.length ? 'Grundlagen fehlen' : 'Technologie ansehen')}</span></button>`;
      })
      .join('')}</nav>`;
    return `<section class="research-branch"><div class="research-branch-heading">${workloadArt(tree.art, true)}<div><span class="eyebrow">FORSCHUNGSZWEIG</span><h2>${ctx.esc(ctx.tr(tree.name))}</h2><p>${ctx.esc(ctx.tr(tree.description))}</p></div></div>${map}<div class="research-tree">${nodes.map((n, i) => researchCard(n, model, ['root', 'left', 'right', 'join'][i] || '')).join('')}</div></section>`;
  }
  return { researchCard, researchBranch };
}
