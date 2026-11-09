// WHY: pack for the Polish subject proof. The drone method is unchanged; the words, boards and goal
//      sentences are the only thing that names a subject, and the engine never sees them. This pack
//      carries Polish workplace vocabulary as the context the puzzles live in, so a person studying
//      that vocabulary has a reason to solve them. Boards are borrowed from the depot shapes that the
//      prover already clears, so the new subject starts proven rather than unproven.
// PACK: loopworks
// 2026-11-09 agent: authored under the learner's delegation ("start with words that has to do with
//      work place"), following GRILL-loopworks-v2-subject.txt entries 5 and 6 (Polish is the proof,
//      words off the board, no engine change).

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  const LoopworksPolish = {
    id: 'polish',
    name: 'The Workplace',
    subject: 'Polish workplace vocabulary',
    blurb: 'A first pack for the Polish subject proof: the drone drives the same boards as the depot, but every level is named and framed in the words of a Polish workplace. Programming logic stays the method; the vocabulary is the reason to solve.',
    verbs: ['forward', 'turn left', 'turn right', 'grab', 'drop', 'u-turn'],
    sensors: ['wall ahead', 'clear ahead', 'crate ahead', 'pad ahead'],
    rules: {},
    levels: [
      {
        id: 'polish-1',
        title: 'Pierwszy dzien',
        teaches: 'sequence',
        budget: 4,
        goal: { kind: 'visit', count: 1 },
        goalSentence: 'Walk the drone onto the marked pad - dzien dobry, first day on the floor.',
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
        id: 'polish-2',
        title: 'Dostawa',
        teaches: 'repeat',
        budget: 4,
        goal: { kind: 'visit', count: 4 },
        goalSentence: 'Visit every delivery pad on the warehouse floor.',
        teachesSentence: 'A loop walks the same route without you writing it twice.',
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
        traps: ['forward 1\nturn right\nforward 1\nturn right']
      },
      {
        id: 'polish-3',
        title: 'Kontrola jakosci',
        teaches: 'if',
        budget: 12,
        goal: { kind: 'fill', count: 2 },
        goalSentence: 'Leave a crate on both quality-check pads.',
        teachesSentence: 'The drone carries one crate at a time and only puts it down in front of itself.',
        rows: [
          '#####',
          '#...#',
          '#...#',
          '#...#'
        ],
        start: { x: 2, y: 2, dir: 'E' },
        pads: [[1, 1], [2, 3]],
        crates: [[2, 1], [1, 3]],
        traps: ['forward 9']
      }
    ]
  };

  host.LoopworksPolish = LoopworksPolish;
  if (host.Loopworks && typeof host.Loopworks.register === 'function') {
    host.Loopworks.register(LoopworksPolish);
  }
})();
