// WHY: the word list belongs to the pack, so this file never keeps a list of its own: it asks the
//      engine what the current pack unlocks, then pairs each word with the rule the engine enforces
//      in plain words. A word without a description fails the harness instead of shipping blank.
//      Nothing here touches the document at load, so the node harness can load the file too.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: the words dialog, replacing the chip list in the rail.

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;

  const DESCRIPTIONS = {
    forward: 'Walks the drone forward one cell. Add a number after it to walk further, like forward 3.',
    'turn left': 'Turns the drone a quarter turn to the left, standing still.',
    'turn right': 'Turns the drone a quarter turn to the right, standing still.',
    grab: 'Picks up the crate in the cell in front of the drone. The drone carries one crate at a time.',
    drop: 'Puts down the crate the drone is carrying, in the cell in front of it. On a pad, the crate fills the pad.',
    'if wall ahead': 'Asks whether the way forward is blocked by a wall, a crate, or the edge of the floor. When the answer is yes, the action after the colon runs. Asking costs one tick either way.',
    'if clear ahead': 'Asks whether the cell in front is open floor the drone can walk into. A wall, a crate, or the edge of the floor answers no. When the answer is yes, the action after the colon runs.',
    'if crate ahead': 'Asks whether the cell in front holds a crate. When the answer is yes, the action after the colon runs. Asking costs one tick either way.',
    'if pad ahead': 'Asks whether the cell in front is a marked pad. When the answer is yes, the action after the colon runs. Asking costs one tick either way.',
    repeat: 'Runs the lines indented under it the number of times you give, like repeat 3. Write end on its own line to close the block.',
    end: 'Closes the nearest repeat that is still open. The lines indented under that repeat are the block it runs.'
  };

  function list(pack) {
    const Loopworks = host.Loopworks;
    if (!Loopworks || !pack) return [];
    // WHY: a guard is offered as "if wall ahead: " so Tab can carry the colon into the line. In a
    //      glossary the colon is punctuation, not part of the word, so the label drops it.
    return Loopworks.suggest(pack, '').items.map((item) => item.trim().replace(/:$/, ''));
  }

  function describe(word) {
    return DESCRIPTIONS[word] || '';
  }

  // WHY: one button per word the pack offers, in the engine's order. The handler is attached once
  //      because the mount lives for the whole session and the controller passes a stable callback.
  function render(mount, pack, onPick) {
    const doc = host.document;
    if (!mount || !doc) return;
    mount.textContent = '';
    list(pack).forEach((word) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'word-btn';
      button.dataset.word = word;
      button.textContent = word;
      button.setAttribute('aria-pressed', 'false');
      mount.appendChild(button);
    });
    if (!mount.dataset.wired) {
      mount.dataset.wired = 'true';
      mount.addEventListener('click', (event) => {
        const button = event.target.closest ? event.target.closest('[data-word]') : null;
        if (!button || !onPick) return;
        onPick(button.dataset.word);
      });
    }
  }

  host.LoopworksWords = { list, describe, render };
})();
