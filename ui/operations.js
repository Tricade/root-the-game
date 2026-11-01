/** Operations UI keeps planning separate from immediate, explicitly quoted work. */
export function createOperationsUI(ctx) {
  const numeric = (key, label, value) =>
    `<label class="field-label">${ctx.tr(label)}<input class="input" data-ops-field="${key}" type="number" min="0" max="1000000000000" step="1" value="${value}"></label>`;
  const select = (key, label, rows) =>
    `<label class="field-label">${ctx.tr(label)}<select class="select" data-ops-field="${key}">${rows.map(([v, t]) => `<option value="${ctx.esc(v)}">${ctx.esc(ctx.tr(t))}</option>`).join('')}</select></label>`;
  const button = (action, label, extra = '') =>
    `<button class="button" data-ops="${action}" ${extra}>${ctx.tr(label)}</button>`;
  const planNames = {
    createBackup: 'Betriebssicherung',
    upgradeRack: 'Rack ausbauen',
    upgradeCentral: 'Zentralanlage ausbauen',
    convertRoomSupply: 'Raumversorgung umbauen',
  };
  function operationsView() {
    const o = ctx.E.getOperations(ctx.state),
      rooms = ctx.E.getFacilityLayout(ctx.state).rooms;
    return (
      ctx.head(
        'Betriebspläne',
        'Budgets, Lieferungen und Projekte laufen auch während deiner Abwesenheit weiter.',
      ) +
      `<div class="policy-grid"><section class="panel" data-ops-form="limits">${ctx.panelHeader('Budgets & Reserven')}<div class="panel-body"><div class="business-controls">${[
        ['repair', 'Reparaturen / Stunde'],
        ['backup', 'Backups / Stunde'],
        ['parts', 'Beschaffung / Stunde'],
        ['plan', 'Ablaufplan / Stunde'],
        ['reserve', 'Geschützte Geldreserve'],
        ['savings', 'Sparziel für Ausbau'],
      ]
        .map(([key, label]) => numeric(key, label, o.limits[key]))
        .join(
          '',
        )}</div><p data-ops-spent></p><p class="policy-explainer">Wartung nutzt die Geldreserve als Untergrenze. Geplante Ausbauten schützen zusätzlich dein Sparziel. Änderungen setzen verbrauchte Stundenbudgets nicht zurück.</p>${numeric('partsTarget', 'Zielbestand Ersatzteile', o.partsTarget)}<label class="field-label"><input data-ops-field="autoParts" type="checkbox" ${o.autoParts ? 'checked' : ''}> ${ctx.tr('Ersatzteile automatisch nachbestellen')}</label>${button('policy', 'Betriebsplan speichern')}</div></section>` +
      `<section class="panel" data-ops-form="delivery">${ctx.panelHeader('Ersatzteillogistik')}<div class="panel-body"><p data-ops-stock></p><div class="business-controls">${numeric('quantity', 'Bestellmenge', 3)}${select(
        'method',
        'Lieferung',
        [
          ['standard', 'Standard · 30 Minuten'],
          ['express', 'Express · 5 Minuten · doppelter Preis'],
        ],
      )}</div>${button('delivery', 'Bestellung prüfen')}<div data-ops-deliveries></div><p class="policy-explainer">Jeder Serverraum erweitert das Lager. Höchstens zwei Lieferungen können gleichzeitig unterwegs sein.</p></div></section></div>` +
      `<section class="panel section-spacer">${ctx.panelHeader('Ablaufplan', button('pause', o.paused ? 'Fortsetzen' : 'Pausieren', `data-value="${!o.paused}"`))}<div class="panel-body"><p>Maßnahmen starten nacheinander. Fehlen Geld, Ersatzteile oder Voraussetzungen, wartet der Plan mit einer sichtbaren Begründung. Maximal zwölf Einträge.</p><div class="business-controls" data-ops-form="plan">${select('action', 'Maßnahme', Object.entries(planNames))}<div data-plan-for="upgradeRack" hidden>${select(
        'rackId',
        'Rack',
        ctx.state.facility.racks.map((r) => [r.id, r.name]),
      )}${select('component', 'Komponente', [
        ['cooling', 'Kühlung'],
        ['power', 'Strom'],
        ['switch', 'Switch'],
      ])}</div><div data-plan-for="upgradeCentral" hidden>${select('system', 'Zentralanlage', [
        ['cooling', 'Zentrale Kühlung'],
        ['ups', 'USV'],
        ['distribution', 'Stromverteilung'],
      ])}</div><div data-plan-for="convertRoomSupply" hidden>${select(
        'roomId',
        'Raum',
        rooms.map((r) => [r.id, r.name]),
      )}${select('supplySystem', 'System', [
        ['cooling', 'Kühlung'],
        ['power', 'Strom'],
      ])}${select('mode', 'Zielversorgung', [
        ['local', 'Lokal'],
        ['central', 'Zentral'],
        ['hybrid', 'Zentral mit lokaler Reserve'],
        ['ups', 'Lokaler Strom mit zentraler USV'],
      ])}</div>${numeric('ceiling', 'Preisfreigabe für diese Maßnahme', 1000)}${button('queue', 'Maßnahme einplanen')}</div><ol class="operations-queue">${o.queue.map((item) => `<li><strong>${ctx.tr(planNames[item.action])}</strong> · ${ctx.fmt(item.ceiling)} CR <p>${ctx.esc(ctx.tr(item.reason || 'Wartet auf Ausführung.'))}</p>${button('cancel', 'Entfernen', `data-id="${item.id}"`)}</li>`).join('') || '<li>Keine Maßnahmen eingeplant.</li>'}</ol></div></section>` +
      `<section class="panel section-spacer" data-ops-form="project">${ctx.panelHeader('Agentenprojekte')}<div class="panel-body"><p>Während eines Projekts entfallen der normale Beitrag und die Teamleitung dieses Agenten. Die zugesagte Belohnung bleibt bis zum Abschluss fest.</p><div class="business-controls">${select(
        'id',
        'Agent',
        ctx.state.agents.map((a) => [a.id, a.name]),
      )}${select('kind', 'Projekt', [
        ['audit', 'Betriebsaudit'],
        ['research', 'Forschungsprojekt'],
        ['tuning', 'Kapazitätsanalyse'],
      ])}${button('project', 'Projekt prüfen')}</div><div data-ops-projects></div></div></section>`
    );
  }
  function read(form, key) {
    return form.querySelector(`[data-ops-field="${key}"]`)?.value;
  }
  function operationsClick(target) {
    if (target.hasAttribute('data-ops-confirm')) {
      const extra = ctx.modal?.extra;
      if (ctx.modal?.type !== 'operations-confirm' || !extra) return true;
      ctx.closeModal();
      ctx.execute(extra.action, extra.payload);
      return true;
    }
    const command = target.dataset.ops;
    if (!command) return false;
    const form = target.closest('[data-ops-form]');
    if (command === 'policy') {
      const p = {};
      for (const key of ['repair', 'backup', 'parts', 'plan', 'reserve', 'savings', 'partsTarget'])
        p[key] = Number(read(form, key));
      p.autoParts = form.querySelector('[data-ops-field="autoParts"]').checked;
      ctx.execute('setOperationsPolicy', p);
    }
    if (command === 'pause')
      ctx.execute('pauseOperations', { value: target.dataset.value === 'true' });
    if (command === 'cancel') ctx.execute('cancelPlannedOperation', { id: target.dataset.id });
    if (command === 'delivery')
      ctx.openModal('operations-confirm', {
        action: 'orderParts',
        payload: { quantity: Number(read(form, 'quantity')), method: read(form, 'method') },
      });
    if (command === 'project')
      ctx.openModal('operations-confirm', {
        action: 'startProject',
        payload: { id: read(form, 'id'), kind: read(form, 'kind') },
      });
    if (command === 'queue') {
      const action = read(form, 'action'),
        payload = {};
      if (action === 'upgradeRack') {
        payload.rackId = read(form, 'rackId');
        payload.component = read(form, 'component');
      }
      if (action === 'upgradeCentral') payload.system = read(form, 'system');
      if (action === 'convertRoomSupply') {
        payload.roomId = read(form, 'roomId');
        payload.system = read(form, 'supplySystem');
        payload.mode = read(form, 'mode');
      }
      ctx.openModal('operations-confirm', {
        action: 'queueOperation',
        payload: { action, payload, ceiling: Number(read(form, 'ceiling')) },
      });
    }
    return true;
  }
  function operationsChange(el) {
    if (!el.matches('[data-ops-field="action"]')) return false;
    for (const section of el.closest('[data-ops-form]').querySelectorAll('[data-plan-for]'))
      section.hidden = section.dataset.planFor !== el.value;
    return true;
  }
  function operationsConfirm(extra) {
    let q;
    if (extra.action === 'orderParts') q = ctx.E.quoteDelivery(ctx.state, extra.payload);
    else if (extra.action === 'startProject') q = ctx.E.quoteProject(ctx.state, extra.payload);
    else {
      const p = extra.payload;
      q =
        p.action === 'createBackup'
          ? ctx.E.getResilience(ctx.state).backup
          : p.action === 'convertRoomSupply'
            ? ctx.E.quoteSupply(ctx.state, p.payload)
            : ctx.E.quoteHardware(ctx.state, p.action, p.payload);
    }
    const planned = extra.action === 'queueOperation';
    return `<p class="modal-intro">${ctx.esc(ctx.tr(q.label || 'Maßnahme prüfen'))}</p><div class="status-row"><span>Kosten jetzt</span><strong>${ctx.fmt(q.cost || 0)} CR</strong></div><div class="status-row"><span>Dauer</span><strong>${ctx.duration(q.duration || 0)}</strong></div>${q.research !== undefined ? `<p>${ctx.fmt(q.research)} FP · ${ctx.fmt(q.reputation)} ${ctx.tr('Ansehen')}</p><p>Regulärer Beitrag und Teamleitung pausieren während dieses Projekts.</p>` : ''}${planned ? '<p>Die Aufnahme in den Plan kostet nichts. Bei Ausführung werden Preis, Voraussetzungen, Stundenbudget und Reserven erneut geprüft. Ausbauten und Umbauten unterbrechen den betroffenen Bereich.</p>' : ''}${q.reason ? `<p class="modal-alert">${ctx.esc(ctx.tr(q.reason))}</p>` : ''}<button class="button primary block" data-ops-confirm ${!planned && !q.enabled ? 'disabled' : ''}>${ctx.tr('Bestätigen')}</button>`;
  }
  function operationsSignature() {
    if (ctx.view !== 'operations') return '';
    const o = ctx.state.operations;
    return JSON.stringify([
      o.limits,
      o.autoParts,
      o.partsTarget,
      o.paused,
      o.queue,
      o.orders.map((x) => x.arrivalAt),
      o.projects.map((x) => x.agentId),
    ]);
  }
  function updateOperations() {
    if (ctx.view !== 'operations') return;
    const o = ctx.E.getOperations(ctx.state),
      put = (key, value) =>
        ctx.$$('.view-content [data-ops-' + key + ']').forEach((el) => (el.textContent = value));
    put(
      'spent',
      `${ctx.tr('Verbraucht')}: ${ctx.fmt(o.repairSpent)} / ${ctx.fmt(o.backupSpent)} / ${ctx.fmt(o.partsSpent)} / ${ctx.fmt(o.planSpent)} CR`,
    );
    put(
      'stock',
      `${ctx.tr('Ersatzteile im Lager')}: ${ctx.fmt(ctx.state.resilience.parts)} / ${ctx.fmt(o.partsCapacity)}`,
    );
    put(
      'deliveries',
      o.orders
        .map((x) => `${x.quantity} · ${ctx.duration(Math.max(0, x.arrivalAt - ctx.state.time))}`)
        .join(' | '),
    );
    put(
      'projects',
      o.projects
        .map(
          (x) =>
            `${ctx.state.agents.find((a) => a.id === x.agentId)?.name}: ${ctx.tr({ audit: 'Betriebsaudit', research: 'Forschungsprojekt', tuning: 'Kapazitätsanalyse' }[x.kind])} · ${ctx.duration(x.remaining)}`,
        )
        .join(' | '),
    );
  }
  return {
    operationsView,
    operationsClick,
    operationsChange,
    operationsConfirm,
    operationsSignature,
    updateOperations,
  };
}
