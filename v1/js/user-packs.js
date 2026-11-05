// WHY: a player can put a level into the app on the machine they are sitting at, with no rebuild and no
//      code. The rule that makes this safe is that nothing here is a program: the text is read as data,
//      checked by the engine's own validator, kept under one storage key, and handed to register()
//      before js/app.js reads the shelf - which is why the controller never learns this file exists.
//      Nothing asks a server anything, and nothing runs a script that came out of a file.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: built to PRD-TRD-loopworks-level-import.md sections 6 to 11 and the decisions
//      locked in GRILL-loopworks-level-import.txt.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  const engine = host.Loopworks;
  const doc = host.document;

  const KEY = 'loopworks.app.user-packs.v1';
  // WHY: the board is drawn to fit the room a phone leaves, and every shipped level is 13 cells across
  //      or fewer. Twenty-four keeps a map someone else wrote inside the sizes the layout is proven at.
  const MAX_CELLS = 24;
  // WHY: one file should not bury the level line. Twenty packs the size of The Depot is already a course.
  const MAX_LEVELS = 20;

  function storeOf(given) {
    const holder = given || host;
    return holder && holder.localStorage ? holder.localStorage : null;
  }

  function tell(report, message) {
    if (typeof report === 'function') report(message);
  }

  // WHY: a key this module cannot read is a broken record, not a broken game. It reads as no added
  //      levels and says so, because the shipped levels have to open whatever one file contains.
  function read(given, report) {
    const store = storeOf(given);
    if (!store) return [];
    let raw = null;
    try {
      raw = store.getItem(KEY);
    } catch (err) {
      tell(report, `the levels kept under "${KEY}" could not be reached, so none of them were used.`);
      return [];
    }
    if (!raw) return [];
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      tell(report, `the levels kept under "${KEY}" are not text this app can read, so none of them were used.`);
      return [];
    }
    if (!Array.isArray(parsed)) {
      tell(report, `the levels kept under "${KEY}" are not a list of level packs, so none of them were used.`);
      return [];
    }
    return parsed;
  }

  function write(list, given) {
    const store = storeOf(given);
    if (!store) return { ok: false, errors: ['this browser has no room to keep an added level.'] };
    try {
      store.setItem(KEY, JSON.stringify(list));
    } catch (err) {
      return { ok: false, errors: ['this browser would not keep the level. It is probably full, or the page is open in a private window.'] };
    }
    return { ok: true, errors: [] };
  }

  function remove(id, given) {
    const kept = read(given).filter((pack) => !pack || pack.id !== id);
    return write(kept, given);
  }

  function knownIds(shelf) {
    const list = shelf || engine.packs().map((entry) => entry.pack);
    const packs = [];
    const levels = [];
    (list || []).forEach((pack) => {
      if (!pack || typeof pack !== 'object') return;
      if (pack.id) packs.push(pack.id);
      (Array.isArray(pack.levels) ? pack.levels : []).forEach((level) => {
        if (level && typeof level === 'object' && level.id) levels.push(level.id);
      });
    });
    return { packs, levels };
  }

  function sizeErrors(pack, errors) {
    const levels = Array.isArray(pack.levels) ? pack.levels : [];
    if (levels.length > MAX_LEVELS) {
      errors.push(`pack "${pack.id}" holds ${levels.length} levels; a pack added here holds at most ${MAX_LEVELS}.`);
    }
    levels.forEach((level) => {
      if (!level || typeof level !== 'object') return;
      const where = `level "${level.id}"`;
      if (!Array.isArray(level.rows) || level.rows.length === 0) return;
      if (level.rows.length > MAX_CELLS) {
        errors.push(`${where} in pack "${pack.id}" is ${level.rows.length} cells tall; a board is at most ${MAX_CELLS} cells wide and tall.`);
      }
      const width = typeof level.rows[0] === 'string' ? level.rows[0].length : 0;
      if (width > MAX_CELLS) {
        errors.push(`${where} in pack "${pack.id}" is ${width} cells across; a board is at most ${MAX_CELLS} cells wide and tall.`);
      }
    });
  }

  function idErrors(candidate, known, seen, errors) {
    if (known.packs.indexOf(candidate.id) !== -1) {
      errors.push(`a pack called "${candidate.id}" is already in the app. An added pack needs an id of its own.`);
    }
    if (seen.packs.indexOf(candidate.id) !== -1) {
      errors.push(`two added packs share the id "${candidate.id}".`);
    }
    seen.packs.push(candidate.id);
    (Array.isArray(candidate.levels) ? candidate.levels : []).forEach((level) => {
      if (!level || typeof level !== 'object' || !level.id) return;
      if (known.levels.indexOf(level.id) !== -1) {
        errors.push(`a level called "${level.id}" is already in the app. Level ids are where the record of a solved level lives, so an added level needs an id of its own.`);
      }
      if (seen.levels.indexOf(level.id) !== -1) {
        errors.push(`two added levels share the id "${level.id}".`);
      }
      seen.levels.push(level.id);
    });
  }

  // WHY: the engine's sentences come first, because they are the ones an author reads in the harness.
  //      The size caps and the id collisions are this file's own rules, and they run before anything is
  //      saved so a bad pack is refused while the player is still looking at the box they typed it into.
  function validate(candidates, shelf) {
    const errors = [];
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return { ok: false, errors: ['there is nothing to add yet: a pack is one level pack written between { and }.'] };
    }
    const known = knownIds(shelf);
    const seen = { packs: [], levels: [] };
    candidates.forEach((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        errors.push('an added pack has to be one level pack written between { and }, not a list of them.');
        return;
      }
      if (typeof candidate.id !== 'string' || !candidate.id) {
        errors.push('an added pack has no id. The id is how this app tells one pack from another.');
        return;
      }
      engine.validatePack(candidate).forEach((message) => errors.push(message));
      sizeErrors(candidate, errors);
      idErrors(candidate, known, seen, errors);
    });
    return { ok: errors.length === 0, errors };
  }

  // WHY: text first, then data. A file ending in .js is refused here for the same reason a pasted one
  //      is: it is not data, and this app does not run what a stranger wrote.
  function parse(text) {
    if (typeof text !== 'string' || text.trim() === '') {
      return { ok: false, packs: [], errors: ['there is nothing to add yet: paste the level pack, or pick a .json file.'] };
    }
    let value = null;
    try {
      value = JSON.parse(text);
    } catch (err) {
      return { ok: false, packs: [], errors: ['that is not a level pack: it does not read as data between { and }. A level pack is JSON, never a script.'] };
    }
    return { ok: true, packs: Array.isArray(value) ? value : [value], errors: [] };
  }

  // WHY: called once when the page loads this file, which is before js/app.js reads the shelf. A pack
  //      that does not hold up is left off and reported; the shipped levels keep working.
  function load(given) {
    const errors = [];
    const stored = read(given, (message) => errors.push(message));
    if (stored.length === 0) return { ok: errors.length === 0, loaded: [], errors };
    const verdict = validate(stored);
    if (!verdict.ok) {
      verdict.errors.forEach((message) => errors.push(message));
      return { ok: false, loaded: [], errors };
    }
    stored.forEach((pack) => engine.register(pack));
    return { ok: true, loaded: stored.slice(), errors };
  }

  // WHY: registering has to happen while this file is being read, because js/app.js asks for the shelf
  //      on the next line. A pack that no longer holds up is not dropped quietly: the reason is kept for
  //      the dialog, so the player finds out where they would go to fix it.
  const boot = load(host);

  host.LoopworksUserPacks = { KEY, MAX_CELLS, MAX_LEVELS, read, write, remove, validate, parse, load, added: boot.loaded, problems: boot.errors };

  // ---------------------------------------------------------------- the dialog

  // WHY: the harness runs this file with no document, so the page behaviour sits behind one test instead
  //      of a guard on every function. The registration above has to happen either way.
  if (!doc) return;

  function id(name) { return doc.getElementById(name); }
  const el = {
    open: id('pack-add-open'),
    modal: id('pack-add-modal'),
    close: id('pack-add-close'),
    text: id('pack-add-text'),
    file: id('pack-add-file'),
    save: id('pack-add-save'),
    error: id('pack-add-error'),
    list: id('pack-add-list')
  };

  // WHY: one problem to a line. Three of the engine's sentences run together into one paragraph read as
  //      a wall, and the player has to find the row the pack got wrong.
  function showProblems(lines) {
    el.error.textContent = lines.join('\n');
    el.error.hidden = lines.length === 0;
  }

  // WHY: the row is built with textContent, never a markup string. A pack name arrives from a file
  //      someone else wrote, and it must not be able to put a tag into this page.
  function renderList() {
    el.list.textContent = '';
    const stored = read(host);
    if (stored.length === 0) {
      const none = doc.createElement('p');
      none.className = 'pack-add-empty';
      none.textContent = 'Nothing has been added on this machine yet.';
      el.list.appendChild(none);
      return;
    }
    stored.forEach((pack) => {
      if (!pack || typeof pack !== 'object' || !pack.id) return;
      const row = doc.createElement('div');
      row.className = 'pack-add-row';
      const name = doc.createElement('span');
      name.className = 'pack-add-name';
      name.textContent = pack.name || pack.id;
      const count = doc.createElement('span');
      count.className = 'pack-add-count';
      count.textContent = `${(Array.isArray(pack.levels) ? pack.levels.length : 0)} levels under ${pack.id}`;
      const drop = doc.createElement('button');
      drop.type = 'button';
      drop.className = 'pack-add-remove';
      drop.dataset.pack = pack.id;
      drop.textContent = 'Remove';
      row.appendChild(name);
      row.appendChild(count);
      row.appendChild(drop);
      el.list.appendChild(row);
    });
  }

  function open() {
    renderList();
    showProblems(boot.errors);
    if (el.modal.showModal) el.modal.showModal();
    else el.modal.setAttribute('open', '');
  }

  function addIt() {
    showProblems([]);
    const parsed = parse(el.text.value);
    if (!parsed.ok) {
      showProblems(parsed.errors);
      return;
    }
    const verdict = validate(parsed.packs);
    if (!verdict.ok) {
      showProblems(verdict.errors);
      return;
    }
    const written = write(read(host).concat(parsed.packs), host);
    if (!written.ok) {
      showProblems(written.errors);
      return;
    }
    // WHY: the shelf is read once, by js/app.js, and rebuilding the level line, the Dictionary and the
    //      Evidence list underneath a live shelf is a bigger change than reloading the page with the
    //      data already saved.
    host.location.reload();
  }

  el.open.addEventListener('click', open);
  el.close.addEventListener('click', () => el.modal.close());
  el.save.addEventListener('click', addIt);
  el.file.addEventListener('change', () => {
    const picked = el.file.files && el.file.files[0];
    if (!picked) return;
    const reader = new host.FileReader();
    reader.onload = () => {
      el.text.value = String(reader.result);
      showProblems([]);
    };
    reader.onerror = () => showProblems(['that file could not be read.']);
    reader.readAsText(picked);
  });
  el.list.addEventListener('click', (event) => {
    const row = event.target.closest ? event.target.closest('[data-pack]') : null;
    if (!row) return;
    remove(row.dataset.pack, host);
    host.location.reload();
  });
})();
