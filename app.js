import { createRoom } from './room.js';
/* ROOT · Local network simulation · no external services */
(() => {
  'use strict';
  const E = window.RootEngine;
  const I18N=window.ROOTI18N;
  const tr=text=>I18N?.translate(String(text))||String(text);
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numberFormats=Object.fromEntries(['de','en'].map(lang=>[lang,[new Intl.NumberFormat(lang,{maximumFractionDigits:0}),new Intl.NumberFormat(lang,{minimumFractionDigits:1,maximumFractionDigits:1})]]));
  const fmt = n => Number.isFinite(n) ? numberFormats[I18N?.getLanguage()||'de'][0].format(n) : '—';
  const dec = n => Number.isFinite(n) ? numberFormats[I18N?.getLanguage()||'de'][1].format(n) : '—';
  const compact = n => n >= 1e9 ? dec(n / 1e9) + (I18N?.getLanguage()==='en'?' B':' Mrd.') : n >= 1e6 ? dec(n / 1e6) + (I18N?.getLanguage()==='en'?' M':' Mio.') : fmt(n);
  const duration = seconds => { const s = Math.max(0, Math.ceil(seconds)); return s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min` : s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`; };
  const clock = seconds => { const n = Math.floor(seconds); return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(x => String(x).padStart(2, '0')).join(':'); };
  const iconPaths = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    server:'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.1M7 17.5h.1M12 6.5h5M12 17.5h5"/>',
    cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
    agents:'<path d="M8 5V3m8 2V3"/><rect x="3" y="5" width="18" height="15" rx="4"/><path d="M8 10h.1M16 10h.1M8 15h8M1 11h2m18 0h2"/>',
    jobs:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 6V3h8v3M3 12h18M10 12v3h4v-3"/>',
    research:'<path d="M9 3h6m-5 0v6l-6 10q-1 2 2 2h12q3 0 2-2L14 9V3M7 15h10"/><path d="M10 18h.1M14 12h.1"/>',
    automation:'<path d="M13 2 4 14h7l-1 8 10-13h-7z"/>',
    log:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.3 8.5a3 3 0 0 1 5.4 1.2c0 2-2.7 2-2.7 4M12 17h.1"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    cross:'<path d="m6 6 12 12M6 18 18 6"/>',
    coins:'<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5h-3a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-3M12 6v2m0 8v2"/>',
    pulse:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/>',
    globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    inbox:'<path d="m6 4-4 10v6h20v-6L18 4zM2 14h6l2 3h4l2-3h6"/>',
    layers:'<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    storage:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    bell:'<path d="M5 17v-7a7 7 0 0 1 14 0v7l2 2H3zM9 22h6"/>',
    expand:'<path d="M14 3h7v7m0-7-8 8M3 14v7h7m-7 0 8-8"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    refresh:'<path d="M20 7V2l-3 3a8 8 0 1 0 3 12M20 7h-5"/>',
    trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H3v3q0 5 5 5m8-8h5v3q0 5-5 5M12 14v7m-5 0h10"/>',
    spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
    timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6m-3 0v3m6 2 2-2"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',
    leaf:'<path d="M20 3q2 13-6 16C4 22 0 9 9 6q5-1 11-3ZM5 21l10-10"/>',
    heat:'<path d="M10 4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0zM12 9v8"/>'
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.grid}</svg>`;
  const navs = [['overview','grid','Übersicht'],['network','server','Rechenzentrum'],['agents','agents','Agenten'],['jobs','jobs','Aufträge'],['research','research','Forschung'],['automation','automation','Automatisierung'],['resilience','shield','Betrieb & Schutz'],['inbox','inbox','Entscheidungen'],['log','log','Aktivitätslog']];
  const focusNames = {income:'Auftragsarbeit',research:'Forschung',maintenance:'Netzwerkpflege'};
  const modeNames = {balanced:'Ausgewogen',performance:'Leistung',eco:'Öko'};
  const kindNames = {monitoring:'Monitoring',migration:'Migration',audit:'Audit',optimization:'Optimierung',recovery:'Wiederherstellung',research:'Forschung',ai:'KI-Workload'};
  const kindIcons = {monitoring:'pulse',migration:'layers',audit:'shield',optimization:'automation',recovery:'storage',research:'research',ai:'cpu'};
  const roleClass = role => role === 'analyst' ? 'blue' : role === 'engineer' ? 'amber' : '';
  const STORAGE = 'root.network.save.v1';
  let state, view = 'overview', modal = null, lastFocus = null, lastTick = Date.now(), lastSave = 0, toastTimer;
  let saveBusy = false, savePending = null, saveDrainPromise = null, saveMode = 'ready', saveError = '', diskAvailable = true, initialized = false, importing = null, logFilter = 'all', hideGuide = false;
  let remoteRevision=null,saveConflict=false;
  let signature = '', renderPending = false, lastChartTime = -1;
  const pendingAchievements = () => E.catalog.achievements.filter(a=>!state.achievements[a.id]&&(state.achievementUnlocks?.[a.id]||a.check(state)));
  const R = window.RootRacks.create({E,icon,esc,fmt,dec,duration,getState:()=>state});
  const Room = createRoom({E,esc,fmt,dec,getState:()=>state,
    openRack:id=>{R.select(id);navigate('network');},
    openServer:(rackId,id)=>{R.select(rackId,id);navigate('network');},
    openProtection:()=>navigate('resilience'),
    openView:id=>navigate(id),
    onExit:()=>{view='overview';requestAnimationFrame(()=>render());}
  });
  let seenAchievements=new Set();
  function announceAchievements(){const fresh=pendingAchievements().filter(a=>!seenAchievements.has(a.id));pendingAchievements().forEach(a=>seenAchievements.add(a.id));if(fresh.length)toast(fresh.length===1?'Erfolg freigeschaltet: '+fresh[0].name:fresh.length+' Erfolge freigeschaltet. Belohnungen warten in der Forschung.',false,'research');}
  const agentOperations = () => E.getAgentOperations(state);
  const agentSignature = () => {const a=agentOperations();return a.agents.map(x=>x.id+':'+(x.assignment?.kind||'')+':'+(x.cooldown>0)).join('|')+'|'+a.effects.map(x=>x.kind).join(',');};

  function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function storageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  function stat(name, fallback = '') { return `<span data-stat="${name}">${fallback}</span>`; }
  function actionButton(action, label, payload = {}, cls = '', kind = '', costId = '') {
    const data = Object.entries(payload).map(([k,v]) => `data-${k}="${esc(v)}"`).join(' ');
    return `<button class="button ${cls}" data-action="${action}" ${data} ${kind ? `data-cost-kind="${kind}" data-cost-id="${esc(costId)}"` : ''}>${label}</button>`;
  }
  function head(title, description, button = '', eyebrow = 'WORKSPACE / NETWORK OPERATIONS') {
    return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="page-description">${description}</p></div>${button ? `<div class="heading-actions">${button}</div>` : ''}</div>`;
  }
  const newServer = () => `<button class="button primary" data-modal="servers">${icon('plus')}Server hinzufügen</button>`;
  function panelHeader(title, aside = '', count = '') { return `<div class="panel-header"><div class="panel-header-left"><h2>${title}</h2>${count !== '' ? `<span class="count">${count}</span>` : ''}</div>${aside}</div>`; }
  function navLink(target, label) { return `<button class="text-button" data-nav="${target}">${label}${icon('arrow')}</button>`; }
  function empty(title, description, target = '', label = '', symbol = 'layers') { return `<div class="empty-state">${icon(symbol)}<strong>${title}</strong><p>${description}</p>${target ? `<button class="button small" data-nav="${target}">${label}${icon('arrow')}</button>` : ''}</div>`; }
  function sparklinePoints(type) {
    const data = state.history.slice(-24).map(h => h[type]);
    if (data.length < 2) data.push(type === 'load' ? E.getMetrics(state).load : 0, type === 'load' ? E.getMetrics(state).load : 0);
    const min = Math.min(...data), max = Math.max(...data), range = Math.max(max - min, .001);
    return data.map((n,i) => `${(i / (data.length - 1) * 74).toFixed(1)},${(19 - (max === min ? .5 : (n - min) / range) * 16).toFixed(1)}`).join(' ');
  }
  function sparkline(type, color = '#a6cc89') {
    return `<svg class="sparkline" data-sparkline="${type}" viewBox="0 0 74 23" role="img" aria-label="Verlauf der letzten Messwerte"><polyline points="${sparklinePoints(type)}" fill="none" stroke="${color}" stroke-width="1.4"/></svg>`;
  }
  function avatar(agent) {
    let hash = [...agent.name].reduce((h,c) => (h * 31 + c.charCodeAt(0)) >>> 0, 3);
    let cells = '';
    for (let y=0;y<5;y++) for (let x=0;x<3;x++) { hash = (hash * 1664525 + 1013904223) >>> 0; if (hash % 3) {cells += `<rect x="${x*4}" y="${y*4}" width="3" height="3" rx=".6"/>`; if(x<2) cells+=`<rect x="${(4-x)*4}" y="${y*4}" width="3" height="3" rx=".6"/>`;}}
    return `<div class="agent-avatar ${roleClass(agent.role)}"><svg viewBox="0 0 19 19" fill="${agent.role === 'analyst' ? '#9cbce0' : agent.role === 'engineer' ? '#d9bc84' : '#b3d690'}" aria-hidden="true">${cells}</svg></div>`;
  }
  function shell() {
    $('#app').innerHTML = `<div class="app-shell"><div class="mobile-overlay" data-command="menu-close"></div><aside class="sidebar" aria-label="Hauptnavigation"><div class="brand"><img class="brand-mark" src="favicon.svg" alt=""><div><div class="wordmark">root<span>.</span></div><div class="brand-label">NETWORK OS</div></div></div><div class="workspace"><div class="workspace-symbol">${icon('globe')}</div><div><div class="workspace-name" data-stat="name"></div><div class="workspace-meta">Sektor <span data-stat="sector"></span> · Lokales Netzwerk</div></div></div><div class="nav-heading">Leitstelle</div><nav class="nav-list">${navs.map(([id,i,label])=>`${id === 'inbox' ? '<div class="nav-divider"></div><div class="nav-heading">Betrieb</div>' : ''}<button class="nav-item ${view===id?'active':''}" data-nav="${id}" ${view===id?'aria-current="page"':''}>${icon(i)}${label}${id==='inbox'?'<span class="nav-count" data-stat="eventCount"></span>':id==='jobs'?'<span class="nav-count" data-stat="jobCount"></span>':id==='research'?'<span class="nav-count reward-count" data-stat="achievementCount" aria-label="Offene Belohnungen"></span>':''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sector-tile"><div class="sector-tile-label">${icon('globe')} &nbsp;Horizont erweitern</div><strong>Sektor <span data-stat="nextSector"></span> wartet.</strong><p>Neue Kapazitäten. Größere Aufträge. Dein nächster Schritt.</p><button class="button small" data-modal="sector">Sektor erschließen${icon('arrow')}</button></div><button class="nav-item" data-modal="help">${icon('help')}Handbuch</button><button class="nav-item" data-modal="settings">${icon('settings')}Einstellungen</button><div class="nav-divider"></div><div class="sidebar-footer"><i class="live-dot"></i>ROOT v1.4<span>LOCAL</span></div></div></aside><div class="main-wrap"><header class="topbar"><div class="breadcrumbs"><button class="icon-button menu-button" data-command="menu" aria-label="Navigation öffnen">${icon('menu')}</button>${icon('home')}<span>Workspace</span><span>/</span><span class="current" id="breadcrumb">Übersicht</span></div><div class="topbar-right"><span class="save-status">${icon('check')}<span data-stat="save">Netzwerkstand gespeichert</span></span><span class="tag" data-system-tag><i class="live-dot"></i> ${stat('systemStatus')}</span><button class="icon-button" data-nav="inbox" aria-label="Entscheidungen öffnen">${icon('bell')}</button><button class="icon-button" data-modal="settings" aria-label="Einstellungen öffnen">${icon('settings')}</button></div></header><main class="main-content" id="main" tabindex="-1"></main></div></div>`;
    render();
  }
  function metricsCards() {
    return `<div class="metrics-grid"><div class="metric-card"><div class="metric-label">Verfügbare Credits${icon('coins')}</div><div class="metric-value">${stat('credits')}<small>CR</small></div><div class="metric-footer"><span class="positive">+${stat('incomeMinute')} CR / min</span>${sparkline('credits')}</div></div><div class="metric-card"><div class="metric-label">Rechenkapazität${icon('cpu')}</div><div class="metric-value">${stat('capacity')}<small>CU</small></div><div class="metric-footer"><span>${stat('load')} % ausgelastet</span>${sparkline('load','#9cbce0')}</div></div><div class="metric-card"><div class="metric-label">Forschungspunkte${icon('research')}</div><div class="metric-value">${stat('research')}<small>FP</small></div><div class="metric-footer"><span class="positive">+${stat('researchMinute')} FP / min</span><span>${fmt(Object.values(state.upgrades).reduce((a,b)=>a+b,0))} Upgrades</span></div></div><div class="metric-card"><div class="metric-label">Zuverlässigkeit${icon('shield')}</div><div class="metric-value">${stat('reliability')}<small>%</small></div><div class="metric-footer"><span><i class="live-dot"></i> ${stat('healthLabel')}</span><span>${stat('power')} kW</span></div></div></div>`;
  }
  function topology() { return Room.markup(); }
  function jobRows(jobs=state.jobs) {
    return jobs.length ? jobs.map(j=>`<div class="workload-row" data-job="${j.id}"><div class="job-top"><div class="job-title"><span class="job-title-icon">${icon(kindIcons[j.kind])}</span><div>${esc(j.title)}<div class="job-client">${esc(j.client)} · ${esc(kindNames[j.kind])}</div></div></div><span class="job-number">+${fmt(j.reward*(1+(state.upgrades.market||0)*.1))} CR</span></div><div class="progress-track"><div class="progress-fill" data-job-progress="${j.id}" style="width:${Math.min(100,j.work/j.totalWork*100)}%"></div></div><div class="job-meta"><span data-job-percent="${j.id}">${fmt(j.work/j.totalWork*100)} % erledigt</span><span data-job-eta="${j.id}"></span><span>+${fmt(j.science)} FP</span>${j.kind==="ai"?`<span class="gpu-label">${j.gpuDemand} GPU benötigt</span>`:""}</div></div>`).join('') : empty('Kapazitäten sind frei','Nimm einen Auftrag an oder aktiviere die automatische Vergabe.','jobs','Aufträge entdecken','jobs');
  }
  function agentRows() { return state.agents.slice(0,4).map(a=>`<div class="agent-row">${avatar(a)}<div><div class="agent-name">${esc(a.name)}<span class="level-pill">LVL ${a.level}</span></div><div class="agent-role">${E.catalog.roles[a.role].name}</div></div><div class="agent-action"><i class="live-dot"></i>${a.assignment?esc(a.assignment.label):focusNames[a.focus]}</div></div>`).join(''); }
  function eventPreview() {
    const event = state.events[0];
    if(event) return `<div class="panel-body"><span class="tag amber">ENTSCHEIDUNG OFFEN</span><h3 class="inbox-title" style="margin-top:16px">${esc(event.title)}</h3><p class="inbox-description">${esc(event.description)}</p><button class="button block" data-nav="inbox">Optionen ansehen${icon('arrow')}</button><div class="mission-status">${icon('timer')}Wartet auf dich. Ohne Zeitlimit.</div></div>`;
    const serverGoal=Math.min(E.getMetrics(state).serverLimit,2+state.sector), jobsGoal=state.sector*3;
    return `<div class="panel-body"><div class="signal-icon">${icon('expand')}</div><h3 class="inbox-title">Dein nächster Horizont</h3><p class="inbox-description">Mach dein Netzwerk bereit für Sektor ${state.sector+1}. Jeder Ausbau eröffnet neue Möglichkeiten.</p><div class="step-label"><span>Server im Betrieb</span><span>${state.servers.length} / ${serverGoal}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,state.servers.length/serverGoal*100)}%"></div></div><div class="step-label"><span>Aufträge abgeschlossen</span><span>${Math.min(state.counters.jobs,jobsGoal)} / ${jobsGoal}</span></div><div class="progress-track"><div class="progress-fill blue" style="width:${Math.min(100,state.counters.jobs/jobsGoal*100)}%"></div></div><div style="margin-top:18px"><button class="button small block" data-modal="sector">Ausbau planen${icon('arrow')}</button></div></div>`;
  }
  function overviewView() {
    return head('Netzwerkübersicht','Alles im Blick. Dein Netzwerk arbeitet für dich.',`<button class="button ghost" data-nav="jobs">${icon('jobs')}Aufträge</button>${newServer()}`)+
    (!hideGuide && state.counters.jobs<5 ? `<div class="onboarding">${icon('spark')}<div class="onboarding-copy"><strong>Willkommen in deiner Leitstelle.</strong><p>Baue Kapazität auf, wähle passende Aufträge und gib deinen Agenten einen Schwerpunkt.</p></div><button class="button small" data-modal="help">So funktioniert ROOT${icon('arrow')}</button><button class="icon-button" data-command="hide-guide" aria-label="Einführung ausblenden">${icon('cross')}</button></div>`:'')+
    metricsCards()+`<div class="dashboard-grid"><section class="panel">${panelHeader('Dein Rechenzentrum','<span class="tag green"><i class="live-dot"></i>LIVE</span>')}${topology()}<div class="network-stats"><div class="network-stat"><span class="network-stat-label">Server online</span><span class="network-stat-value">${stat('onlineServers')} <span class="muted">/ ${state.servers.length}</span></span></div><div class="network-stat"><span class="network-stat-label">Agenten aktiv</span><span class="network-stat-value">${stat('activeAgentCount')}</span></div><div class="network-stat"><span class="network-stat-label">Wärmstes Rack</span><span class="network-stat-value">${stat('rackTemperature')} °C</span></div><div class="network-stat"><span class="network-stat-label">Durchsatz</span><span class="network-stat-value">${stat('work')} / s</span></div></div><div class="panel-footer"><div class="graph-legend"><span class="legend-item"><i></i>Live aus deinem Netzwerk</span></div>${navLink('network','Infrastruktur verwalten')}</div></section><section class="panel inbox-panel">${panelHeader(state.events.length?'Entscheidungs-Inbox':'Nächster Schritt',state.events.length?`<span class="count">${state.events.length}</span>`:icon('globe'))}${eventPreview()}</section><section class="panel">${panelHeader('Aktive Aufträge',navLink('jobs','Alle Aufträge'),state.jobs.length)}${jobRows(state.jobs.slice(0,3))}<div class="panel-footer"><span>${state.policies.autocontract?'Automatische Vergabe aktiv':'Aufträge werden manuell angenommen'}</span>${navLink('automation','Automatisieren')}</div></section><section class="panel">${panelHeader('Deine Agenten',navLink('agents','Verwalten'),state.agents.length)}${agentRows()}<div class="panel-footer"><span>Selbstständig im Hintergrund aktiv</span><span class="tag green">ONLINE</span></div></section></div><section class="panel section-spacer">${panelHeader('Zuletzt im Netzwerk',navLink('log','Aktivitätslog'))}<div class="activity-list">${state.log.slice(0,3).map(l=>`<div class="activity-row"><span class="activity-time">${clock(l.time)}</span><span class="activity-message"><i class="activity-dot"></i>${esc(l.message)}</span></div>`).join('')}</div></section>`;
  }
  function networkView() { return R.view(); }
  function agentsView() {
    const m=E.getMetrics(state), ops=agentOperations();
    return head('Agenten','Gib deinem Team einen Schwerpunkt — und gezielte Einsätze.',`<span class="budget-info">${stat('activeAgentCount')} im Normalbetrieb / ${m.agentLimit} Plätze</span><button class="button primary" data-modal="agents">${icon('plus')}Agent einstellen</button>`)+
    (ops.effects.length?`<div class="effect-strip">${ops.effects.map(e=>`<span>${icon('spark')}${esc(e.label)} <strong data-effect="${e.kind}"></strong></span>`).join('')}</div>`:'')+
    `<div class="card-grid">${state.agents.map(a=>{const op=ops.agents.find(x=>x.id===a.id);return `<section class="agent-card ${op.assignment?'on-assignment':''}"><div class="agent-card-top">${avatar(a)}<span class="tag ${a.role==='analyst'?'blue':a.role==='engineer'?'amber':'green'}">STUFE ${a.level}</span></div><h3>${esc(a.name)}</h3><p class="role-desc">${E.catalog.roles[a.role].name} · ${E.catalog.roles[a.role].description}</p><span class="agent-trait">${icon('spark')}${esc(a.trait)}</span><div class="agent-assignment"><span class="assignment-label">${icon(op.assignment?'timer':'pulse')}${op.assignment?'SONDEREINSATZ':'EINSATZSTATUS'}</span><strong data-agent-status="${a.id}"></strong>${op.assignment?`<div class="progress-track"><div class="progress-fill blue" data-agent-progress="${a.id}"></div></div>`:''}<button class="button block ${op.assignment?'ghost':'primary'}" data-modal="agent-task" data-id="${a.id}">${icon('jobs')}${op.assignment?'Einsatz ansehen':'Einsatz planen'}</button></div><div class="agent-controls"><label class="field-label" for="focus-${a.id}">Schwerpunkt im Normalbetrieb</label><select id="focus-${a.id}" class="select" data-change="agent-focus" data-id="${a.id}">${Object.entries(focusNames).map(([k,v])=>`<option value="${k}" ${a.focus===k?'selected':''}>${v}</option>`).join('')}</select>${actionButton('upgradeAgent',`${icon('plus')}Entwickeln · ${fmt(E.cost(state,'agentUpgrade',a.id))} CR`,{id:a.id},'block','agentUpgrade',a.id)}</div></section>`;}).join('')}</div><div class="helper-card"><h3>Wen kannst du gerade entbehren?</h3><p>Im Sondereinsatz fehlt ein Agent bei Aufträgen, Forschung und Pflege. Techniker diagnostizieren schneller, Operatoren optimieren schneller, Analysten liefern mehr Forschung. Die Wirkung beginnt erst nach Abschluss. Danach ist der Agent wieder im Normalbetrieb; ein weiterer Sondereinsatz muss bis zum Ende der Erholungszeit warten. Große Krisen pausieren laufende Einsätze.</p></div>`;
  }
  function agentTaskModal(id){
    const agent=state.agents.find(x=>x.id===id), op=agentOperations().agents.find(x=>x.id===id);
    if(!agent||!op)return '<p class="modal-intro">Dieser Agent ist nicht mehr vorhanden.</p>';
    return `<p class="modal-intro"><strong>${esc(agent.name)}</strong> · ${E.catalog.roles[agent.role].name} · Stufe ${agent.level}. Im Sondereinsatz entfallen alle normalen Beiträge dieses Agenten. Kosten werden beim Start verbraucht; die Wirkung folgt nach Abschluss.</p><div class="assignment-summary" data-agent-status="${id}"></div><div class="protection-choices">${op.options.map(o=>`<article class="protection-option mission-option"><h3>${esc(o.label)}</h3><p>${esc(o.description)}</p><div class="protection-cost">${fmt(o.cost)} CR · ${duration(o.duration)} Einsatz<br>${duration(o.cooldown)} Erholungszeit danach</div><div class="protection-reason" data-mission-reason>${esc(o.reason||'')}</div>${actionButton('dispatchAgent',`${icon('arrow')}Einsatz starten`,{id,mission:o.key},'block')}</article>`).join('')}</div>`;
  }
  function jobsView() {
    const m=E.getMetrics(state);
    return head('Auftragsboard','Wähle Arbeit, die zu deinem Netzwerk passt. Neue Angebote entstehen laufend.',`<button class="button ${state.policies.autocontract?'':'primary'}" data-action="setPolicy" data-key="autocontract" data-value="${!state.policies.autocontract}">${icon('automation')}Automatik ${state.policies.autocontract?'an':'aktivieren'}</button>`)+`<section class="panel">${panelHeader('In Bearbeitung',`<span class="tag">${state.jobs.length} / ${m.jobLimit} AUFTRÄGE</span>`)}<div class="stats-strip"><div><span>GPU belegt / nutzbar</span><strong>${stat("gpuUsed")} / ${stat("gpuCapacity")}</strong></div><div><span>Freie Kapazität</span><strong>${stat('freeCapacity')} CU</strong></div><div><span>Gemeinsamer Durchsatz</span><strong>${stat('work')} / s</strong></div><div><span>Abgeschlossen</span><strong>${fmt(state.counters.jobs)}</strong></div></div>${jobRows()}</section><div class="section-heading"><h2>Verfügbare Aufträge <span class="muted">/ ${state.offers.length}</span></h2><p>Angebote bleiben verfügbar · Aktualisierung in ${stat('offerEta')}</p></div><div class="card-grid">${state.offers.map(j=>`<section class="offer-card"><div class="offer-card-top"><span class="job-title-icon">${icon(kindIcons[j.kind])}</span><span class="tag">${kindNames[j.kind]}</span></div><h3>${esc(j.title)}</h3><p>${esc(j.client)}</p><div class="offer-stats"><div><small>Vergütung</small><strong>${fmt(j.reward*(1+(state.upgrades.market||0)*.1))} CR</strong></div><div><small>Forschung</small><strong>${fmt(j.science)} FP</strong></div><div><small>Kapazität</small><strong>${dec(j.load)} CU${j.kind==="ai"?` · ${j.gpuDemand} GPU`:""}</strong></div></div><div class="card-actions">${actionButton('acceptJob',`${icon('plus')}Annehmen`,{id:j.id},'primary')}<button class="icon-button" data-action="declineJob" data-id="${j.id}" aria-label="${esc(j.title)} ablehnen" title="Angebot ablehnen">${icon('cross')}</button></div></section>`).join('')}</div>${!state.offers.length?`<section class="panel">${empty('Neue Angebote sind unterwegs','Dein Netzwerk wird in Kürze wieder angefragt. Die automatische Vergabe übernimmt auf Wunsch neue passende Aufträge.','','','timer')}</section>`:''}<div class="helper-card"><h3>Teile die Arbeit bewusst auf.</h3><p>Alle Aufträge teilen sich die Leistung deiner Agenten. Mehr parallele Arbeit belegt mehr Kapazität. Mit einer Priorität unter Automatisierung kannst du lukrative oder forschungsintensive Aufträge vorziehen.</p></div>`;
  }
  function researchView() {
    const researchIcons={routing:'globe',cooling:'heat',market:'jobs',automation:'automation',synthesis:'research'};
    return head('Forschung & Entwicklung','Verbessere die Architektur deines Netzwerks – Stufe für Stufe.',`<span class="tag blue">${icon('research')}${stat('research')} FORSCHUNGSPUNKTE</span>`)+`<div class="card-grid">${E.catalog.research.map(r=>`<section class="research-card"><div class="research-top"><div class="research-icon">${icon(researchIcons[r.id])}</div><span class="tag">STUFE ${state.upgrades[r.id]||0}</span></div><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p><div class="research-effect">Dauerhaft aktiv · Ausbau bleibt erhalten</div>${actionButton('buyResearch',`${icon('plus')}Erforschen · ${fmt(E.cost(state,'research',r.id))} FP`,{id:r.id},'','research',r.id)}</section>`).join('')}</div><div class="section-heading"><h2>Erfolge & Meilensteine</h2><p>${pendingAchievements().length?pendingAchievements().length+' Belohnungen verfügbar':'Deine nächsten Ziele'}</p></div><div class="achievement-grid">${E.catalog.achievements.map(a=>`<div class="achievement ${state.achievements[a.id]?'claimed':(state.achievementUnlocks?.[a.id]||a.check(state))?'available':''}">${icon('trophy')}<div class="achievement-copy"><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p></div>${state.achievements[a.id]?'<span class="tag">ERREICHT</span>':actionButton('claimAchievement',`${icon('coins')}+${fmt(a.reward)} CR`,{id:a.id},'small')}</div>`).join('')}</div>`;
  }
  function automationView() {
    const m=E.getMetrics(state);
    const choice=(key, options)=>`<div class="choice-buttons">${Object.entries(options).map(([v,label])=>`<button class="choice-button ${state.policies[key]===v?'active':''}" data-action="setPolicy" data-key="${key}" data-value="${v}" aria-pressed="${state.policies[key]===v}">${label}</button>`).join('')}</div>`;
    return head('Automatisierung','Lege die Regeln fest. Dein Netzwerk kümmert sich um die Routine.',`<span class="tag green">${icon('automation')}AUTONOMER BETRIEB</span>`)+`<div class="policy-grid"><section class="panel">${panelHeader('Betriebsregeln',icon('settings'))}${[['autocontract','Automatische Auftragsvergabe','Freie Kapazitäten werden mit passenden Angeboten belegt. Deine Priorität bestimmt die Auswahl.'],['autorepair','Automatische Netzwerkpflege','Pflegt das Netz und repariert kleinere Defekte mit Ersatzteilen innerhalb von Budget und Geldreserve. Laufende Pflege kostet zusätzlich Betriebskosten.']].map(([key,title,desc])=>`<div class="policy-row"><div class="policy-copy"><strong>${title}</strong><p>${desc}</p></div><button class="toggle" role="switch" aria-label="${title}" aria-checked="${state.policies[key]}" data-action="setPolicy" data-key="${key}" data-value="${!state.policies[key]}"></button></div>`).join('')}</section><section class="policy-card"><h3>Aktueller Betrieb</h3><div class="status-row"><span>Netto-Grundversorgung</span><strong class="positive">+${stat('incomeMinute')} CR / min</strong></div><div class="status-row"><span>Laufende Betriebskosten</span><strong>${stat('upkeepMinute')} CR / min</strong></div><div class="status-row"><span>Gemeinsamer Arbeitsdurchsatz</span><strong>${stat('work')} / s</strong></div><div class="status-row"><span>Aktuelle Zuverlässigkeit</span><strong>${stat('reliability')} %</strong></div></section><section class="policy-card"><h3>Globales Energieprofil</h3>${choice('power',modeNames)}<p class="policy-explainer">Öko reduziert Stromkosten und Durchsatz. Leistung beschleunigt die Arbeit, erzeugt aber mehr Wärme. Das Profil ergänzt den Betriebsmodus jedes einzelnen Servers.</p></section><section class="policy-card"><h3>Priorität der Auftragsarbeit</h3>${choice('priority',{balanced:'Ausgewogen',income:'Vergütung',research:'Forschung'})}<p class="policy-explainer">Verteile die Agentenleistung gleichmäßig oder bevorzuge Aufträge mit höherer Vergütung beziehungsweise mehr Forschung pro Arbeitseinheit.</p></section></div><div class="helper-card"><h3>Ein Netzwerk, das auch ohne dich weiterkommt.</h3><p>Beim nächsten Öffnen wird bis zu 12 Stunden Abwesenheit nachgeholt. Deine Regeln gelten auch dann. Größere Krisen pausieren die Auftragsarbeit und warten im Schutzmodus auf dich. Backups, Budget und Geldreserve legst du unter Betrieb & Schutz fest.</p></div>`;
  }
  function inboxView() {
    return head('Entscheidungs-Inbox','Besondere Situationen. Mehrere Wege. Du bestimmst die Richtung.',`<span class="tag amber">${state.events.length} OFFEN</span>`)+`<div class="events-stack">${state.events.map(e=>`<section class="event-card"><span class="tag amber">${icon('inbox')}NETZWERKEREIGNIS</span><h3>${esc(e.title)}</h3><p>${esc(e.description)}</p><div class="event-choices">${e.choices.map((c,i)=>`<button class="event-choice" data-action="resolveEvent" data-id="${e.id}" data-choice="${i}"><strong>${esc(c.label)} ${icon('arrow')}</strong><span>${esc(c.description)}</span></button>`).join('')}</div></section>`).join('') || `<section class="panel">${empty('Alles geklärt. Dein Netzwerk arbeitet.','Besondere Anfragen und Entdeckungen landen hier. Deine nächste Entscheidung kommt, während das Netzwerk wächst.','overview','Zur Übersicht','inbox')}</section>`}</div><div class="helper-card"><h3>Du gibst den Takt vor.</h3><p>Diese Entscheidungen haben kein Zeitlimit. Bis zu drei Ereignisse warten auf dich; der reguläre Betrieb geht währenddessen weiter.</p></div>`;
  }
  const serverStatusNames={...R.statusNames,failed:'Ausgefallen'};
  function protectionSignature(){
    const r=E.getResilience(state);
    return [r.incident?.id,r.operation?.kind,r.operation?.serverId,r.backupAt,r.servers.map(s=>s.id+':'+s.status),r.parts].join('|');
  }
  function optionSummary(option){
    const costs=[option.cost?`${fmt(option.cost)} CR`:'Keine Credits',option.parts?`${option.parts} Ersatzteil${option.parts===1?'':'e'}`:'',option.duration?duration(option.duration):''];
    const losses=[option.researchLoss>0?`${dec(option.researchLoss)} FP Verlust`:'',option.workLoss>0?`${dec(option.workLoss)} Arbeitseinheiten verloren`:''].filter(Boolean);
    return costs.filter(Boolean).join(' · ')+(losses.length?' · '+losses.join(' · '):'');
  }
  function protectionButton(option,action,payload={},cls=''){
    return actionButton(action,`${icon(action==='createBackup'?'storage':action==='buyParts'?'plus':'settings')}${esc(option.label)}`,{...payload,safety:'true'},cls);
  }
  function protectionOption(option,action,payload={},confirm=false){
    return `<article class="protection-option"><div class="protection-option-heading"><h3>${esc(option.label)}</h3>${option.key==='manual'?'<span class="tag amber">NOTWEG</span>':''}</div><p data-option-description>${esc(option.description)}</p><div class="protection-cost" data-option-cost>${esc(optionSummary(option))}</div><div class="protection-reason" data-option-reason>${esc(option.reason||'')}</div>${confirm?`<button class="button block" data-modal="incident-confirm" data-choice="${esc(option.key)}" data-safety="true" data-action-quote="resolveIncident" data-id="${esc(payload.id)}">Folgen prüfen${icon('arrow')}</button>`:protectionButton(option,action,payload,'block')}</article>`;
  }
  function incidentPanel(r){
    if(!r.incident)return '';
    const i=r.incident;
    return `<section class="incident-panel"><div class="incident-heading"><div><span class="tag red">${icon('shield')}SCHUTZMODUS AKTIV</span><h2>${esc(i.title)}</h2></div><span class="incident-time">${r.operation?'Maßnahme läuft':'Entscheidung erforderlich'}</span></div><p>${esc(i.description)}</p><div class="incident-consequence">${icon('help')}<span>${esc(i.consequence)}</span></div><div class="protection-choices">${i.choices.map(o=>protectionOption(o,'resolveIncident',{id:i.id,choice:o.key},true)).join('')}</div><p class="containment-note">${r.operation?'Weitere Folgeschäden sind gestoppt. Deine gewählte Maßnahme läuft bis zum Abschluss.':'Weitere Folgeschäden sind gestoppt. Diese Entscheidung wartet ohne Zeitlimit auf dich.'} Die Folgen deiner Auswahl werden einmalig angewendet.</p></section>`;
  }
  function operationPanel(r){
    if(!r.operation)return '';
    const op=r.operation;
    return `<section class="panel operation-panel">${panelHeader(esc(op.label),'<span class="tag amber">IN ARBEIT</span>')}<div class="panel-body"><div class="operation-status"><span>Verbleibende Zeit: <strong data-stat="operationEta"></strong></span><span data-stat="operationPercent"></span></div><div class="progress-track tall"><div class="progress-fill amber" data-operation-progress style="width:${Math.min(100,(1-op.remaining/op.total)*100)}%"></div></div><p class="policy-explainer">Die Maßnahme läuft automatisch bis zum Abschluss. Das Wartungsfenster ist in dieser Zeit belegt.</p></div></section>`;
  }
  function resilienceView(){
    const r=E.getResilience(state);
    return head('Betrieb & Schutz','Gesundheit, Wiederherstellung und Vorsorge für dein Netzwerk.',`<span class="tag ${r.incident?'red':'green'}">${icon('shield')}${stat('systemStatus')}</span>`)+incidentPanel(r)+operationPanel(r)+
    `<div class="metrics-grid protection-metrics"><div class="metric-card"><div class="metric-label">Server verfügbar${icon('server')}</div><div class="metric-value">${stat('onlineServers')}<small>/ ${state.servers.length}</small></div><div class="metric-footer"><span>${stat('failedServers')} ausgefallen · ${stat('repairingServers')} in Reparatur</span></div></div><div class="metric-card"><div class="metric-label">Durchschnittlicher Zustand${icon('pulse')}</div><div class="metric-value">${stat('condition')}<small>%</small></div><div class="metric-footer"><span>Datenintegrität ${stat('integrity')} %</span></div></div><div class="metric-card"><div class="metric-label">Störungsrisiko${icon('heat')}</div><div class="metric-value">${stat('riskRate')}<small>/ h</small></div><div class="metric-footer"><span data-stat="riskLabel"></span></div></div><div class="metric-card"><div class="metric-label">Letztes Betriebsbackup${icon('storage')}</div><div class="metric-value backup-age" data-stat="backupAge"></div><div class="metric-footer"><span>${stat('protectedResearch')} FP geschützt</span></div></div></div>`+
    `<div class="policy-grid"><section class="panel">${panelHeader('Betriebsbackup',icon('storage'))}<div class="panel-body"><p class="policy-explainer" style="margin-top:0">Schützt vorhandene Forschung und laufende Aufträge bis zum Sicherungszeitpunkt. Spätere Änderungen sind erst im nächsten Backup enthalten.</p><div class="status-row"><span>Geschützte Forschung</span><strong>${stat('protectedResearch')} FP</strong></div><div class="status-row"><span>Gesicherte Aufträge</span><strong data-stat="backupJobs"></strong></div><div class="status-row"><span>Nächste manuelle Sicherung</span><strong data-stat="backupCooldown"></strong></div><div class="protection-option compact"><p data-option-description>${esc(r.backup.description)}</p><div class="protection-cost" data-option-cost>${esc(optionSummary(r.backup))}</div><div class="protection-reason" data-option-reason>${esc(r.backup.reason)}</div>${protectionButton(r.backup,'createBackup',{},'block')}</div></div><div class="policy-row"><div class="policy-copy"><strong>Automatische Betriebsbackups</strong><p>Sicherungen innerhalb deines Wartungsbudgets und deiner Geldreserve.</p></div><button class="toggle" role="switch" aria-label="Automatische Betriebsbackups" aria-checked="${state.policies.autobackup}" data-action="setPolicy" data-key="autobackup" data-value="${!state.policies.autobackup}"></button></div></section><section class="panel">${panelHeader('Reserve & Automatik',icon('settings'))}<div class="panel-body"><div class="status-row"><span>Ersatzteile im Lager</span><strong>${stat('parts')} / 20</strong></div><div class="protection-option compact"><p data-option-description>${esc(r.partsPurchase.description)}</p><div class="protection-cost" data-option-cost>${esc(optionSummary(r.partsPurchase))}</div><div class="protection-reason" data-option-reason>${esc(r.partsPurchase.reason)}</div>${protectionButton(r.partsPurchase,'buyParts',{},'block')}</div><div class="policy-budget"><label class="field-label" for="repair-budget">Maximale automatische Ausgaben pro Betriebsstunde</label><select id="repair-budget" class="select" data-change="protection-policy" data-key="repairBudget">${[0,100,300,1000].map(v=>`<option value="${v}" ${state.policies.repairBudget===v?'selected':''}>${fmt(v)} CR / Stunde</option>`).join('')}</select><div class="budget-caption">Verbraucht: ${stat('repairSpent')} / ${stat('repairBudget')} CR</div><label class="field-label" for="cash-reserve">Geschützte Geldreserve</label><select id="cash-reserve" class="select" data-change="protection-policy" data-key="reserve">${[0,250,1000,5000].map(v=>`<option value="${v}" ${state.policies.reserve===v?'selected':''}>${fmt(v)} CR zurückhalten</option>`).join('')}</select><p class="policy-explainer">Die Reserve begrenzt automatische Eingriffe. Manuell freigegebene Maßnahmen können sie nutzen. Ein Wechsel der Einstellungen setzt verbrauchte Budgets nicht zurück.</p></div></div><div class="policy-row"><div class="policy-copy"><strong>Automatische Netzwerkpflege</strong><p>Kleinere Reparaturen mit verfügbaren Ersatzteilen. Größere Krisen warten auf dich.</p></div><button class="toggle" role="switch" aria-label="Automatische Netzwerkpflege" aria-checked="${state.policies.autorepair}" data-action="setPolicy" data-key="autorepair" data-value="${!state.policies.autorepair}"></button></div></section></div>`+
    `<section class="panel section-spacer">${panelHeader('Zustand der Server',`<span class="tag">${state.servers.length} KNOTEN</span>`)}<div class="table-scroll"><table><thead><tr><th>Knoten</th><th>Zustand</th><th>Status</th><th>Maßnahmen</th></tr></thead><tbody>${r.servers.map(s=>{const server=state.servers.find(x=>x.id===s.id);return `<tr><td><div class="table-name"><span class="server-icon ${s.status!=='online'?'faulted':''}">${icon('server')}</span><div>${esc(server.name)}<span class="table-secondary">${esc(s.fault||'Keine aktive Störung')}</span></div></div></td><td><div class="condition-cell"><span data-condition-label="${s.id}">${dec(s.condition)} %</span><div class="progress-track"><div data-condition-bar="${s.id}" class="progress-fill ${s.condition<50?'danger':s.condition<80?'amber':''}" style="width:${s.condition}%"></div></div></div></td><td><span class="tag ${s.displayStatus==='failed'?'red':s.displayStatus!=='online'?'amber':'green'}">${serverStatusNames[R.serverStatus(s.id,s.status)]}</span></td><td><button class="button small" data-modal="repair" data-id="${s.id}">${icon('settings')}Maßnahmen prüfen</button></td></tr>`;}).join('')}</tbody></table></div></section><div class="helper-card"><h3>Vorsorge verändert die Folgen.</h3><p>Hohe Leistung, Hitze und Verschleiß erhöhen das Risiko. Eine schnelle Reparatur spart Zeit und hinterlässt mehr Verschleiß. Eine Überholung kostet Ersatzteile und bringt den Zustand vollständig zurück. Backups begrenzen Datenverluste; ihr Alter entscheidet darüber, wie viel erhalten bleibt. Eine zusätzliche JSON-Sicherung deiner gesamten Leitstelle findest du in den Einstellungen.</p></div>`;
  }
  function repairModal(id){
    const r=E.getResilience(state),s=r.servers.find(x=>x.id===id),server=state.servers.find(x=>x.id===id);
    if(!s||!server)return '<p class="modal-intro">Dieser Server ist nicht mehr vorhanden.</p>';
    return `<p class="modal-intro">${esc(server.name)} · ${serverStatusNames[s.status]} · Zustand ${dec(s.condition)} %. Während der Reparatur liefert dieser Knoten keine Kapazität. Kosten und Ersatzteile werden beim Start verbraucht.</p><div class="protection-choices repair-choices">${s.repairs.map(o=>protectionOption(o,'repairServer',{id:s.id,method:o.key})).join('')}</div>`;
  }
  function incidentConfirm(choice){
    const r=E.getResilience(state),i=r.incident,o=i?.choices.find(x=>x.key===choice);
    if(!i||!o)return '<p class="modal-intro">Dieser Vorfall wurde bereits bearbeitet.</p>';
    return `<span class="tag red">${esc(i.title)}</span><h3 class="resolution-title">${esc(o.label)}</h3><div class="protection-option compact"><p data-option-description>${esc(o.description)}</p><div class="protection-cost" data-option-cost>${esc(optionSummary(o))}</div><div class="resolution-warning">Diese Entscheidung verbraucht die angegebenen Ressourcen und kann ungesicherten Fortschritt dauerhaft verwerfen. Nach dem Start läuft die Maßnahme bis zum Abschluss.</div><div class="protection-reason" data-option-reason>${esc(o.reason||'')}</div>${protectionButton(o,'resolveIncident',{id:i.id,choice:o.key},'primary block')}</div>`;
  }
  function logView() {
    const entries=state.log.filter(l=>logFilter==='all'||l.type===logFilter);
    return head('Aktivitätslog','Die Geschichte deines Netzwerks. Ein Ereignis nach dem anderen.',`<div class="log-filter">${[['all','Alle'],['success','Fortschritte'],['system','Betrieb']].map(([k,l])=>`<button class="button small ${logFilter===k?'selected':''}" data-filter="${k}">${l}</button>`).join('')}</div>`)+`<section class="panel">${panelHeader('Netzwerkprotokoll',`<span class="tag">LETZTE ${entries.length} EREIGNISSE</span>`)}${entries.map(l=>`<div class="log-detail"><span class="tag ${l.type==='success'?'green':''}">${l.type==='success'?'ERFOLG':'SYSTEM'}</span><div><p>${esc(l.message)}</p><small>Betriebszeit ${clock(l.time)}</small></div></div>`).join('')||empty('Noch keine Einträge','Neue Ereignisse erscheinen hier automatisch.','','','log')}</section>`;
  }
  function facilityView(){
    const layout=E.getFacilityLayout(state),central=E.getCentralInfrastructure(state);
    const details={cooling:'Zusätzliche Kühlleistung wird auf aktive Racks verteilt. Die Anlage benötigt selbst Strom; Temperaturen sinken allmählich.',ups:'Die USV schützt nur die Last innerhalb ihrer Leistungskapazität. Sie senkt Wahrscheinlichkeit und Schwere von Stromausfällen.',distribution:'Ein endliches zusätzliches Strombudget wird auf aktive Racks verteilt. Leere Racks verbrauchen keine Reserve.'};
    return head('Gebäudetechnik','Zentrale Versorgung für deine wachsende Anlage.')+`<div class="rack-summary"><div><span>Serverräume</span><strong>${layout.roomCount}</strong></div><div><span>Untergeschosse</span><strong>${layout.floorCount}</strong></div><div><span>Technikverbrauch</span><strong data-central-stat="power">${dec(central.powerW/1000)} kW</strong></div><div><span>Technikkosten</span><strong data-central-stat="upkeep">${dec(central.upkeep*60)} CR / min</strong></div></div><div class="facility-system-grid">${central.systems.map(system=>{const q=system.quote;return `<section class="panel facility-system"><div class="facility-system-heading">${icon(system.id==='cooling'?'heat':system.id==='ups'?'shield':'automation')}<span class="tag">${system.available?'Stufe '+system.level+' / '+system.maxLevel:'Ab Sektor '+system.unlockSector}</span></div><h2>${esc(system.name)}</h2><p>${details[system.id]}</p><div class="facility-output" data-central-output="${system.id}"></div><div class="hardware-quote"><p>${esc(q.description)}</p><button class="button primary block" data-hw-action="upgradeCentral" data-hw-payload="${esc(JSON.stringify({system:system.id}))}" data-hw-confirm="true" ${q.enabled?'':'disabled'}>Ausbau prüfen · ${fmt(q.cost)} CR</button><small data-hw-reason>${esc(q.reason)}</small></div><button class="text-button" data-facility-visit="${system.id}" ${system.available?'':'disabled'}>Technikraum betreten${icon('arrow')}</button></section>`;}).join('')}</div><section class="panel facility-operation" data-central-operation ${central.operation?'':'hidden'}><strong data-central-operation-title></strong><span data-central-operation-time></span><div class="progress-track"><div class="progress-fill" data-central-operation-progress></div></div></section><section class="panel section-spacer"><div class="panel-body"><h2>Raumplan</h2><p>Sechs Racks pro Raum, vier Serverräume pro Untergeschoss. Neue Räume und Untergeschosse entstehen mit zusätzlichen Racks.</p><div class="facility-room-plan">${layout.rooms.map(room=>`<button class="button" data-facility-visit="${room.id}">Untergeschoss ${room.floor} · Raum ${room.number}<small>${room.rackCount} Racks · ${room.serverCount} Server</small></button>`).join('')}<button class="button" data-facility-visit="control">Kontrollraum${icon('arrow')}</button></div></div></section><div class="helper-card"><h3>Automatische Schutzfunktionen</h3><p>Bestehende Wartungsregeln, Backups und der Schutzmodus bleiben aktiv. Zentrale Anlagen kosten laufend Credits. Während eines Ausbaus ist kein weiterer Wartungseingriff möglich; der bisherige Anlagenstand arbeitet weiter.</p></div>`;
  }
  function updateCentralTelemetry(){
    const central=E.getCentralInfrastructure(state);
    const output={cooling:dec(central.coolingCapacityW/1000)+' kW · '+central.activeRackCount+' '+tr('aktive Racks'),ups:dec(central.upsCapacityW/1000)+' kW · '+fmt(central.upsCoverage*100)+' % '+tr('Last abgedeckt'),distribution:dec(central.distributionCapacityW/1000)+' kW '+tr('gesamt')+' · '+dec(central.distributionCapacityWPerRack/1000)+' kW / '+tr('aktives Rack')};
    $$('[data-central-output]').forEach(el=>el.textContent=output[el.dataset.centralOutput]);
    $$('[data-central-stat="power"]').forEach(el=>el.textContent=dec(central.powerW/1000)+' kW');
    $$('[data-central-stat="upkeep"]').forEach(el=>el.textContent=dec(central.upkeep*60)+' CR / min');
    $$('[data-central-operation]').forEach(el=>{const op=central.operation;el.hidden=!op;if(op){el.querySelector('[data-central-operation-title]').textContent=tr(op.label||op.name);el.querySelector('[data-central-operation-time]').textContent=duration(op.remaining);el.querySelector('[data-central-operation-progress]').style.width=(1-op.remaining/op.total)*100+'%';}});
  }
  navs.push(['facility','layers','Gebäudetechnik']);
  const viewFunctions = {overview:overviewView,network:networkView,agents:agentsView,jobs:jobsView,research:researchView,automation:automationView,resilience:resilienceView,inbox:inboxView,log:logView,facility:facilityView};
  function consoleOverviewView(){return head('Leitstelle im Raum','Aufträge, Ausbau und Betrieb von diesem Terminal aus steuern.',`<button class="button primary" data-modal="sector">${icon('expand')}Sektor erschließen</button>`)+metricsCards()+`<div class="room-console-hub">${navs.filter(([id])=>id!=='overview').map(([id,symbol,label])=>`<button class="button" data-nav="${id}">${icon(symbol)}${label}${icon('arrow')}</button>`).join('')}</div><section class="panel section-spacer">${panelHeader('Aktive Aufträge',navLink('jobs','Aufträge verwalten'))}${jobRows(state.jobs)}</section>`;}
  function render() {
    if(!state) return;
    if(Room.isInRoom()&&!Room.isConsoleOpen()){renderPending=true;updateLive();return;}
    if(document.activeElement && /^(SELECT|INPUT)$/.test(document.activeElement.tagName) && !modal) { renderPending=true; updateLive(); return; }
    const roomMode=Room.isInRoom(),container=roomMode?Room.consoleBody():$('#main');
    const protection=E.getResilience(state);
    const alert=protection.incident&&view!=='resilience'?`<aside class="protection-banner" role="status"><span class="signal-icon">${icon('shield')}</span><div><strong>${esc(protection.incident.title)}</strong><span>Schutzmodus aktiv. Weitere Schäden sind gestoppt; eine Entscheidung wartet auf dich.</span></div><button class="button small" data-nav="resilience">Vorfall öffnen${icon('arrow')}</button></aside>`:protection.failed>0&&view!=='resilience'?`<aside class="protection-banner warning" role="status"><span class="signal-icon">${icon('server')}</span><div><strong>${protection.failed} Server ausgefallen</strong><span>Kapazität und Einnahmen sind reduziert. Prüfe die verfügbaren Reparaturen.</span></div><button class="button small" data-nav="resilience">Betrieb & Schutz${icon('arrow')}</button></aside>`:'';
    const rewards=pendingAchievements();
    const rewardAlert=rewards.length&&view!=='research'?`<aside class="reward-banner" role="status">${icon('trophy')}<div><strong>${rewards.length===1?'Ein Erfolg wartet auf dich':rewards.length+' Erfolge warten auf dich'}</strong><span>${rewards.map(a=>esc(a.name)).join(' · ')} · ${stat('achievementReward')} CR abholbereit</span></div><button class="button small" data-nav="research">Belohnung abholen${icon('arrow')}</button></aside>`:'';
    container.innerHTML = `${saveError?`<div class="save-warning" role="status">${esc(saveError)}${saveConflict?'<button class="button small" data-command="reload">Aktuellen Stand laden</button>':''}</div>`:''}${alert}${rewardAlert}<div class="view-content">${roomMode&&view==='overview'?consoleOverviewView():viewFunctions[view]()}</div><footer class="bottom-caption"><span><i class="live-dot"></i>${stat('systemStatus')} · ${stat('runtime')}</span><span>DEIN NETZWERK. DEINE REGELN.</span></footer>`;
    $$('.nav-item[data-nav]').forEach(el=>{el.classList.toggle('active',el.dataset.nav===view);if(el.dataset.nav===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    $('#breadcrumb').textContent=tr(navs.find(n=>n[0]===view)[2]);
    window.ROOTI18N?.localize?.($('#app'));
    if(roomMode)Room.setConsoleTitle(navs.find(n=>n[0]===view)[2],view);else if(view==='overview')Room.mount();else Room.hide();
    signature=stateSignature();renderPending=false;updateLive();
  }
  function stateSignature(){
    // Only changed lists on the visible page require new markup. Timers,
    // counters, affordability and chart samples are updated in place.
    const protection=[protectionSignature(),agentSignature(),pendingAchievements().map(a=>a.id),R.signature(),JSON.stringify(state.facility.central),state.facility.centralOperation?.system].join('|');
    if(view==='overview')return [protection,state.jobs.map(x=>x.id),state.events.map(x=>x.id),state.log[0]?.id].join('|');
    if(view==='jobs')return [protection,state.jobs.map(x=>x.id),state.offers.map(x=>x.id),state.counters.jobs].join('|');
    if(view==='inbox')return protection+'|'+state.events.map(x=>x.id).join('|');
    if(view==='log')return protection+'|'+(state.log[0]?.id||'');
    return protection;
  }
  function updateLive() {
    if(!state)return;
    if(view==='facility')updateCentralTelemetry();
    const m=E.getMetrics(state), facility=E.getRackModel(state,m), r=E.getResilience(state,facility,m), a=agentOperations(), achievements=pendingAchievements(), limited=facility.racks.some(x=>x.status!=='online');
    const serverRows=new Map(facility.racks.flatMap(rack=>rack.servers.map(server=>[server.id,server])));
    const values={gpuCapacity:dec(m.gpuCapacity||0),gpuInstalled:fmt(m.gpuInstalled||0),gpuUsed:dec(m.gpuUsed||0),gpuLoad:dec((m.gpuLoad||0)*100),name:state.networkName,sector:state.sector,nextSector:state.sector+1,credits:compact(state.credits),capacity:dec(m.capacity),research:compact(state.research),incomeMinute:dec(m.incomePerSecond*60),researchMinute:dec(m.researchPerSecond*60),reliability:dec(m.reliability),load:dec(m.load*100),power:dec(m.power),heat:dec(m.heat),rackTemperature:dec(m.maxRackTemperature),work:dec(m.workPerSecond),upkeepMinute:dec(m.upkeep*60),freeCapacity:dec(Math.max(0,m.capacity-m.usedCapacity)),eventCount:state.events.length,jobCount:state.jobs.length,runtime:clock(state.time),offerEta:duration(state.timers.offer),healthLabel:r.safetyMode?'Schutzmodus':r.failed?'Reparatur erforderlich':m.reliability>90?'Stabiler Betrieb':m.reliability>65?'Wartung empfohlen':'Kühlung empfohlen',save:saveMode==='saving'?'Wird gespeichert …':saveMode==='fallback'?'Im Browser gespeichert':saveMode==='error'?'Speichern fehlgeschlagen':'Netzwerkstand gespeichert'};
    Object.assign(values,{onlineServers:fmt(r.online),failedServers:fmt(r.failed),repairingServers:fmt(r.repairing),condition:dec(r.condition),integrity:dec(r.integrity),riskRate:dec(r.riskPerHour)+' %',riskLabel:r.safetyMode?'Im Schutzmodus ausgesetzt':r.graceRemaining>0?'Anlaufschutz: '+duration(r.graceRemaining):'Risiko '+r.riskLabel,backupAge:r.backupAge===null?'Noch keines':duration(r.backupAge),protectedResearch:dec(r.backupProtectedResearch),backupJobs:fmt(r.backupJobCount),backupCooldown:r.backupCooldown>0?duration(r.backupCooldown):'Jetzt möglich',parts:fmt(r.parts),repairSpent:fmt(r.spent),repairBudget:fmt(r.budget),reserve:fmt(r.reserve),operationEta:r.operation?duration(r.operation.remaining):'',operationPercent:r.operation?fmt((1-r.operation.remaining/r.operation.total)*100)+' %':'',systemStatus:r.safetyMode?'SCHUTZMODUS':!r.online?'NETZWERK OFFLINE':r.failed?'BETRIEB EINGESCHRÄNKT':r.repairing||facility.operation?'WARTUNG AKTIV':limited?'KAPAZITÄT BEGRENZT':'SYSTEM ONLINE',achievementCount:achievements.length,achievementReward:fmt(achievements.reduce((sum,x)=>sum+x.reward,0)),activeAgentCount:state.agents.length-a.agents.filter(x=>x.assignment).length});
    $$('[data-stat]').forEach(el=>{const raw=String(values[el.dataset.stat]??''),v=el.dataset.stat==='name'?raw:tr(raw);if(el.textContent!==v)el.textContent=v;if(el.classList.contains('nav-count'))el.hidden=v==='0';});
    $$('[data-system-tag]').forEach(el=>{el.classList.toggle('red',r.safetyMode||!r.online);el.classList.toggle('amber',!r.safetyMode&&r.online>0&&(r.failed>0||r.repairing>0||limited));});
    $$('[data-operation-progress]').forEach(el=>{if(r.operation)el.style.width=Math.min(100,(1-r.operation.remaining/r.operation.total)*100)+'%';});
    const conditionRows=new Map(r.servers.map(server=>[server.id,server]));
    $$('[data-condition-label]').forEach(el=>{const server=conditionRows.get(el.dataset.conditionLabel);if(server)el.textContent=dec(server.condition)+' %';});
    $$('[data-condition-bar]').forEach(el=>{const server=conditionRows.get(el.dataset.conditionBar);if(!server)return;el.style.width=server.condition+'%';el.classList.toggle('danger',server.condition<50);el.classList.toggle('amber',server.condition>=50&&server.condition<80);});
    $$('[data-safety]').forEach(b=>{
      const action=b.dataset.action||b.dataset.actionQuote;
      const o=action==='createBackup'?r.backup:action==='buyParts'?r.partsPurchase:action==='resolveIncident'?r.incident?.choices.find(x=>x.key===b.dataset.choice):r.servers.find(x=>x.id===b.dataset.id)?.repairs.find(x=>x.key===b.dataset.method);
      b.disabled=!o?.enabled;b.title=o?.reason||'';
      const card=b.closest('.protection-option');
      if(o&&card){const description=$('[data-option-description]',card),cost=$('[data-option-cost]',card),reason=$('[data-option-reason]',card);if(description)description.textContent=o.description;if(cost)cost.textContent=optionSummary(o);if(reason)reason.textContent=o.reason;}
    });
    a.agents.forEach(agent=>{
      $$(`[data-agent-status="${agent.id}"]`).forEach(el=>{el.textContent=agent.assignment?agent.assignment.label+' · '+(r.safetyMode?'pausiert':duration(agent.assignment.remaining)):agent.cooldown>0?'Nächster Sondereinsatz in '+duration(agent.cooldown):'Für Sondereinsatz verfügbar';});
      $$(`[data-agent-progress="${agent.id}"]`).forEach(el=>{if(agent.assignment)el.style.width=(1-agent.assignment.remaining/agent.assignment.total)*100+'%';});
      $$(`[data-change="agent-focus"][data-id="${agent.id}"]`).forEach(el=>{el.disabled=!!agent.assignment;});
    });
    $$('[data-mission]').forEach(b=>{const o=a.agents.find(x=>x.id===b.dataset.id)?.options.find(x=>x.key===b.dataset.mission);b.disabled=!o?.enabled;b.title=o?.reason||'';const reason=b.closest('.mission-option')?.querySelector('[data-mission-reason]');if(reason)reason.textContent=o?.reason||'';});
    $$('[data-effect]').forEach(el=>{const effect=a.effects.find(x=>x.kind===el.dataset.effect);el.textContent=effect?duration(effect.remaining):'';});
    const chartTime=state.history.at(-1)?.time??-1;
    if(chartTime!==lastChartTime){
      $$('[data-sparkline]').forEach(el=>$('polyline',el)?.setAttribute('points',sparklinePoints(el.dataset.sparkline)));
      lastChartTime=chartTime;
    }
    state.jobs.forEach(j=>{
      const p=Math.min(100,j.work/j.totalWork*100);
      $$(`[data-job-progress="${j.id}"]`).forEach(bar=>bar.style.width=p+'%');
      $$(`[data-job-percent="${j.id}"]`).forEach(percent=>percent.textContent=tr(fmt(p)+' % erledigt'));
      const text=m.jobRates?.[j.id]>0?'Noch '+duration((j.totalWork-j.work)/m.jobRates[j.id])+(m.jobBlockedReasons?.[j.id]?' · '+m.jobBlockedReasons[j.id]:''):r.safetyMode?'Schutzmodus · pausiert':m.jobBlockedReasons?.[j.id]||(!r.online?'Keine Server verfügbar':'Wartet auf Agenten');
      $$(`[data-job-eta="${j.id}"]`).forEach(eta=>eta.textContent=tr(text));
    });
    $$('[data-cost-kind]').forEach(b=>{const price=E.cost(state,b.dataset.costKind,b.dataset.costId);const balance=b.dataset.costKind==='research'?state.research:state.credits;const limit=b.dataset.costKind==='server'?state.servers.length>=m.serverLimit:b.dataset.costKind==='agent'?state.agents.length>=m.agentLimit:false;b.disabled=balance<price||limit||!Number.isFinite(price);b.title=limit?'Alle Plätze belegt – erschließe einen neuen Sektor.':balance<price?`Noch ${fmt(Math.ceil(price-balance))} ${b.dataset.costKind==='research'?'FP':'CR'} nötig`:'';});
    $$('[data-action="upgradeServer"]').forEach(b=>{if(serverRows.get(b.dataset.id)?.status!=='online'){b.disabled=true;b.title='Dieser Knoten muss zuerst wieder verfügbar sein.';}});
    $$('[data-action="upgradeAgent"]').forEach(b=>{if(a.agents.find(x=>x.id===b.dataset.id)?.assignment){b.disabled=true;b.title='Der Agent ist im Sondereinsatz.';}});
    $$('[data-action="acceptJob"]').forEach(b=>{const j=state.offers.find(j=>j.id===b.dataset.id);b.disabled=!j||state.jobs.length>=m.jobLimit||m.usedCapacity+(j?.load||0)>m.capacity*1.08||(j?.kind==='ai'&&(j.gpuDemand||1)>(m.gpuCapacity||0)-(m.gpuUsed||0)+1e-9);b.title=b.disabled?(j?.kind==='ai'&&(j.gpuDemand||1)>(m.gpuCapacity||0)-(m.gpuUsed||0)+1e-9?'Nicht genügend freie GPU-Kapazität. Prüfe KI-Server, Uplink, Strom und Kühlung.':'Mehr freie Auftragsplätze oder Serverkapazität nötig.'):'';});
    $$('[data-action="claimAchievement"]').forEach(b=>{const a=E.catalog.achievements.find(a=>a.id===b.dataset.id);b.disabled=!a||!!state.achievements[b.dataset.id]||!(state.achievementUnlocks?.[a.id]||a.check(state));});
    $$('[data-action="expandSector"]').forEach(b=>{b.disabled=!m.expansionReady;});
    R.updateLive(facility);
    if(view==='overview'||Room.isInRoom())Room.update({state,metrics:m,model:facility,resilience:r,operations:a});
  }
  function navigate(next) { if(!viewFunctions[next])return;if(Room.isInRoom()){view=next;closeModal();document.activeElement?.blur();Room.openConsole(navs.find(n=>n[0]===view)[2]);render();return;}Room.hide();view=next;hideMobile();closeModal();document.activeElement?.blur();render();window.scrollTo(0,0); }
  function hideMobile() { $('.sidebar')?.classList.remove('open');$('.mobile-overlay')?.classList.remove('open'); }
  function shop(type) {
    if(type==='servers')return R.shop();
    const server=type==='servers', items=server?E.catalog.servers:E.catalog.roles;
    return `<p class="modal-intro">${server?'Jeder Knoten liefert Grundversorgung und Rechenkapazität. Wähle die passende Architektur für dein Netzwerk.':'Agenten arbeiten autonom an deinen Aufträgen. Jede Rolle bringt einen eigenen Vorteil ins Netzwerk.'}</p><div class="shop-grid">${Object.entries(items).map(([id,item])=>`<div class="shop-card"><span class="server-icon">${icon(server?(id==='compute'?'cpu':id==='storage'?'storage':'server'):'agents')}</span><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="shop-spec">${server?`${item.capacity} CU Basiskapazität<br>${dec(item.power)} kW Grundverbrauch`:'Stufe 1 · Autonom aktiv<br>Schwerpunkt frei wählbar'}</div>${actionButton(server?'buyServer':'recruitAgent',`${icon('plus')}${fmt(E.cost(state,server?'server':'agent',id))} CR`,server?{type:id}:{role:id},'primary',server?'server':'agent',id)}</div>`).join('')}</div><div class="modal-bottom"><span>${server?state.servers.length:state.agents.length} / ${server?E.getMetrics(state).serverLimit:E.getMetrics(state).agentLimit} Plätze belegt</span><span>Budget: <strong class="positive">${stat('credits')} CR</strong></span></div>`;
  }
  function sectorModal() {
    const m=E.getMetrics(state), goal=Math.min(m.serverLimit,2+state.sector), goalJobs=state.sector*3;
    return `<p class="modal-intro">Erschließe Sektor ${state.sector+1}. Dein bestehendes Netzwerk bleibt vollständig erhalten. Neue Verträge wachsen mit deinem Sektor; die nächsten Ausbauschritte werden anspruchsvoller.</p><div class="breakdown"><div class="status-row"><span>Server im Betrieb</span><strong class="${state.servers.length>=goal?'positive':''}">${state.servers.length} / ${goal}</strong></div><div class="status-row"><span>Aufträge insgesamt abgeschlossen</span><strong class="${state.counters.jobs>=goalJobs?'positive':''}">${state.counters.jobs} / ${goalJobs}</strong></div><div class="status-row"><span>Erschließungskosten</span><strong>${fmt(m.sectorCost)} CR</strong></div><div class="status-row"><span>Danach: Server / Agenten</span><strong>${E.getFacilityLayout({...state,sector:state.sector+1}).serverLimit} / ${Math.min(12,3+(state.sector+1)*2)} Plätze</strong></div></div>${actionButton('expandSector',`${icon('expand')}Sektor ${state.sector+1} erschließen · ${fmt(m.sectorCost)} CR`,{},'primary block')}<p class="policy-explainer">Auch nach dem Ausbau aller Plätze kannst du dein Netzwerk über Stufen, Forschung und weitere Sektoren weiterentwickeln.</p>`;
  }
  function helpModal() {
    const help=[['globe','Begehe deinen Serverraum','Raum betreten öffnet die Ego-Ansicht. WASD bewegt dich, Maus oder Pfeiltasten links/rechts drehen den Blick. Am Rack öffnet E zuerst die Tür und danach die freiliegende Hardware. E an der Tür schließt sie. Raumtüren lassen sich von beiden Seiten bedienen und schließen nach dem Durchgehen. Escape führt zurück. Ohne Mausbindung halte die Maustaste zum Umsehen gedrückt. Die Geräte-Liste führt auch direkt zu jedem Server. Die Monitore an den Leitständen und die Konsole öffnen alle Verwaltungsbereiche direkt im Raum. Escape schließt zuerst den Dialog, dann die Konsole; Weboberfläche beendet den Rundgang.'],['server','1. Plane dein Rechenzentrum','Server belegen echte Höheneinheiten in deinen Racks. Wähle Geräte, Ports, Kühlung und Stromversorgung direkt im Rechenzentrum aus. Ein freier Einbauplatz öffnet die passende Hardwareauswahl.'],['agents','2. Gib Agenten einen Schwerpunkt','Agenten teilen ihre Leistung auf deine laufenden Aufträge auf. Rolle, Stufe und Schwerpunkt verändern Durchsatz, Forschung und Pflege.'],['jobs','3. Wähle passende Aufträge','Aufträge bringen Credits, Forschung und Ansehen. Die Vergütung kommt beim Abschluss. Grundversorgung und Forschung laufen zusätzlich stetig weiter.'],['automation','4. Lass die Routine laufen','Aktiviere die automatische Vergabe. Sie nimmt passende Angebote an und beachtet deine Priorität. So arbeitet das Netzwerk auch während deiner Abwesenheit.'],['research','5. Investiere in Entwicklung','Forschung verbessert die ganze Flotte. Meilensteine geben zusätzliche Credits. Neue Sektoren öffnen anspruchsvollere Aufträge und anfangs mehr Plätze.'],['shield','6. Schütze deinen Betrieb','Verschleiß und Hitze können Server ausfallen lassen. Reparaturen kosten Zeit und Ressourcen. Betriebsbackups sichern Forschung und laufende Arbeit; große Krisen warten im Schutzmodus auf dich.'],['agents','7. Plane gezielte Einsätze','Diagnose und Optimierung helfen dem ganzen Netz. Forschung liefert Punkte nach Abschluss. Währenddessen fehlt der Agent im Normalbetrieb; anschließend gilt eine Erholungszeit.'],['globe','8. Beachte die Verbindungen','Abgeschaltete Server und getrennte Switch-Ports liefern keine Kapazität. Ein Neustart oder Umsetzen dauert 30 Sekunden. Rack-Umbauten legen das betroffene Rack für 45–90 Sekunden still. Strom, Kühlung und Uplink begrenzen den Durchsatz; die Anzeigen zeigen dir die Engpässe.'],['cpu','KI braucht eigene Hardware','Der A480 belegt 4 HE und liefert vier GPUs mit 320 GB VRAM. Inferenz- und Trainingsaufträge brauchen freie GPU-Kapazität zusätzlich zu CU. Ausfälle, Porttrennung, Strom-, Kühlungs- und Uplink-Engpässe begrenzen diese Leistung. Ein stärkerer KI-Auftrag bindet mehr GPUs und bringt entsprechend mehr Arbeit, Vergütung und Forschung.'],['inbox','9. Komm in deinem Tempo zurück','Ereignisse warten ohne Zeitlimit. Bis zu 12 Stunden Fortschritt werden nachgeholt. ROOT speichert regelmäßig lokal; Export sichert einen Stand zusätzlich.']];
    return `<p class="modal-intro">ROOT ist deine eigene Netzwerk-Leitstelle. Es gibt keinen Zeitdruck: Gute Entscheidungen, ein durchdachter Ausbau und passende Regeln bringen dich weiter.</p><div class="help-grid">${help.map(([i,t,d])=>`<div class="help-item">${icon(i)}<h3>${t}</h3><p>${d}</p></div>`).join('')}</div><p class="keyboard-hint">TASTATUR · 1–9: Bereiche wechseln · ?: Hilfe · Escape: Schließen</p>`;
  }
  function settingsModal() {
    return `<div class="settings-row"><h3>Sprache / Language</h3><p>Weboberfläche und Raumkonsole</p><label class="field-label" for="root-language">Sprache / Language</label><select class="select" id="root-language" data-change="language"><option value="de" ${I18N.getLanguage()==='de'?'selected':''}>Deutsch</option><option value="en" ${I18N.getLanguage()==='en'?'selected':''}>English</option></select></div><div class="settings-row"><h3>Dein Netzwerk</h3><p>Ein eigener Name für deine Leitstelle.</p><form id="rename-form" class="input-row"><input class="input" id="network-name" aria-label="Netzwerkname" maxlength="36" minlength="2" required value="${esc(state.networkName)}"><button class="button" type="submit">Speichern</button></form></div><div class="settings-row"><h3>Netzwerkstand & Sicherung</h3><p>Automatisches Speichern alle 15 Sekunden und nach jeder Entscheidung. Die lokale Datei liegt im ROOT-Ordner unter data/save.json. Ein Export enthält deinen vollständigen Fortschritt. Das Betriebsbackup unter „Betrieb & Schutz“ schützt dagegen gezielt vor Datenkorruption im Netzwerk.</p><div class="settings-actions"><button class="button" data-command="export">${icon('download')}Sicherung exportieren</button><button class="button ghost" data-command="import">${icon('upload')}Sicherung importieren</button><button class="button ghost" data-command="save">${icon('check')}Jetzt speichern</button></div></div><div class="settings-row"><h3>Zugang zum Cyberbunker</h3><p>Eine kurze Kamerafahrt führt von außen durch die Sicherheitsschleusen. Sie läuft beim ersten Start pro Browser-Tab. Nach F5 bleibt dein letzter Standort erhalten. Reduzierte Animationen werden berücksichtigt.</p><label class="field-label"><input type="checkbox" data-change="arrival" ${storageGet('root.arrival.enabled')!=='0'?'checked':''}> Einfahrt beim Start anzeigen</label><button class="button ghost" data-command="replay-arrival">Einfahrt ansehen</button></div><div class="settings-row"><h3>Neues Netzwerk</h3>${storageGet('root.conflict.save')?'<button class="button ghost" data-command="export-conflict">Abweichende Browserkopie exportieren</button>':''}<p>Beginne mit einer neuen Ausgangslage. Dein bisheriger Stand wird vorher automatisch als Datei exportiert.</p><button class="button danger" data-modal="reset">${icon('refresh')}Neu anfangen</button></div><div class="settings-row"><h3>ROOT · Version 1.4</h3><p>Deine lokale Netzwerk-Leitstelle. Alle Server und Agenten sind Teil der Simulation. Fortschritt während der Abwesenheit: maximal 12 Stunden. Beende zum Schließen einfach den Browser-Tab.</p></div>`;
  }
  function openModal(type, extra) {
    if(!modal)lastFocus=document.activeElement;
    modal={type,extra};
    const titles={servers:'Dein Netzwerk erweitern',agents:'Dein Team erweitern',sector:'Nächsten Sektor erschließen',help:'Willkommen bei ROOT',settings:'Einstellungen',offline:'Dein Netzwerk war fleißig',reset:'Ein neues Netzwerk beginnen',import:'Sicherung wiederherstellen',repair:'Reparatur planen','incident-confirm':'Folgen deiner Entscheidung','agent-task':'Agent gezielt einsetzen','hardware-shop':'Hardware einbauen','hardware-move':'Umsetzen / Umpatchen','hardware-confirm':'Infrastruktur ändern'};
    let content='';
    if(type==='servers'||type==='agents')content=shop(type);
    else if(type.startsWith('hardware-'))content=R.modal(type,extra);
    else if(type==='sector')content=sectorModal();
    else if(type==='repair')content=repairModal(extra);
    else if(type==='incident-confirm')content=incidentConfirm(extra);
    else if(type==='agent-task')content=agentTaskModal(extra);
    else if(type==='help')content=helpModal();
    else if(type==='settings')content=settingsModal();
    else if(type==='offline') {const r=extra;content=`<span class="tag green">${icon('automation')}AUTONOMER BETRIEB</span><div class="offline-title">Willkommen zurück.</div><p class="modal-intro">Während deiner Abwesenheit hat ROOT ${duration(r.seconds)} weitergearbeitet.${r.capped?' Berücksichtigt wurden maximal 12 Stunden.':''}</p><div class="offline-grid"><div class="offline-stat"><strong>+${compact(r.credits)}</strong><span>Credits erwirtschaftet</span></div><div class="offline-stat"><strong>+${compact(r.research)}</strong><span>Forschungspunkte</span></div><div class="offline-stat"><strong>${fmt(r.jobsCompleted)}</strong><span>Aufträge abgeschlossen</span></div></div>${E.getResilience(state).incident?`<div class="modal-alert">${esc(E.getResilience(state).incident.title)}: Das Netz wartet im Schutzmodus. Weitere Schäden sind gestoppt.</div><button class="button primary block" data-nav="resilience">Vorfall ansehen${icon('arrow')}</button>`:''}<button class="button ${E.getResilience(state).incident?'ghost':'primary'} block" data-command="close">Zur Leitstelle${icon('arrow')}</button>`;}
    else if(type==='reset')content=`<p class="modal-intro">Du startest mit 800 Credits, einem Server und zwei Agenten. Vorher wird dein bisheriger Netzwerkstand als JSON-Datei exportiert. Über „Importieren“ kannst du jederzeit zu ihm zurückkehren.</p><button class="button danger block" data-command="reset-confirm">${icon('refresh')}Stand exportieren & neu beginnen</button>`;
    else if(type==='import')content=`<p class="modal-intro">Der Netzwerkstand wurde geprüft. Wiederherstellen ersetzt den aktuellen Fortschritt. Dieser wird zuvor als Datei exportiert.</p><div class="breakdown"><div class="status-row"><span>Netzwerk</span><strong>${esc(importing.networkName)}</strong></div><div class="status-row"><span>Sektor / Server / Agenten</span><strong>${importing.sector} / ${importing.servers.length} / ${importing.agents.length}</strong></div><div class="status-row"><span>Credits</span><strong>${fmt(importing.credits)} CR</strong></div></div><button class="button primary block" data-command="import-confirm">${icon('upload')}Sicherung wiederherstellen</button>`;
    $('#modal-root').innerHTML=`<div class="modal-backdrop" data-backdrop="true"><section class="modal ${['servers','agents','repair','agent-task','hardware-shop','hardware-move'].includes(type)?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-header"><h2 id="modal-title">${titles[type]||'ROOT'}</h2><button class="icon-button" data-command="close" aria-label="Dialog schließen">${icon('cross')}</button></div><div class="modal-body">${content}</div></section></div>`;
    window.ROOTI18N?.localize?.($('#modal-root'));
    $('#app').inert=true;document.body.style.overflow='hidden';updateLive();$('.modal').focus();
  }
  function closeModal(){if(!modal)return;modal=null;$('#modal-root').innerHTML='';$('#app').inert=false;document.body.style.overflow='';if(lastFocus?.isConnected)lastFocus.focus();if(view==='overview'&&!Room.isInRoom())Room.startArrival();}
  function toast(message,error=false,target=''){clearTimeout(toastTimer);$('#toast-root').innerHTML=`<div class="toast ${error?'error':''}">${icon(error?'help':target?'trophy':'check')}<span>${esc(message)}</span>${target?`<button class="button small" data-nav="${target}">Ansehen${icon('arrow')}</button>`:''}</div>`;toastTimer=setTimeout(()=>{$('#toast-root').innerHTML='';},target?8000:4200);}
  function simulate(now=Date.now()) {
    if(saveConflict)return null;
    const elapsed=Math.max(0,(now-lastTick)/1000);lastTick=now;
    if(elapsed<=0)return null;
    const report=E.advance(state,elapsed);state.savedAt=now;
    return {...report,capped:elapsed>43200};
  }
  function tick() {
    if(!initialized||document.hidden)return;
    const report=simulate();
    if(stateSignature()!==signature||renderPending)render();else updateLive();
    announceAchievements();
    if(Date.now()-lastSave>15000)save();
    if(report?.seconds>90&&!modal)openModal('offline',report);
  }
  async function save(exit=false) {
    if(!state||!initialized)return {status:'idle',persisted:false};
    if(saveConflict)return {status:'conflict',persisted:false};
    state.savedAt=lastTick;lastSave=Date.now();
    const snapshot=JSON.stringify(state), localOkay=storageSet(STORAGE,snapshot);
    if(location.protocol==='file:'){saveMode=localOkay?'fallback':'error';updateLive();return {status:saveMode,persisted:false};}
    if(remoteRevision===null){
      storageSet('root.server.unverified','1');
      saveMode=localOkay?'fallback':'error';diskAvailable=false;
      const warning=localOkay?'Der lokale Dienst wurde noch nicht bestätigt. Dein Stand liegt nur im Browser; ROOT sendet ihn erst nach einem erfolgreichen Laden des Serverstands.':'Der Netzwerkstand konnte nicht bestätigt oder lokal gespeichert werden. Exportiere ihn aus den Einstellungen.';
      if(saveError!==warning){saveError=warning;render();}
      updateLive();return {status:'unverified',persisted:false};
    }
    savePending={body:snapshot,localOkay,exit};
    if(saveBusy)return saveDrainPromise;
    saveBusy=true;
    saveDrainPromise=(async()=>{
      let result={status:'idle',persisted:false};
      while(savePending){
        const pending=savePending;savePending=null;saveMode='saving';updateLive();
        try{
          const headers={'Content-Type':'application/json','X-Root-Revision':remoteRevision};
          const response=await fetch('/api/save',{method:'POST',headers,body:pending.body,keepalive:pending.exit&&new Blob([pending.body]).size<60000,signal:AbortSignal.timeout(8000)});
          if(response.status===409){
            const rejected=await response.json();
            if(rejected.conflict||rejected.updateRequired){
              state.savedAt=lastTick;
              const latest=JSON.stringify(state);
              saveConflict=true;saveMode='error';savePending=null;
              storageSet(STORAGE,latest);
              storageSet('root.conflict.save',latest);storageSet('root.save.conflict','1');
              saveError=rejected.conflict?'Eine andere Browser-Sitzung hat einen neueren Stand gespeichert. Diese Sitzung pausiert. Lade die Seite neu; deine abweichende Kopie bleibt in den Einstellungen exportierbar.':'Diese Oberfläche ist veraltet. Lade die Seite neu, bevor du fortfährst.';
              if(Room.isInRoom())navigate('overview');else render();
              result={status:'conflict',persisted:false};break;
            }
          }
          if(!response.ok)throw new Error(`HTTP ${response.status}`);
          const saved=await response.json();if(!saved.ok)throw new Error('Speichern abgelehnt');
          remoteRevision=saved.revision||response.headers.get('X-Root-Revision')||remoteRevision;
          if(remoteRevision)storageSet('root.server.revision',remoteRevision);
          storageSet('root.server.unverified','0');storageSet('root.save.conflict','0');saveMode='ready';diskAvailable=true;
          if(saveError){saveError='';render();}
          result={status:'ready',persisted:true};
        }catch(error){
          saveMode=pending.localOkay?'fallback':'error';diskAvailable=false;
          const warning=pending.localOkay?'Der lokale Dienst ist nicht erreichbar. Dein aktueller Stand ist im Browser gesichert. Starte ROOT über den Desktop-Starter, um wieder in die lokale Sicherungsdatei zu speichern.':'Der Netzwerkstand konnte nicht gespeichert werden. Exportiere ihn in den Einstellungen und starte ROOT über den Desktop-Starter.';
          if(saveError!==warning){saveError=warning;render();}
          // Keep a newer snapshot queued while this request was in flight. The
          // loop gives that snapshot its own attempt with the still-current
          // revision; with no newer save, this failure ends the drain.
          result={status:saveMode,persisted:false};
        }
      }
      saveBusy=false;updateLive();return result;
    })();
    return saveDrainPromise;
  }
  function execute(action,payload) {
    if(saveConflict){toast('Diese Sitzung pausiert. Bitte Seite neu laden.',true);return;}
    simulate();const result=E.act(state,action,payload);
    if(!result.ok){toast(result.message,true);updateLive();return;}
    render();
    if(modal){if(modal.type.startsWith('hardware-'))closeModal();else if(action==='buyServer'||action==='recruitAgent')openModal(modal.type,modal.extra);else if(['expandSector','renameNetwork','repairServer','resolveIncident','dispatchAgent'].includes(action))closeModal();}
    save();toast(result.message);announceAchievements();
  }
  function exportSave() {
    simulate();const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ROOT-Sektor-${state.sector}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function replaceState(next){
    if(saveConflict){toast('Diese Sitzung pausiert. Lade zuerst den aktuellen Serverstand neu.',true);return false;}
    exportSave();
    state=next;seenAchievements=new Set();state.savedAt=Date.now();lastTick=state.savedAt;hideGuide=false;storageSet('root.guide.hidden','0');signature='';closeModal();view='overview';render();
    const outcome=await save();
    if(outcome?.persisted){toast('Dein Netzwerk ist bereit.');announceAchievements();return true;}
    if(outcome?.status==='conflict')return false;
    toast('Der Stand ist nur im Browser gesichert. Der Server hat die Änderung noch nicht bestätigt.',true);
    return false;
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('button,[data-nav],[data-modal],[data-command],[data-rack-command]');
    if(!target){if(event.target.dataset.backdrop)closeModal();return;}
    if(target.disabled)return;
    const hardware=R.click(target);
    if(hardware){if(hardware.modal)openModal(hardware.modal,hardware.extra);else if(hardware.action)execute(hardware.action,hardware.payload);else if(hardware.render)render();return;}
    if(target.dataset.facilityVisit){const destination=target.dataset.facilityVisit;if(Room.isInRoom()){Room.closeConsole();Room.changeLocation(destination);}else{navigate('overview');Room.changeLocation(destination);}return;}
    if(target.dataset.nav)return navigate(target.dataset.nav);
    if(target.dataset.modal)return openModal(target.dataset.modal,target.dataset.modal==='incident-confirm'?target.dataset.choice:target.dataset.id);
    if(target.dataset.filter){logFilter=target.dataset.filter;render();return;}
    if(target.dataset.action){const p={};for(const key of ['id','type','role','key','value','choice','method','mission'])if(target.dataset[key]!==undefined)p[key]=target.dataset[key];if(p.key==='autocontract'||p.key==='autorepair'||p.key==='autobackup')p.value=p.value==='true';return execute(target.dataset.action,p);}
    const command=target.dataset.command;
    if(command==='replay-arrival'){closeModal();navigate('overview');Room.startArrival(true);return;}
    if(command==='close')closeModal();
    if(command==='menu'){$('.sidebar').classList.toggle('open');$('.mobile-overlay').classList.toggle('open');}
    if(command==='menu-close')hideMobile();
    if(command==='hide-guide'){hideGuide=true;storageSet('root.guide.hidden','1');render();}
    if(command==='export'){exportSave();toast('Netzwerkstand als Datei exportiert.');}
    if(command==='export-conflict'){const body=storageGet('root.conflict.save');if(body){const url=URL.createObjectURL(new Blob([body],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='ROOT-abweichende-Browserkopie.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}return;}
    if(command==='reload'){location.reload();return;}
    if(command==='import')$('#import-file').click();
    if(command==='save'){simulate();save().then(result=>{if(result?.persisted)toast('Netzwerkstand gespeichert.');else if(result?.status==='conflict')toast('Diese Sitzung pausiert. Bitte lade den Serverstand neu.',true);else toast('Stand nur im Browser gesichert; Serverbestätigung fehlt.',true);});}
    if(command==='reset-confirm')replaceState(E.createState(Math.floor(Math.random()*0xffffffff)));
    if(command==='import-confirm'&&importing){if(saveConflict){toast('Diese Sitzung pausiert. Lade zuerst den aktuellen Serverstand neu.',true);return;}const next=importing;importing=null;replaceState(next);}
  });
  document.addEventListener('change',event=>{
    if(event.target.dataset.change==='arrival'){storageSet('root.arrival.enabled',event.target.checked?'1':'0');return;}
    if(event.target.dataset.change==='language'){I18N.setLanguage(event.target.value);Room.update();render();return;}
    const el=event.target,hardware=R.change(el);if(hardware){if(hardware.render){event.target.blur();render();}if(hardware.refreshModal&&modal)openModal(modal.type,modal.extra);return;}if(el.dataset.change==='server-mode')execute('setServerMode',{id:el.dataset.id,mode:el.value});
    if(el.dataset.change==='agent-focus')execute('setAgentFocus',{id:el.dataset.id,focus:el.value});
    if(el.dataset.change==='protection-policy')execute('setPolicy',{key:el.dataset.key,value:Number(el.value)});
  });
  document.addEventListener('focusout',()=>{if(renderPending)setTimeout(()=>{if(renderPending)render();},0);});
  document.addEventListener('submit',event=>{if(event.target.id==='rename-form'){event.preventDefault();execute('renameNetwork',{name:$('#network-name').value});}});
  document.addEventListener('keydown',event=>{
    if(!modal&&(Room.isExploring()||Room.isArriving()||(Room.isConsoleOpen()&&event.key==='Escape')))return;
    if(event.key==='Escape'){closeModal();hideMobile();event.preventDefault();event.stopImmediatePropagation();return;}
    if(modal&&event.key==='Tab'){
      const focusables=$$('button:not(:disabled),input,select,[tabindex="0"]',$('.modal'));
      const first=focusables[0],last=focusables.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===$('.modal'))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===$('.modal'))){event.preventDefault();first?.focus();}
      return;
    }
    if(/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.key==='?'&&!modal)openModal('help');
    if(!modal&&/^[1-9]$/.test(event.key))navigate(navs[Number(event.key)-1][0]);
    if((event.key==='Enter'||event.key===' ')&&document.activeElement?.classList.contains('topology-node')){event.preventDefault();document.activeElement.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
  });
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    if(file.size>16*1024*1024){toast('Der Netzwerkstand ist zu groß. Maximal 16 MiB.',true);return;}
    try{importing=E.normalizeState(JSON.parse(await file.text()));openModal('import');}catch(error){toast('Ungültiger Netzwerkstand: '+error.message,true);}
  });
  document.addEventListener('visibilitychange',()=>{
    if(!initialized)return;
    const report=simulate();
    if(document.hidden)save(true);else{render();save();if(report?.seconds>90)openModal('offline',report);}
  });
  window.addEventListener('pagehide',()=>{if(initialized){simulate();save(true);}});
  window.addEventListener('pageshow',event=>{if(event.persisted&&initialized){simulate();render();save();}});

  async function boot(){
    if(!E)throw new Error('Der Simulationskern fehlt. Bitte starte ROOT aus dem vollständigen ROOT-Ordner.');
    let localState=null,remoteState=null,remoteInvalid=false,localVersion=null,remoteRead=false;
    const stored=storageGet(STORAGE);
    const priorRevision=storageGet('root.server.revision');
    if(stored){try{const raw=JSON.parse(stored);localVersion=raw.version;localState=E.normalizeState(raw);}catch{saveError='Die Browserkopie war beschädigt. ROOT versucht, deinen lokalen Netzwerkstand zu laden.';}}
    if(location.protocol!=='file:'){
      try{
        const response=await fetch('/api/save',{cache:'no-store',signal:AbortSignal.timeout(6000)});
        if(!response.ok){remoteInvalid=response.status===500;throw new Error('Netzwerkstanddienst nicht verfügbar');}
        remoteRevision=response.headers.get('X-Root-Revision');
        const result=await response.json();if(result.save)remoteState=E.normalizeState(result.save);
        remoteRead=remoteRevision!==null;diskAvailable=remoteRead;
        if(remoteRead)storageSet('root.server.revision',remoteRevision);
        else storageSet('root.server.unverified','1');
      }catch{diskAvailable=false;remoteRevision=null;storageSet('root.server.unverified','1');}
    }else diskAvailable=false;
    if(remoteInvalid&&!localState){
      $('#app').innerHTML=`<div class="boot"><div class="boot-logo">root<span class="brand-dot">.</span></div><p>Die lokale Sicherungsdatei und ihre Sicherung konnten nicht gelesen werden.</p><p>Deine Dateien bleiben erhalten. Prüfe data/save.json und data/save.backup.json im ROOT-Ordner.</p><p>Nach dem Wiederherstellen einer Sicherung kannst du diese Seite neu laden.</p><button class="button">Neu laden</button></div>`;
      $('button').addEventListener('click',()=>location.reload());return;
    }
    const unverifiedLocal=location.protocol!=='file:'&&storageGet('root.server.unverified')==='1';
    const conflicting=Boolean(stored&&(unverifiedLocal||storageGet('root.save.conflict')==='1'||remoteRead&&(!priorRevision||priorRevision!==remoteRevision)));
    if(conflicting)storageSet('root.conflict.save',stored);
    const emptyServerAfterConflict=remoteRead&&remoteRevision==='empty'&&conflicting&&Boolean(stored);
    state=remoteState&&(Number(localVersion)<3||conflicting)?remoteState:emptyServerAfterConflict?E.createState(Math.floor(Math.random()*0xffffffff)):localState&&(!remoteState||localState.savedAt>remoteState.savedAt)?localState:remoteState||E.createState(Math.floor(Math.random()*0xffffffff));
    if(!diskAvailable)saveError='ROOT verwendet die Browserkopie. Öffne ROOT über „ROOT starten“, damit dein Fortschritt zusätzlich in der lokalen Sicherungsdatei gespeichert wird.';
    else saveError='';
    lastTick=Math.min(Date.now(),state.savedAt);const report=simulate();initialized=true;hideGuide=storageGet('root.guide.hidden')==='1';shell();
    if(emptyServerAfterConflict)toast('Der Server ist leer. Die abweichende Browserkopie wurde separat gesichert und kann aus den Einstellungen exportiert oder importiert werden.',true);
    else if(conflicting&&remoteState)toast('Der aktuelle Serverstand wurde geladen. Deine abweichende Browserkopie kann aus den Einstellungen exportiert werden.',true);
    save();
    if(report&&report.seconds>=60)openModal('offline',report);
    announceAchievements();
    setInterval(tick,1000);
  }
  async function start(){
    try{
      if(navigator.locks&&location.protocol!=='file:'){
        await navigator.locks.request('root-active-session',{ifAvailable:true},async lock=>{
          if(!lock){$('#app').innerHTML=`<div class="boot"><div class="boot-logo">root<span class="brand-dot">.</span></div><p>Dein Netzwerk ist bereits in einem anderen Tab geöffnet.</p><p>Schließe den anderen ROOT-Tab und lade diese Seite neu.</p><button class="button" id="retry-boot">Erneut verbinden</button></div>`;$('#retry-boot').addEventListener('click',()=>location.reload());return;}
          await boot();await new Promise(()=>{});
        });
      }else await boot();
    }catch(error){$('#app').innerHTML=`<div class="boot"><div class="boot-logo">root<span class="brand-dot">.</span></div><p>${esc(error.message)}</p><p>Starte ROOT über „ROOT starten“ im Desktop-Ordner ROOT.</p></div>`;}
  }
  I18N?.installLocalization({getProtectedText:()=>state?[state.networkName,...state.servers.map(s=>s.name),...state.agents.map(a=>a.name),...state.facility.racks.map(r=>r.name)]:[]});
  start();
})();
