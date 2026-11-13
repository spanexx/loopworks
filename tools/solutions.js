// WHY: the published solutions, as data. A level is only worth shipping if a human wrote a program
//      that finishes it inside its own Budget, and this table is that promise in one place. It is NOT
//      part of a level, because level data ships to the live site and an answer key must not: the two
//      harnesses read this file, the page never loads it.
// PACK: loopworks-level-authoring
// 2026-11-04 qoder-agent: pulled out of tools/verify.mjs and app/tools/verify.mjs, which each carried
//      their own copy of the same five strings. app/tools/solutions.js is a byte-for-byte copy kept in
//      step by `npm run sync`, so a clone of the app repo can still run its checks.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  // WHY: one entry per level, keyed by the level id, valued by the exact text the player would type.
  //      The checks solve the level with it; a line here that does not fit the Budget is a red check.
  const LoopworksSolutions = {
    'polish-1': 'forward 2\nturn right\nforward 2',
    'depot-1': 'forward 2\nturn right\nforward 2',
    'polish-3': 'turn left\ngrab\nturn right\nturn right\ndrop\nturn right\nforward 1\nturn left\ngrab\nturn right\nturn right\ndrop',
    'depot-2': 'turn left\ngrab\nturn right\nturn right\ndrop\nturn right\nforward 1\nturn left\ngrab\nturn right\nturn right\ndrop',
    'polish-2': 'repeat 4\n  forward 3\n  turn right\nend',
    // WHY: the two word boards are planned, not looped: each letter is a grab-carry-drop cycle, and the
    //      hole fixes the order. The programs fit their Budgets with room to spare because levers 1 and
    //      4 are deferred (loopworks-v2-subject, GRILL entries 9 and 11).
    'polish-4': 'forward\nturn right\ngrab\nforward\nforward\nturn left\nforward\ndrop\nturn left\nforward\nturn right\ngrab\nforward\nturn right\ndrop\nturn left\nforward\ngrab\nturn right\nforward\nturn right\ndrop\nturn left\nforward\nturn right\nforward\nforward\ngrab\nturn right\nforward\nturn right\ndrop\nturn right\nforward\nturn left\nforward\nforward\ngrab\nturn left\nforward\nturn left\ndrop',
    'polish-5': 'forward\nturn right\ngrab\nforward\nforward\nturn left\nforward\nforward\ndrop\nturn left\nforward\nforward\nturn right\nforward\nforward\nforward\nforward\nturn right\ngrab\nforward\nforward\nturn right\nforward\nforward\ndrop\nturn left\nturn left\nforward\nturn right\nforward\nforward\nturn right\ngrab\nturn right\nforward\nforward\nturn left\nforward\ndrop\nturn left\nturn left\nforward\nforward\nturn right\ngrab\nturn right\nforward\nforward\ndrop\nturn left\nturn left\nforward\nturn right\nforward\nforward\nturn right\nforward\nforward\nforward\nforward\nforward\nturn right\ngrab\nforward\nforward\nturn right\nforward\nforward\ndrop',
    'depot-3': 'repeat 4\n  forward 3\n  turn right\nend',
    'depot-4': 'repeat 10\n  if wall ahead: turn right\n  forward 1\nend',
    'depot-5': 'forward 6\nturn right\nforward 4',
    'depot-6': 'repeat 3\n  forward 1\n  turn left\n  grab\n  turn right\n  forward 1\n  turn right\n  drop\n  turn left\nend',
    'depot-7': 'repeat 4\n  turn left\n  forward 3\n  turn left\n  turn left\n  forward 3\n  turn left\n  forward 2\nend',
    'depot-8': 'repeat 5\n  turn right\n  if crate ahead: grab\n  if pad ahead: drop\nend',
    'depot-9': 'repeat 20\n  if wall ahead: turn right\n  forward 1\nend',
    'night-1': 'forward 4\nturn left\nturn left\nforward 8',
    'night-2': 'repeat 4\n  forward 3\n  turn right\nend',
    'night-3': 'repeat 12\n  if wall ahead: turn right\n  forward 1\nend',
    'night-4': 'forward 1\nturn left\nturn left\nforward 1\nturn right\nforward 2\nturn left\nturn left\nforward 8',
    'night-5': 'forward 7\ngrab\nturn left\nturn left\nforward 4\ndrop',
    'night-6': 'repeat 3\n  forward 3\n  turn left\n  grab\n  turn left\n  turn left\n  drop\n  turn left\nend',
    'night-7': 'repeat 8\n  turn left\n  if crate ahead: grab\n  turn left\n  turn left\n  if pad ahead: drop\n  turn left\n  forward 1\nend',
    'night-8': 'forward 1\nturn left\ngrab\nturn right\nforward 3\ndrop\nturn left\nturn left\nforward 2\nturn right\ngrab\nturn right\ndrop',
    'night-9': 'forward 6\ngrab\nturn left\nturn left\nforward 3\ndrop',
    'night-10': 'forward 1\nturn left\ngrab\nturn right\nforward 6\ndrop\nturn left\nturn left\nforward 5\nturn right\ngrab\nturn right\ndrop'
  };

  host.LoopworksSolutions = LoopworksSolutions;
})();
