// WHY: a level that arrives from somewhere else has to say whether it can be won before it lands on the
//      shelf. This module answers that, and it answers it only through the engine's own doors: every
//      candidate program is handed to run() and the verdict is whatever the engine says, so a change to
//      what the words mean cannot leave a second opinion behind. It never asks what a level is about, and
//      it prints nothing.
// PACK: loopworks-level-proving
// 2026-11-05 qoder-agent: built to PRD-TRD-loopworks-level-proving.md sections 7 to 10 and the decisions
//      locked in GRILL-loopworks-level-proving.txt, on the measurements in its table.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  const engine = host.Loopworks;

  // WHY: these are the sizes a phone waits for. Measured on the shipped levels every verdict lands inside
  //      them, and a search that stops says where it stopped instead of guessing an answer.
  const CAPS = { worlds: 2000, programs: 5000 };
  // WHY: the run cap is one budget, but no layer may spend all of it. Measured with a shared cap the walk
  //      alone took all 5,000 runs and the loop shapes never got a turn, so the levels whose answer is a
  //      guarded loop came back not proven. The shares below add up to CAPS.programs.
  const SHARES = { walk: 2600, loops: 2000, sweep: 400 };
  const WORLD_SHARES = { walk: 1200, sweep: 800 };
  const LINE_COST = 100000;
  const TICK_COST = 1;
  const MAX_BLOCK = 4;
  const NO_FUEL = 40;

  // WHY: "program ended" is a walk that simply ran out of lines, which a longer program can still
  //      finish. Every other ending - a bump, no fuel, too many steps - stops the machine, and no line
  //      added after it will ever be read.
  function deadEnd(reason) {
    return reason !== 'program ended';
  }

  function stopped(state, which) {
    if (!state.stopsAt) state.stopsAt = which;
    else if (state.stopsAt !== which) state.stopsAt = 'both';
  }

  // WHY: the smallest step the machine can take. "forward 1" rather than "forward 7", because a walk built
  //      one cell at a time is the same walk a player writes in seven cells - and it is the only walk whose
  //      every stop is a world this level can actually be in.
  function primitives(pack) {
    const verbs = pack.verbs || [];
    const out = [];
    if (verbs.indexOf('forward') !== -1) out.push('forward 1');
    verbs.forEach((verb) => { if (verb !== 'forward') out.push(verb); });
    return out;
  }

  // WHY: the questions a pack knows are read from the pack, never named here. That is what keeps a third
  //      pack with different sensors provable without touching this file.
  function bodies(pack) {
    const bare = primitives(pack);
    const out = bare.slice();
    (pack.sensors || []).forEach((sensor) => {
      bare.forEach((action) => out.push(`if ${sensor}: ${action}`));
    });
    return out;
  }

  function repCounts(pack) {
    const fuel = pack.rules && pack.rules.fuel ? pack.rules.fuel : NO_FUEL;
    const out = [];
    for (let n = 2; n <= fuel + 2; n++) out.push(n);
    return out;
  }

  // WHY: the whole board and the fuel left, every cell that is not terrain. Two worlds that differ only in
  //      which crate is still on the floor are different worlds, and merging them hides the walk that
  //      finishes the level. Fuel belongs in it for the same reason: a world first reached with less fuel
  //      left cannot play out the futures a cheaper arrival can.
  function worldKey(world, last) {
    let board = '';
    (world.cells || []).forEach((row) => {
      row.forEach((cell) => {
        if (cell.wall) return;
        board += `${cell.crate ? 'c' : '-'}${cell.filled ? 'f' : '-'}${cell.visited ? 'v' : '-'}`;
      });
    });
    return [world.drone.x, world.drone.y, world.drone.dir, world.carries ? 1 : 0, world.fuelLeft, board, last || ''].join('|');
  }

  function stateOf(caps) {
    const given = caps || {};
    const programs = given.programs > 0 ? given.programs : CAPS.programs;
    const worlds = given.worlds > 0 ? given.worlds : CAPS.worlds;
    const share = (part) => Math.max(1, Math.round(part * programs / CAPS.programs));
    const room = (part) => Math.max(1, Math.round(part * worlds / CAPS.worlds));
    return {
      programs: 0,
      checks: 0,
      used: { walk: 0, loops: 0, sweep: 0 },
      usedWorlds: { walk: 0, sweep: 0 },
      ceilings: { walk: share(SHARES.walk), loops: share(SHARES.loops), sweep: share(SHARES.sweep) },
      worldCeilings: { walk: room(WORLD_SHARES.walk), sweep: room(WORLD_SHARES.sweep) },
      stopsAt: ''
    };
  }

  // WHY: one door to the engine for the search, and it counts. Every layer asks the same question of the
  //      same machine, so the runs a verdict reports are the runs this file made, and the cap that stops a
  //      layer is recorded rather than quietly swallowed.
  function search(pack, level, program, state, layer) {
    if (state.used[layer] >= state.ceilings[layer]) {
      stopped(state, 'programs');
      return null;
    }
    state.used[layer] += 1;
    state.programs += 1;
    return engine.run(pack, level.id, program);
  }

  // WHY: a proof is only a proof when the engine says so, so every candidate a layer believes in comes
  //      back through this door. It does not count against the search cap: a check is not a guess, and
  //      stopping must never throw away a program that already wins.
  function check(pack, level, program, state) {
    state.checks += 1;
    return engine.run(pack, level.id, program);
  }

  // WHY: the walk costs a line only when it starts a new instruction. Seven steps in one facing are one
  //      "forward 7", so the search that minimises lines is not the search that minimises steps.
  function walk(pack, level, state) {
    const acts = primitives(pack);
    const start = search(pack, level, '', state, 'walk');
    if (!start) return { found: false, lines: [] };
    if (start.status === 'solved') return { found: true, lines: [], startSolved: true };
    if (start.status === 'stuck' && deadEnd(start.reason)) return { found: false, lines: [] };
    state.usedWorlds.walk = 1;
    const best = new Map();
    best.set(worldKey(start.world, ''), 0);
    const open = [{ acts: [], cost: 0, dead: false }];
    while (open.length > 0) {
      let at = 0;
      for (let i = 1; i < open.length; i++) if (open[i].cost < open[at].cost) at = i;
      const node = open.splice(at, 1)[0];
      if (node.dead) continue;
      for (let a = 0; a < acts.length; a++) {
        if (state.usedWorlds.walk >= state.worldCeilings.walk) {
          stopped(state, 'worlds');
          return { found: false, lines: [] };
        }
        const act = acts[a];
        const last = node.acts.length > 0 ? node.acts[node.acts.length - 1] : '';
        const followed = node.acts.concat([act]);
        const result = search(pack, level, followed.join('\n'), state, 'walk');
        if (!result) return { found: false, lines: [] };
        const cost = node.cost + (act === 'forward 1' && last === 'forward 1' ? 0 : LINE_COST) + TICK_COST;
        const key = worldKey(result.world, act === 'forward 1' ? 'f' : act);
        const seen = best.get(key);
        if (seen !== undefined && seen <= cost) continue;
        best.set(key, cost);
        if (seen === undefined) state.usedWorlds.walk += 1;
        if (result.status === 'solved') return { found: true, lines: render(followed), ticks: result.ticks };
        open.push({ acts: followed, cost, dead: result.status === 'stuck' && deadEnd(result.reason) });
      }
    }
    return { found: false, lines: [], exhausted: true };
  }

  // WHY: seven steps the same way are one line. This is the only place a walk is written down, and it
  //      writes no line the grammar of the engine would not read.
  function render(acts) {
    const out = [];
    let i = 0;
    while (i < acts.length) {
      if (acts[i] === 'forward 1') {
        let n = 1;
        while (i + n < acts.length && acts[i + n] === 'forward 1') n += 1;
        out.push(n === 1 ? 'forward' : `forward ${n}`);
        i += n;
      } else {
        out.push(acts[i]);
        i += 1;
      }
    }
    return out;
  }

  // WHY: a walk that does the same thing twice is a loop, and a loop is three lines whatever it repeats.
  //      One contiguous block, at least twice, is all this claims - and the result is run again before
  //      anything is believed.
  function fold(lines) {
    let best = { program: lines.join('\n'), count: lines.length };
    for (let start = 0; start < lines.length; start++) {
      for (let block = 1; block <= MAX_BLOCK; block++) {
        if (start + block * 2 > lines.length) continue;
        let reps = 1;
        for (;;) {
          if (start + block * (reps + 1) > lines.length) break;
          let same = true;
          for (let j = 0; j < block; j++) {
            if (lines[start + block * reps + j] !== lines[start + j]) { same = false; break; }
          }
          if (!same) break;
          reps += 1;
        }
        if (reps < 2) continue;
        const body = [`repeat ${reps}`].concat(lines.slice(start, start + block).map((line) => `  ${line}`)).concat(['end']);
        const merged = lines.slice(0, start).concat(body).concat(lines.slice(start + block * reps));
        if (merged.length < best.count) best = { program: merged.join('\n'), count: merged.length };
      }
    }
    return best;
  }

  // WHY: the shapes a player writes to keep a walk short - a loop around one or two instructions, each of
  //      them plain or guarded by a question the pack knows. One-line bodies before two-line ones, because
  //      they cost fewer lines, and the repeat counts of one body tried together, so a shape that works at
  //      all is found without walking the whole library first.
  function loops(pack, level, state) {
    const inside = bodies(pack);
    const reps = repCounts(pack);
    for (let pass = 1; pass <= 2; pass++) {
      if (pass + 2 > level.budget) continue;
      for (let i = 0; i < inside.length; i++) {
        for (let j = 0; j < (pass === 1 ? 1 : inside.length); j++) {
          const block = [`repeat`, `  ${inside[i]}`];
          if (pass === 2) block.push(`  ${inside[j]}`);
          block.push('end');
          for (let r = 0; r < reps.length; r++) {
            block[0] = `repeat ${reps[r]}`;
            const program = block.join('\n');
            const result = search(pack, level, program, state, 'loops');
            if (!result) return { found: false, program: '' };
            if (result.status === 'solved' && result.linesUsed <= level.budget) {
              return { found: true, program, lines: result.linesUsed };
            }
          }
        }
      }
    }
    return { found: false, program: '' };
  }

  // WHY: every world this level can ever be in, one instruction at a time, and the only layer allowed to
  //      say a level cannot be won. A repeat block and a guard are two ways of writing a walk the sweep
  //      already walks, so a finished sweep that never met the goal means no program of any shape meets it.
  function sweep(pack, level, state) {
    const acts = primitives(pack);
    const start = search(pack, level, '', state, 'sweep');
    if (!start) return { reached: false, complete: false };
    if (start.status === 'solved') return { reached: true, complete: true };
    const seen = new Set([worldKey(start.world, '')]);
    state.usedWorlds.sweep = 1;
    let frontier = [[]];
    while (frontier.length > 0) {
      const next = [];
      for (let f = 0; f < frontier.length; f++) {
        for (let a = 0; a < acts.length; a++) {
          if (seen.size >= state.worldCeilings.sweep) {
            stopped(state, 'worlds');
            return { reached: false, complete: false };
          }
          const followed = frontier[f].concat([acts[a]]);
          const result = search(pack, level, followed.join('\n'), state, 'sweep');
          if (!result) return { reached: false, complete: false };
          if (result.status === 'solved') return { reached: true, complete: true };
          if (result.status === 'stuck' && deadEnd(result.reason)) continue;
          const key = worldKey(result.world, '');
          if (seen.has(key)) continue;
          seen.add(key);
          state.usedWorlds.sweep = seen.size;
          next.push(followed);
        }
      }
      frontier = next;
    }
    return { reached: false, complete: true };
  }

  function checkProof(pack, level, program) {
    const result = engine.run(pack, level.id, program);
    return {
      solves: result.status === 'solved',
      fits: result.status === 'solved' && result.linesUsed <= level.budget,
      lines: result.linesUsed,
      ticks: result.ticks,
      budget: level.budget,
      reason: result.reason
    };
  }

  // WHY: four layers, cheapest proof first, and the engine has the last word in every one of them. Nothing
  //      is called proven that a fresh run does not solve inside the Budget, and nothing is called
  //      unwinnable that a finished sweep did not prove.
  function prove(pack, level, caps) {
    const state = stateOf(caps);
    const verdict = {
      verdict: 'not proven', by: '', program: '', lines: 0, ticks: 0, budget: level.budget,
      worlds: 0, programs: 0, checks: 0, complete: false, stopsAt: '', detail: ''
    };
    const totals = () => {
      verdict.worlds = state.usedWorlds.walk + state.usedWorlds.sweep;
      verdict.programs = state.programs;
      verdict.checks = state.checks;
      verdict.stopsAt = state.stopsAt;
      verdict.complete = state.stopsAt === '';
    };
    const report = (name, by, program, lines, ticks, detail) => {
      verdict.verdict = name;
      verdict.by = by;
      verdict.program = program;
      verdict.lines = lines;
      verdict.ticks = ticks;
      if (detail) verdict.detail = detail;
      totals();
      return verdict;
    };

    if (typeof level.proof === 'string' && level.proof !== '') {
      const carried = checkProof(pack, level, level.proof);
      if (carried.solves && carried.fits) return report('proven', 'proof', level.proof, carried.lines, carried.ticks);
      if (!carried.solves) {
        // WHY: a proof that does not win says the importer was wrong about his own board. It says nothing
        //      about whether the board can be won, so it is not the same word as an unwinnable level.
        return report('proof fails', 'proof', '', 0, 0, `its own proof does not win it: ${carried.reason}`);
      }
      verdict.detail = `the proof it carries takes ${carried.lines} lines`;
    }

    const walked = walk(pack, level, state);
    if (walked.startSolved) return report('proven', 'walk', '', 0, 0, 'it is already won where it starts');
    // WHY: a walk that ran out of new worlds searched every world this level can be in, because a repeat
    //      block and a guard are only ever two ways of writing one instruction after another. So the
    //      strongest sentence the sweep can say is already paid for here, and saying it now keeps the
    //      loops and the sweep from burning a budget on a board that has no route at all.
    if (walked.exhausted) {
      return report('unwinnable', 'walk', '', 0, 0, 'no walk of any length reaches the goal');
    }
    if (walked.found) {
      const plain = { program: walked.lines.join('\n'), count: walked.lines.length };
      const folded = fold(walked.lines);
      const candidate = folded.count < plain.count ? folded : plain;
      const tried = check(pack, level, candidate.program, state);
      if (tried.status === 'solved' && tried.linesUsed <= level.budget) {
        return report('proven', folded.count < plain.count ? 'fold' : 'walk', candidate.program, tried.linesUsed, tried.ticks);
      }
      if (tried.status === 'solved') verdict.detail = `the shortest walk it knows takes ${tried.linesUsed} lines`;
    }

    const looped = loops(pack, level, state);
    if (looped.found) {
      const tried = check(pack, level, looped.program, state);
      if (tried.status === 'solved' && tried.linesUsed <= level.budget) {
        return report('proven', 'loop', looped.program, tried.linesUsed, tried.ticks);
      }
    }

    const swept = sweep(pack, level, state);
    if (swept.complete && !swept.reached) {
      return report('unwinnable', 'sweep', '', 0, 0, 'no walk of any length reaches the goal');
    }
    totals();
    return verdict;
  }

  // WHY: counts, never the program. A proof printed on the level it proves is the very thing the answer
  //      key is kept off the page for.
  function sentence(verdict) {
    if (verdict.verdict === 'proven') return `proven - ${verdict.lines} lines inside a Budget of ${verdict.budget}`;
    if (verdict.verdict === 'unwinnable') return 'no program can reach this goal';
    if (verdict.verdict === 'proof fails') return `this level cannot be added: ${verdict.detail}`;
    const head = verdict.detail ? `${verdict.detail}, ` : '';
    return `not proven - ${head}it searched ${verdict.worlds} worlds and ran ${verdict.programs} programs`;
  }

  // WHY: the two share tables are read from outside so the caps can be checked, not trusted. A later edit
  //      that gave the whole run budget to one layer is the failure this search already had once.
  host.LoopworksProver = {
    CAPS, SHARES, WORLD_SHARES, LINE_COST, TICK_COST, primitives, bodies, repCounts, worldKey, render, fold,
    walk, loops, sweep, checkProof, prove, sentence
  };
})();
