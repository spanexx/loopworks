// WHY: the learner's screen is theirs. A game that forces a bright page into a dark room gets
//      closed, so the ramp is chosen before the body paints and remembered after that.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: first build, following GRILL-loopworks-app entry on light and dark.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  const KEY = 'loopworks.app.theme.v1';

  // WHY: a stored choice beats the machine setting, because the learner picked it on purpose and
  //      expects the app to still look that way tomorrow.
  function stored() {
    try {
      const value = host.localStorage.getItem(KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (err) {
      return null;
    }
  }

  function remember(theme) {
    // WHY: a browser with storage blocked still plays; only the choice is forgotten.
    try {
      host.localStorage.setItem(KEY, theme);
    } catch (err) {
      /* the app runs either way */
    }
  }

  function system() {
    return host.matchMedia && host.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function current() {
    return host.document.documentElement.getAttribute('data-theme') || 'light';
  }

  // WHY: one attribute on the root is the whole theme. The stylesheet answers every colour word
  //      from it, so no script and no markup ever writes a colour.
  function apply(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    host.document.documentElement.setAttribute('data-theme', next);
    syncButton();
    return next;
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    remember(next);
    return apply(next);
  }

  // WHY: the icon is chosen by the stylesheet from the root attribute; this only keeps the name
  //      and the tooltip honest for a screen reader.
  function syncButton() {
    const button = host.document.querySelector('[data-action="toggle-theme"]');
    if (!button) return;
    const dark = current() === 'dark';
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    button.setAttribute('title', button.getAttribute('aria-label'));
  }

  if (host.document) {
    // WHY: a document-level listener works whichever view painted the button, so switching views
    //      can never orphan the control.
    host.document.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('[data-action="toggle-theme"]')) toggle();
    });
    host.document.addEventListener('DOMContentLoaded', syncButton);
    apply(stored() || system());
  }

  host.LoopworksTheme = { apply, toggle, current, stored, system };
})();
