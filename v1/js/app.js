// WHY: the controller is the only file that reads or writes the screen. It never decides a rule:
//      it builds a machine, asks it for one tick at a time, and paints whatever snapshot comes
//      back. The drawer under the board is the input; dragging its top edge lends height from the
//      board and gives it back. The completion list comes from the engine, never from this file.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: first build, following PRD-TRD sections 4-9, 17-21 and 24.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  const doc = host.document;
  const Loopworks = host.Loopworks;
  const LoopworksBoard = host.LoopworksBoard;
  const LoopworksEvidence = host.LoopworksEvidence;
  const LoopworksWords = host.LoopworksWords;

  function id(name) { return doc.getElementById(name); }
  const el = {
    viewWork: id('view-work'),
    viewEvidence: id('view-evidence'),
    wherePack: id('where-pack'),
    whereLevel: id('where-level'),
    prevLevel: id('prev-level'),
    nextLevel: id('next-level'),
    goalTop: id('goal-top'),
    goalStatus: id('goal-status'),
    budgetFact: id('budget-fact'),
    budget: id('budget'),
    fuelFact: id('fuel-fact'),
    fuel: id('fuel'),
    wordsOpen: id('words-open'),
    wordsModal: id('words-modal'),
    wordsClose: id('words-close'),
    wordsList: id('words-list'),
    wordsDetailName: id('words-detail-name'),
    wordsDetailBody: id('words-detail-body'),
    main: id('main'),
    field: id('field'),
    stage: id('stage'),
    board: id('board'),
    verdict: id('verdict'),
    verdictIcon: id('verdict-icon'),
    verdictWord: id('verdict-word'),
    verdictDetail: id('verdict-detail'),
    logIcon: id('log-icon'),
    logLine: id('log-line'),
    logNote: id('log-note'),
    logCount: id('log-count'),
    logToggle: id('log-toggle'),
    logList: id('log-list'),
    splitter: id('splitter'),
    program: id('program'),
    editor: id('editor'),
    gutter: id('gutter'),
    code: id('code'),
    suggest: id('suggest'),
    lineCount: id('line-count'),
    run: id('run'),
    runIcon: id('run-icon'),
    runLabel: id('run-label'),
    step: id('step'),
    reset: id('reset'),
    evidenceList: id('evidence-list')
  };
  const tabs = Array.prototype.slice.call(doc.querySelectorAll('.tab'));

  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20V5M6 11l6-6 6 6"/></svg>';
  const TURN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 18v-6a4 4 0 0 1 4-4h6M14 5l3 3-3 3"/></svg>';
  const GRAB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4v9M8 9l4 4 4-4M5 18h14"/></svg>';
  const DROP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 14V5M8 10l4-4 4 4M5 18h14"/></svg>';
  const ASK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M9.7 9.4a2.4 2.4 0 1 1 3.5 2.2c-.7.4-1.2.9-1.2 1.7"/><path d="M12 16.6v.2"/></svg>';
  const DASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 12h12"/></svg>';
  const DOT = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="3.4"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>';
  const WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3.4 22 20.6H2z"/><path d="M12 9.6v4.6M12 17.6v.2"/></svg>';
  // WHY: the play glyph points up and to the right, so Run reads as a launch next to the level
  //      arrow rather than as another horizontal bar. Pause stays the two upright bars.
  const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path transform="rotate(-45 12 12)" d="M8 5l11 7-11 7z"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="5" width="3.4" height="14"/><rect x="13.6" y="5" width="3.4" height="14"/></svg>';

  const shelf = Loopworks.packs()
    .filter((entry) => entry.errors.length === 0)
    .map((entry) => entry.pack);
  let progress = LoopworksEvidence.readProgress();

  let pack = null;
  let level = null;
  let baseline = null;
  let machine = null;
  let timer = null;
  let running = false;
  let logOpen = false;
  let view = 'work';
  let wordsWord = '';

  const sug = { items: [], index: 0, from: 0, lineEnd: 0, dismissed: false };
  const MIN_PROGRAM = 180;
  const DEFAULT_PROGRAM = 280;

  // ---------------------------------------------------------------- the board and the rail

  function openLevel(nextPack, nextLevel) {
    pause();
    pack = nextPack;
    level = nextLevel;
    machine = null;
    baseline = Loopworks.machine(pack, level.id, '').world();
    logOpen = false;
    el.logList.hidden = true;
    el.logToggle.setAttribute('aria-expanded', 'false');
    setLogLabel();
    sug.dismissed = false;
    hideSuggest();
    el.code.value = '';
    el.wherePack.textContent = pack.name;
    el.whereLevel.textContent = level.title;
    el.goalTop.textContent = level.goalSentence;
    el.goalStatus.textContent = level.goalSentence;
    updateLevelNav();
    // WHY: the icon says what the number is; the hint says it again in words for a screen reader
    //      or a hover.
    const budgetLine = level.budget === 1 ? '1 line' : `${level.budget} lines`;
    el.budget.textContent = String(level.budget);
    el.budgetFact.title = `Line budget: ${budgetLine}`;
    LoopworksBoard.render(el.board, baseline, level);
    resetLog();
    updateFuel(baseline);
    setVerdict('idle', '', 'Write a program, then run it.', DOT);
    updateCount();
    syncGutter();
    fitBoard();
  }

  // WHY: the line runs through both packs, in shelf order, so the arrow after the last depot level
  //      opens the first night-shift level instead of stopping at a pack boundary.
  function lineAt(offset) {
    if (!pack || !level) return null;
    const flat = [];
    shelf.forEach((paper) => paper.levels.forEach((item) => flat.push({ pack: paper, level: item })));
    const at = flat.findIndex((entry) => entry.pack.id === pack.id && entry.level.id === level.id);
    return at < 0 ? null : flat[at + offset] || null;
  }

  function updateLevelNav() {
    const onWork = view === 'work';
    const prev = onWork ? lineAt(-1) : null;
    const next = onWork ? lineAt(1) : null;
    el.prevLevel.hidden = !prev;
    el.nextLevel.hidden = !next;
    if (prev) {
      const label = `Previous level: ${prev.level.title}`;
      el.prevLevel.title = label;
      el.prevLevel.setAttribute('aria-label', label);
    } else {
      el.prevLevel.title = 'Previous level';
      el.prevLevel.setAttribute('aria-label', 'Previous level');
    }
    if (next) {
      const label = `Next level: ${next.level.title}`;
      el.nextLevel.title = label;
      el.nextLevel.setAttribute('aria-label', label);
    } else {
      el.nextLevel.title = 'Next level';
      el.nextLevel.setAttribute('aria-label', 'Next level');
    }
  }

  // WHY: the board is drawn from a snapshot, so its size can follow the room it has and the cells
  //      stay square without the drawer ever covering the board. Only the board is sized: the stage
  //      keeps its width so the verdict and the log never lose their words to a narrow board.
  function fitBoard() {
    if (!level || view !== 'work') return;
    const rows = level.rows.length;
    const cols = level.rows[0].length;
    const widthRoom = el.field.clientWidth - 48;
    const heightRoom = el.field.clientHeight - 36 - 98;
    const byHeight = ((heightRoom - 22 - (rows - 1) * 5) * cols) / rows;
    const width = Math.max(200, Math.min(480, widthRoom, byHeight));
    el.board.style.width = `${Math.round(width)}px`;
  }

  function updateFuel(snapshot) {
    const total = pack && pack.rules ? pack.rules.fuel : null;
    if (!total) { el.fuelFact.hidden = true; return; }
    el.fuelFact.hidden = false;
    const left = snapshot && typeof snapshot.fuelLeft === 'number' ? snapshot.fuelLeft : total;
    el.fuel.textContent = `${left}/${total}`;
    el.fuelFact.title = `Charge left: ${left} of ${total}`;
  }

  // ---------------------------------------------------------------- the verdict

  function setVerdict(tone, word, detail, icon) {
    el.verdict.dataset.tone = tone;
    el.verdict.classList.toggle('is-long', detail.length > 90);
    el.verdictWord.textContent = word;
    el.verdictDetail.textContent = detail;
    el.verdictIcon.innerHTML = icon;
  }

  // ---------------------------------------------------------------- the compact log

  function actionIcon(event) {
    if (event.action === 'forward') return { svg: ARROW, angle: LoopworksBoard.ANGLE[event.drone.dir] || 0 };
    if (event.action === 'turn') return { svg: TURN, angle: 0 };
    if (event.action === 'grab') return { svg: GRAB, angle: 0 };
    if (event.action === 'drop') return { svg: DROP, angle: 0 };
    return { svg: ASK, angle: 0 };
  }

  function resetLog() {
    el.logIcon.innerHTML = DASH;
    el.logIcon.style.transform = '';
    el.logIcon.classList.remove('is-bad');
    el.logLine.textContent = 'No ticks yet';
    el.logNote.textContent = '';
    el.logCount.textContent = '';
    el.logList.textContent = '';
  }

  function sourceLine(line) {
    const source = machine && machine.source ? machine.source : '';
    const lines = String(source).split(/\r?\n/);
    return (lines[line - 1] || '').trim();
  }

  function updateLog(event) {
    const icon = actionIcon(event);
    el.logIcon.innerHTML = icon.svg;
    el.logIcon.style.transform = icon.angle ? `rotate(${icon.angle}deg)` : '';
    el.logIcon.classList.toggle('is-bad', event.ok === false);
    el.logLine.textContent = `L${event.line}`;
    el.logNote.textContent = event.note || event.action;
    el.logCount.textContent = event.tick === 1 ? '1 tick' : `${event.tick} ticks`;
    if (logOpen) renderTrace();
  }

  function renderTrace() {
    el.logList.textContent = '';
    if (!machine) return;
    machine.events.forEach((event) => {
      const icon = actionIcon(event);
      const row = doc.createElement('li');
      if (event.ok === false) row.classList.add('is-bad');
      const n = doc.createElement('span');
      n.className = 'n';
      n.textContent = event.tick;
      const mark = doc.createElement('span');
      mark.className = 't-ico';
      mark.innerHTML = icon.svg;
      if (icon.angle) mark.style.transform = `rotate(${icon.angle}deg)`;
      const code = doc.createElement('code');
      code.textContent = sourceLine(event.line);
      const note = doc.createElement('em');
      note.textContent = event.note;
      row.appendChild(n);
      row.appendChild(mark);
      row.appendChild(code);
      row.appendChild(note);
      el.logList.appendChild(row);
    });
    el.logList.scrollTop = el.logList.scrollHeight;
  }

  function setLogLabel() {
    const label = logOpen ? 'Hide the full trace' : 'Show the full trace';
    el.logToggle.setAttribute('aria-label', label);
    el.logToggle.title = label;
  }

  function toggleLog() {
    logOpen = !logOpen;
    el.logList.hidden = !logOpen;
    el.logToggle.setAttribute('aria-expanded', String(logOpen));
    setLogLabel();
    if (logOpen) renderTrace();
  }

  // ---------------------------------------------------------------- the run

  function setRunButton() {
    el.runIcon.innerHTML = running ? PAUSE : PLAY;
    el.runLabel.textContent = running ? 'Pause' : 'Run';
    el.run.title = running ? 'Pause the program (Ctrl+Enter)' : 'Run the program (Ctrl+Enter)';
  }

  function pause() {
    if (timer !== null) {
      host.clearInterval(timer);
      timer = null;
    }
    running = false;
    setRunButton();
  }

  function runTick() {
    if (!machine) return;
    const status = machine.tick();
    const snapshot = machine.world();
    if (snapshot) LoopworksBoard.render(el.board, snapshot, level);
    updateFuel(snapshot);
    const event = machine.events[machine.events.length - 1];
    if (event) updateLog(event);
    if (status.done) finish(status);
  }

  function finish(status) {
    pause();
    if (status.status === 'solved') {
      const entry = {
        lines: status.linesUsed,
        ticks: status.ticks,
        budget: level.budget,
        within: status.linesUsed <= level.budget
      };
      progress = LoopworksEvidence.writeEntry(level.id, entry);
      const over = status.linesUsed > level.budget ? ', over budget' : '';
      setVerdict('solved', 'Solved', `${status.linesUsed} of ${level.budget} lines${over}`, CHECK);
    } else {
      const last = machine.events[machine.events.length - 1];
      let detail = status.reason;
      if (status.reason === 'program ended') detail = 'program ended - the goal is not met';
      else if (last) detail = `${status.reason} at line ${last.line}`;
      setVerdict('stuck', 'Stuck', detail, WARN);
    }
    if (logOpen) renderTrace();
  }

  function startRun() {
    if (running) { pause(); return; }
    if (!machine || machine.status.done) {
      machine = Loopworks.machine(pack, level.id, el.code.value);
      LoopworksBoard.render(el.board, baseline, level);
      resetLog();
      updateFuel(baseline);
      if (machine.error) {
        setVerdict('stuck', 'Stuck', `parse error - ${machine.error}`, WARN);
        return;
      }
    }
    running = true;
    setRunButton();
    timer = host.setInterval(runTick, 240);
    runTick();
  }

  function stepOnce() {
    pause();
    if (!machine || machine.status.done) {
      machine = Loopworks.machine(pack, level.id, el.code.value);
      LoopworksBoard.render(el.board, baseline, level);
      resetLog();
      updateFuel(baseline);
      if (machine.error) {
        setVerdict('stuck', 'Stuck', `parse error - ${machine.error}`, WARN);
        return;
      }
    }
    runTick();
  }

  function resetRun() {
    pause();
    machine = null;
    LoopworksBoard.render(el.board, baseline, level);
    resetLog();
    updateFuel(baseline);
    setVerdict('idle', '', 'Write a program, then run it.', DOT);
  }

  // ---------------------------------------------------------------- editing

  function updateCount() {
    const count = Loopworks.parse(el.code.value).lineCount;
    el.lineCount.textContent = count === 1 ? '1 line' : `${count} lines`;
  }

  function syncGutter() {
    const count = el.code.value.split('\n').length;
    const numbers = [];
    for (let n = 1; n <= count; n += 1) numbers.push(n);
    el.gutter.textContent = numbers.join('\n');
    el.gutter.scrollTop = el.code.scrollTop;
  }

  // WHY: editing the source makes the last run a lie, so the board returns to its untouched state
  //      and the trace clears. The program itself is never saved or thrown away.
  function programChanged() {
    pause();
    machine = null;
    LoopworksBoard.render(el.board, baseline, level);
    resetLog();
    updateFuel(baseline);
    setVerdict('idle', '', 'Write a program, then run it.', DOT);
    updateCount();
    syncGutter();
  }

  // ---------------------------------------------------------------- typing help

  // WHY: a program that outgrows the drawer has to keep the line being typed in view. The snap
  //      only applies when the caret has no line under it, so editing an earlier line never moves
  //      the view. snapGuard survives the scroll event, because a scroll the app asked for must not
  //      dismiss the completion list the player is reading.
  let snapGuard = false;
  let quiet = 0;

  function snapToLastLine() {
    if (el.code.value.indexOf('\n', el.code.selectionStart) !== -1) return;
    const bottom = el.code.scrollHeight - el.code.clientHeight;
    if (bottom <= 0 || Math.abs(el.code.scrollTop - bottom) < 1) return;
    snapGuard = true;
    el.code.scrollTop = bottom;
    el.gutter.scrollTop = bottom;
  }

  // WHY: execCommand joins the browser's own undo history, so Ctrl+Z walks back through accepted
  //      words and auto-indents like any other typing. setRangeText is the fallback when it refuses.
  function insertText(text) {
    el.code.focus();
    quiet += 1;
    try {
      let done = false;
      try { done = doc.execCommand('insertText', false, text); } catch (err) { done = false; }
      if (!done) {
        el.code.setRangeText(text, el.code.selectionStart, el.code.selectionEnd, 'end');
      }
    } finally {
      quiet -= 1;
    }
  }

  function deleteSelection() {
    el.code.focus();
    quiet += 1;
    try {
      let done = false;
      try { done = doc.execCommand('delete'); } catch (err) { done = false; }
      if (!done) {
        el.code.setRangeText('', el.code.selectionStart, el.code.selectionEnd, 'end');
      }
    } finally {
      quiet -= 1;
    }
  }

  function indentOf(text) {
    return /^[\t ]*/.exec(text)[0];
  }

  // WHY: "end" closes the nearest repeat that is still open. Walking up and counting finished
  //      blocks makes a nested end snap to its parent, not to the first repeat it passes.
  function repeatIndent(lineStart) {
    const above = el.code.value.slice(0, lineStart).split('\n');
    let depth = 0;
    for (let at = above.length - 1; at >= 0; at -= 1) {
      const text = above[at].trim();
      if (text === 'end') { depth += 1; continue; }
      if (/^repeat \d+$/.test(text)) {
        if (depth === 0) return indentOf(above[at]);
        depth -= 1;
      }
    }
    return '';
  }

  function dedentEndLine() {
    const line = caretLine();
    if (line.text.trim() !== 'end') return;
    const want = repeatIndent(line.start);
    const have = indentOf(line.text);
    if (have === want) return;
    const caret = el.code.selectionStart;
    el.code.setSelectionRange(line.start, line.start + have.length);
    insertText(want);
    const next = Math.max(line.start + want.length, caret + want.length - have.length);
    el.code.setSelectionRange(next, next);
  }

  function outdentLine() {
    const line = caretLine();
    const have = indentOf(line.text);
    if (!have) return;
    const remove = Math.min(2, have.length);
    const caret = el.code.selectionStart;
    el.code.setSelectionRange(line.start, line.start + remove);
    deleteSelection();
    const next = Math.max(line.start, caret - remove);
    el.code.setSelectionRange(next, next);
    snapToLastLine();
    programChanged();
    refreshSuggest(false);
  }

  // ---------------------------------------------------------------- completion

  const mirror = doc.createElement('div');
  mirror.className = 'measure';
  mirror.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(mirror);

  function caretLine() {
    const value = el.code.value;
    const at = el.code.selectionStart;
    const start = value.lastIndexOf('\n', at - 1) + 1;
    const next = value.indexOf('\n', at);
    const end = next === -1 ? value.length : next;
    return { start, end, text: value.slice(start, end) };
  }

  function caretPoint() {
    const style = host.getComputedStyle(el.code);
    mirror.style.font = style.font;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.padding = style.padding;
    mirror.style.borderWidth = style.borderWidth;
    mirror.style.tabSize = style.tabSize;
    mirror.style.width = `${el.code.clientWidth}px`;
    mirror.textContent = el.code.value.slice(0, el.code.selectionStart);
    const mark = doc.createElement('span');
    mark.textContent = '\u200b';
    mirror.appendChild(mark);
    const box = mirror.getBoundingClientRect();
    const point = mark.getBoundingClientRect();
    const field = el.code.getBoundingClientRect();
    const frame = el.editor.getBoundingClientRect();
    return {
      left: (field.left - frame.left) + (point.left - box.left) - el.code.scrollLeft,
      top: (field.top - frame.top) + (point.top - box.top) - el.code.scrollTop + point.height,
      height: point.height
    };
  }

  function hideSuggest() {
    sug.items = [];
    sug.index = 0;
    el.suggest.hidden = true;
    el.suggest.textContent = '';
    el.code.removeAttribute('aria-activedescendant');
  }

  function renderSuggest() {
    el.suggest.textContent = '';
    sug.items.forEach((item, index) => {
      const option = doc.createElement('div');
      option.className = 'suggest-option';
      option.id = `sug-${index}`;
      option.dataset.index = String(index);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === sug.index));
      option.textContent = item.trim();
      el.suggest.appendChild(option);
    });
    el.code.setAttribute('aria-activedescendant', `sug-${sug.index}`);
  }

  function positionSuggest() {
    const point = caretPoint();
    const left = Math.max(0, Math.min(point.left, el.editor.clientWidth - 170));
    el.suggest.style.maxHeight = '';
    const height = el.suggest.offsetHeight;
    const below = el.editor.clientHeight - point.top - 2;
    const above = point.top - point.height - 4;
    // WHY: with the view snapped to the last line the caret sits at the bottom edge, so a list that
    //      only opens downward would land outside the drawer. It opens where the room is, and
    //      shrinks with its own scrollbar rather than spilling over the run button.
    const flip = height > below && above > below;
    if (flip) {
      const room = Math.max(40, Math.min(height, above));
      el.suggest.style.maxHeight = `${room}px`;
      el.suggest.style.top = `${Math.round(Math.max(0, point.top - point.height - room - 2))}px`;
    } else {
      if (height > below) el.suggest.style.maxHeight = `${Math.max(40, below)}px`;
      el.suggest.style.top = `${Math.round(point.top + 2)}px`;
    }
    el.suggest.style.left = `${Math.round(left)}px`;
  }

  function refreshSuggest(force) {
    if (!pack) return;
    if (!force && sug.dismissed) return;
    if (doc.activeElement !== el.code) { hideSuggest(); return; }
    const line = caretLine();
    const answer = Loopworks.suggest(pack, line.text);
    if (!answer.items.length) { hideSuggest(); return; }
    sug.items = answer.items;
    sug.from = line.start + answer.from;
    sug.lineEnd = line.end;
    if (force || sug.index >= sug.items.length) sug.index = 0;
    renderSuggest();
    el.suggest.hidden = false;
    positionSuggest();
  }

  function acceptSuggestion() {
    const item = sug.items[sug.index];
    if (!item) return;
    // WHY: a verb needs its space before the number; a guard or "repeat" brings its own, and a
    //      second one would leave a double gap.
    const text = /\s$/.test(item) ? item : `${item} `;
    const caret = sug.from + text.length;
    el.code.setSelectionRange(sug.from, sug.lineEnd);
    insertText(text);
    el.code.setSelectionRange(caret, caret);
    hideSuggest();
    sug.dismissed = false;
    dedentEndLine();
    snapToLastLine();
    programChanged();
    el.code.focus();
  }

  // ---------------------------------------------------------------- the drawer

  function clampHeight(height) {
    const mainHeight = el.main.getBoundingClientRect().height;
    const max = Math.max(MIN_PROGRAM, mainHeight - 220);
    return Math.max(MIN_PROGRAM, Math.min(height, max));
  }

  function setProgramHeight(height) {
    const next = clampHeight(height);
    el.program.style.height = `${next}px`;
    const mainHeight = el.main.getBoundingClientRect().height || 1;
    el.splitter.setAttribute('aria-valuenow', String(Math.round((next / mainHeight) * 100)));
  }

  let drag = null;

  function initSplitter() {
    el.splitter.addEventListener('pointerdown', (event) => {
      drag = { y: event.clientY, height: el.program.getBoundingClientRect().height };
      el.splitter.setPointerCapture(event.pointerId);
      doc.body.classList.add('is-dragging');
      event.preventDefault();
    });
    el.splitter.addEventListener('pointermove', (event) => {
      if (!drag) return;
      setProgramHeight(drag.height - (event.clientY - drag.y));
    });
    el.splitter.addEventListener('pointerup', (event) => {
      if (!drag) return;
      drag = null;
      doc.body.classList.remove('is-dragging');
      if (el.splitter.hasPointerCapture(event.pointerId)) el.splitter.releasePointerCapture(event.pointerId);
    });
    el.splitter.addEventListener('pointercancel', () => {
      drag = null;
      doc.body.classList.remove('is-dragging');
    });
    el.splitter.addEventListener('dblclick', () => setProgramHeight(DEFAULT_PROGRAM));
    el.splitter.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const step = event.key === 'ArrowUp' ? 24 : -24;
      setProgramHeight(el.program.getBoundingClientRect().height + step);
    });
  }

  // ---------------------------------------------------------------- views

  function showView(name) {
    const next = name === 'evidence' ? 'evidence' : 'work';
    if (view === 'work' && next === 'evidence') pause();
    view = next;
    doc.body.classList.toggle('is-evidence', next === 'evidence');
    el.viewWork.hidden = next !== 'work';
    el.viewEvidence.hidden = next !== 'evidence';
    tabs.forEach((tab) => {
      const on = tab.dataset.view === next;
      tab.classList.toggle('is-on', on);
      tab.setAttribute('aria-pressed', String(on));
    });
    updateLevelNav();
    if (next === 'evidence') {
      LoopworksEvidence.render(el.evidenceList, shelf, progress, pick);
    } else {
      fitBoard();
    }
  }

  function pick(packId, levelId) {
    const foundPack = shelf.find((entry) => entry.id === packId);
    const foundLevel = foundPack && foundPack.levels.find((entry) => entry.id === levelId);
    if (!foundLevel) return;
    openLevel(foundPack, foundLevel);
    showView('work');
    el.code.focus();
  }

  // ---------------------------------------------------------------- the words dialog

  function chooseWord(word) {
    wordsWord = word;
    el.wordsDetailName.textContent = word;
    el.wordsDetailBody.textContent = LoopworksWords.describe(word);
    Array.prototype.forEach.call(el.wordsList.querySelectorAll('[data-word]'), (button) => {
      button.setAttribute('aria-pressed', String(button.dataset.word === word));
    });
  }

  // WHY: the first word is already open, so the dialog never shows an empty page; the word read
  //      last time is still open when the list comes back.
  function openWords() {
    if (!pack) return;
    const words = LoopworksWords.list(pack);
    LoopworksWords.render(el.wordsList, pack, chooseWord);
    chooseWord(words.indexOf(wordsWord) >= 0 ? wordsWord : words[0]);
    el.wordsModal.showModal();
    const chosen = el.wordsList.querySelector('[aria-pressed="true"]');
    (chosen || el.wordsClose).focus();
  }

  function closeWords() {
    if (el.wordsModal.open) el.wordsModal.close();
  }

  // ---------------------------------------------------------------- wiring

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });
  el.run.addEventListener('click', startRun);
  el.step.addEventListener('click', stepOnce);
  el.reset.addEventListener('click', resetRun);
  el.logToggle.addEventListener('click', toggleLog);
  el.wordsOpen.addEventListener('click', openWords);
  el.wordsClose.addEventListener('click', closeWords);
  // WHY: a click on the backdrop arrives with the dialog itself as the target, while a click on
  //      the sheet is on one of its children.
  el.wordsModal.addEventListener('click', (event) => {
    if (event.target === el.wordsModal) closeWords();
  });
  el.prevLevel.addEventListener('click', () => {
    const prev = lineAt(-1);
    if (!prev) return;
    openLevel(prev.pack, prev.level);
    showView('work');
    el.code.focus();
  });
  el.nextLevel.addEventListener('click', () => {
    const next = lineAt(1);
    if (!next) return;
    openLevel(next.pack, next.level);
    showView('work');
    el.code.focus();
  });

  el.code.addEventListener('input', (event) => {
    if (quiet) return;
    sug.dismissed = false;
    // WHY: walking the undo history must not re-apply the dedent it just undid.
    if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') dedentEndLine();
    snapToLastLine();
    programChanged();
    refreshSuggest(false);
  });
  el.code.addEventListener('scroll', () => {
    el.gutter.scrollTop = el.code.scrollTop;
    if (snapGuard) { snapGuard = false; return; }
    if (sug.items.length) hideSuggest();
  });
  el.code.addEventListener('blur', () => hideSuggest());
  el.code.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape' && sug.items.length) {
      event.preventDefault();
      sug.dismissed = true;
      hideSuggest();
      return;
    }
    if (event.key === 'ArrowDown' && sug.items.length) {
      event.preventDefault();
      sug.index = (sug.index + 1) % sug.items.length;
      renderSuggest();
      return;
    }
    if (event.key === 'ArrowUp' && sug.items.length) {
      event.preventDefault();
      sug.index = (sug.index - 1 + sug.items.length) % sug.items.length;
      renderSuggest();
      return;
    }
    if (event.key === 'Tab') {
      if (event.shiftKey) {
        event.preventDefault();
        outdentLine();
        return;
      }
      if (sug.items.length) {
        event.preventDefault();
        acceptSuggestion();
        return;
      }
      if (el.code.value.trim() === '') {
        event.preventDefault();
        sug.dismissed = false;
        refreshSuggest(true);
        return;
      }
      event.preventDefault();
      insertText('  ');
      snapToLastLine();
      programChanged();
      refreshSuggest(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        hideSuggest();
        startRun();
        return;
      }
      const line = caretLine();
      const indent = indentOf(line.text);
      // WHY: a repeat line is the only line whose Enter opens a block, so it is the only one that
      //      adds the body's two spaces. Everything else keeps the indent it already had.
      const opens = /^repeat \d+$/.test(line.text.trim()) && el.code.selectionStart === line.end;
      insertText(`\n${indent}${opens ? '  ' : ''}`);
      hideSuggest();
      sug.dismissed = false;
      snapToLastLine();
      programChanged();
    }
  });
  el.suggest.addEventListener('mousedown', (event) => {
    const option = event.target.closest ? event.target.closest('.suggest-option') : null;
    if (!option) return;
    event.preventDefault();
    sug.index = Number(option.dataset.index);
    acceptSuggestion();
  });
  doc.addEventListener('pointerdown', (event) => {
    if (el.suggest.hidden) return;
    if (el.suggest.contains(event.target) || event.target === el.code) return;
    hideSuggest();
  });

  host.addEventListener('resize', () => {
    setProgramHeight(el.program.getBoundingClientRect().height);
    fitBoard();
  });

  if (host.ResizeObserver) {
    new host.ResizeObserver(() => fitBoard()).observe(el.field);
  }

  // ---------------------------------------------------------------- boot

  initSplitter();
  setRunButton();
  const next = LoopworksEvidence.nextUnsolved(shelf, progress);
  const start = next || (shelf.length ? { pack: shelf[0], level: shelf[0].levels[0] } : null);
  if (!start) {
    setVerdict('stuck', 'Stuck', 'No pack on the shelf.', WARN);
  } else {
    openLevel(start.pack, start.level);
    setProgramHeight(DEFAULT_PROGRAM);
    showView(next ? 'work' : 'evidence');
    if (next && host.matchMedia && host.matchMedia('(min-width: 901px)').matches) el.code.focus();
  }
})();
