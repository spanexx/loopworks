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
    // 2026-11-08 qoder-agent: `u-turn` joined the list with the sixth verb. Withholding it is a hard
    //      tier decision (docs/features/loopworks-u-turn-verb/PRD-TRD-loopworks-u-turn-verb.md, PRD 5).
    verbs: ['forward', 'turn left', 'turn right', 'grab', 'drop', 'u-turn'],
    sensors: ['wall ahead', 'clear ahead', 'crate ahead', 'pad ahead'],
    rules: {},

    // WHY: every level names the plausible wrong programs it refuses, in the same text a player types.
    //      These are read by the harness and never by the engine - a trap that wins inside the Budget
    //      turns the shelf red, which is the difficulty instrument landing (`loopworks-difficulty-instrument`).
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
        crates: [],
        traps: ['forward 3']
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
        crates: [[2, 1], [1, 3]],
        traps: ['turn left\ngrab\nturn right\nturn right\nforward 2\ndrop\nturn right\nturn right\nforward 1\ngrab\nturn right\nturn right\nforward 2\ndrop']
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
        crates: [],
        traps: ['forward 3\nturn right\nforward 3\nturn right\nforward 3\nturn right\nforward 3\nturn right']
      },
      {
        id: 'depot-4',
        title: 'Ask The Wall',
        teaches: 'guard',
        // WHY: this ring is four cells wide and three tall, so its sides are three moves and two
        //      moves, alternating. A uniform loop cannot cross it at any step count: 1 bumps the
        //      centre wall at (2,2), 2 bumps at (3,2), 3 bumps at (4,4). Written with turns the route
        //      is seven lines, folded into repeat 2 it is six, and the budget is five - so the only
        //      shape that fits asks the floor instead of counting it.
        budget: 5,
        goal: { kind: 'visit', count: 4 },
        goalSentence: 'Drive over all four marked pads.',
        teachesSentence: 'if wall ahead: turn right asks what is in front of the drone, so the same two lines work down every side of an uneven ring.',
        rows: [
          '######',
          '#....#',
          '#.##.#',
          '#....#',
          '######'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [[2, 1], [4, 2], [3, 3], [1, 2]],
        crates: [],
        traps: ['repeat 2\n  forward 3\n  turn right\n  forward 2\n  turn right\nend']
      },
      {
        id: 'depot-5',
        title: 'The Long Aisle',
        teaches: 'a number after forward',
        // WHY: the aisle is seven cells and the drop leg five, so the walk is ten cells and it
        //      touches four pads on the way. Written one cell at a time that is eleven lines; with
        //      two arguments and one turn it is three, and the budget is three. This is the first
        //      level where the number after forward has to be big, so counting on your fingers is
        //      the lesson rather than a shortcut around it.
        budget: 3,
        goal: { kind: 'visit', count: 4 },
        goalSentence: 'Drive over all four marked pads.',
        teachesSentence: 'forward 6 walks six cells in one line, so a long aisle costs one line and not six.',
        rows: [
          '#########',
          '#.......#',
          '#######.#',
          '#######.#',
          '#######.#',
          '#######.#',
          '#########'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [[3, 1], [7, 1], [7, 3], [7, 5]],
        crates: [],
        traps: ['forward 1\nforward 1\nforward 1\nforward 1\nforward 1\nforward 1\nturn right\nforward 1\nforward 1\nforward 1\nforward 1']
      },
      {
        id: 'depot-6',
        title: 'The Assembly Line',
        teaches: 'a loop that carries',
        // WHY: three stations, each two cells down the aisle, each a crate above its pad. The body
        //      of eight lines does one station, so repeat 3 fills all three in ten lines; written
        //      out the same job costs twenty-one. depot-2 taught grab and drop, depot-3 taught
        //      repeat - this is the first level that puts them in the same block.
        budget: 10,
        goal: { kind: 'fill', count: 3 },
        goalSentence: 'Leave a crate on all three marked pads.',
        teachesSentence: 'A loop can carry as well as walk: the same eight lines pick up and set down three times.',
        rows: [
          '#########',
          '##.#.#.##',
          '#.......#',
          '###.#.#.#',
          '#########'
        ],
        start: { x: 1, y: 2, dir: 'E' },
        pads: [[3, 3], [5, 3], [7, 3]],
        crates: [[2, 1], [4, 1], [6, 1]],
        traps: ['forward 1\nturn left\ngrab\nturn right\nforward 1\nturn right\ndrop\nturn left\nforward 1\nturn left\ngrab\nturn right\nforward 1\nturn right\ndrop\nturn left\nforward 1\nturn left\ngrab\nturn right\nforward 1\nturn right\ndrop']
      },
      {
        id: 'depot-7',
        title: 'Every Shelf',
        teaches: 'a loop that returns to where it started',
        // WHY: four dead-end shelves, three cells deep, standing two cells apart. One body climbs
        //      a shelf, turns around, climbs back and steps to the next shelf - seven lines inside
        //      repeat 4, nine in all. Written out the four climbs cost twenty-three. The turn that
        //      faces the drone back down the aisle is the one a player has to find himself, which
        //      is why the budget is nine and not eight.
        budget: 9,
        goal: { kind: 'visit', count: 4 },
        goalSentence: 'Drive into all four shelf ends.',
        teachesSentence: 'A loop that ends where it began can be repeated: turn around inside it, not outside.',
        rows: [
          '############',
          '############',
          '##.#.#.#.###',
          '##.#.#.#.###',
          '##.#.#.#.###',
          '#..........#',
          '############'
        ],
        start: { x: 2, y: 5, dir: 'E' },
        pads: [[2, 2], [4, 2], [6, 2], [8, 2]],
        crates: [],
        traps: ['turn left\nforward 3\nturn left\nturn left\nforward 3\nturn left\nforward 2\nturn left\nforward 3\nturn left\nturn left\nforward 3\nturn left\nforward 2\nturn left\nforward 3\nturn left\nturn left\nforward 3\nturn left\nforward 2\nturn left\nforward 3\nturn left\nturn left\nforward 3\nturn left\nforward 2']
      },
      {
        id: 'depot-8',
        title: 'Four Doors',
        teaches: 'two sensors in one loop',
        // WHY: four doors off one standing place, two of them crates and two of them pads. The
        //      drone never walks: it turns, asks, and the guards do the rest. A program that names
        //      the doors instead of asking them costs seven lines and only works from one facing,
        //      and the budget is five - so the two questions in the block are what make one loop
        //      serve all four doors.
        budget: 5,
        goal: { kind: 'fill', count: 2 },
        goalSentence: 'Leave a crate on both marked pads.',
        teachesSentence: 'Ask twice in one loop - if crate ahead: grab, if pad ahead: drop - and let the turn bring the next door.',
        rows: [
          '#####',
          '##.##',
          '#...#',
          '##.##',
          '#####'
        ],
        start: { x: 2, y: 2, dir: 'N' },
        pads: [[3, 2], [1, 2]],
        crates: [[2, 1], [2, 3]],
        traps: ['grab\nturn right\ndrop\nturn right\ngrab\nturn right\ndrop']
      },
      {
        id: 'depot-9',
        title: 'Round The Yard',
        teaches: 'asking instead of counting',
        // WHY: the yard is seven cells wide and four tall, so its sides are six and three. No
        //      uniform loop crosses it at any step count - 1, 2, 3 and 5 each bump a side wall -
        //      and the legs written out folded into repeat 2 cost six lines against a budget of
        //      five. The only shape that fits asks the floor: turn when the wall is in front, walk
        //      when it is not, and the uneven ring is walked by four lines.
        budget: 5,
        goal: { kind: 'visit', count: 4 },
        goalSentence: 'Drive over all four marked pads.',
        teachesSentence: 'A guard loop does not need to know how long each side is, so one loop fits an uneven ring.',
        rows: [
          '########',
          '#......#',
          '#.####.#',
          '#.####.#',
          '#......#',
          '########'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [[4, 1], [6, 3], [3, 4], [1, 2]],
        crates: [],
        traps: [
          'repeat 20\n  forward 2\n  turn right\nend',
          'repeat 2\n  forward 5\n  turn right\n  forward 3\n  turn right\nend'
        ]
      }
    ]
  };

  host.LoopworksDepot = LoopworksDepot;
  // WHY: registering is optional, because the harness loads this file into its own clean
  //      context to check the data; a page loads it after the engine and gets it on the shelf.
  if (host.Loopworks) host.Loopworks.register(LoopworksDepot);
})();
