/** Research tree names, effects and funded-project feedback. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root) root.RootResearchEnglish = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (translate) {
  return {
    pairs: [
      ['Netzarchitektur', 'Network architecture'],
      ['Durchsatz und verlässliche Infrastruktur.', 'Throughput and reliable infrastructure.'],
      ['Kundenbetrieb', 'Customer operations'],
      [
        'Einrichtung, Ressourcenplanung und Kundenbindung.',
        'Setup, resource planning and customer retention.',
      ],
      ['Betriebsautomatisierung', 'Operations automation'],
      [
        'Pflege und Energie effizienter organisieren.',
        'Organize maintenance and energy more efficiently.',
      ],
      ['Wissen & KI', 'Research & AI'],
      [
        'Forschungsgrundlagen und spezialisierte KI-Dienste.',
        'Research foundations and specialized AI services.',
      ],
      ['Paketvermittlung', 'Packet switching'],
      [
        '+4 % Projektarbeit aus freier CPU-Leistung.',
        '+4% project work from available CPU capacity.',
      ],
      ['Thermische Telemetrie', 'Thermal telemetry'],
      [
        '5 % geringeres Störungsrisiko. Physische Kühlung bleibt erforderlich.',
        '5% lower incident risk. Physical cooling is still required.',
      ],
      ['Lastverteilung', 'Load balancing'],
      [
        '+8 % Projektarbeit aus freien Ressourcen. Erzeugt keine Hardwarekapazität.',
        '+8% project work from available resources. Does not add hardware capacity.',
      ],
      ['Failover-Verfahren', 'Failover procedures'],
      [
        '5 % weniger Hardwareverschleiß durch geordnete Betriebswechsel.',
        '5% less hardware wear from orderly operating mode changes.',
      ],
      ['Service Desk', 'Service Desk'],
      [
        'Agenten erledigen Einrichtung und Kundenbetreuung 10 % schneller.',
        'Agents set up customer services and handle customer support 10% faster.',
      ],
      ['Störungsbegleitung', 'Incident support'],
      [
        '25 % mehr Geduld vor einer Kündigung wegen Versorgungsdefiziten. Beschwerden bleiben sichtbar.',
        '25% more time before cancellation due to service deficits. Complaints remain visible.',
      ],
      ['Kapazitätsplanung', 'Capacity planning'],
      [
        'Kundendienste benötigen 5 % weniger CPU, RAM, Speicher und Netzressourcen einschließlich GPU/VRAM.',
        'Customer services use 5% less CPU, RAM, storage and network resources, including GPU/VRAM.',
      ],
      ['Account Management', 'Account management'],
      [
        'Rückgewinnung hat bei gesunder Versorgung 80 % statt 65 % Erfolgschance.',
        'Retention has an 80% success chance with healthy service, up from 65%.',
      ],
      ['Bereitstellungsabläufe', 'Provisioning workflows'],
      [
        'Agenten erledigen Einrichtung und Kundenbetreuung 5 % schneller.',
        'Agents complete setup and customer support 5% faster.',
      ],
      ['Vorausschauende Pflege', 'Predictive maintenance'],
      [
        '5 % weniger Hardwareverschleiß. Reparaturen und Ersatzteile bleiben notwendig.',
        '5% less hardware wear. Repairs and spare parts are still required.',
      ],
      ['Energiekoordination', 'Energy coordination'],
      [
        '6 % niedrigere Energiekosten. Verändert keine Strom- oder Kühlleistung.',
        '6% lower energy costs. Does not change power or cooling capacity.',
      ],
      ['Laborautomatisierung', 'Lab automation'],
      [
        '+8 % laufende Forschungspunkte. Belegte Laborzeit bleibt eine Entscheidung.',
        '+8% ongoing research points. Allocating lab time remains a choice.',
      ],
      ['Experimentelle Methodik', 'Experimental methods'],
      ['+4 % laufende Forschungspunkte.', '+4% ongoing research points.'],
      ['Wissenstransfer', 'Knowledge transfer'],
      ['+5 % laufende Forschungspunkte.', '+5% ongoing research points.'],
      ['KI-Validierungsverfahren', 'AI validation methods'],
      [
        '+8 % Belohnung für KI-Projektaufträge. Benötigt passende KI-Hardware für diese Aufträge.',
        '+8% rewards for AI project jobs. Suitable AI hardware is required for these jobs.',
      ],
      ['Produktive Modellbereitstellung', 'Production model serving'],
      [
        '+6 % Umsatz aus tatsächlich erbrachter KI-Inferenz.',
        '+6% revenue from AI inference actually delivered.',
      ],
      [
        'Plane Voraussetzungen und Laborzeit. Wirkungen werden erst nach Abschluss aktiv.',
        'Plan prerequisites and lab time. Effects become active only after completion.',
      ],
      ['Labor', 'Laboratory'],
      ['Forschung läuft', 'Research in progress'],
      ['Kein aktives Forschungsprojekt', 'No active research project'],
      ['Verbleibende Laborzeit', 'Remaining lab time'],
      ['Abbruch prüfen', 'Review cancellation'],
      [
        'Wähle einen Forschungszweig. Ein Projekt belegt das Labor und bindet 10 % des Projektdurchsatzes. Punktkosten werden beim Start bezahlt; ein Abbruch erstattet sie nicht.',
        'Choose a research branch. A project occupies the lab and uses 10% of project throughput. Research points are charged at start; cancellation does not refund them.',
      ],
      ['Fortlaufende Forschungsreihen', 'Ongoing research tracks'],
      [
        'Vorhandene Stufen bleiben aktiv. Neue Stufen benötigen ihre Grundlagen und Laborzeit.',
        'Existing levels remain active. New levels require their prerequisites and lab time.',
      ],
      ['Erforscht', 'Researched'],
      ['In Arbeit', 'In progress'],
      ['Technologie', 'Technology'],
      ['Voraussetzungen', 'Prerequisites'],
      ['Keine Vorforschung erforderlich', 'No prior research required'],
      ['Laborzeit', 'Lab time'],
      ['Dauerhaft aktiv', 'Permanently active'],
      ['Forschung prüfen', 'Review research'],
      ['FORSCHUNGSZWEIG', 'RESEARCH BRANCH'],
      [
        'Ein Abbruch gibt das Labor frei. Bezahlte Forschungspunkte und bisherige Laborzeit gehen verloren.',
        'Canceling frees the lab. Research points paid and lab time spent so far are lost.',
      ],
      ['Ohne Erstattung abbrechen', 'Cancel without refund'],
      ['Punktkosten bei Start', 'Research points due at start'],
      ['Belegte Laborzeit', 'Committed lab time'],
      [
        'Das Labor bearbeitet ein Projekt gleichzeitig. Währenddessen sinkt der Projektdurchsatz um 10 %. Ohne erreichbare Server pausiert die Laborarbeit. Ein Abbruch erstattet keine Forschungspunkte.',
        'The lab handles one project at a time. Project throughput is reduced by 10% while it is active. Lab work pauses if no servers are reachable. Cancellation does not refund research points.',
      ],
      ['Forschungsprojekt starten', 'Start research project'],
      [
        'Forschungsprojekt gestartet. Wirkung folgt nach Abschluss.',
        'Research project started. Effects take effect on completion.',
      ],
      ['Forschungsprojekt abgebrochen. Keine Erstattung.', 'Research project canceled. No refund.'],
      ['Diese Forschung ist unbekannt.', 'This research is unknown.'],
      ['Diese Technologie ist bereits erforscht.', 'This technology has already been researched.'],
      [
        'Das Labor ist durch ein Forschungsprojekt belegt.',
        'The lab is occupied by a research project.',
      ],
      [
        'Der benötigte Sektor ist noch nicht erschlossen.',
        'The required sector has not been unlocked yet.',
      ],
      [
        'Die Voraussetzungen dieses Forschungszweigs fehlen noch.',
        'This research branch still has unmet prerequisites.',
      ],
      ['Im Labor läuft kein Forschungsprojekt.', 'There is no research project in progress.'],
      ['Ungültiger Forschungsplan.', 'Invalid research plan.'],
    ],
    patterns: [
      [/^Es fehlen (.+?) Forschungspunkte.$/, '$1 more research points required.'],
      [
        /^Forschungsprojekt gestartet: (.+?).$/,
        (_, name) => `Research project started: ${translate(name, 'en')}.`,
      ],
      [
        /^Forschungsprojekt abgebrochen: (.+?). Bezahlte Forschungspunkte werden nicht erstattet.$/,
        (_, name) =>
          `Research project canceled: ${translate(name, 'en')}. Paid research points are not refunded.`,
      ],
      [/^Noch (.+?) CR nötig$/, '$1 CR required'],
    ],
  };
});
