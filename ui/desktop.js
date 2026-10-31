/** Optional desktop controls. The ordinary browser does not need the bridge. */
export function createDesktopUI(ctx, platform = globalThis) {
  const bridge = platform.rootDesktop;
  if (!bridge) return { desktopSettings: () => '', desktopClosing: () => false };
  let closing = false;
  let state = {
    status: 'idle',
    version: '',
    kind: 'development',
    canUpdate: false,
    progress: 0,
    autoCheck: false,
  };
  const text = (de, en) => (ctx.I18N?.getLanguage() === 'en' ? en : de);
  const message = () => {
    const states = {
      idle: text('Updates sind bereit.', 'Updates are ready.'),
      development: text(
        'Updates sind in der Entwicklungsansicht deaktiviert.',
        'Updates are disabled in development mode.',
      ),
      manual: text(
        'Portable oder manuelle Ausgabe: Ersetze die Anwendung durch einen neuen Download.',
        'Portable or manual edition: replace the application with a new download.',
      ),
      checking: text('Neue Version wird gesucht …', 'Checking for a new version …'),
      available:
        text('Neue Version verfügbar:', 'New version available:') +
        ' ' +
        (state.availableVersion || ''),
      downloading:
        text('Update wird geladen …', 'Downloading update …') +
        ` ${Math.round(state.progress || 0)} %`,
      downloaded: text(
        'Update geprüft und bereit. Vor dem Neustart wird dein Fortschritt gespeichert.',
        'Update verified and ready. Progress will be saved before restarting.',
      ),
      current: text('Du verwendest die aktuelle Version.', 'You are using the current version.'),
      error:
        state.error === 'not-published'
          ? text(
              'Für diesen Kanal ist noch kein Update veröffentlicht.',
              'No update has been published for this channel yet.',
            )
          : text(
              'Update nicht abgeschlossen. Du kannst erneut prüfen oder die Release-Seite öffnen.',
              'Update did not complete. You can check again or open the release page.',
            ),
    };
    return closing
      ? text('Fortschritt wird gespeichert …', 'Saving progress …')
      : states[state.status] || states.error;
  };
  function update() {
    for (const section of platform.document.querySelectorAll('[data-desktop-section]')) {
      section.querySelector('[data-desktop-status]').textContent = message();
      const progress = section.querySelector('progress');
      progress.hidden = state.status !== 'downloading';
      progress.value = state.progress || 0;
      for (const button of section.querySelectorAll('[data-desktop-command]')) {
        const command = button.dataset.desktopCommand;
        button.disabled =
          closing || (['checking', 'downloading'].includes(state.status) && command !== 'releases');
        button.hidden =
          (command === 'check' && !state.canUpdate) ||
          (command === 'download' &&
            !(
              state.canUpdate &&
              state.availableVersion &&
              ['available', 'error'].includes(state.status)
            )) ||
          (command === 'install' && state.status !== 'downloaded');
      }
      const checkbox = section.querySelector('[data-desktop-auto]');
      checkbox.checked = Boolean(state.autoCheck);
      checkbox.disabled = closing || !state.canUpdate;
      checkbox.parentElement.hidden = !state.canUpdate;
    }
  }
  const accept = (next) => {
    if (!next || typeof next.status !== 'string') return;
    state = {
      ...state,
      ...next,
      progress: Number.isFinite(next.progress) ? Math.min(100, Math.max(0, next.progress)) : 0,
    };
    update();
  };
  const failure = () => {
    state = { ...state, status: 'error', error: 'update-failed' };
    update();
  };
  bridge.info().then(accept).catch(failure);
  bridge.onStatus(accept);
  bridge.onResume(() => {
    closing = false;
    update();
  });
  bridge.onPrepareClose(async ({ token }) => {
    if (typeof token !== 'string') return;
    closing = true;
    update();
    let persisted = false;
    try {
      ctx.simulate();
      persisted = (await ctx.save())?.persisted === true;
    } catch {}
    try {
      await bridge.closeReady({ token, persisted });
    } catch {}
  });

  function desktopSettings() {
    const button = (command, label) =>
      `<button class="button ghost" data-desktop-command="${command}">${label}</button>`;
    return `<div class="settings-row" data-desktop-section><h3>${text('Desktop & Updates', 'Desktop & updates')}</h3><p>ROOT ${ctx.esc(state.version)}</p><p>${
      state.kind === 'portable'
        ? text(
            'Dein Fortschritt liegt im ROOT-data-Ordner neben der portablen Anwendung. Behalte diesen Ordner beim Austausch.',
            'Progress is stored in ROOT-data beside the portable application. Keep that folder when replacing it.',
          )
        : text(
            'Dein Fortschritt liegt getrennt von den Programmdateien und bleibt bei Updates erhalten.',
            'Progress is stored separately from program files and is retained through updates.',
          )
    }</p><p data-desktop-status role="status">${ctx.esc(message())}</p><progress class="desktop-progress" max="100" value="${Math.round(state.progress)}" ${state.status === 'downloading' ? '' : 'hidden'}></progress><label class="field-label"><input type="checkbox" data-desktop-auto ${state.autoCheck ? 'checked' : ''}> ${text('Automatisch nach neuen Versionen suchen', 'Automatically check for new versions')}</label><div class="settings-actions">${button('check', text('Nach Updates suchen', 'Check for updates'))}${button('download', text('Update laden', 'Download update'))}${button('install', text('Installieren & neu starten', 'Install & restart'))}${button('releases', text('Releases öffnen', 'Open releases'))}${button('data', text('Speicherordner öffnen', 'Open data folder'))}</div></div>`;
  }
  function handleDesktopCommand(command) {
    const actions = {
      check: () => bridge.checkUpdates(),
      download: () => bridge.downloadUpdate(),
      install: () => bridge.installUpdate(),
      releases: () => bridge.openReleases(),
      data: () => bridge.openDataFolder(),
    };
    if (!Object.hasOwn(actions, command)) return false;
    if (!closing)
      Promise.resolve()
        .then(actions[command])
        .then((result) => {
          if (result?.status) accept(result);
        })
        .catch(failure);
    return true;
  }
  async function desktopReady() {
    await ctx.save();
    await bridge.setLanguage(ctx.I18N?.getLanguage() === 'en' ? 'en' : 'de');
    await bridge.bootReady();
  }
  function syncDesktopLanguage() {
    bridge.setLanguage(ctx.I18N?.getLanguage() === 'en' ? 'en' : 'de').catch(failure);
  }
  platform.document.addEventListener('change', (event) => {
    if (event.target.matches?.('[data-desktop-auto]'))
      bridge.setAutoCheck(event.target.checked).then(accept).catch(failure);
  });
  const desktopSaveNote = () =>
    text(
      'Die lokale Datei liegt im Desktop-Speicherordner unter network/save.json.',
      'The local file is stored in the desktop data folder under network/save.json.',
    );
  return {
    desktopSettings,
    desktopSaveNote,
    handleDesktopCommand,
    desktopReady,
    syncDesktopLanguage,
    desktopClosing: () => closing,
    updateDesktopControls: update,
  };
}
