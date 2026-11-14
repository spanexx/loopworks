// WHY: pack for the Polish subject proof. The drone method is unchanged; the words, boards and goal
//      sentences are the only thing that names a subject, and the engine never sees them. This pack
//      carries Polish workplace vocabulary as the context the puzzles live in, so a person studying
//      that vocabulary has a reason to solve them. Boards are borrowed from the depot shapes that the
//      prover already clears, so the new subject starts proven rather than unproven.
// PACK: loopworks
// 2026-11-09 agent: authored as the Polish subject proof, following GRILL-loopworks-v2-subject.txt
//      entry 5 (Polish is the proof) and the accepted simulation at
//      docs/features/loopworks-v2-subject/sims/words-in-context-v4.html.
// 2026-11-13 agent: provenance corrected under D-23. The old header quoted the learner with a sentence
//      no record carries. The workplace framing is the pack's own; the first word is the learner's own
//      because the accepted simulation is his 2026-11-09 starting point and carries his words, which is
//      how entry 3's "your list first, decks later" is honoured here.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  const LoopworksPolish = {
    id: 'polish',
    name: 'The Workplace',
    subject: 'Polish workplace vocabulary',
    blurb: 'A first pack for the Polish subject proof: the drone drives the same boards as the depot, but every level is named and framed in the words of a Polish workplace. Programming logic stays the method; the vocabulary is the reason to solve.',
    // WHY: the word studio reads these three fields and nothing else from the subject. The words are
    //      the learner's own material from the accepted simulation; the language and aim are the pack's
    //      framing, so no subject string has to live in code (loopworks-v2-subject, GRILL entry 11).
    language: 'Polish',
    aim: 'the words of the workplace',
    words: {
      biuro: {
        en: 'office',
        pl: 'biuro',
        story: [
          { pl: 'Pracuję ____ biurze.', en: 'I work in an office.', answer: 'w' },
          { pl: 'W ____ jest dużo okien.', en: 'There are many windows in the office.', answer: 'biurze' },
          { pl: 'W biurze pracuje mój ____.', en: 'My brother works in the office.', answer: 'brat' }
        ],
        // WHY: the Word studio teaches the change as pack data: the base is this Word's own pl, so it
        //      is not repeated here, and the use sentence is fresh - no line of the story above - so
        //      passing it proves the change transfers. The studio names no language or case of its own.
        forms: [
          {
            label: 'locative',
            to: 'biurze',
            en: 'in the office',
            why: 'When the word comes after a preposition such as "w" (in) or "o" (about), Polish puts it in the locative: the ending -o becomes -e, and the r softens to rz.',
            use: { pl: 'Rozmawiamy o ____ przez telefon.', en: 'We are talking about the office on the phone.', answer: 'biurze' }
          }
        ],
        // WHY: the base and the changed form carry different meanings here. Before this, both said
        //      "office", which is the confusion the learner named; the pair is part of teaching the
        //      change, not a separate lesson.
        match: [
          { pl: 'Pracuję', en: 'I work' },
          { pl: 'biuro', en: 'office' },
          { pl: 'biurze', en: 'in the office' },
          { pl: 'dużo', en: 'many' },
          { pl: 'okien', en: 'windows' },
          { pl: 'jest', en: 'is' },
          { pl: 'w', en: 'in' }
        ],
        dialog: {
          q: 'Gdzie pracujesz?',
          qGloss: 'Where do you work?',
          opts: ['W biurze.', 'W szkole.', 'W sklepie.'],
          right: 0,
          reply: 'Dobrze. Biuro to dobre miejsce. (Good. An office is a good place.)'
        }
      }
    },
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
      },
      {
        // WHY: the first word board spends the accepted simulation's own shape: five letter crates, one
        //      hole, and a route that has to visit them in spelling order. It spends no decoy and no
        //      tight Budget, so levers 1, 4 and 5 stay deferred (GRILL entries 9 and 11).
        id: 'polish-4',
        title: 'Biuro',
        teaches: 'sequence',
        word: 'biuro',
        budget: 60,
        goal: { kind: 'hole', sequence: ['b', 'i', 'u', 'r', 'o'] },
        goalSentence: 'Carry each letter into the hole, in order, and spell biuro.',
        teachesSentence: 'The letter the hole wants next is the only one it will take, so the word fixes the route.',
        rows: [
          '#########',
          '#.......#',
          '#.......#',
          '#.......#',
          '#.......#',
          '#########'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [],
        holes: [[4, 3]],
        crates: [[2, 2, 'b'], [4, 2, 'i'], [6, 2, 'u'], [2, 4, 'r'], [6, 4, 'o']],
        traps: [
          'forward 9',
          'forward 1\nturn right\ngrab\nturn left\nforward 2\nturn right\ndrop',
          'turn left\nturn left\ngrab'
        ]
      },
      {
        // WHY: the second board is the same word with the decoy lever spent - two letters the word does
        //      not use - and two pillars that make the spelling order fight the geometry. It also spends
        //      lever 5: the word was met on polish-4 and in the studio, so the goal gives only its
        //      meaning (GRILL entries 9 and 11, amended by the learner on 2026-11-13). Its title must not
        //      name the word either, because the top bar shows it before the first letter is carried.
        id: 'polish-5',
        title: 'Drugie podejscie',
        teaches: 'sequence',
        word: 'biuro',
        budget: 90,
        goal: { kind: 'hole', sequence: ['b', 'i', 'u', 'r', 'o'] },
        goalSentence: 'Carry each letter into the hole, in order, and spell the Polish word for office - the pillars are in your way.',
        teachesSentence: 'Decoy crates carry letters the word does not use; the hole refuses them and the claw keeps them.',
        rows: [
          '###########',
          '#.........#',
          '#....##...#',
          '#.........#',
          '#....##...#',
          '#.........#',
          '###########'
        ],
        start: { x: 1, y: 1, dir: 'E' },
        pads: [],
        holes: [[5, 3]],
        crates: [[2, 2, 'b'], [8, 2, 'i'], [6, 5, 'u'], [8, 4, 'r'], [2, 4, 'o'], [9, 5, 'k'], [1, 5, 'a']],
        traps: [
          'forward 10',
          'forward 1\nturn right\ngrab\nturn left\nforward 4\nturn right\ndrop',
          'turn left\nturn left\ngrab'
        ]
      }
    ]
  };

  host.LoopworksPolish = LoopworksPolish;
  if (host.Loopworks && typeof host.Loopworks.register === 'function') {
    host.Loopworks.register(LoopworksPolish);
  }
})();
