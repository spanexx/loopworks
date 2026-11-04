// WHY: pack one. It is data, not code - the engine reads this and plays it. Everything here
//      names a subject (a depot, crates, a pad), and nothing in engine.js is allowed to.
// PACK: loopworks
// 2026-11-03 qoder-agent: authored to the promises in docs/features/loopworks/GRILL-loopworks.txt.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  const LoopworksDepot = {
    id: 'depot',
    name: 'The Depot',
    subject: 'programming logic',
    blurb: 'A drone, a shelf of crates, and a floor marked for delivery. Nothing here needs a map — the drone can only ever ask what is in front of it.',
    // WHY: this pack hands the player every word the engine knows. A later pack can hand over
    //      fewer, which is how a level can be made harder by vocabulary instead of by size.
    verbs: ['forward', 'turn left', 'turn right', 'grab', 'drop'],
    sensors: ['wall ahead', 'clear ahead', 'crate ahead', 'pad ahead'],
    rules: {},

    levels: [
      {
        id: 'depot-1',
        title: 'First Run',
        teaches: 'sequence',
        // WHY: four lines is more than this route needs (three) and less than a brute-force
        //      walk of every single cell. A player who has not learned to combine still fits,
        //      because nothing is being withheld from them yet.
        budget: 4,
        goal: { kind: 'visit', count: 1 },
        goalSentence: 'Walk the drone onto the marked pad.',
        teachesSentence: 'One instruction after another, in the order you wrote them.',
        rows: [
          '#####',
          '#...#',
          '###.#',
          '#...#'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [[3, 3]],
        crates: []
      },
      {
        id: 'depot-2',
        title: 'Two Crates',
        teaches: 'grab and drop',
        // WHY: twelve lines is exactly the route written out, so a player who wants slack has
        //      to find the turns that do two jobs. This level is not about loops yet.
        budget: 12,
        goal: { kind: 'fill', count: 2 },
        goalSentence: 'Leave a crate on both marked pads.',
        teachesSentence: 'The drone carries one crate at a time, and only puts it down in front of itself.',
        rows: [
          '#####',
          '#...#',
          '#...#',
          '#...#',
          '#####'
        ],
        start: { x: 2, y: 2, dir: 'E' },
        pads: [[1, 1], [2, 3]],
        crates: [[2, 1], [1, 3]]
      },
      {
        id: 'depot-3',
        title: 'The Ring Road',
        teaches: 'repeat',
        // WHY: the arithmetic is the lesson. The same walk written out costs eight lines and the
        //      budget is six, so the only way to solve this level inside its budget is a loop.
        budget: 6,
        goal: { kind: 'visit', count: 4 },
        goalSentence: 'Drive over all four marked pads.',
        teachesSentence: 'repeat 4 runs the lines under it four times, so you write the turn once.',
        rows: [
          '######',
          '#....#',
          '#.##.#',
          '#.##.#',
          '#....#',
          '######'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [[3, 1], [4, 3], [2, 4], [1, 2]],
        crates: []
      }
    ]
  };

  host.LoopworksDepot = LoopworksDepot;
  // WHY: registering is optional, because the harness loads this file into its own clean
  //      context to check the data; a page loads it after the engine and gets it on the shelf.
  if (host.Loopworks) host.Loopworks.register(LoopworksDepot);
})();
