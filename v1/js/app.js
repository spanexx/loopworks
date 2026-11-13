// WHY: the controller is the only file that reads or writes the screen. It never decides a rule:
//      it builds a machine, asks it for one tick at a time, and paints whatever snapshot comes
//      back. The drawer under the board is the input; dragging its top edge lends height from the
//      board and gives it back. The completion list comes from the engine, never from this file.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: first build, following PRD-TRD sections 4-9, 17-21 and 24.
// 2026-11-04 qoder-agent: the typing layout - the controller keeps the board on screen while the
//      soft keyboard is up, following PRD-TRD section 28 and GRILL entry 30.
// 2026-11-04 qoder-agent: the phone drawer is one row - the run buttons flank the line being typed
//      and its height is pulled from one line by the edge, following GRILL entry 32.
// 2026-11-08 qoder-agent: the buttons find their homes - Step and Reset on the drone panel's own
//      corners, Run and the level arrows pinned inside the typing box, and a touch acting on the
//      first tap - following GRILL-loopworks-input-area decisions 1-6.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  const doc = host.document;
  const Loopworks = host.Loopworks;
  const LoopworksBoard = host.LoopworksBoard;
  const LoopworksEvidence = host.LoopworksEvidence;
  const LoopworksWords = host.LoopworksWords;
  const LoopworksSound = host.LoopworksSound;
  const LoopworksStudio = host.LoopworksStudio;
  const LoopworksStudioView = host.LoopworksStudioView;

  function id(name) { return doc.getElementById(name); }
  const el = {
    viewWork: id('view-work'),
    viewEvidence: id('view-evidence'),
    viewStudio: id('view-studio'),
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
    clawFact: id('claw-fact'),
    claw: id('claw'),
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
    evidenceList: id('evidence-list'),
    evidenceSearch: id('evidence-search'),
    evidenceNext: id('evidence-next'),
    evidenceNextName: id('evidence-next-name'),
    aim: id('aim'),
    aimLine: id('aim-line'),
    aimWords: id('aim-words'),
    studioBody: id('studio-body')
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
  // WHY: the studio's marks are read once and kept in step with every write, so drawing the studio
  //      never has to touch storage and a finished context survives the view being rebuilt.
  let wordsRecord = LoopworksStudio.read();

  const sug = { items: [], index: 0, from: 0, lineEnd: 0, dismissed: false };
  const MIN_PROGRAM = 180;
  const DEFAULT_PROGRAM = 280;
  // WHY: on a phone the drawer is one row with the buttons beside the line, so its resting height
  //      is that one line - the 42 px editor and the drawer's bottom padding - and the learner
  //      pulls it taller from there instead of starting from a box three lines deep.
  const ONE_LINE = 50;
  const TIGHT_HEIGHT = 340;

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
    // WHY: a hole level's aim is a sequence, so the goal bar carries a slot for each label. The
    //      baseline has no labels yet, so every slot starts empty.
    renderGoal(level, baseline);
    updateLevelNav();
    // WHY: the icon says what the number is; the hint says it again in words for a screen reader
    //      or a hover.
    const budgetLine = level.budget === 1 ? '1 line' : `${level.budget} lines`;
    el.budget.textContent = String(level.budget);
    el.budgetFact.title = `Line budget: ${budgetLine}`;
    LoopworksBoard.render(el.board, baseline, level);
    resetLog();
    updateFuel(baseline);
    updateClaw(baseline);
    setVerdict('idle', '', 'Write a program, then run it.', DOT);
    updateCount();
    syncGutter();
    fitBoard();
  }

  // WHY: the claw fact belongs to a level that carries a word and to no other. It shows the label the
  //      drone holds, "crate" for an unlabelled one, and "nothing" with an empty claw - a fact about
  //      this run, never a count or a rating. Keeping the fact in one function means every place that
  //      repaints the board paints the claw with the same rule.
  // 2026-11-13 agent: added for the v2 word pack, following GRILL-loopworks-v2-subject entry 10.
  function updateClaw(snapshot) {
    const wordLevel = !!(level && level.word);
    el.clawFact.hidden = !wordLevel;
    if (!wordLevel) return;
    el.claw.textContent = LoopworksBoard.carried(snapshot) || 'nothing';
  }

  // WHY: a hole level's goal bar carries the sequence, one slot per wanted label, filled as labels
  //      land. It never prints a fraction or a count: what is in the hole is evidence, and the
  //      sequence is the aim (loopworks-labelled-crate, GRILL decisions 9 and 10).
  // 2026-11-13 agent: added for the first capability v2 needs.
  function goalSequence(level) {
    return level && level.goal && level.goal.kind === 'hole' && Array.isArray(level.goal.sequence)
      ? level.goal.sequence : null;
  }

  function paintGoal(mount, level, snap) {
    mount.textContent = level.goalSentence;
    const sequence = goalSequence(level);
    if (!sequence) return;
    const row = doc.createElement('span');
    row.className = 'goal-seq';
    // WHY: the sentence above already names the word. The slots are the same aim drawn once, so a
    //      screen reader gets one copy rather than a row of empty boxes.
    row.setAttribute('aria-hidden', 'true');
    const landed = snap && Array.isArray(snap.hole) ? snap.hole : [];
    sequence.forEach((label, index) => {
      const slot = doc.createElement('span');
      slot.className = 'goal-slot';
      if (landed[index]) {
        slot.classList.add('is-landed');
        slot.textContent = landed[index];
      }
      row.appendChild(slot);
    });
    mount.appendChild(doc.createTextNode(' '));
    mount.appendChild(row);
  }

  function renderGoal(level, snap) {
    if (!level) return;
    paintGoal(el.goalTop, level, snap);
    paintGoal(el.goalStatus, level, snap);
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
    // WHY: the field's own padding is read from the sheet, not guessed here - a phone narrows it and
    //      typing narrows it again - so the board is always sized against the room that is really
    //      inside the box it has to fit in.
    const pad = host.getComputedStyle(el.field);
    const stagePad = Math.round(parseFloat(host.getComputedStyle(el.stage).paddingTop) || 0);
    const roomX = Math.round(parseFloat(pad.paddingLeft) + parseFloat(pad.paddingRight));
    const roomY = Math.round(parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom));
    const widthRoom = el.field.clientWidth - roomX;
    // WHY: 98 is the verdict and the log under the board. While typing, the sheet hides that pair,
    //      so reserving their height would shrink the board against room that is no longer there
    //      and pin it to its floor. The floor itself is lower while typing, because a board that
    //      overflows its own box hides the line being typed. The stage's top strip holds the Step
    //      and Reset corners and is spent on every width, keyboard or not.
    const typing = typingOn();
    const heightRoom = el.field.clientHeight - roomY - stagePad - (typing ? 0 : 98);
    const byHeight = ((heightRoom - 22 - (rows - 1) * 5) * cols) / rows;
    const width = Math.max(typing ? 120 : 200, Math.min(480, widthRoom, byHeight));
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

  // WHY: the ear follows the eye. A tick that is not a hand or an ending is the move tick, and an
  //      ending replaces the tick it lands on rather than layering over it, so the two never
  //      argue about what just happened.
  function tickCue(event) {
    return event.action === 'grab' || event.action === 'drop' ? 'grab' : 'move';
  }

  function endingCue(status) {
    if (status.status === 'solved') return 'solved';
    if (status.reason === 'bump') return 'bump';
    if (status.reason === 'out of fuel') return 'fuel';
    if (status.reason === 'too many steps') return 'steps';
    return 'ended';
  }

  function cue(name) {
    if (LoopworksSound) LoopworksSound.play(name);
  }

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
    if (snapshot) renderGoal(level, snapshot);
    updateFuel(snapshot);
    updateClaw(snapshot);
    const event = machine.events[machine.events.length - 1];
    if (event) updateLog(event);
    if (status.done) finish(status);
    else if (event) cue(tickCue(event));
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
    cue(endingCue(status));
  }

  function startRun() {
    if (running) { pause(); return; }
    closeKeyboard();
    if (!machine || machine.status.done) {
      machine = Loopworks.machine(pack, level.id, el.code.value);
      LoopworksBoard.render(el.board, baseline, level);
      renderGoal(level, baseline);
      resetLog();
      updateFuel(baseline);
      updateClaw(baseline);
      if (machine.error) {
        setVerdict('stuck', 'Stuck', `parse error - ${machine.error}`, WARN);
        cue('code');
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
      renderGoal(level, baseline);
      resetLog();
      updateFuel(baseline);
      updateClaw(baseline);
      if (machine.error) {
        setVerdict('stuck', 'Stuck', `parse error - ${machine.error}`, WARN);
        cue('code');
        return;
      }
    }
    runTick();
  }

  function resetRun() {
    pause();
    machine = null;
    LoopworksBoard.render(el.board, baseline, level);
    renderGoal(level, baseline);
    resetLog();
    updateFuel(baseline);
    updateClaw(baseline);
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
    renderGoal(level, baseline);
    resetLog();
    updateFuel(baseline);
    updateClaw(baseline);
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
    // WHY: while typing, the drawer holds only the editor and its controls, so a list that opens
    //      upward can borrow the board area above the editor; its top is allowed to sit outside the
    //      editor box for the same reason.
    const borrowed = typingOn() ? el.field.clientHeight - el.editor.clientHeight - 12 : 0;
    const above = point.top - point.height - 4 + borrowed;
    // WHY: with the view snapped to the last line the caret sits at the bottom edge, so a list that
    //      only opens downward would land outside the drawer. It opens where the room is, and
    //      shrinks with its own scrollbar rather than spilling over the run button.
    const flip = height > below && above > below;
    if (flip) {
      const room = Math.max(40, Math.min(height, above));
      el.suggest.style.maxHeight = `${room}px`;
      const top = Math.round(point.top - point.height - room - 2);
      el.suggest.style.top = `${typingOn() ? top : Math.max(0, top)}px`;
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

  function drawerFloor() { return isNarrow() ? ONE_LINE : MIN_PROGRAM; }

  function drawerDefault() { return isNarrow() ? ONE_LINE : DEFAULT_PROGRAM; }

  function clampHeight(height) {
    const mainHeight = el.main.getBoundingClientRect().height;
    // WHY: the reserve is what the bar, the panel and the status line need back before the row may
    //      grow. While typing the panel gives up the verdict and the trace, so the row may be
    //      pulled taller than the rest layout would allow.
    const reserve = typingOn() ? 170 : 220;
    const floor = drawerFloor();
    const max = Math.max(floor, mainHeight - reserve);
    return Math.max(floor, Math.min(height, max));
  }

  function setProgramHeight(height) {
    const next = clampHeight(height);
    el.program.style.height = `${next}px`;
    // WHY: a pull made while typing is the height he wants to keep working at, so it is the height
    //      that comes back with the keyboard, not the one that was there before the focus.
    if (typingOn()) keyboard.programHeight = `${next}px`;
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
    el.splitter.addEventListener('dblclick', () => setProgramHeight(drawerDefault()));
    el.splitter.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const step = event.key === 'ArrowUp' ? 24 : -24;
      setProgramHeight(el.program.getBoundingClientRect().height + step);
    });
  }

  // ---------------------------------------------------------------- typing under a keyboard

  // WHY: on a phone the soft keyboard does not make this page shorter. On iOS it only shrinks the
  //      window the user sees, and the browser slides that window down to the editor - the main
  //      panel, which is the thing being programmed, leaves the screen. So while the editor holds
  //      focus on a narrow screen the app is pinned to the height that is actually visible and the
  //      board is refitted into what is left: the board and the line being typed share one screen.
  //      Two signals say "a keyboard is over the editor": the visible window is shorter than the
  //      layout it is panned across, or the layout itself is shorter than the `resting` height
  //      measured while nothing was focused - Chrome resizes the layout, but only when asked to.
  const keyboard = { resting: 0, programHeight: '' };

  function isNarrow() {
    return !!(host.matchMedia && host.matchMedia('(max-width: 900px)').matches);
  }

  function visibleHeight() {
    return Math.round(host.visualViewport ? host.visualViewport.height : host.innerHeight);
  }

  function typingOn() { return doc.body.classList.contains('is-typing'); }

  // WHY: under this many visible pixels the bar, the draggable edge and the one-row drawer leave
  //      the panel less than one row of cells - measured at 320 x 568 with a 330 px keyboard, where
  //      the board overflowed its own box. Tight mode spends the status line on the panel; it
  //      returns with the keyboard.
  function setTight(on) {
    doc.body.classList.toggle('is-typing-tight', on && visibleHeight() < TIGHT_HEIGHT);
  }

  function setTyping(on) {
    if (on === typingOn()) return;
    doc.body.classList.toggle('is-typing', on);
    setTight(on);
    if (on) {
      // WHY: the drawer height is an inline style written by the splitter, and an inline style
      //      outranks the sheet, so it has to be lifted while typing and handed back on the way out
      //      - a height the learner dragged stays dragged.
      keyboard.programHeight = el.program.style.height;
      el.program.style.height = '';
      doc.documentElement.style.setProperty('--app-visible', `${visibleHeight()}px`);
      // WHY: the browser may have panned the document to reach the editor before this class landed.
      //      Pinned to the visible height the app needs no pan, so the one scroll reset puts the
      //      board back in view.
      host.scrollTo(0, 0);
    } else {
      doc.documentElement.style.removeProperty('--app-visible');
      el.program.style.height = keyboard.programHeight || `${drawerDefault()}px`;
    }
    fitBoard();
  }

  function syncKeyboard() {
    const visible = visibleHeight();
    const layout = Math.round(host.innerHeight);
    const focused = doc.activeElement === el.code;
    // WHY: an editor without focus has no keyboard over it, so every unfocused beat re-measures the
    //      resting height from the layout, which a phone browser leaves alone. Only a real window
    //      change or a Chrome keyboard moves it - which is exactly why the layout, not the visible
    //      height, is the yardstick here.
    if (!focused) keyboard.resting = layout;
    const panned = visible < layout - 8;
    const resized = keyboard.resting - layout > 80;
    const typing = isNarrow() && focused && (panned || resized);
    if (typing && typingOn()) {
      doc.documentElement.style.setProperty('--app-visible', `${visible}px`);
      setTight(true);
    }
    setTyping(typing);
  }

  // WHY: running is reading, not typing, and a keyboard over the bottom half of the screen hides
  //      the drone while it moves. Stepping does not close it: that loop alternates type and tick.
  function closeKeyboard() {
    if (typingOn()) el.code.blur();
  }

  // ---------------------------------------------------------------- views

  // WHY: the Evidence view is one list with two controls above it - the named next level and the
  //      search box. Both are painted here, and the module only draws the list, so the record and
  //      the controls cannot drift apart. The search value is passed in, which keeps the module
  //      testable without a DOM event.
  function renderEvidence() {
    renderAim();
    LoopworksEvidence.render(el.evidenceList, shelf, progress, pick,
      el.evidenceSearch ? el.evidenceSearch.value : '');
    paintEvidenceNext();
  }

  // WHY: the aim is one named target above the evidence rows: the pack's own language and its own name
  //      for the target, then the words met so far. It is read from pack data and the progress record,
  //      so no subject string lives here, and nothing is counted, ranked or turned into a bar.
  // 2026-11-13 agent: added for the v2 word pack, following GRILL-loopworks-v2-subject entry 4.
  function renderAim() {
    const aim = LoopworksStudio.aim(shelf, progress);
    if (!aim) {
      el.aim.hidden = true;
      return;
    }
    el.aim.hidden = false;
    el.aimLine.textContent = aim.target
      ? `${aim.language} - ${aim.target}`
      : aim.language;
    el.aimWords.textContent = aim.words.length ? aim.words.join(', ') : 'No word met yet.';
  }

  function paintEvidenceNext() {
    const next = LoopworksEvidence.nextUnsolved(shelf, progress);
    if (!next) {
      el.evidenceNext.hidden = true;
      return;
    }
    el.evidenceNext.hidden = false;
    el.evidenceNext.dataset.pack = next.pack.id;
    el.evidenceNext.dataset.level = next.level.id;
    el.evidenceNextName.textContent = `${next.pack.name} · ${next.level.title}`;
  }

  function showView(name) {
    const next = name === 'evidence' ? 'evidence' : name === 'studio' ? 'studio' : 'work';
    if (view === 'work' && next !== 'work') pause();
    view = next;
    doc.body.classList.toggle('is-evidence', next === 'evidence');
    doc.body.classList.toggle('is-studio', next === 'studio');
    el.viewWork.hidden = next !== 'work';
    el.viewEvidence.hidden = next !== 'evidence';
    el.viewStudio.hidden = next !== 'studio';
    tabs.forEach((tab) => {
      const on = tab.dataset.view === next;
      tab.classList.toggle('is-on', on);
      tab.setAttribute('aria-pressed', String(on));
    });
    updateLevelNav();
    if (next === 'evidence') {
      renderEvidence();
    } else if (next === 'studio') {
      renderStudio();
    } else {
      fitBoard();
    }
  }

  // WHY: the view is redrawn from the one record every time it is opened, so a word solved on a level
  //      appears in the studio without a reload, and a finished context is still finished. The callback
  //      is the only write: the view never touches storage, and the controller never redraws it
  //      mid-exercise - doing that would throw away the sentence being typed.
  // 2026-11-13 agent: added for the v2 word pack, following GRILL-loopworks-v2-subject entry 11.
  function renderStudio() {
    const met = LoopworksStudio.met(shelf, progress, wordsRecord);
    LoopworksStudioView.render(el.studioBody, met, (packId, word, context) => {
      wordsRecord = LoopworksStudio.mark(packId, word, context);
    });
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

  // WHY: on a touch screen the tap that should press a button is also the tap that dismisses the
  //      keyboard, and the blur that follows moves the row out from under the finger - so a touch
  //      acts on pointerdown, before the keyboard starts to close, and the click that follows it is
  //      ignored. Mouse and keyboard keep the click, where press-and-release is the expected feel.
  function press(target, act) {
    let lastTouch = 0;
    target.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      event.preventDefault();
      lastTouch = event.timeStamp;
      act();
    });
    target.addEventListener('click', (event) => {
      if (event.timeStamp - lastTouch < 800) return;
      act();
    });
  }

  function stepLevel(direction) {
    const spot = lineAt(direction);
    if (!spot) return;
    openLevel(spot.pack, spot.level);
    showView('work');
    el.code.focus();
  }

  // ---------------------------------------------------------------- wiring

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });
  press(el.run, startRun);
  press(el.step, stepOnce);
  press(el.reset, resetRun);
  el.logToggle.addEventListener('click', toggleLog);
  el.wordsOpen.addEventListener('click', openWords);
  el.wordsClose.addEventListener('click', closeWords);
  // WHY: a click on the backdrop arrives with the dialog itself as the target, while a click on
  //      the sheet is on one of its children.
  el.wordsModal.addEventListener('click', (event) => {
    if (event.target === el.wordsModal) closeWords();
  });
  press(el.prevLevel, () => stepLevel(-1));
  press(el.nextLevel, () => stepLevel(1));

  // WHY: the search box narrows the list as it is typed, and the named next level opens that level
  //      in Work. Both are view controls, so both are wired here rather than inside the module.
  if (el.evidenceSearch) el.evidenceSearch.addEventListener('input', renderEvidence);
  if (el.evidenceNext) {
    el.evidenceNext.addEventListener('click', () => {
      pick(el.evidenceNext.dataset.pack, el.evidenceNext.dataset.level);
    });
  }

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
  el.code.addEventListener('blur', () => {
    hideSuggest();
    setTyping(false);
  });
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
    syncKeyboard();
    // WHY: while typing the drawer height is the sheet's, not an inline one; re-clamping here would
    //      write the inline height straight back and fight the layout that keeps the board in view.
    if (!typingOn()) setProgramHeight(el.program.getBoundingClientRect().height);
    fitBoard();
  });

  el.code.addEventListener('focus', syncKeyboard);

  if (host.visualViewport) {
    // WHY: the visual viewport is the only cross-browser signal that a soft keyboard is up - on iOS
    //      the layout never changes, and on Chrome it changes only because the page asks for
    //      `interactive-widget=resizes-content` in the viewport meta.
    host.visualViewport.addEventListener('resize', syncKeyboard);
  }

  if (host.ResizeObserver) {
    // WHY: sizing the board inside the observer's own delivery writes layout while layout is
    //      being delivered, which Chrome reports as a ResizeObserver loop on rapid resizes. One
    //      frame later is imperceptible and keeps the console clean.
    let fitFrame = 0;
    new host.ResizeObserver(() => {
      if (fitFrame) return;
      fitFrame = host.requestAnimationFrame(() => {
        fitFrame = 0;
        fitBoard();
      });
    }).observe(el.field);
  }

  // ---------------------------------------------------------------- boot

  initSplitter();
  setRunButton();
  keyboard.resting = Math.round(host.innerHeight);
  const next = LoopworksEvidence.nextUnsolved(shelf, progress);
  const start = next || (shelf.length ? { pack: shelf[0], level: shelf[0].levels[0] } : null);
  if (!start) {
    setVerdict('stuck', 'Stuck', 'No pack on the shelf.', WARN);
  } else {
    openLevel(start.pack, start.level);
    setProgramHeight(drawerDefault());
    showView(next ? 'work' : 'evidence');
    if (next && host.matchMedia && host.matchMedia('(min-width: 901px)').matches) el.code.focus();
  }
})();
