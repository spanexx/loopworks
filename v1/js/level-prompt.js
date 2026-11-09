// WHY: a player who wants more levels asks a chat model for them, and the ask is only as good as the
//      rules it carries. This module builds that ask from what the running app already knows - the
//      Dictionary's own words, the engine's own refusals, the importer's own caps - instead of a second
//      copy typed out by hand, because a hand-typed copy is the thing this project keeps removing. It
//      reads the shelf through the host it is handed and returns a string; it never touches the document,
//      the clipboard or storage, so the node harness and the page get the same text from the same code.
// PACK: loopworks-level-prompt
// 2026-11-05 qoder-agent: built to PRD-TRD-loopworks-level-prompt.md sections 2, 3 and 9, and the
//      decisions locked in GRILL-loopworks-level-prompt.txt entries 3, 5, 6, 7, 8 and 10.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  // WHY: the ask is a whole pack, not one level, because a level is too small a sample for a model to
  //      learn the shape from and one level is too little for the player to be worth adding. The ceiling
  //      stays under the importer's own, so a prompt-following model never writes a pack this app refuses.
  const LEVEL_MIN = 3;
  const LEVEL_MAX = 5;

  function shelfFirst(h) {
    const entries = h.Loopworks.packs().filter((entry) => entry.errors.length === 0);
    return entries.length ? entries[0].pack : null;
  }

  // WHY: a word with no description ships a bare rule into the prompt, so the pair is checked here the
  //      same way the Dictionary checks it - a word that has fallen off gets refused, not sent silent.
  function words(h, pack) {
    const W = h.LoopworksWords;
    if (!W || !pack) return [];
    return W.list(pack).map((word) => {
      const said = W.describe(word);
      return `${word}: ${said}`;
    });
  }

  // WHY: the grammar the player is asked to obey is not written here. It is what the engine says when a
  //      board is wrong, pulled by poisoning one real level three ways. If the engine ever stops refusing
  //      a bad character, this line goes blank and the harness turns red - a prompt cannot claim a rule
  //      the code no longer enforces.
  function grammar(h, pack) {
    const sentences = [];
    if (!pack || !pack.levels || !pack.levels.length) return sentences;
    const base = pack.levels[0];

    const one = JSON.parse(JSON.stringify(base));
    one.rows[0] = `${one.rows[0]}x`;
    const board = JSON.parse(JSON.stringify(pack));
    board.levels = [one];
    h.Loopworks.validatePack(board).forEach((message) => {
      if (/character that is not/.test(message)) sentences.push(message);
    });

    const kinded = JSON.parse(JSON.stringify(pack));
    kinded.levels = [Object.assign({}, base, { goal: { kind: 'deliver', count: 1 } })];
    h.Loopworks.validatePack(kinded).forEach((message) => {
      if (/goal kind/.test(message)) sentences.push(message);
    });

    const carrying = JSON.parse(JSON.stringify(pack));
    carrying.verbs = ['forward', 'turn left', 'turn right'];
    carrying.levels = [Object.assign({}, base, {
      crates: base.pads ? [[base.start.x + 1, base.start.y]] : [[1, 1]]
    })];
    h.Loopworks.validatePack(carrying).forEach((message) => {
      if (/places crates but the pack does not unlock/.test(message)) sentences.push(message);
    });

    return sentences;
  }

  // WHY: the numbers the importer will enforce, stated in the ask so a model that obeys it never hands
  //      back a pack the add button would refuse. Read off the module that owns the limits, not copied.
  function limits(h) {
    const U = h.LoopworksUserPacks;
    if (!U) return [];
    return [
      `A board is at most ${U.MAX_CELLS} cells wide and ${U.MAX_CELLS} cells tall.`,
      `A pack added here holds at most ${U.MAX_LEVELS} levels.`
    ];
  }

  // WHY: a real level from the shelf, not a described one. The player is shown the shape he must match by
  //      holding up the first thing this app already plays, trimmed to a single level so the ask stays
  //      short. It is serialised from live data, so a field added to every level appears here for free.
  function exampleJson(h) {
    const pack = shelfFirst(h);
    if (!pack) return '';
    const one = JSON.parse(JSON.stringify(pack));
    one.levels = [one.levels[0]];
    return JSON.stringify(one, null, 2);
  }

  function text(h, pack) {
    const target = pack || shelfFirst(h);
    if (!target) return '';
    const blocks = [];

    blocks.push([
      'Write a pack of levels for Loopworks, a game that teaches programming logic.',
      'The player types short instruction lines and a drone runs them on a grid.',
      'Return one JSON pack holding ' + LEVEL_MIN + ' to ' + LEVEL_MAX + ' levels, and nothing else - no prose around it.'
    ].join('\n'));

    blocks.push([
      'The only words the player may use:',
      ...words(h, target)
    ].join('\n'));

    const rules = grammar(h, target);
    if (rules.length) {
      blocks.push(['The board and goal rules, in the words the game enforces:', ...rules].join('\n'));
    }

    const caps = limits(h);
    if (caps.length) blocks.push(['Keep within these limits:', ...caps].join('\n'));

    blocks.push([
      'A pack may hand over fewer words than the full set (for example, leaving out "u-turn"),',
      'so the player has to solve the same board with fewer tools. It may also carry a "rules" object',
      'such as { "fuel": 12 } that limits how many steps the drone takes before it stalls.',
      'If you withhold a word, every level in the pack must be solvable without it, and any trap that',
      'names the withheld word is refused by the game.'
    ].join('\n'));

    const level = target.levels[0];
    const fields = level ? Object.keys(level).join(', ') : '';
    blocks.push([
      'Each level is an object with exactly these fields:',
      fields,
      'goal is { "kind": "visit" or "fill", "count": a whole number }.',
      'rows uses only "#" for a wall and "." for floor, every row the same length.',
      'start is { "x", "y", "dir" } with dir one of N, E, S, W.',
      'pads and crates are [x, y] pairs on floor cells, never on the same cell.',
      'budget is the most lines a winning program may use, and it must be beatable inside it.',
      'teaches and title are short strings that say what the level teaches.',
      'Add a field named proof holding a program you have checked wins the level inside its budget.',
      'Add a field named traps: an array of programs a learner might wrongly try, each of which must lose inside its budget. At least one per level.'
    ].join('\n'));

    blocks.push(['Here is one real level to copy the shape of:', exampleJson(h)].join('\n'));

    return blocks.join('\n\n');
  }

  host.LoopworksLevelPrompt = { LEVEL_MIN, LEVEL_MAX, words, grammar, limits, exampleJson, text };
})();
