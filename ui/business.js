import { createCustomerCards } from './customer-cards.js';
import { createCustomerControls } from './customer-controls.js';

/** Customer sales, contracts and service quality. Room engineering lives in Facility. */
export function createBusinessUI(ctx) {
  let selectedRoom = null;
  function selectCustomerRoom(id) {
    if (!ctx.state.business.rooms.some((r) => r.roomId === id)) return false;
    selectedRoom = id;
    return true;
  }
  const cards = createCustomerCards(ctx),
    controls = createCustomerControls(ctx);
  function businessView() {
    const model = ctx.E.getBusinessModel(ctx.state);
    if (!model.rooms.some((r) => r.roomId === selectedRoom)) selectedRoom = model.rooms[0].roomId;
    const book = ctx.E.getCustomers(ctx.state, { roomId: selectedRoom });
    const room = model.rooms.find((r) => r.roomId === selectedRoom),
      layout = ctx.E.getFacilityLayout(ctx.state);
    const contracts = book.contracts.filter((c) => c.roomId === selectedRoom);
    return (
      ctx.head(
        'Kunden & Verträge',
        'Kunden fragen Dienste an. Dein Team richtet sie ein und betreut verbindliche Verträge.',
      ) +
      `<div class="business-layout"><section class="panel business-summary">${ctx.panelHeader('Geschäftsbilanz', '<span class="tag green">LIVE</span>')}<div class="stats-strip"><div><span>Aktive Verträge</span><strong data-customer-stat="active">${book.active}</strong></div><div><span>Kundenumsatz / min</span><strong data-business-stat="gross"></strong></div><div><span>Alle Kosten / min</span><strong data-business-stat="cost"></strong></div><div><span>Netto / min</span><strong data-business-stat="net"></strong></div></div></section>
      <div class="business-room-selector"><label class="field-label">Vertragsstandort<select class="select" data-business-select>${layout.rooms.map((r) => `<option value="${r.id}" ${r.id === selectedRoom ? 'selected' : ''}>${ctx.tr(`Untergeschoss ${r.floor}`)} · ${ctx.tr(`Raum ${r.number}`)}</option>`).join('')}</select></label><button class="button small" data-nav="facility">Raumbetrieb & Versorgung</button><button class="button small" data-nav="automation">Kundenautomatik</button></div>
      <section class="panel">${ctx.panelHeader('Ressourcen am Vertragsstandort')}<div class="business-resources panel-body">${Object.entries(
        {
          cpu: 'CPU',
          ram: 'RAM / GB',
          storage: 'Speicher / TB',
          network: 'Netz / Mbit/s',
          gpu: 'GPU',
          vram: 'VRAM / GB',
        },
      )
        .map(
          ([key, label]) =>
            `<div><span>${ctx.tr(label)}</span><strong data-room-resource="${key}">${ctx.dec(room.reserved[key])} / ${ctx.dec(room.available[key])}</strong><small>Reserviert / verfügbar</small></div>`,
        )
        .join('')}</div></section>
      <div class="section-heading"><h2>Anfrageeingang</h2><p><span data-customer-stat="leads">${book.leads.length}</span> / 12</p></div><p class="policy-explainer">Anfragen sind noch keine Zusagen. Prüfe Raum, Reserve und Kosten; eine Ablehnung kostet keine Reputation. Neue Anfragen kommen automatisch. Unbeantwortete Anfragen laufen nach vier Stunden aus.</p>
      <div class="card-grid customer-leads">${book.leads.map((lead) => cards.leadCard(lead, selectedRoom, model)).join('') || ctx.empty('Neue Kundenanfragen sind unterwegs', 'Dein Anfrageeingang füllt sich automatisch, während dein Betrieb weiterläuft.', '', '', 'inbox')}</div>
      <div class="section-heading"><h2>Verträge an diesem Standort</h2><p>${contracts.length} / 16</p></div><div class="customer-contracts">${contracts.map((c) => cards.contractCard(c, model)).join('') || ctx.empty('Noch keine Kunden an diesem Standort', 'Nimm eine passende Kundenanfrage an. Die Einrichtung benötigt einen verfügbaren Agenten.', '', '', 'jobs')}</div>
      <section class="panel">${ctx.panelHeader('Vertragsstandards für neue Zusagen')}<div class="panel-body business-service-grid">${room.groups.map((g) => `<div data-business-room="${room.roomId}" data-service-kind="${g.kind}"><strong>${ctx.tr(model.services[g.kind].name)}</strong><p>${ctx.dec(model.services[g.kind].fee * 60)} CR / min · ${ctx.tr('Basisumsatz je Diensteinheit')}</p><button class="button small" data-service="setServicePremium" data-value="${!g.nextPremium}">${ctx.tr(g.nextPremium ? 'Premium bei Verlängerung: an' : 'Premium bei Verlängerung: aus')}</button></div>`).join('')}</div></section>
      <div class="helper-card"><h3>Verträge sind Zusagen.</h3><p>Einrichtung reserviert Hardware und bindet einen Agenten. Umsatz beginnt nach der Einrichtung und hängt von der tatsächlichen Versorgung ab. Kurze Störungen sind reparierbar; anhaltende Defizite führen zu Beschwerden und Kündigungsfristen. Auch gesunde Kunden können zum Vertragsende aus geschäftlichen Gründen wechseln. Automatische Verlängerung garantiert keine ewige Bindung.</p></div>
      ${
        book.history.length
          ? `<section class="panel">${ctx.panelHeader('Beendete Kundenverträge')}<div class="activity-list">${book.history
              .slice(0, 6)
              .map(
                (h) =>
                  `<div class="activity-row"><span class="activity-time">${ctx.clock(h.time)}</span><span>${ctx.esc(h.client)} · ${ctx.tr({ sla: 'Versorgungsprobleme', budget: 'Kundenbudget', consolidation: 'Zusammenlegung', competitor: 'Anbieterwechsel', term: 'Vertragsende' }[h.reason])}</span></div>`,
              )
              .join('')}</div></section>`
          : ''
      }</div>`
    );
  }
  function businessClick(target) {
    if (target.hasAttribute('data-service-confirm')) {
      const extra = ctx.modal?.extra;
      if (ctx.modal?.type !== 'business-confirm' || !extra) return true;
      ctx.closeModal();
      ctx.execute(extra.action, extra.payload);
      return true;
    }
    if (controls.customerClick(target)) return true;
    const action = target.dataset.service;
    if (!action) return false;
    const card = target.closest('[data-business-room]'),
      read = (key) => card.querySelector(`[data-field="${key}"]`)?.value;
    const payload = { roomId: card.dataset.businessRoom, kind: card.dataset.serviceKind };
    if (action === 'convertRoomSupply') {
      payload.system = read('system');
      payload.mode = read('mode');
    }
    if (action === 'configureServiceRoom') {
      payload.profile = read('profile');
      payload.reserve = Number(read('reserve'));
    }
    if (action === 'assignManager') payload.id = read('manager') || null;
    if (action.startsWith('setService')) payload.value = target.dataset.value === 'true';
    ctx.openModal('business-confirm', { action, payload });
    return true;
  }
  function businessConfirm(extra) {
    if (extra.action.includes('Customer')) return controls.customerConfirm(extra);
    const q =
      extra.action === 'convertRoomSupply'
        ? ctx.E.quoteSupply(ctx.state, extra.payload)
        : ctx.E.quoteService(ctx.state, extra.action, extra.payload);
    return `<p class="modal-intro">${ctx.esc(ctx.tr(q.label || 'Betriebsplan ändern'))}</p><div class="status-row"><span>Kosten</span><strong>${ctx.fmt(q.cost)} CR</strong></div><div class="status-row"><span>Dauer</span><strong>${ctx.duration(q.duration || 0)}</strong></div><p>${extra.action === 'convertRoomSupply' ? 'Dieser Raum ist beim Umbau drei Minuten offline. Zentrale Versorgung betrifft nur angeschlossene Räume; lokale Reserve kann weiterhin Leistung liefern.' : 'Raumprofile, Reserve und Teams beeinflussen die zugesagte Kundenversorgung. Teams verursachen laufende Kosten; bestehende Premiumzusagen bleiben bis zur Verlängerung bindend.'}</p>${q.reason ? `<div class="modal-alert">${ctx.esc(ctx.tr(q.reason))}</div>` : ''}<button class="button primary block" data-service-confirm ${q.enabled ? '' : 'disabled'}>Bestätigen</button>`;
  }
  function businessChange(el) {
    if (ctx.roomOperationsChange?.(el)) return true;
    if (!el.hasAttribute('data-business-select')) return false;
    selectedRoom = el.value;
    ctx.render();
    return true;
  }
  function businessSignature() {
    if (!['business', 'facility', 'overview', 'agents', 'operations'].includes(ctx.view)) return '';
    return JSON.stringify([
      ctx.state.business.rooms.map((r) => [
        r.roomId,
        r.profile,
        r.reserve,
        r.crew,
        r.managerId,
        r.changeRemaining > 0,
        r.supply,
        r.conversion?.system,
        r.groups.map((g) => [g.kind, g.units, g.pending, g.renew, g.nextPremium]),
      ]),
      ctx.state.customers.leads.map((l) => l.id),
      ctx.state.customers.contracts.map((c) => [
        c.id,
        c.stage,
        c.work,
        c.agentId,
        c.issue,
        c.notice > 0,
        c.renew,
        c.retentionUsed,
      ]),
      ctx.state.customers.history[0]?.id,
      ctx.state.jobs.map((j) => j.id),
    ]);
  }
  function updateBusiness(metrics = null) {
    if (!['overview', 'business', 'automation'].includes(ctx.view)) return;
    const m = metrics || ctx.E.getMetrics(ctx.state),
      model = ctx.E.getBusinessModel(ctx.state, m),
      book = ctx.E.getCustomers(ctx.state, {
        roomId: selectedRoom,
        summaryOnly: ctx.view !== 'business',
      });
    const room = model.rooms.find((r) => r.roomId === selectedRoom);
    const values = {
      gross: ctx.dec(model.gross * 60) + ' CR',
      cost: ctx.dec(m.upkeep * 60) + ' CR',
      net: ctx.dec(m.incomePerSecond * 60) + ' CR',
      allowance: ctx.dec(m.recoveryAllowance * 60) + ' CR',
    };
    ctx.$$('[data-business-stat]').forEach((el) => {
      el.textContent = values[el.dataset.businessStat];
      if (el.dataset.businessStat === 'net') el.classList.toggle('negative', m.incomePerSecond < 0);
    });
    ctx.$$('[data-customer-stat]').forEach((el) => {
      const key = el.dataset.customerStat;
      el.textContent = ctx.fmt(key === 'leads' ? book.leads.length : book[key] || 0);
    });
    if (room)
      ctx.$$('[data-room-resource]').forEach((el) => {
        const key = el.dataset.roomResource;
        el.textContent = ctx.dec(room.reserved[key]) + ' / ' + ctx.dec(room.available[key]);
      });
    const spent = ctx.$('[data-customer-spent]');
    if (spent) spent.textContent = ctx.fmt(book.spent) + ' CR';
    if (ctx.view !== 'business') return;
    for (const c of book.contracts.filter((c) => c.roomId === selectedRoom)) {
      const supplied =
        model.rooms.find((r) => r.roomId === c.roomId)?.groups.find((g) => g.kind === c.kind)
          ?.supplied || 0;
      const write = (key, value) => {
        const el = ctx.$(`[data-customer-${key}="${c.id}"]`);
        if (el) el.textContent = value;
      };
      write('time', ctx.duration(c.stage === 'setup' ? c.term : c.remaining));
      write('notice', ctx.duration(c.notice));
      write('satisfaction', ctx.dec(c.satisfaction) + ' %');
      write(
        'supply',
        c.stage === 'setup' ? ctx.tr('Noch nicht eingerichtet') : ctx.dec(supplied * 100) + ' %',
      );
      const agent = ctx.state.agents.find((a) => a.id === c.agentId);
      write(
        'work',
        (agent ? agent.name : ctx.tr('Wartet auf Agent')) + ' · ' + ctx.duration(c.workRemaining),
      );
      const progress = ctx.$(`[data-customer-progress="${c.id}"]`);
      if (progress)
        progress.style.width = (c.workTotal ? 100 * (1 - c.workRemaining / c.workTotal) : 0) + '%';
    }
    ctx.$$('[data-customer-ready]').forEach((card) => {
      if (card.dataset.customerReady !== 'true') return;
      const affordable = ctx.state.credits >= Number(card.dataset.customerCost);
      card.querySelector('[data-customer="acceptCustomerLead"]').disabled = !affordable;
      card.querySelector('[data-customer-reason]').textContent = affordable
        ? ''
        : ctx.tr('Das verfügbare Budget reicht nicht aus.');
    });
  }
  return {
    ...controls,
    selectCustomerRoom,
    businessView,
    businessClick,
    businessChange,
    businessConfirm,
    businessSignature,
    updateBusiness,
  };
}
