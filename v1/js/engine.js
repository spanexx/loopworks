// WHY: the whole rule set of Loopworks in one file that never touches the screen. It knows
//      instructions, a grid and a goal - and no subject. Keeping it pure is what lets
//      tools/verify.mjs run it in plain node, and what lets the same rules move into the
//      packaged app later without a redesign.
// PACK: loopworks
// 2026-11-03 qoder-agent: first build. Written after tools/verify.mjs fixed the promises.

(function () {
  // WHY: the engine owns these words. A pack chooses which of them a level may use, but a
  //      pack cannot invent a verb - that is an engine change and its own ticket (AGENTS.md,
  //      "THE LAYERING RULE").
  const MOVES = { N: 0, E: 1, S: 2, W: 3 };
  // WHY: a turn is the only thing that changes facing, so the facing order above is the clock
  //      direction and "right" is +1. Turning twice is a U-turn, which the player uses a lot.
  const TURN_STEP = { left: -1, right: 1 };

  // 2026-11-08 qoder-agent: the sixth verb is `u-turn`, locked in
  //      docs/features/loopworks-u-turn-verb. It is the only hyphenated word the player types.
  const VERBS = ['forward', 'turn left', 'turn right', 'grab', 'drop', 'u-turn'];
  // WHY: a sensor only ever asks about the one cell the drone faces. That is the whole rule of
  //      the guard, and it is why no sensor needs a coordinate.
  const SENSORS = ['wall ahead', 'clear ahead', 'crate ahead', 'pad ahead'];
  const RULES = ['fuel'];
  const CAP = 400; // WHY: an endless loop has to end somewhere. A cap reads as a bug to the
                   //      player unless it is named, so it is a stop reason of its own.

  // ---------------------------------------------------------------- the shape of a program

  function leadingSpace(text) {
    const m = /^[\t ]*/.exec(text);
    return m[0].replace(/\t/g, '  ').length;
  }

  // WHY: one action, no block. Returns null when the words are not a verb this pack hands over,
  //      and the caller turns that into an error that names the line.
  function readAction(body, lineNo, errors, verbs) {
    const words = body.trim().toLowerCase();
    const shape = shapeOf(words);
    // WHY: a word can fail two ways - the language has never heard it, or this level is keeping it
    //      back. The two refusals teach different things, so they have to read differently.
    if (shape === null || verbs.indexOf(shape) === -1) {
      const list = shape ? `The words here are ${verbs.join(', ')}.` : `The words are ${VERBS.join(', ')}.`;
      const said = shape ? `"${shape}" is not a word this level gives you.` : `"${words}" is not something the drone can do.`;
      errors.push({ line: lineNo, message: `line ${lineNo}: ${said} ${list}` });
      return null;
    }
    if (shape === 'forward') {
      const parts = words.split(' ');
      return { kind: 'action', verb: 'forward', amount: parts.length === 2 ? Number(parts[1]) : 1, line: lineNo };
    }
    if (/^turn /.test(shape)) {
      return { kind: 'action', verb: 'turn', side: shape.split(' ')[1], line: lineNo };
    }
    return { kind: 'action', verb: shape, line: lineNo };
  }

  // WHY: parse is line-based with indentation for blocks, because that is the shape a player
  //      can type without a cursor fight. It reports every problem with its line number so the
  //      trace can point at the source instead of describing an abstraction.
  function parse(source, pack) {
    // WHY: the pack decides which words may run, not only which words the autocomplete offers. No
    //      pack argument means the whole language, which is what the bare parser always did.
    const open = unlocked(pack);
    const errors = [];
    const root = { list: [], indent: -1 };
    const stack = [root];
    let lineCount = 0;
    const rawLines = String(source).split(/\r?\n/);

    rawLines.forEach((raw, index) => {
      const lineNo = index + 1;
      const text = raw.trim();
      if (text === '') return;
      lineCount += 1;
      const indent = leadingSpace(raw);
      const top = stack[stack.length - 1];

      // WHY: a repeat only ends on "end", so a line that dedents back out has to be reported
      //      instead of quietly joining the block above it. The error is raised and the block
      //      stays open, because "end" is the only thing that closes it and it closes itself.
      if (top.declaredAt !== undefined && indent < top.need && text !== 'end') {
        errors.push({ line: lineNo, message: `line ${lineNo}: this line is not inside the repeat on line ${top.declaredAt}. Indent it by two spaces, or put "end" before it.` });
      }

      if (text === 'end') {
        if (stack.length === 1) {
          errors.push({ line: lineNo, message: `line ${lineNo}: "end" with no "repeat" open.` });
          return;
        }
        stack.pop();
        return;
      }

      const repeat = /^repeat (\d+)$/.exec(text);
      if (repeat) {
        const loop = { kind: 'repeat', count: Number(repeat[1]), body: [], line: lineNo };
        top.list.push(loop);
        // WHY: need is the smallest indent that still belongs to this block. The repeat's own
        //      indent does not qualify, so a body line has to go deeper.
        stack.push({ list: loop.body, indent, need: indent + 1, declaredAt: lineNo });
        return;
      }

      if (/^repeat\b/.test(text)) {
        errors.push({ line: lineNo, message: `line ${lineNo}: "repeat" needs a whole number after it, like "repeat 3".` });
        return;
      }

      if (/^if\b/.test(text)) {
        const colon = text.indexOf(':');
        if (colon === -1) {
          errors.push({ line: lineNo, message: `line ${lineNo}: an "if" line needs a colon, like "if wall ahead: turn right".` });
          return;
        }
        const asked = text.slice(3, colon).trim().toLowerCase();
        // WHY: the same two-way refusal as a verb. A sensor the drone has never had is a different
        //      mistake from a sensor this level kept back, and the player cannot fix either blindly.
        if (SENSORS.indexOf(asked) === -1 || open.sensors.indexOf(asked) === -1) {
          const known = SENSORS.indexOf(asked) >= 0;
          const said = known ? `"${asked}" is not a question this level gives you.` : `the drone cannot ask "${asked}".`;
          errors.push({ line: lineNo, message: `line ${lineNo}: ${said} It can ask ${known ? open.sensors.join(', ') : SENSORS.join(', ')}.` });
          return;
        }
        const inner = readAction(text.slice(colon + 1), lineNo, errors, open.verbs);
        if (inner) top.list.push({ kind: 'guard', sensor: asked, action: inner, line: lineNo });
        return;
      }

      if (/^end\b/.test(text)) {
        errors.push({ line: lineNo, message: `line ${lineNo}: "end" stands on its own line.` });
        return;
      }

      const action = readAction(text, lineNo, errors, open.verbs);
      if (action) top.list.push(action);
    });

    if (stack.length > 1) {
      errors.push({ line: stack[stack.length - 1].declaredAt, message: `line ${stack[stack.length - 1].declaredAt}: this repeat never gets its "end".` });
    }

    return { ok: errors.length === 0, program: root.list, errors, lineCount, sourceLines: rawLines.length };
  }

  // ---------------------------------------------------------------- what a pack is allowed to say

  function packError(list, id, message) { list.push(`pack "${id}": ${message}`); }

  // WHY: a label is opaque to the engine. Letters, note names and symbols all fit, and the engine
  //      only ever compares one label with another. One to three characters is the room a board cell
  //      has, not a language rule - the engine never learns what a label means.
  // 2026-11-13 agent: added for docs/features/loopworks-labelled-crate (GRILL decision 1).
  function labelOk(label) {
    return typeof label === 'string' && label.length >= 1 && label.length <= 3;
  }

  // WHY: a pack is data a stranger could write, so it gets checked before a player ever sees
  //      it. A broken pack is reported by name and the rest of the packs still load - the app
  //      never falls over because someone's level file was wrong.
  function validatePack(pack) {
    const errors = [];
    const id = pack && pack.id ? pack.id : '(no id)';
    if (!pack || !Array.isArray(pack.levels)) { packError(errors, id, 'has no levels'); return errors; }

    (pack.verbs || []).forEach((verb) => {
      if (VERBS.indexOf(verb) === -1) packError(errors, id, `"${verb}" is not a verb the engine knows`);
    });
    (pack.sensors || []).forEach((sensor) => {
      if (SENSORS.indexOf(sensor) === -1) packError(errors, id, `"${sensor}" is not a sensor the engine knows`);
    });
    Object.keys(pack.rules || {}).forEach((rule) => {
      if (RULES.indexOf(rule) === -1) packError(errors, id, `"${rule}" is not a rule the engine enforces`);
    });
    if (pack.rules && pack.rules.fuel !== undefined && !(Number.isInteger(pack.rules.fuel) && pack.rules.fuel > 0)) {
      packError(errors, id, 'its fuel rule has to be a positive whole number');
    }
    // WHY: the door obeys the pack's list now, so a pack that hands over no verb at all would refuse
    //      every line a player types. That is an authoring mistake, and it is worth naming as one.
    if (Array.isArray(pack.verbs) && unlocked(pack).verbs.length === 0) {
      packError(errors, id, 'unlocks no verb the engine knows, so nothing a player types could run');
    }

    pack.levels.forEach((level) => {
      const where = `level "${level.id}"`;
      if (!Array.isArray(level.rows) || level.rows.length < 3) { packError(errors, id, `${where} needs rows of terrain`); return; }
      const width = level.rows[0].length;
      level.rows.forEach((row, y) => {
        if (row.length !== width) packError(errors, id, `${where} row ${y} is ${row.length} cells wide, the others are ${width}`);
        if (/[^#.]/.test(row)) packError(errors, id, `${where} row ${y} uses a character that is not "#" or "."`);
      });

      const cell = (x, y) => (level.rows[y] && level.rows[y][x]) || '#';
      const inside = (x, y) => x >= 0 && y >= 0 && y < level.rows.length && x < width;
      const taken = new Set();
      const claim = (x, y, what) => {
        if (!inside(x, y) || cell(x, y) === '#') { packError(errors, id, `${where} puts a ${what} on wall or outside at [${x},${y}]`); return; }
        const key = `${x},${y}`;
        if (taken.has(key)) packError(errors, id, `${where} puts two things on [${x},${y}]`);
        taken.add(key);
      };

      if (!level.start || !MOVES.hasOwnProperty(level.start.dir)) {
        packError(errors, id, `${where} has no start facing (N, E, S or W)`);
      } else {
        claim(level.start.x, level.start.y, 'start');
      }
      (level.pads || []).forEach((p) => claim(p[0], p[1], 'pad'));
      // WHY: a crate's third element is its label. A two-element crate stays anonymous and keeps
      //      working, so every shipped level is untouched (GRILL decision 2).
      (level.crates || []).forEach((c) => {
        claim(c[0], c[1], 'crate');
        if (c.length > 2 && !labelOk(c[2])) {
          packError(errors, id, `${where} gives a crate at [${c[0]},${c[1]}] a label that is not one to three characters`);
        }
      });

      // WHY: the hole is an object, not terrain. Rows stay "#" and ".", and one hole is the most a
      //      level can hold, which is the shape the learner asked for (GRILL decisions 3 and 12).
      const holes = level.holes === undefined ? [] : level.holes;
      if (!Array.isArray(holes)) {
        packError(errors, id, `${where} has holes that are not a list`);
      }
      const holeList = Array.isArray(holes) ? holes : [];
      if (holeList.length > 1) {
        packError(errors, id, `${where} holds ${holeList.length} holes, but one hole is the most a level can hold`);
      }
      holeList.forEach((h) => claim(h[0], h[1], 'hole'));

      // WHY: a level with crates is a level about carrying them, so the pack has to hand the
      //      player the words for it. This is the check that keeps a pack honest.
      if ((level.crates || []).length > 0) {
        ['grab', 'drop'].forEach((verb) => {
          if ((pack.verbs || []).indexOf(verb) === -1) {
            packError(errors, id, `${where} places crates but the pack does not unlock "${verb}"`);
          }
        });
      }

      const goal = level.goal || {};
      if (goal.kind === 'visit' && goal.count > (level.pads || []).length) {
        packError(errors, id, `${where} asks to visit ${goal.count} pads but only ${(level.pads || []).length} exist`);
      }
      if (goal.kind === 'fill') {
        if (goal.count > (level.crates || []).length) packError(errors, id, `${where} asks to fill with ${goal.count} crates but only ${level.crates.length} exist`);
        if (goal.count > (level.pads || []).length) packError(errors, id, `${where} asks to fill ${goal.count} but only ${level.pads.length} pads exist`);
      }
      if (goal.kind === 'hole') {
        // WHY: a hole level is won by a sequence, so the pack is refused by name when the sequence
        //      has no hole to land in, is empty, asks for a label the board does not place, or
        //      withholds the two verbs the hole needs (GRILL decision 7).
        if (holeList.length !== 1) {
          packError(errors, id, `${where} asks for a hole but places ${holeList.length} holes`);
        }
        if (!Array.isArray(goal.sequence) || goal.sequence.length === 0) {
          packError(errors, id, `${where} asks for a hole but its sequence is empty`);
        } else {
          const unknown = goal.sequence.filter((label) => !labelOk(label));
          if (unknown.length > 0) {
            packError(errors, id, `${where} has a sequence label that is not one to three characters`);
          }
          const have = {};
          (level.crates || []).forEach((c) => {
            if (labelOk(c[2])) have[c[2]] = (have[c[2]] || 0) + 1;
          });
          const want = {};
          goal.sequence.forEach((label) => { if (labelOk(label)) want[label] = (want[label] || 0) + 1; });
          Object.keys(want).forEach((label) => {
            const found = have[label] || 0;
            if (found < want[label]) {
              packError(errors, id, `${where} asks for "${label}" ${want[label]} time${want[label] === 1 ? '' : 's'} but only ${found} crate${found === 1 ? '' : 's'} ${found === 1 ? 'carries' : 'carry'} it`);
            }
          });
        }
        ['grab', 'drop'].forEach((verb) => {
          if ((pack.verbs || []).indexOf(verb) === -1) {
            packError(errors, id, `${where} asks for a hole but the pack does not unlock "${verb}"`);
          }
        });
      }
      if (!['visit', 'fill', 'hole'].includes(goal.kind)) packError(errors, id, `${where} has a goal kind "${goal.kind}" that is not visit, fill or hole`);
      if (!(Number.isInteger(level.budget) && level.budget > 0)) packError(errors, id, `${where} needs a line budget above zero`);
      if (!level.teaches || !level.title) packError(errors, id, `${where} does not say what it teaches`);
    });
    return errors;
  }

  // ---------------------------------------------------------------- the world

  // WHY: terrain, pads and crates become one mutable board per run. A pad that holds a crate is
  //      still a pad, so both flags live on the same cell rather than trading one slot.
  function buildWorld(level, pack) {
    const cells = level.rows.map((row) => row.split('').map((ch) => ({
      wall: ch === '#', crate: false, pad: false, filled: false, visited: false,
      // WHY: the label lives on the cell that holds the crate, and the opening lives on its own
      //      cell. Both default empty, so a shipped level carries them without changing.
      label: null, hole: false
    })));
    (level.pads || []).forEach((p) => { cells[p[1]][p[0]].pad = true; });
    (level.crates || []).forEach((c) => {
      const target = cells[c[1]][c[0]];
      target.crate = true;
      target.label = labelOk(c[2]) ? c[2] : null;
    });
    (level.holes || []).forEach((h) => { cells[h[1]][h[0]].hole = true; });
    const fuel = pack.rules && pack.rules.fuel ? pack.rules.fuel : null;
    return {
      level, pack, cells,
      cols: level.rows[0].length, rows: level.rows.length,
      drone: { x: level.start.x, y: level.start.y, dir: level.start.dir },
      // WHY: carries stays the boolean every screen and every guard already reads; the label travels
      //      beside it, and the hole keeps the sequence it has accepted so far (GRILL decision 2).
      carries: false, carryLabel: null, hole: [],
      fuelLeft: fuel, fuelWas: fuel,
      padsVisited: 0, cratesOnPads: 0
    };
  }

  // WHY: "ahead" always means one cell in the facing direction. Taking a distance rather than an
  //      x/y pair is what makes a sensor and one walk step ask exactly the same question.
  function facingCell(world, distance) {
    const step = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[world.drone.dir];
    return { x: world.drone.x + step[0] * distance, y: world.drone.y + step[1] * distance };
  }

  function at(world, x, y) {
    if (x < 0 || y < 0 || y >= world.rows || x >= world.cols) return null;
    return world.cells[y][x];
  }

  // WHY: a guard is a question about the faced cell only. "clear ahead" is the one the player
  //      uses to stop a loop from bumping, so it has to mean "I can walk there".
  function askSensor(world, sensor) {
    const ahead = facingCell(world, 1);
    const cell = at(world, ahead.x, ahead.y);
    // WHY: the hole is an obstruction, exactly as a wall or a crate is. "clear ahead" is what a loop
    //      asks before it walks, so it has to say no; "wall ahead" keeps its shipped meaning of
    //      "cannot walk there" (GRILL decision 4, D-8).
    if (sensor === 'wall ahead') return cell === null || (cell && cell.wall) || (cell && cell.crate) || (cell && cell.hole);
    if (sensor === 'clear ahead') return cell !== null && cell.wall === false && cell.crate === false && cell.hole === false;
    if (sensor === 'crate ahead') return cell !== null && cell.crate === true;
    if (sensor === 'pad ahead') return cell !== null && cell.pad === true;
    return false;
  }

  function snapshot(world) {
    return {
      drone: { x: world.drone.x, y: world.drone.y, dir: world.drone.dir },
      carries: world.carries,
      carryLabel: world.carryLabel,
      hole: world.hole.slice(),
      fuelLeft: world.fuelLeft,
      padsVisited: world.padsVisited,
      cratesOnPads: world.cratesOnPads,
      cells: world.cells.map((row) => row.map((c) => ({
        wall: c.wall, crate: c.crate, pad: c.pad, filled: c.filled, visited: c.visited,
        label: c.label, hole: c.hole
      })))
    };
  }

  function goalMet(world) {
    const goal = world.level.goal;
    // WHY: fill means a crate is standing on a pad, and every pad has to be covered when the
    //      count is the pad count; visit means the drone has walked onto that many pads.
    if (goal.kind === 'visit') return world.padsVisited >= goal.count;
    if (goal.kind === 'fill') return world.cratesOnPads >= goal.count;
    // WHY: a hole is won when the labels it holds are the sequence the goal asks for, in the same
    //      order. The engine compares labels; it never asks what they spell (GRILL decision 6).
    if (goal.kind === 'hole') {
      const wanted = goal.sequence || [];
      if (world.hole.length !== wanted.length) return false;
      return wanted.every((label, index) => world.hole[index] === label);
    }
    return false;
  }

  // ---------------------------------------------------------------- running one instruction

  // WHY: one line, one tick. A "forward 3" is one line, so it is one tick and one unit of the
  //      Budget; the cells it walks are distance, not time, and the fuel rule counts those.
  function stepOnce(vm) {
    let st = nextStatement(vm);
    if (st === null) return { done: true, status: 'stuck', reason: 'program ended' };

    vm.ticks += 1;
    const world = vm.world;
    const event = { tick: vm.ticks, line: st.line, ok: true, note: '', action: '' };

    if (st.kind === 'guard') {
      const answer = askSensor(world, st.sensor);
      event.action = st.sensor;
      event.guard = st.sensor;
      event.answer = answer;
      if (!answer) {
        event.note = 'asked the question, the answer was no';
        return commit(vm, event, st.line);
      }
      st = { kind: 'action', ...st.action, line: st.line };
    }

    if (st.verb === 'forward') {
      // WHY: a forward with an amount still walks one cell at a time inside its single tick, so a
      //      bump stops at the cell that caused it and the trace says how far the drone actually got.
      const steps = st.amount || 1;
      for (let i = 0; i < steps; i += 1) {
        if (world.fuelLeft !== null && world.fuelLeft <= 0) {
          event.action = 'forward';
          event.ok = false;
          event.note = 'out of fuel';
          return { done: true, status: 'stuck', reason: 'out of fuel', event: commit(vm, event, st.line) };
        }
        const ahead = facingCell(world, 1);
        const cell = at(world, ahead.x, ahead.y);
        if (cell === null || cell.wall) {
          event.action = 'forward'; event.ok = false; event.note = 'bumped a wall';
          return { done: true, status: 'stuck', reason: 'bump', event: commit(vm, event, st.line) };
        }
        if (cell.crate) {
          event.action = 'forward'; event.ok = false; event.note = 'a crate is in the way';
          return { done: true, status: 'stuck', reason: 'bump', event: commit(vm, event, st.line) };
        }
        // WHY: the hole is a container, not floor. The drone stands beside it and drops in, so a
        //      forward into it is a bump that ends the run, named like any other obstruction.
        if (cell.hole) {
          event.action = 'forward'; event.ok = false; event.note = 'a hole is in the way';
          return { done: true, status: 'stuck', reason: 'bump', event: commit(vm, event, st.line) };
        }
        world.drone.x = ahead.x; world.drone.y = ahead.y;
        if (world.fuelLeft !== null) world.fuelLeft -= 1;
        if (cell.pad && !cell.visited) { cell.visited = true; world.padsVisited += 1; }
      }
      event.action = 'forward';
      event.note = `walked ${steps} to (${world.drone.x},${world.drone.y})`;
      return commit(vm, event, st.line);
    }

    if (st.verb === 'turn') {
      const turnValue = (MOVES[world.drone.dir] + TURN_STEP[st.side] + 4) % 4;
      world.drone.dir = Object.keys(MOVES)[turnValue];
      event.action = 'turn';
      event.note = `facing ${world.drone.dir}`;
      return commit(vm, event, st.line);
    }

    if (st.verb === 'u-turn') {
      // WHY: a reversal is two quarter turns facing the same way, done in one line, so it uses the
      //      same clock as a turn rather than a kind of move of its own.
      const turnValue = (MOVES[world.drone.dir] + 2) % 4;
      world.drone.dir = Object.keys(MOVES)[turnValue];
      event.action = 'u-turn';
      event.note = `facing ${world.drone.dir}`;
      return commit(vm, event, st.line);
    }

    if (st.verb === 'grab') {
      const ahead = facingCell(world, 1);
      const cell = at(world, ahead.x, ahead.y);
      event.action = 'grab';
      if (world.carries) { event.ok = false; event.note = 'already carrying a crate'; }
      else if (!cell || !cell.crate) { event.ok = false; event.note = 'nothing to grab in front'; }
      else {
        // WHY: the label travels with the crate. Clearing it from the cell keeps one crate in one
        //      place; the trace names it so the player can see what the claw holds.
        const label = cell.label;
        cell.crate = false;
        cell.label = null;
        world.carries = true;
        world.carryLabel = label || null;
        if (cell.filled) { cell.filled = false; world.cratesOnPads -= 1; }
        event.note = world.carryLabel
          ? `picked up ${world.carryLabel} at (${ahead.x},${ahead.y})`
          : `picked up at (${ahead.x},${ahead.y})`;
      }
      return commit(vm, event, st.line);
    }

    if (st.verb === 'drop') {
      const ahead = facingCell(world, 1);
      const cell = at(world, ahead.x, ahead.y);
      event.action = 'drop';
      if (!world.carries) { event.ok = false; event.note = 'carrying nothing'; }
      else if (!cell || cell.wall || cell.crate) { event.ok = false; event.note = 'nowhere to drop in front'; }
      else if (cell.hole) {
        // WHY: the hole keeps the word in spelling order. It takes a labelled crate only when that
        //      label is the next one the goal asks for; any other drop is a wasted line and the
        //      crate stays in the claw, exactly as an unfetchable grab does (GRILL decision 5).
        const goal = world.level.goal || {};
        const sequence = goal.kind === 'hole' && Array.isArray(goal.sequence) ? goal.sequence : [];
        const wanted = sequence[world.hole.length];
        if (!world.carryLabel) {
          event.ok = false;
          event.note = 'the hole only takes a labelled crate';
        } else if (!wanted) {
          event.ok = false;
          event.note = goal.kind === 'hole' ? 'the hole is full' : 'this hole is not the goal';
        } else if (world.carryLabel !== wanted) {
          event.ok = false;
          event.note = `the hole wants ${wanted} next - ${world.carryLabel} stays in the claw`;
        } else {
          const label = world.carryLabel;
          world.hole.push(label);
          world.carries = false;
          world.carryLabel = null;
          event.note = `dropped ${label} into the hole - the hole holds ${world.hole.join(', ')}`;
        }
      } else {
        // WHY: a labelled crate dropped on ordinary floor lies there with its label and can be
        //      grabbed again, so a wrong crate can still be moved out of the way.
        const label = world.carryLabel;
        cell.crate = true;
        cell.label = label;
        world.carries = false;
        world.carryLabel = null;
        if (cell.pad) { cell.filled = true; world.cratesOnPads += 1; }
        event.note = label
          ? `left ${label} at (${ahead.x},${ahead.y})`
          : `left a crate at (${ahead.x},${ahead.y})`;
      }
      return commit(vm, event, st.line);
    }

    event.action = 'unknown'; event.ok = false; event.note = 'nothing happened';
    return commit(vm, event, st.line);
  }

  // WHY: every tick records the same shape - line, what ran, whether it worked, and where the
  //      drone ended up - so the trace, the animation and the scrubbing slider all read from one
  //      list instead of recomputing the world behind the player's back.
  function commit(vm, event, line) {
    const w = vm.world;
    event.line = line;
    event.drone = { x: w.drone.x, y: w.drone.y, dir: w.drone.dir };
    event.carries = w.carries;
    event.fuelLeft = w.fuelLeft;
    event.padsVisited = w.padsVisited;
    event.cratesOnPads = w.cratesOnPads;
    vm.events.push(event);
    vm.snapshots.push(snapshot(w));
    return { done: false, event, line };
  }

  // WHY: a repeat is a frame on a stack rather than a text rewrite, so a loop inside a loop
  //      works the moment a pack wants it, with no engine change.
  function nextStatement(vm) {
    while (vm.frames.length > 0) {
      const frame = vm.frames[vm.frames.length - 1];
      if (frame.index >= frame.list.length) {
        if (frame.loop) {
          frame.left -= 1;
          if (frame.left > 0) { frame.index = 0; continue; }
        }
        vm.frames.pop();
        continue;
      }
      const st = frame.list[frame.index];
      frame.index += 1;
      if (st.kind === 'repeat') {
        if (st.count <= 0) continue;
        vm.frames.push({ list: st.body, index: 0, loop: st, left: st.count });
        continue;
      }
      return st;
    }
    return null;
  }

  // ---------------------------------------------------------------- the two doors in

  function machine(pack, levelId, source) {
    const level = (pack.levels || []).find((l) => l.id === levelId);
    const parsed = parse(source, pack);
    if (!level) return deadMachine(`this pack has no level "${levelId}"`);
    if (!parsed.ok) return deadMachine(parsed.errors.map((e) => e.message).join(' '), parsed.lineCount);

    const vm = {
      world: buildWorld(level, pack),
      frames: [{ list: parsed.program, index: 0, loop: null, left: 0 }],
      ticks: 0, events: [], snapshots: [], lineCount: parsed.lineCount, cap: CAP, dead: false
    };

    function deadMachineResult(st) {
      // WHY: a walk that fails and a walk that simply runs out of lines both end the run, but
      //      only the first one has an event behind it. The old guard looked for an event and so
      //      never wrote the ending, which left a finished program reading as still running.
      if (st.done === true && st.status) {
        vm.status = { done: true, status: st.status, reason: st.reason, ticks: vm.ticks, linesUsed: vm.lineCount };
      }
      return st;
    }

    return {
      pack, level, source,
      events: vm.events,
      snapshots: vm.snapshots,
      get status() {
        if (vm.status) return vm.status;
        return { done: false, status: 'running', reason: '', ticks: vm.ticks, linesUsed: vm.lineCount };
      },
      world() { return snapshot(vm.world); },
      // WHY: the page drives this one tick at a time, and a single run drives it to the end.
      //      Both doors read the same vm, so a step-through can never disagree with a run.
      tick() {
        if (vm.dead || (vm.status && vm.status.done)) return vm.status;
        if (vm.ticks >= vm.cap) {
          vm.status = { done: true, status: 'stuck', reason: 'too many steps', ticks: vm.ticks, linesUsed: vm.lineCount };
          return vm.status;
        }
        const st = stepOnce(vm);
        if (st.done === true && st.status) return deadMachineResult(st);
        if (goalMet(vm.world)) {
          vm.status = { done: true, status: 'solved', reason: 'goal reached', ticks: vm.ticks, linesUsed: vm.lineCount };
          return vm.status;
        }
        return deadMachineResult(st);
      }
    };
  }

  function deadMachine(message, linesUsed) {
    return {
      events: [], snapshots: [], error: message,
      status: { done: true, status: 'stuck', reason: 'parse error', ticks: 0, linesUsed: linesUsed || 0 },
      world: () => null,
      tick() { return this.status; }
    };
  }

  function run(pack, levelId, source) {
    const m = machine(pack, levelId, source);
    let guard = CAP + 10;
    while (!m.status.done && guard-- > 0) m.tick();
    const st = m.status;
    return {
      status: st.status, reason: st.reason, ticks: st.ticks, linesUsed: st.linesUsed,
      events: m.events, snapshots: m.snapshots, world: m.world(), error: m.error || ''
    };
  }

  // ---------------------------------------------------------------- the suggestion list

  // WHY: the play page must offer the player only the words of the pack he is in. A page that
  //      kept its own word list would drift the moment a second pack unlocks fewer verbs, so
  //      the list is built here from the pack data and the page only asks and inserts.
  // 2026-11-04 qoder-agent: the autocomplete ticket. tools/verify.mjs fixed the shape first -
  //      { from, items } where items replace line.slice(from) to the end of that line, so an
  //      indent or a typed prefix survives the completion.
  function suggest(pack, line) {
    const text = String(line == null ? '' : line);
    const { verbs, sensors } = unlocked(pack);

    const colon = text.indexOf(':');
    const guarded = colon >= 0 && /^if\b/i.test(text.slice(0, colon).trim());
    // WHY: from skips the indent on a plain line and the guard on a colon line, because those
    //      are the parts the player already wrote. Everything after it is what a candidate replaces.
    let from = guarded ? colon + 1 : /^[\t ]*/.exec(text)[0].length;
    while (from < text.length && text[from] === ' ') from += 1;

    const words = guarded
      ? verbs.slice()
      : verbs.concat(sensors.map((s) => `if ${s}: `), ['repeat ', 'end']);

    const tail = text.slice(from).trim().toLowerCase();
    // WHY: a line that already spells a whole instruction gets nothing - the list has to be
    //      able to go away, or the player cannot tell a finished line from a half one.
    const items = tail === '' ? words : words.filter((w) => {
      const wanted = w.toLowerCase();
      return wanted.startsWith(tail) && wanted.trim() !== tail;
    });
    return { from, items };
  }

  // ---------------------------------------------------------------- the pack shelf

  const shelf = [];
  function register(pack) {
    if (!pack || !pack.id) return null;
    const known = shelf.findIndex((p) => p.id === pack.id);
    const entry = { pack, errors: validatePack(pack) };
    if (known >= 0) shelf[known] = entry; else shelf.push(entry);
    return entry;
  }

  const Loopworks = { parse, validatePack, buildWorld, machine, run, register, suggest,
    packs: () => shelf.slice(),
    level: (packId, levelId) => {
      const found = shelf.find((p) => p.pack.id === packId);
      if (!found) return null;
      return found.pack.levels.find((l) => l.id === levelId) || null;
    },
    verbs: VERBS.slice(), sensors: SENSORS.slice(), rules: RULES.slice(), cap: CAP
  };

  // ---------------------------------------------------------------- what a pack hands over

  // WHY: a pack chooses from the engine's words; it cannot add one. The filter is what keeps a typo
  //      in a pack file to a narrower list instead of a word nothing can run - validatePack is the
  //      author's first opinion, and this is the door every run goes through.
  function unlocked(pack) {
    return {
      verbs: (pack && pack.verbs ? pack.verbs : VERBS).filter((v) => VERBS.indexOf(v) >= 0),
      sensors: (pack && pack.sensors ? pack.sensors : SENSORS).filter((s) => SENSORS.indexOf(s) >= 0)
    };
  }

  // WHY: the shape is matched before the pack's list is consulted, so a withheld word can be named
  //      exactly instead of reported as a word the language has never had.
  function shapeOf(words) {
    if (/^forward( \d+)?$/.test(words)) return 'forward';
    if (/^turn (left|right)$/.test(words)) return words;
    if (words === 'grab' || words === 'drop' || words === 'u-turn') return words;
    return null;
  }

  // WHY: one global, readable from a browser page and from the node vm that tools/verify.mjs
  //      builds - the same file has to serve both, because file:// will not load a module.
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  host.Loopworks = Loopworks;
})();
