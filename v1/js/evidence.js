// WHY: the player's record is evidence about programs, never a rating of a person. It lives in
//      this browser only, keeps the cheapest solve per level, and the Evidence list is drawn from
//      the same record the controller writes. A corrupt or unavailable record is ignored, never
//      fatal, because losing a record must not stop the game.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: first build, following PRD-TRD sections 10, 12 and 22.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  const KEY = 'loopworks.app.progress.v1';
  const doc = host.document;

  function cleanEntry(value) {
    if (!value || typeof value !== 'object') return null;
    const lines = Number(value.lines);
    const ticks = Number(value.ticks);
    const budget = Number(value.budget);
    if (!Number.isInteger(lines) || lines < 0) return null;
    if (!Number.isInteger(ticks) || ticks < 0) return null;
    if (!Number.isInteger(budget) || budget <= 0) return null;
    return { lines, ticks, budget, within: lines <= budget };
  }

  function readProgress() {
    try {
      const raw = host.localStorage.getItem(KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const clean = {};
      Object.keys(parsed).forEach((levelId) => {
        const entry = cleanEntry(parsed[levelId]);
        if (entry) clean[levelId] = entry;
      });
      return clean;
    } catch (err) {
      return {};
    }
  }

  function store(progress) {
    try {
      host.localStorage.setItem(KEY, JSON.stringify(progress));
    } catch (err) {
      /* the game still plays; only the record is lost */
    }
  }

  // WHY: fewer typed lines is the lesson, so it wins before ticks do. An equally cheap program
  //      with fewer ticks is still a better program of the same length.
  function better(next, prev) {
    if (!prev) return true;
    if (next.lines !== prev.lines) return next.lines < prev.lines;
    return next.ticks < prev.ticks;
  }

  function writeEntry(levelId, entry) {
    const progress = readProgress();
    const clean = cleanEntry(entry);
    if (clean && better(clean, progress[levelId])) {
      progress[levelId] = clean;
      store(progress);
    }
    return progress;
  }

  function nextUnsolved(shelf, progress) {
    for (let p = 0; p < shelf.length; p += 1) {
      const pack = shelf[p];
      for (let l = 0; l < pack.levels.length; l += 1) {
        const level = pack.levels[l];
        if (!progress[level.id]) return { pack, level };
      }
    }
    return null;
  }

  function costText(entry) {
    const lines = `${entry.lines}/${entry.budget} lines`;
    return entry.within ? `Solved - ${lines}` : `Solved - ${lines}, over budget`;
  }

  // WHY: the letters that do not decompose under NFD (ł, ø, đ, ß, æ, œ, ı) are mapped first, so a
  //      learner typing "lodz" reaches "Łódź" - the next subject is Polish, and the search must not
  //      be a wall for the very packs it exists to find. The combining marks are then stripped.
  const FOLD_MAP = { 'ł': 'l', 'ø': 'o', 'đ': 'd', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ı': 'i' };
  function fold(text) {
    return String(text).toLowerCase()
      .replace(/[łøđßæœı]/g, (ch) => FOLD_MAP[ch])
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  // WHY: with thousands of packs the view cannot build a row per level. One line per pack is the
  //      index; a pack's levels are built only when it is opened. Every pack starts closed, so the
  //      first screen is a scannable list and no level is hidden behind an open one. The open set
  //      lives in memory only - no storage key - and a pack the learner opens stays open while the
  //      app runs. A pack line shows a size (its level count), never a solved figure: a ratio is
  //      the shape of a completion meter, and the record is per level.
  const state = { open: {} };
  const SEARCH_CAP = 200;
  const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function matchesFor(shelf, query) {
    const q = fold(query || '').trim();
    const matches = [];
    shelf.forEach((pack) => {
      if (q === '') {
        matches.push({ pack, levels: pack.levels });
        return;
      }
      if (fold(pack.name).includes(q)) {
        matches.push({ pack, levels: pack.levels });
        return;
      }
      const hits = pack.levels.filter((level) => fold(level.title).includes(q));
      if (hits.length) matches.push({ pack, levels: hits });
    });
    return { q, matches };
  }

  function levelRow(pack, level, entry, next) {
    const row = doc.createElement('button');
    row.type = 'button';
    row.className = 'evidence-row';
    row.dataset.pack = pack.id;
    row.dataset.level = level.id;

    const title = doc.createElement('span');
    title.className = 'ev-title';
    title.textContent = level.title;

    const cost = doc.createElement('span');
    cost.className = 'ev-cost';
    if (entry) {
      cost.textContent = costText(entry);
      cost.classList.add(entry.within ? 'is-solved' : 'is-over');
    } else if (next && next.level.id === level.id) {
      cost.textContent = 'Work to do';
      cost.classList.add('is-todo');
    } else {
      cost.textContent = 'Not solved yet';
      cost.classList.add('is-waiting');
    }

    const chevron = doc.createElement('span');
    chevron.innerHTML = CHEVRON;

    row.appendChild(title);
    row.appendChild(cost);
    row.appendChild(chevron);
    return row;
  }

  function packRow(pack, open) {
    const head = doc.createElement('button');
    head.type = 'button';
    head.className = 'evidence-pack';
    head.dataset.packRow = pack.id;
    head.setAttribute('aria-expanded', String(open));
    head.setAttribute('aria-controls', `evidence-levels-${pack.id}`);

    const chevron = doc.createElement('span');
    chevron.innerHTML = CHEVRON;
    const name = doc.createElement('span');
    name.className = 'ev-pack-name';
    name.textContent = pack.name;
    const count = doc.createElement('span');
    count.className = 'ev-pack-count';
    count.textContent = `${pack.levels.length} levels`;

    head.appendChild(chevron);
    head.appendChild(name);
    head.appendChild(count);
    return head;
  }

  function render(mount, shelf, progress, onPick, query) {
    if (!mount || !doc) return;
    const next = nextUnsolved(shelf, progress);
    mount.textContent = '';

    const { q, matches } = matchesFor(shelf, query);

    if (matches.length === 0) {
      const empty = doc.createElement('p');
      empty.className = 'evidence-empty';
      empty.textContent = `No pack or level matches "${String(query || '').trim()}".`;
      mount.appendChild(empty);
      return;
    }

    if (matches.length === 1) state.open[matches[0].pack.id] = true;

    // WHY: an empty query lists every pack - one line each, kept cheap by content-visibility - so
    //      browsing is never capped. The 200 ceiling guards search results only, and it speaks:
    //      silently truncating would lie about what exists.
    const drawn = q === '' ? matches : matches.slice(0, SEARCH_CAP);
    drawn.forEach(({ pack, levels }) => {
      const open = !!state.open[pack.id];
      mount.appendChild(packRow(pack, open));
      if (!open) return;
      const group = doc.createElement('div');
      group.className = 'evidence-levels';
      group.id = `evidence-levels-${pack.id}`;
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', pack.name);
      levels.forEach((level) => {
        group.appendChild(levelRow(pack, level, progress[level.id], next));
      });
      mount.appendChild(group);
    });

    if (q !== '' && matches.length > SEARCH_CAP) {
      const more = doc.createElement('p');
      more.className = 'evidence-more';
      more.textContent = `${matches.length} packs match. Showing the first ${SEARCH_CAP} - keep typing to narrow it.`;
      mount.appendChild(more);
    }

    if (!mount.dataset.wired) {
      mount.dataset.wired = 'true';
      mount.addEventListener('click', (event) => {
        if (!event.target.closest) return;
        const row = event.target.closest('[data-level]');
        if (row) {
          if (onPick) onPick(row.dataset.pack, row.dataset.level);
          return;
        }
        const head = event.target.closest('[data-pack-row]');
        if (head) {
          state.open[head.dataset.packRow] = !state.open[head.dataset.packRow];
          render(mount, shelf, progress, onPick, query);
        }
      });
    }
  }

  host.LoopworksEvidence = { readProgress, writeEntry, nextUnsolved, render, key: KEY };
})();
