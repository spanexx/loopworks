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
      }
    ]
  };

  host.LoopworksNightShift = LoopworksNightShift;
  if (host.Loopworks) host.Loopworks.register(LoopworksNightShift);
})();
