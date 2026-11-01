/** Physical room operation belongs with buildings and utilities, separate from customer sales. */
export function createRoomOperationsUI(ctx) {
  let selectedRoom = null;
  const modes = {
    local: 'Lokal',
    central: 'Zentral',
    hybrid: 'Zentral mit lokaler Reserve',
    ups: 'Lokaler Strom mit zentraler USV',
  };
  const field = (key, label, values, selected) =>
    `<label class="field-label">${label}<select class="select" data-field="${key}">${values.map(([value, text]) => `<option value="${value}" ${String(value) === String(selected) ? 'selected' : ''}>${ctx.esc(ctx.tr(text))}</option>`).join('')}</select></label>`;
  function conversionStatus(room) {
    const p = room.conversion;
    return !p
      ? ctx.tr('Versorgung aktiv')
      : `${ctx.tr('Umbau aktiv')}: ${ctx.tr(p.system === 'cooling' ? 'Kühlung' : 'Strom')} → ${ctx.tr(modes[p.mode])} · ${ctx.duration(p.remaining)}`;
  }
  function roomOperationsView() {
    const model = ctx.E.getBusinessModel(ctx.state);
    if (!model.rooms.some((r) => r.roomId === selectedRoom)) selectedRoom = model.rooms[0].roomId;
    const room = model.rooms.find((r) => r.roomId === selectedRoom);
    const rooms = ctx.E.getFacilityLayout(ctx.state).rooms;
    return `<section class="panel section-spacer room-operating-plan" data-business-room="${room.roomId}">${ctx.panelHeader('Raumbetrieb & Versorgung')}<div class="panel-body business-panel-body"><label class="field-label">Serverraum<select class="select" data-room-operation-select>${rooms.map((r) => `<option value="${r.id}" ${r.id === selectedRoom ? 'selected' : ''}>${ctx.tr(`Untergeschoss ${r.floor}`)} · ${ctx.tr(`Raum ${r.number}`)}</option>`).join('')}</select></label><h3>Kapazitätsprofil & Reserven</h3><div class="business-controls">${field('profile', 'Spezialisierung', Object.entries(model.profiles), room.profile)}${field(
      'reserve',
      'Reserve für Ausfälle und Projekte',
      [
        [0, '0 %'],
        [0.2, '20 %'],
        [0.35, '35 %'],
      ],
      room.reserve,
    )}<button class="button" data-service="configureServiceRoom">Umstellung prüfen</button></div><p class="policy-explainer">Passende Spezialisierung spart 10 % Ressourcen. Eine Umstellung halbiert die Versorgung zwei Minuten lang. Reserve begrenzt neue Zusagen; sie erzeugt keine zusätzliche Hardware.</p><p data-room-change></p><h3>Team & Betreuungskapazität</h3><div class="business-controls">${field('manager', 'Teamleitung', [['', 'Keine Teamleitung'], ...ctx.state.agents.map((a) => [a.id, a.name])], room.managerId || '')}<button class="button" data-service="assignManager">Teamleitung zuweisen</button><button class="button" data-service="hireCrew">Team erweitern</button></div><p><span>Teams</span>: ${ctx.fmt(room.crew)} · <span>Kundenplätze</span>: ${ctx.fmt(room.crewCapacity)}</p><p class="policy-explainer">Ein Team betreut 24 Einheiten. Eine Teamleitung kann jeweils nur einen Raum leiten. Ihr Bonus pausiert während Einsätzen und Selbstwartung. Teams und Agenten verursachen laufende Kosten.</p><h3>Technische Raumversorgung</h3><p>${ctx.tr('Kühlung')}: <strong>${ctx.tr(modes[room.supply.cooling])}</strong> · ${ctx.tr('Strom')}: <strong>${ctx.tr(modes[room.supply.power])}</strong></p><div class="business-controls">${field(
      'system',
      'System',
      [
        ['cooling', 'Kühlung'],
        ['power', 'Strom'],
      ],
      'cooling',
    )}${field(
      'mode',
      'Zielversorgung',
      Object.entries(modes).filter(([key]) => key !== 'ups'),
      room.supply.cooling,
    )}<button class="button" data-service="convertRoomSupply">Umbau prüfen</button></div><p class="policy-explainer">Zentralbetrieb ersetzt lokale Versorgung. Lokale Reserve bleibt bei Hybridversorgung erhalten. Zentrale Kapazität wird nur unter angeschlossenen Racks geteilt; die USV schützt nur angeschlossene Stromkreise.</p><p data-room-conversion>${ctx.esc(conversionStatus(room))}</p></div></section>`;
  }
  function roomOperationsChange(el) {
    if (el.hasAttribute('data-room-operation-select')) {
      selectedRoom = el.value;
      ctx.render();
      return true;
    }
    if (!el.matches('[data-field="system"]')) return false;
    const mode = el.closest('[data-business-room]').querySelector('[data-field="mode"]');
    const value = mode.value;
    mode.innerHTML = Object.entries(modes)
      .filter(([key]) => el.value === 'power' || key !== 'ups')
      .map(([key, label]) => `<option value="${key}">${ctx.tr(label)}</option>`)
      .join('');
    mode.value = value === 'ups' && el.value !== 'power' ? 'local' : value;
    return true;
  }
  function updateRoomOperations() {
    if (ctx.view !== 'facility') return;
    const room = ctx.E.getBusinessModel(ctx.state).rooms.find((r) => r.roomId === selectedRoom);
    if (!room) return;
    const change = ctx.$('[data-room-change]'),
      conversion = ctx.$('[data-room-conversion]');
    if (change) change.textContent = room.changeRemaining ? ctx.duration(room.changeRemaining) : '';
    if (conversion) conversion.textContent = conversionStatus(room);
  }
  return { roomOperationsView, roomOperationsChange, updateRoomOperations };
}
