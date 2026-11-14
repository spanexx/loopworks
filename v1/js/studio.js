// WHY: a met word is worked through its contexts, and the only thing worth remembering is which of
//      them are finished. That is one small record on this machine and nothing else - no account, no
//      server, no key. This file is the model: it reads and writes that record, decides which words a
//      learner has met from the progress record, and builds the aim line. It touches no screen, so a
//      harness can prove every rule without a browser, and the view can be redrawn freely.
// PACK: loopworks-app
// 2026-11-13 agent: first build, following GRILL-loopworks-v2-subject entries 10 and 11 and
//      PRD-TRD-loopworks-v2-subject scenarios 2, 9 and 10.
// 2026-11-14 agent: Forms added as the fifth Context, walked third, following
//      GRILL-loopworks-word-lessons entries 5 to 8 and 11. A Word with no Form keeps four contexts.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  const KEY = 'loopworks.app.words.v1';

  // WHY: the order is the lesson, not a menu. Story gives the word its situation, spelling asks for it
  //      from its meaning, forms explains how it changes, dialogue hears it in use, and matching sorts
  //      the words of the story. Forms sits third so the learner meets the pair before dialogue and
  //      matching ask him to use it. The studio reads this list and never offers a tab that jumps over
  //      a context.
  const CONTEXTS = ['story', 'spelling', 'forms', 'dialogue', 'matching'];

  function emptyRecord() {
    return { version: 1, words: {} };
  }

  // WHY: a record left behind by an older build, a hand-edited line or a half-written save must never
  //      stop the studio. Only a true mark for a context the studio still has survives the read; the
  //      rest is dropped, because a mark is a memory and a broken memory is the same as none.
  function cleanRecord(value) {
    const record = emptyRecord();
    if (!value || typeof value !== 'object') return record;
    if (!value.words || typeof value.words !== 'object') return record;
    Object.keys(value.words).forEach((key) => {
      if (!/^[^:\s]+:[^:\s]+$/.test(key)) return;
      const marks = value.words[key];
      if (!marks || typeof marks !== 'object') return;
      const clean = {};
      CONTEXTS.forEach((context) => {
        if (marks[context] === true) clean[context] = true;
      });
      if (Object.keys(clean).length) record.words[key] = clean;
    });
    return record;
  }

  function read() {
    try {
      const raw = host.localStorage.getItem(KEY);
      if (!raw) return emptyRecord();
      return cleanRecord(JSON.parse(raw));
    } catch (err) {
      return emptyRecord();
    }
  }

  function store(record) {
    try {
      host.localStorage.setItem(KEY, JSON.stringify(record));
    } catch (err) {
      /* the studio still works; only the memory of it is lost */
    }
  }

  function keyOf(packId, word) {
    return `${String(packId)}:${String(word)}`;
  }

  function isDone(record, packId, word, context) {
    const marks = record && record.words ? record.words[keyOf(packId, word)] : null;
    return !!(marks && marks[context] === true);
  }

  // WHY: one mark, one write. A context is done or it is not, so there is nothing to count and no
  //      second flag that could disagree with the first.
  function mark(packId, word, context) {
    const record = read();
    if (!CONTEXTS.includes(context) || !packId || !word) return record;
    const key = keyOf(packId, word);
    if (!record.words[key]) record.words[key] = {};
    record.words[key][context] = true;
    store(record);
    return record;
  }

  // WHY: a Word that changes carries Forms; a Word that does not carries none. Applicability is read
  //      from the Word's own data - not a global flag and not a language name - so the model stays
  //      subject-blind and a pack decides what its word needs.
  function hasForms(data) {
    return !!(data && Array.isArray(data.forms) && data.forms.length > 0);
  }

  function contexts(data) {
    return CONTEXTS.filter((context) => context !== 'forms' || hasForms(data));
  }

  // WHY: the next thing to do is the first unfinished Context in this Word's own walk. A Word with no
  //      Forms never offers one, and a Word that gains Forms later has an unfinished Context again, so
  //      the studio offers it once more.
  function nextContext(done, data) {
    const marks = done || {};
    const walk = contexts(data);
    for (let i = 0; i < walk.length; i += 1) {
      if (marks[walk[i]] !== true) return walk[i];
    }
    return null;
  }

  // WHY: a word is met because its level is solved and its pack still carries the word's own record -
  //      not because a second flag says it was earned. If the pack loses the word, the studio loses it
  //      too, and the progress record stays the one truth about what the learner did. One word reached
  //      through two levels is still one word.
  function met(shelf, progress, record) {
    const entries = [];
    const seen = new Set();
    (shelf || []).forEach((pack) => {
      if (!pack || !Array.isArray(pack.levels)) return;
      const words = pack.words && typeof pack.words === 'object' ? pack.words : {};
      pack.levels.forEach((level) => {
        if (!level || typeof level.word !== 'string' || !level.word) return;
        if (!progress || !progress[level.id]) return;
        const data = words[level.word];
        if (!data || typeof data !== 'object') return;
        const key = keyOf(pack.id, level.word);
        if (seen.has(key)) return;
        seen.add(key);
        const marks = record && record.words ? record.words[key] : null;
        const done = {};
        CONTEXTS.forEach((context) => {
          if (marks && marks[context] === true) done[context] = true;
        });
        entries.push({
          packId: pack.id,
          packName: pack.name,
          language: typeof pack.language === 'string' ? pack.language : '',
          word: level.word,
          data,
          done
        });
      });
    });
    return entries;
  }

  // WHY: the aim is one named target over evidence, never a rating. The language and the target are the
  //      pack's own words, and the met words are read from the progress record, so no subject string has
  //      to live in code and nothing is summed into a score.
  function aim(shelf, progress) {
    const pack = (shelf || []).find((entry) => entry && typeof entry.language === 'string' && entry.language);
    if (!pack) return null;
    const words = [];
    (pack.levels || []).forEach((level) => {
      if (!level || typeof level.word !== 'string' || !level.word) return;
      if (!progress || !progress[level.id]) return;
      if (!pack.words || !pack.words[level.word]) return;
      if (!words.includes(level.word)) words.push(level.word);
    });
    return { language: pack.language, target: typeof pack.aim === 'string' ? pack.aim : '', words };
  }

  host.LoopworksStudio = { key: KEY, CONTEXTS, hasForms, contexts, read, mark, isDone, nextContext, met, aim };
})();
