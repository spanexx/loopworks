// WHY: the board is the only place where a cell becomes a square. It names what a cell is and
//      never writes a colour, so the same markup is legible in both theme ramps.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: first build, following GRILL-loopworks-app entries 12 and 14.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  // WHY: the drone is drawn pointing up and turned by quarter turns. The notch in the tail is what
  //      makes the arrow read as a heading instead of a play button at board scale.
  const NAV = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.2 21 21.3 12 16.7 3 21.3Z" fill="currentColor"/></svg>';
  // WHY: crate is a top-down box with a seam. It is a glyph, not a word, because the same crate
  //      appears on many cells and a label there would be read many times.
  const CRATE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M4 7h16v13H4z"/><path d="M4 7l2-2h12l2 2M9 7v13M15 7v13"/></svg>';

  // WHY: the engine has four facings and no others, so the map is the whole rotation language.
  const ANGLE = { N: 0, E: 90, S: 180, W: 270 };

  // WHY: a pad that holds a crate is a filled pad, and a pad already walked on is a reached pad.
  //      The order matters: filled beats reached, reached beats plain pad. A hole is none of those:
  //      it is a container, so it wins over everything but a wall.
  // 2026-11-13 agent: the hole role and the crate label landed for
  //      docs/features/loopworks-labelled-crate, GRILL decision 10.
  function roleOf(cell) {
    if (cell.wall) return 'is-wall';
    if (cell.hole) return 'is-hole';
    if (cell.pad && cell.filled) return 'is-filled';
    if (cell.pad && cell.visited) return 'is-reached';
    if (cell.pad) return 'is-pad';
    return 'is-floor';
  }

  function describe(cell, x, y) {
    const parts = ['floor'];
    if (cell.wall) parts[0] = 'wall';
    if (cell.hole) parts[0] = 'hole';
    if (cell.pad) parts.push(cell.filled ? 'filled pad' : cell.visited ? 'reached pad' : 'pad');
    if (cell.crate) parts.push(cell.label ? `crate ${cell.label}` : 'crate');
    return `(${x},${y}) ${parts.join(', ')}`;
  }

  // WHY: one renderer for the whole app, so a level switch cannot leave a stale board behind.
  //      It reads only the engine's snapshot, never the level's rows, because a snapshot is what a
  //      run actually produced.
  function render(mount, snap, level) {
    if (!mount || !snap || !snap.cells || !snap.cells.length) return;
    const rows = snap.cells.length;
    const cols = snap.cells[0].length;
    mount.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    mount.setAttribute('aria-label', `${level.title}: ${level.goalSentence}`);
    mount.innerHTML = '';
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const cell = snap.cells[y][x];
        const square = host.document.createElement('div');
        square.className = `cell ${roleOf(cell)}`;
        square.title = describe(cell, x, y);
        if (cell.crate) {
          const crate = host.document.createElement('span');
          // WHY: a label is pack data, so it is written as text, never markup. The box glyph is
          //      replaced by the label because a cell is too small to show both.
          crate.className = cell.label ? 'crate is-labelled' : 'crate';
          if (cell.label) crate.textContent = cell.label;
          else crate.innerHTML = CRATE;
          square.appendChild(crate);
        }
        if (snap.drone.x === x && snap.drone.y === y) {
          const drone = host.document.createElement('span');
          drone.className = 'drone';
          drone.style.transform = `rotate(${ANGLE[snap.drone.dir]}deg)`;
          drone.innerHTML = NAV;
          square.appendChild(drone);
        }
        mount.appendChild(square);
      }
    }
  }

  host.LoopworksBoard = { render, ANGLE };
})();
