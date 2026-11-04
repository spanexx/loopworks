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

  // WHY: one row per level, in pack order, each a button back into Work. Unsolved work says what
  //      it is: the one to do next, or one that is waiting. No row states a rank.
  function render(mount, shelf, progress, onPick) {
    if (!mount || !doc) return;
    const next = nextUnsolved(shelf, progress);
    mount.textContent = '';

    shelf.forEach((pack) => {
      pack.levels.forEach((level) => {
        const entry = progress[level.id];
        const row = doc.createElement('button');
        row.type = 'button';
        row.className = 'evidence-row';
        row.dataset.pack = pack.id;
        row.dataset.level = level.id;

        const main = doc.createElement('span');
        main.className = 'ev-row-main';
        const packName = doc.createElement('span');
        packName.className = 'ev-pack';
        packName.textContent = pack.name;
        const title = doc.createElement('span');
        title.className = 'ev-title';
        title.textContent = level.title;
        main.appendChild(packName);
        main.appendChild(title);

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
        chevron.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

        row.appendChild(main);
        row.appendChild(cost);
        row.appendChild(chevron);
        mount.appendChild(row);
      });
    });

    if (!mount.dataset.wired) {
      mount.dataset.wired = 'true';
      mount.addEventListener('click', (event) => {
        const row = event.target.closest ? event.target.closest('[data-level]') : null;
        if (!row || !onPick) return;
        onPick(row.dataset.pack, row.dataset.level);
      });
    }
  }

  host.LoopworksEvidence = { readProgress, writeEntry, nextUnsolved, render, key: KEY };
})();
