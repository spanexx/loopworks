// WHY: pack two, and the proof of the layer claim. Same engine, same verbs, same sensors - one
//      new rule. A player who has beaten The Depot meets a different kind of problem, and not
//      one new word.
// PACK: loopworks
// 2026-11-03 qoder-agent: authored to GRILL-loopworks.txt entries 7 and 13.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  const LoopworksNightShift = {
    id: 'night-shift',
    name: 'The Night Shift',
    subject: 'programming logic',
    blurb: 'Same depot, same words, and a battery. Every cell the drone walks costs one unit of charge, so a wasted step is now a failure.',
    verbs: ['forward', 'turn left', 'turn right', 'grab', 'drop'],
    sensors: ['wall ahead', 'clear ahead', 'crate ahead', 'pad ahead'],
    // WHY: this one line is the whole new layer. The engine enforces it and knows nothing about
    //      batteries - it only knows a pack asked for a fuel count.
    rules: { fuel: 12 },

    levels: [
      {
        id: 'night-1',
        title: 'Count The Steps',
        teaches: 'planning under a rule',
        // WHY: twelve charge is the exact cost of the shortest route that covers both pads, so
        //      the first wrong turn costs the run rather than a star nobody asked for.
        budget: 6,
        goal: { kind: 'visit', count: 2 },
        goalSentence: 'Reach both marked pads before the charge runs out.',
        teachesSentence: 'Turns are free. Walking is not. Plan the order before you type.',
        rows: [
          '#############',
          '#...........#',
          '#############'
        ],
        start: { x: 6, y: 1, dir: 'E' },
        pads: [[10, 1], [2, 1]],
        crates: []
      },
      {
        id: 'night-2',
        title: 'Four Pads, One Battery',
        teaches: 'a loop you can trust',
        budget: 6,
        goal: { kind: 'visit', count: 4 },
        goalSentence: 'Drive over all four marked pads on one charge.',
        teachesSentence: 'The loop is what makes twelve steps fit in twelve charge with nothing spare.',
        rows: [
          '######',
          '#....#',
          '#.##.#',
          '#.##.#',
          '#....#',
          '######'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [[2, 1], [4, 2], [3, 4], [1, 3]],
        crates: []
      },
      {
        id: 'night-3',
        title: 'No Slack',
        teaches: 'the whole battery, and not one cell more',
        // WHY: the ring is twelve cells round and the battery is twelve, so the counted route
        //      spends every unit it has - folded into repeat 2 it costs six lines against a budget
        //      of five, and written out seven. The guard loop walks the same ring and stops on the
        //      fourth pad at eleven, with one cell left over. Here the Budget forces the shape and
        //      the rule punishes the double-back, which is the pair depot-9 could not teach.
        budget: 5,
        goal: { kind: 'visit', count: 4 },
        goalSentence: 'Drive over all four marked pads on one charge.',
        teachesSentence: 'A guard loop stops on the last pad instead of walking past it, so it spends less than the counted route.',
        rows: [
          '#######',
          '#.....#',
          '#.###.#',
          '#.....#',
          '#######'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [[3, 1], [5, 2], [3, 3], [1, 2]],
        crates: []
      },
      {
        id: 'night-4',
        title: 'Save The Long One For Last',
        teaches: 'the order the battery allows',
        // WHY: three arms off one hub - one cell north, two west, six east. Visiting the long arm
        //      last means never paying to come back: 1 + 1 + 2 + 8 is twelve, which is the whole
        //      battery exactly. Any other order walks a leg twice and runs out at fourteen or
        //      sixteen. The board is the same size as the battery on purpose - the route is the
        //      lesson, and the eight-line counting version still fits the Budget of nine.
        budget: 9,
        goal: { kind: 'visit', count: 3 },
        goalSentence: 'Reach all three marked pads before the charge runs out.',
        teachesSentence: 'End at the far pad. Coming back down a long arm is what costs the charge.',
        rows: [
          '#############',
          '#############',
          '#####.#######',
          '###.........#',
          '#############'
        ],
        start: { x: 5, y: 3, dir: 'N' },
        pads: [[5, 2], [3, 3], [11, 3]],
        crates: []
      },
      {
        id: 'night-5',
        title: 'The Long Fetch',
        teaches: 'stopping in front of the crate',
        // WHY: the crate is at the far end of a nine cell aisle and the pad is back at three, so
        //      the fetch is seven cells out and four back - eleven of twelve, with one to spare.
        //      forward 8 does not overshoot safely: a crate stops the drone the way a wall does,
        //      so one cell too many is a bump and the run is over. That is the night-shift version
        //      of a lesson the depot could only make expensive, not fatal.
        budget: 6,
        goal: { kind: 'fill', count: 1 },
        goalSentence: 'Bring the crate at the end of the aisle back to the marked pad.',
        teachesSentence: 'Walk up to the crate, not onto it - a crate in front stops you, and grabbing needs it in front.',
        rows: [
          '###########',
          '#.........#',
          '###########'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [[3, 1]],
        crates: [[9, 1]]
      },
      {
        id: 'night-6',
        title: 'Three Stations',
        teaches: 'a loop that carries, on one charge',
        // WHY: three stations evenly three cells apart, each a crate above the aisle and a pad
        //      below it. Nine cells of walking fills all three, inside a battery of twelve, and
        //      the loop that does it is nine lines - the same job spelled out costs twenty and
        //      busts the Budget. depot-6 is the same shape without a battery: here an extra lap is
        //      not merely long, it is fatal, so the count in repeat 3 has to be right.
        budget: 9,
        goal: { kind: 'fill', count: 3 },
        goalSentence: 'Leave a crate on all three marked pads on one charge.',
        teachesSentence: 'One loop can carry three times over, and the walk it costs is the walk it cannot undo.',
        rows: [
          '#############',
          '####.##.##.##',
          '#...........#',
          '####.##.##.##',
          '#############'
        ],
        start: { x: 1, y: 2, dir: 'E' },
        pads: [[4, 3], [7, 3], [10, 3]],
        crates: [[4, 1], [7, 1], [10, 1]]
      },
      {
        id: 'night-7',
        title: 'Uneven Stations',
        teaches: 'one loop for stations that are not evenly spaced',
        // WHY: the same job as night-6 with the stations two cells apart and then four, so no
        //      count folds both: the best loop is ten lines and the written-out route is thirteen,
        //      against a budget of nine. The shape that fits walks one cell at a time and asks at
        //      every step - turn to look, grab if a crate is there, turn back, drop if a pad is
        //      there, face down the aisle again. It costs six of twelve because it never overshoots.
        budget: 9,
        goal: { kind: 'fill', count: 2 },
        goalSentence: 'Leave a crate on both marked pads on one charge.',
        teachesSentence: 'When the stations are not evenly spaced, a loop that asks works and a loop that counts does not.',
        rows: [
          '##########',
          '###.###.##',
          '#........#',
          '###.###.##',
          '##########'
        ],
        start: { x: 1, y: 2, dir: 'E' },
        pads: [[3, 3], [7, 3]],
        crates: [[3, 1], [7, 1]]
      }
    ]
  };

  host.LoopworksNightShift = LoopworksNightShift;
  if (host.Loopworks) host.Loopworks.register(LoopworksNightShift);
})();
