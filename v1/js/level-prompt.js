// WHY: a player who wants more levels asks a chat model for them, and the ask is only as good as the
//      rules it carries. This module builds that ask from what the running app already knows - the
//      Dictionary's own words, the engine's own refusals, the importer's own caps - instead of a second
//      copy typed out by hand, because a hand-typed copy is the thing this project keeps removing. It
//      reads the shelf through the host it is handed and returns a string; it never touches the document,
//      the clipboard or storage, so the node harness and the page get the same text from the same code.
//      A learner who names a word gets the word-lesson ask; a learner who names none gets the logic ask.
// PACK: loopworks-level-prompt
// 2026-11-05 qoder-agent: built to PRD-TRD-loopworks-level-prompt.md sections 2, 3 and 9, and the
//      decisions locked in GRILL-loopworks-level-prompt.txt entries 3, 5, 6, 7, 8 and 10.
// 2026-11-14 agent: the word-lesson ask and its real word-pack example, following
//      GRILL-loopworks-word-lessons entries 9 and 10 and PRD-TRD-loopworks-word-lessons sections 3 and 7.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  // WHY: the ask is a whole pack, not one level, because a level is too small a sample for a model to
  //      learn the shape from and one level is too little for the player to be worth adding. The ceiling
  //      stays under the importer's own, so a prompt-following model never writes a pack this app refuses.
  const LEVEL_MIN = 3;
  const LEVEL_MAX = 5;
  // WHY: a word lesson needs at least the two boards the studio's word levels use - one that spells the
  //      word and one that asks its meaning - and no more than four, which is still under the importer's
  //      ceiling. The numbers are the lesson's shape, not a difficulty rating.
  const WORD_LEVEL_MIN = 2;
  const WORD_LEVEL_MAX = 4;

  function shelfFirst(h) {
    const entries = h.Loopworks.packs().filter((entry) => entry.errors.length === 0);
    return entries.length ? entries[0].pack : null;
  }

  // WHY: the word example is a real pack that already carries a Word and a level that names it. It is
  //      found on the shelf, never typed here, so the example cannot drift from the data the studio reads
  //      and this module cannot name a language or a word of its own.
  function wordPack(h) {
    const entries = h.Loopworks.packs().filter((entry) => entry.errors.length === 0);
    const found = entries.find((entry) => {
      const pack = entry.pack;
      if (!pack || !pack.words || typeof pack.words !== 'object') return false;
      if (Object.keys(pack.words).length === 0) return false;
      return (pack.levels || []).some((level) => level && typeof level.word === 'string' && level.word);
    });
    return found ? found.pack : null;
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
  //      Asked for a word lesson, it holds up a real Word pack and the first level that carries a word.
  function exampleJson(h, wanted) {
    const learning = typeof wanted === 'string' ? wanted.trim() : '';
    const pack = learning ? wordPack(h) : shelfFirst(h);
    if (!pack) return '';
    const one = JSON.parse(JSON.stringify(pack));
    const carried = (pack.levels || []).find((level) => level && typeof level.word === 'string' && level.word);
    one.levels = [learning && carried ? carried : one.levels[0]];
    return JSON.stringify(one, null, 2);
  }

  // WHY: the word ask is one contract with the studio: the fields it names are the fields the model
  //      paints, and the importer refuses anything this block promises and the pack does not carry. The
  //      only thing that varies is the learner's own line; every rule around it is the app's voice.
  function wordText(h, target, learning) {
    const blocks = [];

    blocks.push([
      'Write a pack of levels and a word lesson for Loopworks, a game that teaches programming logic and the words of a language.',
      'The player types short instruction lines and a drone runs them on a grid.',
      `The learner is learning: ${learning}.`,
      `Return one JSON pack holding ${WORD_LEVEL_MIN} to ${WORD_LEVEL_MAX} levels, and nothing else - no prose around it.`
    ].join('\n'));

    blocks.push(['The only words the player may use:', ...words(h, target)].join('\n'));

    const rules = grammar(h, target);
    if (rules.length) {
      blocks.push(['The board and goal rules, in the words the game enforces:', ...rules].join('\n'));
    }

    const caps = limits(h);
    if (caps.length) blocks.push(['Keep within these limits:', ...caps].join('\n'));

    blocks.push([
      'The pack carries the lesson as data, not only as boards:',
      'language: the language the word belongs to, named the way the learner named it.',
      'aim: one short phrase naming what the learner is here for.',
      'words: an object with one entry per word. The key is the word in its base form.',
      'Every word carries en, pl, story, match, dialog and forms.',
      'en is the English meaning of the base form. pl is the base form itself, and equals the key.',
      'story is 3 sentences, each with exactly one ____ blank and its answer, and the changed form appears in at least one of them.',
      'match is 6 to 8 pairs taken from the story, the learning-language word first and its English meaning second.',
      'Give the base form and every changed form its own precise meaning, so two forms never both read as the same English word.',
      'dialog is one question, its English gloss, 2 to 4 options, the index of the right option as "right", and a reply.',
      'forms is an array of every way the word changes. A word that does not change carries an empty array.',
      'Each form carries label, to, en, why and use.',
      'label is the pack\'s own name for the change. to is the changed word. en is what the changed form means.',
      'why is one plain sentence saying why the language changes the word.',
      'use is a fresh sentence the learner has not read, with exactly one ____ blank and its answer; the answer is the changed form.'
    ].join('\n'));

    const carried = (target.levels || []).find((item) => item && typeof item.word === 'string' && item.word)
      || ((wordPack(h) && wordPack(h).levels || []).find((item) => item && typeof item.word === 'string' && item.word))
      || (target.levels || [])[0];
    const fields = carried ? Object.keys(carried).join(', ') : '';
    blocks.push([
      'Every level is an object with these fields:',
      fields,
      'rows uses only "#" for a wall and "." for floor, every row the same length.',
      'start is { "x", "y", "dir" } with dir one of N, E, S, W.',
      'budget is the most lines a winning program may use, and it must be beatable inside it.',
      'teaches and title are short strings that say what the level teaches.',
      'A pack may hand over fewer words than the full set, and may carry a "rules" object such as { "fuel": 12 }.',
      'If you withhold a word, every level must be solvable without it, and any trap that names it is refused.'
    ].join('\n'));

    blocks.push([
      'The boards carry the word before the Word studio revisits it:',
      '- One level spells the word. Its goal is { "kind": "hole", "sequence": [...] }, and its crates carry the letters as [x, y, "letter"].',
      '- Another level asks for the meaning, not the word, and may add decoy letter crates and pillars.',
      '- Every level that carries a word names it in a "word" field, and its goal sequence spells that word exactly.',
      '- Every letter of the sequence must sit on a labelled crate. Decoy crates may carry letters the word does not use.',
      '- Add a field named proof holding a program you have checked wins the level inside its budget.',
      '- Add a field named traps: programs a learner might wrongly try, each of which must lose inside its budget.'
    ].join('\n'));

    blocks.push(['Here is one real word lesson to copy the shape of:', exampleJson(h, learning)].join('\n'));

    return blocks.join('\n\n');
  }

  function text(h, pack, wanted) {
    const learning = typeof wanted === 'string' ? wanted.trim() : '';
    const target = pack || (learning ? wordPack(h) : shelfFirst(h));
    if (!target) return '';
    if (learning) return wordText(h, target, learning);
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

  host.LoopworksLevelPrompt = {
    LEVEL_MIN, LEVEL_MAX, WORD_LEVEL_MIN, WORD_LEVEL_MAX,
    words, grammar, limits, wordPack, exampleJson, text
  };
})();
