// WHY: a page opened from disk has no worker to register, and a browser without one must not see an
//      error, so the door opens only where an installable app can exist. A failed registration is
//      silent on purpose: it costs nothing to play without a worker, and a red toast would not fix it.
// PACK: loopworks-installable
// 2026-11-08 qoder-agent: written on the learner's direction, "turn into a pwa and make it
//      installable", under delegated authority; the design notes are in the pack's PRD-TRD.

(() => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
})();
