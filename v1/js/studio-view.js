// WHY: the studio is where a word that was carried on a board is met again, one context at a time. This
//      file owns the screen and no storage: it paints what the model hands it, calls back when a context
//      is finished, and never decides what is remembered. The blank is the input in the story, the two
//      matching columns do not line up, and there are no tabs - a learner walks the four contexts in
//      order, with Back to review and a Next that waits until the current one is done. The fourth
//      context is the end of the walk: one Done returns to Work instead of leaving Back as a dead end.
// PACK: loopworks-app
// 2026-11-13 agent: first build, following GRILL-loopworks-v2-subject entries 8, 10 and 11 and
//      PRD-TRD-loopworks-v2-subject scenarios 4-8.
// 2026-11-13 agent: four contexts met now ends in one Done, following the learner's same-day direction
//      ("when i finish the 4th stage end it, now it just says back").

(function () {
  const host = typeof globalThis !== 'undefined' ? globalThis : window;
  const doc = host.document;
  const Studio = host.LoopworksStudio;
  const CONTEXTS = Studio && Studio.CONTEXTS
    ? Studio.CONTEXTS
    : ['story', 'spelling', 'dialogue', 'matching'];
  const TITLES = {
    story: 'Story',
    spelling: 'Spelling',
    dialogue: 'Dialogue',
    matching: 'Matching'
  };
  const NOT_YET = 'Not yet - try again.';
  const NOT_A_PAIR = 'Not a pair - try again.';
  const NOT_THAT = 'That does not fit. Try again.';

  function node(tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function press(text, className) {
    const el = node('button', className || 'studio-btn', text);
    el.type = 'button';
    return el;
  }

  function lower(value) {
    return String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  }

  // WHY: no screen in this file may name a subject. A word, a sentence, a pair, a question and its
  //      options all arrive from the pack, and the only words this file knows are its own four context
  //      names and the plain refusals a learner reads. That is what keeps a second language a data file.
  function render(mount, met, onDone, onExit) {
    if (!mount || !doc) return;
    const entries = Array.isArray(met) ? met.filter((entry) => entry && entry.data) : [];
    const state = {
      entries,
      entry: entries[0] || null,
      index: 0,
      done: {},
      storyStep: 0,
      left: null,
      matched: {},
      say: '',
      sayNode: null
    };

    function doneOf(entry) {
      const done = {};
      CONTEXTS.forEach((context) => {
        if (entry && entry.done && entry.done[context] === true) done[context] = true;
      });
      return done;
    }

    function enter(index) {
      state.index = Math.max(0, Math.min(CONTEXTS.length - 1, index));
      state.storyStep = 0;
      state.left = null;
      state.matched = {};
      state.say = '';
    }

    function allDone() {
      return CONTEXTS.every((context) => state.done[context] === true);
    }

    function complete(context) {
      if (!state.entry || state.done[context] === true) return;
      state.done[context] = true;
      // WHY: the entry is the view's only memory of this word while it stays open. Writing the mark
      //      back onto it keeps a finished context finished when the learner switches to another met
      //      word and returns, without asking storage again.
      state.entry.done = state.done;
      state.say = '';
      if (onDone) onDone(state.entry.packId, state.entry.word, context);
      paint();
    }

    function wrong(message, field) {
      state.say = message;
      if (field) {
        field.className = `${field.className} is-wrong`.trim();
      }
      paintSay();
    }

    // WHY: the word card sits above the context so the learner always knows which word he is working
    //      on, and the position is a place in a fixed order - not a score. When more than one word has
    //      been met, the row of words switches word without turning the studio into tabs.
    function paintHead(root) {
      const card = node('div', 'studio-card');
      card.appendChild(node('span', 'studio-word-pl', state.entry.word));
      if (state.entry.data.en) card.appendChild(node('span', 'studio-word-en', state.entry.data.en));
      root.appendChild(card);

      if (entries.length > 1) {
        const row = node('div', 'studio-words');
        entries.forEach((entry) => {
          const pick = press(entry.word, 'studio-word');
          pick.setAttribute('aria-pressed', String(entry === state.entry));
          pick.addEventListener('click', () => {
            if (entry === state.entry) return;
            state.entry = entry;
            state.done = doneOf(entry);
            enter(nextIndex(state.done));
            paint();
          });
          row.appendChild(pick);
        });
        root.appendChild(row);
      }

      const line = node('p', 'studio-step',
        `${TITLES[CONTEXTS[state.index]]} - ${state.index + 1} of ${CONTEXTS.length}`);
      root.appendChild(line);
    }

    function nextIndex(done) {
      for (let i = 0; i < CONTEXTS.length; i += 1) {
        if (done[CONTEXTS[i]] !== true) return i;
      }
      return CONTEXTS.length - 1;
    }

    // WHY: a finished context is reviewable, not hidden. Going back shows what was already done, while
    //      Next still waits for the context currently open.
    function paintStory(exercise, todo) {
      const story = Array.isArray(state.entry.data.story) ? state.entry.data.story : [];
      if (state.done.story || state.storyStep >= story.length) {
        exercise.appendChild(node('p', 'studio-done', 'Story completed.'));
        return;
      }
      const line = story[state.storyStep];
      const parts = String(line.pl).split('____');
      const sentence = node('p', 'studio-sentence');
      sentence.appendChild(node('span', 'studio-text', parts[0]));
      const field = node('input', 'studio-blank');
      field.type = 'text';
      field.value = '';
      field.setAttribute('autocomplete', 'off');
      field.setAttribute('autocapitalize', 'off');
      field.setAttribute('spellcheck', 'false');
      field.setAttribute('size', String(Math.max(3, String(line.answer).length)));
      field.setAttribute('aria-label', 'the missing word');
      sentence.appendChild(field);
      sentence.appendChild(node('span', 'studio-text', parts.length > 1 ? parts.slice(1).join('____') : ''));
      exercise.appendChild(sentence);
      if (line.en) exercise.appendChild(node('p', 'studio-gloss', line.en));

      function check(value) {
        if (lower(value) === lower(line.answer)) {
          state.storyStep += 1;
          state.say = '';
          if (state.storyStep >= story.length) complete('story');
          else paint();
          return;
        }
        wrong(NOT_YET, field);
      }

      field.addEventListener('input', (event) => {
        const value = event && event.target ? event.target.value : field.value;
        if (field.className !== 'studio-blank') field.className = 'studio-blank';
        // WHY: the last letter of the answer is the check, so a learner never hunts for a button. Enter
        //      does the same for anyone who expects it.
        if (String(value).trim().length === String(line.answer).length) check(value);
      });
      field.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (event.preventDefault) event.preventDefault();
        check(field.value);
      });
    }

    function paintSpelling(exercise, todo) {
      if (state.done.spelling) {
        exercise.appendChild(node('p', 'studio-done', `Correct - ${state.entry.data.pl}.`));
        return;
      }
      exercise.appendChild(node('p', 'studio-prompt', `Type the word that means "${state.entry.data.en}".`));
      const field = node('input', 'studio-blank');
      field.type = 'text';
      field.value = '';
      field.setAttribute('autocomplete', 'off');
      field.setAttribute('autocapitalize', 'off');
      field.setAttribute('spellcheck', 'false');
      field.setAttribute('aria-label', 'the word');
      exercise.appendChild(field);
      const check = press('Check');
      function submit() {
        if (lower(field.value) === lower(state.entry.data.pl)) complete('spelling');
        else wrong(NOT_YET, field);
      }
      check.addEventListener('click', submit);
      field.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (event.preventDefault) event.preventDefault();
        submit();
      });
      todo.appendChild(check);
    }

    function paintDialogue(exercise, todo) {
      const dialog = state.entry.data.dialog || {};
      if (state.done.dialogue) {
        exercise.appendChild(node('p', 'studio-done', dialog.reply || 'Dialogue answered.'));
        return;
      }
      exercise.appendChild(node('p', 'studio-question', dialog.q || ''));
      if (dialog.qGloss) exercise.appendChild(node('p', 'studio-gloss', dialog.qGloss));
      const opts = Array.isArray(dialog.opts) ? dialog.opts : [];
      const choices = node('div', 'studio-choices');
      opts.forEach((option, index) => {
        const choice = press(option, 'studio-choice');
        choice.addEventListener('click', () => {
          if (index === dialog.right) complete('dialogue');
          else {
            state.say = NOT_THAT;
            paint();
          }
        });
        choices.appendChild(choice);
      });
      exercise.appendChild(choices);
    }

    // WHY: the two columns are not in the same order, so a pair cannot be found by row position. The
    //      shift is fixed rather than random: the same word draws the same two columns on every visit,
    //      which is what makes a mistake repeatable and therefore learnable.
    function paintMatching(exercise) {
      const pairs = Array.isArray(state.entry.data.match) ? state.entry.data.match : [];
      if (state.done.matching) {
        exercise.appendChild(node('p', 'studio-done', 'Every pair is matched.'));
        return;
      }
      const shift = pairs.length > 1 ? Math.max(1, Math.floor(pairs.length / 2)) : 0;
      const columns = node('div', 'studio-columns');

      const left = node('div', 'studio-column');
      left.appendChild(node('h4', 'studio-column-name', state.entry.language || ''));
      const leftList = node('div', 'studio-list');
      pairs.forEach((pair, index) => {
        const pick = press(pair.pl, 'studio-pair');
        pick.dataset.index = String(index);
        pick.dataset.side = 'left';
        if (state.matched[index]) pick.disabled = true;
        if (state.left === index) pick.classList.add('is-picked');
        pick.addEventListener('click', () => {
          state.left = index;
          state.say = '';
          paint();
        });
        leftList.appendChild(pick);
      });
      left.appendChild(leftList);

      const right = node('div', 'studio-column');
      right.appendChild(node('h4', 'studio-column-name', 'Meanings'));
      const rightList = node('div', 'studio-list');
      for (let slot = 0; slot < pairs.length; slot += 1) {
        const index = (slot + shift) % pairs.length;
        const pick = press(pairs[index].en, 'studio-pair');
        pick.dataset.index = String(index);
        pick.dataset.side = 'right';
        if (state.matched[index]) pick.disabled = true;
        pick.addEventListener('click', () => {
          if (state.left === null) {
            state.say = 'Pick one from each side.';
            paint();
            return;
          }
          if (state.left === index) {
            state.matched[index] = true;
            state.left = null;
            state.say = '';
            if (pairs.every((pair, at) => state.matched[at] === true)) complete('matching');
            else paint();
            return;
          }
          state.left = null;
          state.say = NOT_A_PAIR;
          paint();
        });
        rightList.appendChild(pick);
      }
      right.appendChild(rightList);

      columns.appendChild(left);
      columns.appendChild(right);
      exercise.appendChild(columns);
    }

    function paintSay() {
      if (state.sayNode) state.sayNode.textContent = state.say;
    }

    function paintActions(root) {
      const actions = node('div', 'studio-actions');
      // WHY: once every context is met there is nothing left to walk, so Back and Next give way to one
      //      Done. Done is the end of the studio, not another step inside it: it hands control back to
      //      the screen that opened the studio, which is where the learner picks up the next level.
      if (allDone()) {
        const done = press('Done');
        done.addEventListener('click', () => {
          if (onExit) onExit();
        });
        actions.appendChild(done);
        root.appendChild(actions);
        return;
      }
      const back = press('Back');
      back.disabled = state.index === 0;
      back.addEventListener('click', () => {
        if (state.index === 0) return;
        enter(state.index - 1);
        paint();
      });
      const next = press('Next');
      // WHY: Next waits for the current context to be done, and it is refused on the last one because
      //      there is nowhere left to walk. Back is the only way to review from there.
      next.disabled = state.index >= CONTEXTS.length - 1 || state.done[CONTEXTS[state.index]] !== true;
      next.addEventListener('click', () => {
        if (next.disabled || state.index >= CONTEXTS.length - 1) return;
        enter(state.index + 1);
        paint();
      });
      actions.appendChild(back);
      actions.appendChild(next);
      root.appendChild(actions);
    }

    function paint() {
      mount.textContent = '';
      const panel = node('div', 'studio-panel');
      mount.appendChild(panel);

      if (!state.entry) {
        panel.appendChild(node('p', 'studio-empty', 'No word met yet. Solve a level that carries a word.'));
        return;
      }

      paintHead(panel);
      const exercise = node('div', 'studio-exercise');
      const todo = node('div', 'studio-todo');
      const context = CONTEXTS[state.index];
      if (context === 'story') paintStory(exercise, todo);
      else if (context === 'spelling') paintSpelling(exercise, todo);
      else if (context === 'dialogue') paintDialogue(exercise, todo);
      else paintMatching(exercise);
      panel.appendChild(exercise);
      panel.appendChild(todo);

      const say = node('p', 'studio-say',
        allDone() ? 'All four contexts are met.' : state.say);
      say.setAttribute('aria-live', 'polite');
      state.sayNode = say;
      panel.appendChild(say);
      paintActions(panel);
    }

    state.done = doneOf(state.entry);
    enter(nextIndex(state.done));
    paint();
  }

  host.LoopworksStudioView = { render };
})();
