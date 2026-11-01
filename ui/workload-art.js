/** Original inline vector schematics: no remote imagery, IDs or animation loops. */
const database =
  '<path d="M-30-24v46c0 17 60 17 60 0v-46" fill="#263c43"/><ellipse cy="-24" rx="30" ry="10" fill="#344d53"/><path d="M-30-9c0 17 60 17 60 0M-30 7c0 17 60 17 60 0" fill="none"/>';
const rack =
  '<path d="m-32-33 47-9 22 14v63l-47 9-22-14Z" fill="#263b40"/><path d="m-32-33 22 14 47-9M-10-19v63" fill="none"/><path d="m-25-19 9 5m-9 6 9 5m-9 6 9 5m-9 6 9 5M-3-8l32-6M-3 4l32-6M-3 16l32-6M-3 28l32-6"/><path d="m22-12 6-1m-6 13 6-1m-6 13 6-1m-6 13 6-1" stroke="#c0df8d" stroke-width="3"/>';
const chip =
  '<rect x="-29" y="-29" width="58" height="58" rx="6" fill="#30474b"/><rect x="-18" y="-18" width="36" height="36" rx="3" fill="#15282e"/><path d="M-40-18h11m-11 12h11m-11 12h11m-11 12h11m58-36h11M29-6h11M29 6h11M29 18h11M-18-40v11M-6-40v11M6-40v11M18-40v11M-18 29v11M-6 29v11M6 29v11M18 29v11"/>';
const shield =
  '<path d="m0-36 32 12v23c0 21-18 32-32 39C-14 31-32 20-32-1v-23Z" fill="#293f43"/><path d="m-16 0 11 11 22-23" stroke-width="4" fill="none"/>';
const chart =
  '<path d="M-38 31h77M-30 29V8h12v21M-7 29v-42H5v42m12 0v-57h12v57" fill="#30464c"/><path d="m-34-5 20-13 17 5 25-24m-11 1 12-2-1 12" fill="none"/>';
const snow =
  '<path d="M0-39v78M-34-20l68 40M-34 20l68-40M-11-30 0-21l11-9M-11 30 11 30M-11 30 0 21l11 9M-30-7l13-1-1-13m48 14-13-1 1-13M-30 7l13 1-1 13m48-14-13 1 1 13" fill="none" stroke-width="3"/>';
const flask =
  '<path d="M-10-34h20M-7-34v25l-22 37c-3 6 2 9 7 9h44c5 0 10-3 7-9L7-9v-25" fill="#243e43"/><path d="M-18 13h36"/><circle cx="-5" cy="23" r="3" fill="#b6d98b"/><circle cx="6" cy="3" r="3" fill="#b6d98b"/>';
const network =
  '<path d="M-38-23 0 0l38-23M0 0v34M-38 23 0 0l38 23" fill="none"/><g fill="#30474c"><circle cx="-38" cy="-23" r="9"/><circle cx="38" cy="-23" r="9"/><circle cy="34" r="9"/><circle cx="-38" cy="23" r="7"/><circle cx="38" cy="23" r="7"/><circle r="16"/></g>';
const cube =
  '<path d="m0-34 34 18v35L0 37-34 19v-35Z" fill="#293e45"/><path d="M-34-16 0 2l34-18M0 2v35" fill="none"/>';
const loop =
  '<path d="M-31-14a34 34 0 0 1 59-10l7 10M35-14l-20-2m20 2 1-20M31 14a34 34 0 0 1-59 10l-7-10m0 0 20 2m-20-2-1 20" fill="none" stroke-width="4"/>';
const clipboard =
  '<rect x="-26" y="-30" width="52" height="64" rx="5" fill="#293e45"/><rect x="-13" y="-37" width="26" height="12" rx="3" fill="#435953"/><path d="m-16-10 4 4 6-8M0-8h16m-32 16 4 4 6-8M0 10h16M-16 25h32" fill="none"/>';
const motifs = { rack, database, chip, shield, chart, snow, flask, network, cube, loop, clipboard };
export const JOB_ART = {
  monitoring: ['chart', 'network', '#9fc4bd'],
  migration: ['database', 'loop', '#a6bdde'],
  audit: ['clipboard', 'shield', '#d4bd8c'],
  optimization: ['chip', 'chart', '#bdd993'],
  recovery: ['rack', 'loop', '#d5a786'],
  research: ['flask', 'network', '#b9a7d6'],
  ai: ['chip', 'network', '#a6a3dc'],
  database: ['database', 'chip', '#8dbfb2'],
  backup: ['database', 'shield', '#93b4d9'],
  loadtest: ['rack', 'chart', '#d3aa7c'],
  archive: ['database', 'clipboard', '#b5c1a1'],
  containers: ['cube', 'network', '#8cb8c4'],
  security: ['shield', 'chip', '#d2b17c'],
  replication: ['database', 'database', '#9eb8da'],
  rendering: ['cube', 'chip', '#c9a4cb'],
};
export const RESEARCH_ART = {
  routing: ['network', 'rack', '#9dbed3'],
  cooling: ['snow', 'rack', '#8ec9d2'],
  market: ['chart', 'database', '#d3bc83'],
  automation: ['loop', 'chip', '#b9d58f'],
  synthesis: ['flask', 'chip', '#b7a6d6'],
};
export function workloadArt(key, research = false) {
  const [main, secondary, color] = (research ? RESEARCH_ART : JOB_ART)[key] || JOB_ART.monitoring;
  const grid = Array.from(
    { length: 12 },
    (_, i) => `<path d="M${i * 30} 0v120M0 ${i * 15}h360"/>`,
  ).join('');
  return `<div class="workload-art" aria-hidden="true"><svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" fill="none"><rect width="360" height="120" fill="#141e21"/><g stroke="#2c3f40" opacity=".45">${grid}</g><path d="m10 108 95-52 85 47 105-60 55 30" stroke="${color}" stroke-dasharray="3 5" opacity=".35"/><g transform="translate(92 66) scale(.62)" stroke="${color}" stroke-width="2" opacity=".65">${motifs[secondary]}</g><path d="M132 66h50m-8-5 8 5-8 5" stroke="${color}"/><g class="art-subject" transform="translate(237 60)" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${motifs[main]}</g><g fill="${color}" opacity=".65"><circle cx="22" cy="17" r="2"/><circle cx="31" cy="17" r="2"/><circle cx="40" cy="17" r="2"/><path d="M304 99h8v3h-8zm12 0h8v3h-8zm12 0h8v3h-8z"/></g></svg></div>`;
}
