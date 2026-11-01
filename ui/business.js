/** Customer portfolio UI. One selected room keeps even large facilities manageable. */
export function createBusinessUI(ctx) {
  let selectedRoom = null;
  function managerLabel(a) {
    const op = ctx.agentOperations().agents.find((x) => x.id === a.id);
    const status = op?.absent ? 'Selbstwartung' : op?.assignment ? 'Im Einsatz' : '';
    return ctx.esc(a.name) + (status ? ' · ' + ctx.esc(ctx.tr(status)) : '');
  }
  const resourceNames = {
    cpu: 'CPU',
    ram: 'RAM / GB',
    storage: 'Speicher / TB',
    network: 'Netz / Mbit/s',
    gpu: 'GPU',
    vram: 'VRAM / GB',
  };
  const button = (action, label, extra = '') =>
    `<button class="button" data-service="${action}" ${extra}>${label}</button>`;
  const field = (name, label, content) =>
    `<label class="field-label">${label}${content.replace('<select', '<select data-field="' + name + '"').replace('<input', '<input data-field="' + name + '"')}</label>`;
  function businessView() {
    const model = ctx.E.getBusinessModel(ctx.state),
      m = ctx.E.getMetrics(ctx.state),
      roomNames = new Map(
        ctx.E.getFacilityLayout(ctx.state).rooms.map((r) => [
          r.id,
          `${ctx.tr(`Untergeschoss ${r.floor}`)} · ${ctx.tr(`Raum ${r.number}`)}`,
        ]),
      );
    if (!model.rooms.some((r) => r.roomId === selectedRoom)) selectedRoom = model.rooms[0].roomId;
    const room = model.rooms.find((r) => r.roomId === selectedRoom);
    return (
      ctx.head(
        'Kunden & Betrieb',
        'Plane Auslastung, Reserven und Teams. Nur erbrachte Dienste erzielen Umsatz.',
      ) +
      `<div class="business-layout"><section class="panel business-summary">${ctx.panelHeader('Betriebsbilanz', `<span class="tag business-supply-status"><span>Versorgung</span><strong data-business-stat="supply">${ctx.dec(model.totalUnits ? (100 * model.delivered) / model.totalUnits : 100)} %</strong></span>`)}<div class="stats-strip"><div><span>Kundenumsatz / min</span><strong data-business-stat="gross">${ctx.dec(model.gross * 60)} CR</strong></div><div><span>Starthilfe / min</span><strong data-business-stat="allowance">${ctx.dec(m.recoveryAllowance * 60)} CR</strong></div><div><span>Alle Kosten / min</span><strong data-business-stat="cost">${ctx.dec(m.upkeep * 60)} CR</strong></div><div><span>Netto / min</span><strong data-business-stat="net" class="${m.incomePerSecond < 0 ? 'negative' : ''}">${ctx.dec(m.incomePerSecond * 60)} CR</strong></div></div></section>` +
      (model.transitionRemaining
        ? `<div class="helper-card"><h3>Bestand übernommen</h3><p>Deine bisherigen Kunden wurden auf die vorhandene Hardware verteilt. Geld und laufende Aufträge bleiben erhalten. Premium-Ausgleich ist für die ersten zwölf Betriebsstunden ausgesetzt.</p></div>`
        : '') +
      `<section class="panel business-room" data-business-room="${room.roomId}">${ctx.panelHeader('Raumplanung')}<div class="panel-body business-panel-body"><label class="field-label">Serverraum<select class="select" data-business-select>${model.rooms.map((r) => `<option value="${r.roomId}" ${r.roomId === room.roomId ? 'selected' : ''}>${ctx.esc(roomNames.get(r.roomId) || r.roomId)} · ${ctx.tr(model.profiles[r.profile])} · ${ctx.fmt(r.units)}</option>`).join('')}</select></label><div class="business-resources">${Object.entries(
        resourceNames,
      )
        .map(
          ([key, name]) =>
            `<div><span>${name}</span><strong data-room-resource="${key}">${ctx.dec(room.demand[key])} / ${ctx.dec(room.available[key])}</strong><small>Belegt / verfügbar</small></div>`,
        )
        .join('')}</div><div class="business-controls">${field(
        'profile',
        'Spezialisierung',
        `<select class="select">${Object.entries(model.profiles)
          .map(
            ([k, name]) =>
              `<option value="${k}" ${room.profile === k ? 'selected' : ''}>${ctx.tr(name)}</option>`,
          )
          .join('')}</select>`,
      )}${field('reserve', 'Reserve für Ausfälle und Projekte', `<select class="select">${[0, 0.2, 0.35].map((v) => `<option value="${v}" ${room.reserve === v ? 'selected' : ''}>${v * 100} %</option>`).join('')}</select>`)}${button('configureServiceRoom', 'Umstellung prüfen')}</div><p class="policy-explainer">Passende Spezialisierung spart 10 % Ressourcen. Eine Umstellung halbiert die Versorgung zwei Minuten lang. Reserve begrenzt neue Zusagen; sie erzeugt keine zusätzliche Hardware.</p><p data-room-change>${room.changeRemaining ? ctx.duration(room.changeRemaining) : ''}</p><div class="business-controls">${field('manager', 'Teamleitung', `<select class="select"><option value="">Keine Teamleitung</option>${ctx.state.agents.map((a) => `<option value="${a.id}" ${room.managerId === a.id ? 'selected' : ''}>${managerLabel(a)}</option>`).join('')}</select>`)}${button('assignManager', 'Teamleitung zuweisen')}${button('hireCrew', 'Team erweitern')}</div><p>Teams: <strong>${ctx.fmt(room.crew)}</strong> · Kundenplätze: <strong>${ctx.fmt(room.crewCapacity)}</strong></p><p class="policy-explainer">Ein Team betreut 24 Einheiten. Erfahrene Teamleitungen erhöhen die Betreuung; sie können jeweils nur einen Raum leiten. Personal verursacht laufende Kosten. Während eines Einsatzes oder einer Selbstwartung pausiert der Teamleitungsbonus.</p></div></section>` +
      supplyCard(room) +
      `<div class="card-grid business-service-grid">${room.groups.map((g) => serviceCard(room, g, model.services[g.kind])).join('')}</div>` +
      `<div class="helper-card"><h3>Verträge sind Zusagen.</h3><p>Neue Kunden benötigen zehn Minuten Vorbereitung und einmalige Einrichtungskosten. Verträge laufen drei Tage und verlängern sich auf Wunsch. Bei Engpässen sinkt der Umsatz. Premium bringt 15 % mehr, verlangt Reserve und reduziert bei Ausfällen die Zahlung zusätzlich. Forschung und Projektarbeit nutzen die verbleibende Leistung.</p><button class="button" data-nav="jobs">Zusätzliche Projekte ansehen</button></div></div>`
    );
  }
  function supplyCard(room) {
    const modes = {
      local: 'Lokal',
      central: 'Zentral',
      hybrid: 'Zentral mit lokaler Reserve',
      ups: 'Lokaler Strom mit zentraler USV',
    };
    return `<section class="panel business-supply" data-business-room="${room.roomId}">${ctx.panelHeader('Raumversorgung')}<div class="panel-body business-panel-body"><p>${ctx.tr('Kühlung')}: <strong>${ctx.tr(modes[room.supply.cooling])}</strong> · ${ctx.tr('Strom')}: <strong>${ctx.tr(modes[room.supply.power])}</strong></p><p class="policy-explainer">Zentralbetrieb ersetzt lokale Versorgung. Die Variante mit lokaler Reserve hält die lokalen Geräte zusätzlich bereit. Zentrale Kapazität wird unter angeschlossenen Racks geteilt; die USV schützt nur angeschlossene Stromkreise. Ein USV-Anschluss ist auch bei lokalem Strom möglich.</p><div class="business-controls">${field('system', 'System', `<select class="select"><option value="cooling">${ctx.tr('Kühlung')}</option><option value="power">${ctx.tr('Strom')}</option></select>`)}${field(
      'mode',
      'Zielversorgung',
      `<select class="select">${Object.entries(modes)
        .map(
          ([k, v]) => `<option value="${k}" ${k === 'ups' ? 'disabled' : ''}>${ctx.tr(v)}</option>`,
        )
        .join('')}</select>`,
    )}${button('convertRoomSupply', 'Umbau prüfen')}</div><p data-room-conversion>${ctx.esc(conversionStatus(room))}</p><button class="button ghost" data-nav="facility">Zentralanlagen ausbauen</button></div></section>`;
  }
  function conversionStatus(room) {
    const p = room.conversion;
    if (!p) return ctx.tr('Versorgung aktiv');
    const modes = {
      local: 'Lokal',
      central: 'Zentral',
      hybrid: 'Zentral mit lokaler Reserve',
      ups: 'Lokaler Strom mit zentraler USV',
    };
    return `${ctx.tr('Umbau aktiv')}: ${ctx.tr(p.system === 'cooling' ? 'Kühlung' : 'Strom')} → ${ctx.tr(modes[p.mode])} · ${ctx.duration(p.remaining)}`;
  }
  function serviceCard(room, g, def) {
    const q = ctx.E.quoteService(ctx.state, 'contractService', {
      roomId: room.roomId,
      kind: g.kind,
      units: 1,
    });
    return `<section class="offer-card service-card" data-business-room="${room.roomId}" data-service-kind="${g.kind}"><span class="tag">${ctx.tr(def.name)}</span><h3>${ctx.fmt(g.units)} ${ctx.tr('Kundeneinheiten')}</h3><p data-service-status="${g.kind}">${g.pending ? ctx.fmt(g.pending) + ' · ' + ctx.duration(g.onboarding) : ctx.duration(g.remaining)}</p><p>${ctx.dec(def.fee * 60)} CR / min · ${ctx.tr('je vollständig versorgter Einheit')}</p><p>${Object.entries(
      def.needs,
    )
      .map(([k, v]) => `${ctx.dec(v)} ${ctx.tr(resourceNames[k])}`)
      .join(
        ' · ',
      )}</p><p>${ctx.tr('Zusätzlich möglich')}: <strong data-service-capacity="${g.kind}">${ctx.fmt(q.capacity || 0)}</strong></p><div class="business-controls">${field('units', 'Neue Einheiten', `<input class="input" type="number" min="1" max="1000000" step="1" value="1">`)}${button('contractService', 'Vertrag prüfen')}</div><div class="card-actions">${button('setServiceRenewal', g.renew ? 'Verlängerung: an' : 'Verlängerung: aus', `data-value="${!g.renew}"`)}${button('setServicePremium', g.nextPremium ? 'Premium bei Verlängerung: an' : 'Premium bei Verlängerung: aus', `data-value="${!g.nextPremium}"`)}</div></section>`;
  }
  function businessClick(target) {
    if (target.hasAttribute('data-service-confirm')) {
      const extra = ctx.modal?.extra;
      if (ctx.modal?.type !== 'business-confirm' || !extra) return true;
      ctx.closeModal();
      ctx.execute(extra.action, extra.payload);
      return true;
    }
    const action = target.dataset.service;
    if (!action) return false;
    const card = target.closest('[data-business-room]');
    const read = (key) => card.querySelector(`[data-field="${key}"]`)?.value;
    const payload = { roomId: card.dataset.businessRoom, kind: card.dataset.serviceKind };
    if (action === 'contractService') payload.units = Number(read('units'));
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
    const q =
      extra.action === 'convertRoomSupply'
        ? ctx.E.quoteSupply(ctx.state, extra.payload)
        : ctx.E.quoteService(ctx.state, extra.action, extra.payload);
    if (extra.action === 'convertRoomSupply')
      return `<p class="modal-intro">Raumversorgung umbauen</p><p>Dieser Raum ist beim Umbau drei Minuten offline. Ein Ausfall der Zentralanlage betrifft zentral angeschlossene Räume; lokale Reserve kann weiterhin Leistung liefern. Lokale Stromverteiler bleiben als Rack-Sicherung erforderlich.</p><div class="status-row"><span>Kosten</span><strong>${ctx.fmt(q.cost)} CR</strong></div><div class="status-row"><span>Zentralkapazität / angeschlossene Last nach Umbau</span><strong>${ctx.dec((q.centralCapacity || 0) / 1000)} / ${ctx.dec(((q.demand || 0) + (q.otherDemand || 0)) / 1000)} kW</strong></div>${q.reason ? `<div class="modal-alert">${ctx.esc(ctx.tr(q.reason))}</div>` : ''}<button class="button primary block" data-service-confirm ${q.enabled ? '' : 'disabled'}>Bestätigen</button>`;
    return `<p class="modal-intro">${ctx.esc(ctx.tr(q.label || 'Betriebsplan ändern'))}</p><div class="status-row"><span>Kosten</span><strong>${ctx.fmt(q.cost)} CR</strong></div><div class="status-row"><span>Dauer</span><strong>${ctx.duration(q.duration || 0)}</strong></div><p>Verträge binden Ressourcen für drei Tage. Premiumänderungen gelten bei der nächsten Verlängerung. Teams kosten laufend Geld. Profilwechsel unterbrechen einen Teil der Versorgung.</p>${q.reason ? `<div class="modal-alert">${ctx.esc(ctx.tr(q.reason))}</div>` : ''}<button class="button primary block" data-service-confirm ${q.enabled ? '' : 'disabled'}>Bestätigen</button>`;
  }
  function businessChange(el) {
    if (el.matches('[data-field="system"]')) {
      const mode = el.closest('[data-business-room]').querySelector('[data-field="mode"]');
      mode.querySelector('[value="ups"]').disabled = el.value !== 'power';
      if (el.value !== 'power' && mode.value === 'ups') mode.value = 'local';
      return true;
    }
    if (!el.hasAttribute('data-business-select')) return false;
    selectedRoom = el.value;
    ctx.render();
    return true;
  }
  function businessSignature() {
    return ctx.view === 'business'
      ? JSON.stringify(
          ctx.state.business.rooms.map((r) => [
            r.roomId,
            r.profile,
            r.reserve,
            r.crew,
            r.managerId,
            r.changeRemaining > 0,
            r.supply,
            r.conversion?.system,
            r.groups.map((g) => [g.kind, g.units, g.pending, g.renew, g.premium, g.nextPremium]),
          ]),
        )
      : '';
  }
  function updateBusiness() {
    if (ctx.view !== 'business') return;
    const model = ctx.E.getBusinessModel(ctx.state),
      m = ctx.E.getMetrics(ctx.state),
      room = model.rooms.find((r) => r.roomId === selectedRoom);
    if (!room) return;
    const values = {
      gross: ctx.dec(model.gross * 60) + ' CR',
      cost: ctx.dec(m.upkeep * 60) + ' CR',
      allowance: ctx.dec(m.recoveryAllowance * 60) + ' CR',
      net: ctx.dec(m.incomePerSecond * 60) + ' CR',
      supply: ctx.dec(model.totalUnits ? (100 * model.delivered) / model.totalUnits : 100) + ' %',
    };
    ctx.$$('[data-business-stat]').forEach((el) => {
      el.textContent = values[el.dataset.businessStat];
      if (el.dataset.businessStat === 'net') el.classList.toggle('negative', m.incomePerSecond < 0);
    });
    ctx.$$('[data-room-resource]').forEach((el) => {
      const key = el.dataset.roomResource;
      el.textContent = ctx.dec(room.demand[key]) + ' / ' + ctx.dec(room.available[key]);
    });
    for (const g of room.groups) {
      const cap = ctx.$(`[data-service-capacity="${g.kind}"]`);
      if (cap)
        cap.textContent = ctx.fmt(
          ctx.E.quoteService(ctx.state, 'contractService', {
            roomId: room.roomId,
            kind: g.kind,
            units: 1,
          }).capacity || 0,
        );
      const el = ctx.$(`[data-service-status="${g.kind}"]`);
      if (el)
        el.textContent = g.pending
          ? ctx.fmt(g.pending) + ' · ' + ctx.duration(g.onboarding)
          : ctx.duration(g.remaining);
    }
    const change = ctx.$('[data-room-change]');
    if (change) change.textContent = room.changeRemaining ? ctx.duration(room.changeRemaining) : '';
    const conversion = ctx.$('[data-room-conversion]');
    if (conversion) conversion.textContent = conversionStatus(room);
  }
  return {
    businessView,
    businessClick,
    businessChange,
    businessConfirm,
    businessSignature,
    updateBusiness,
  };
}
