// WHY: the acceptance evidence for App v1. It proves three things without a browser: the app is
//      still using the tested rules unchanged, the two packs still solve, and the page carries no
//      external asset, absolute path, stray storage key or unreadable colour. Exits non-zero when
//      any check fails, so it can be the only gate the app repository needs.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: written before the page existed, so the promises in
//                          PRD-TRD-loopworks-app.md are the specification, not a description.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const v1 = path.join(appRoot, 'v1');
const source = path.resolve(appRoot, '..', 'wireframe', 'loopworks');

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function read(file) {
  return readFileSync(file, 'utf8');
}
// WHY: a developer comment is not on the screen. Stripping comments keeps the rating-word guard
//      pointed at what the player can read, including pack titles and goal sentences.
function spoken(file) {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

// WHY: the engine is a classic script that hangs itself off a global, because file:// refuses ES
//      modules. A vm context gives it a global to hang off in node, so the same file is both the
//      game's rules in the browser and the subject of this harness.
function freshContext() {
  const ctx = { console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  return ctx;
}
function runScript(ctx, file) {
  vm.runInContext(read(file), ctx, { filename: file });
}
const ctx = freshContext();
runScript(ctx, path.join(v1, 'js', 'engine.js'));
runScript(ctx, path.join(v1, 'js', 'packs', 'depot.js'));
runScript(ctx, path.join(v1, 'js', 'packs', 'night-shift.js'));
runScript(ctx, path.join(v1, 'js', 'words.js'));
const L = ctx.Loopworks;
assert(L, 'the app engine did not define the Loopworks global');
const W = ctx.LoopworksWords;
assert(W, 'the words module did not define the LoopworksWords global');

function shelf() {
  return L.packs().filter((entry) => entry.errors.length === 0).map((entry) => entry.pack);
}
function findPack(id) {
  const pack = shelf().find((entry) => entry.id === id);
  assert(pack, `the shelf does not hold the pack "${id}"`);
  return pack;
}
function play(packId, levelId, program) {
  return L.run(findPack(packId), levelId, program);
}

// WHY: the app is a surface over the prototype's rules. A copy that has drifted is a second set of
//      rules pretending to be the first, which is exactly what the layering rule forbids.
check('app: the engine and both packs are byte-for-byte copies', () => {
  const pairs = [
    ['js/engine.js', path.join(source, 'engine.js')],
    ['js/packs/depot.js', path.join(source, 'packs', 'depot.js')],
    ['js/packs/night-shift.js', path.join(source, 'packs', 'night-shift.js')]
  ];
  for (const [local, original] of pairs) {
    const a = readFileSync(path.join(v1, local));
    const b = readFileSync(original);
    assert(a.equals(b), `${local} no longer matches ${path.relative(appRoot, original)}`);
  }
  return 'three copies match';
});

check('app: both packs validate and only two load', () => {
  const entries = L.packs();
  assert(entries.length === 2, `expected two packs, found ${entries.length}`);
  entries.forEach((entry) => assert(entry.errors.length === 0, entry.errors.join('; ')));
  assert(findPack('depot').levels.length === 3, 'the depot pack must keep three levels');
  assert(findPack('night-shift').levels.length === 2, 'the night pack must keep two levels');
  return entries.map((entry) => entry.pack.id).join(', ');
});

check('app: the engine names no pack and carries no subject', () => {
  const text = read(path.join(v1, 'js', 'engine.js')).toLowerCase();
  // WHY: crates, pads and drones are the engine's own world, not a subject. What must never appear
  //      here is a pack's name or a subject's vocabulary - that belongs to a pack or the page.
  ['depot', 'night-shift', 'the night shift', 'market', 'sentence', 'grammar'].forEach((word) => {
    assert(!text.includes(word), `engine.js names "${word}"`);
  });
  return 'engine stays subject-blind';
});

// WHY: these are the published solutions from the prototype. If one stops solving inside its
//      budget, the app is offering a level that cannot be finished as taught.
const SOLUTIONS = {
  'depot-1': 'forward 2\nturn right\nforward 2',
  'depot-2': 'turn left\ngrab\nturn right\nturn right\ndrop\nturn right\nforward 1\nturn left\ngrab\nturn right\nturn right\ndrop',
  'depot-3': 'repeat 4\n  forward 3\n  turn right\nend',
  'night-1': 'forward 4\nturn left\nturn left\nforward 8',
  'night-2': 'repeat 4\n  forward 3\n  turn right\nend'
};

check('app: every published solution solves inside its budget', () => {
  const rows = [];
  for (const pack of shelf()) {
    for (const level of pack.levels) {
      const program = SOLUTIONS[level.id];
      assert(program, `${level.id} has no published solution`);
      const run = play(pack.id, level.id, program);
      assert(run.status === 'solved', `${level.id}: ${run.status} / ${run.reason}`);
      assert(run.linesUsed <= level.budget, `${level.id}: ${run.linesUsed} lines over ${level.budget}`);
      rows.push(`${level.id} ${run.linesUsed}/${level.budget}`);
    }
  }
  return rows.join('  ');
});

check('app: the ring still forces a loop by arithmetic', () => {
  const spelled = 'forward 3\nturn right\n'.repeat(4);
  const looped = SOLUTIONS['depot-3'];
  const a = play('depot', 'depot-3', spelled);
  const b = play('depot', 'depot-3', looped);
  const budget = findPack('depot').levels.find((level) => level.id === 'depot-3').budget;
  assert(a.status === 'solved' && b.status === 'solved', 'both routes must reach the goal');
  assert(a.linesUsed > budget && b.linesUsed <= budget, `spelled ${a.linesUsed}, looped ${b.linesUsed}, budget ${budget}`);
  assert(a.ticks === b.ticks, `the routes must walk the same ticks: ${a.ticks} vs ${b.ticks}`);
  return `${a.linesUsed} > ${budget} >= ${b.linesUsed}, same ${a.ticks} ticks`;
});

check('app: the five endings still exist and are named', () => {
  const cases = [
    ['bump', play('depot', 'depot-1', 'forward 9')],
    ['program ended', play('depot', 'depot-1', 'forward 1')],
    ['out of fuel', play('night-shift', 'night-1', 'forward 4\nturn left\nturn left\nforward 9')],
    ['too many steps', play('depot', 'depot-1', 'repeat 999\n  turn left\nend')],
    ['parse error', play('depot', 'depot-1', 'fly 3')]
  ];
  cases.forEach(([reason, run]) => {
    assert(run.status === 'stuck', `${reason}: expected stuck, got ${run.status}`);
    assert(run.reason === reason, `expected "${reason}", got "${run.reason}"`);
  });
  return cases.map(([reason]) => reason).join(', ');
});

check('app: a parse error names its line', () => {
  const run = play('depot', 'depot-1', 'forward 2\nfly 3');
  assert(run.error.includes('line 2'), `the message must name line 2: ${run.error}`);
  return run.error.slice(0, 60);
});

check('app: a false guard still costs a tick', () => {
  const run = play('depot', 'depot-1', 'if crate ahead: grab');
  assert(run.ticks === 1, `expected one tick, got ${run.ticks}`);
  assert(run.events[0].guard === 'crate ahead' && run.events[0].answer === false, 'the trace must show the question was asked');
  return 'asked once, answered no';
});

// WHY: the editor must offer the pack's words, never a list of its own. A page that keeps its own
//      vocabulary offers a word the next pack refuses and breaks the layering rule.
check('app: completion narrows, keeps the guard, and stops at a finished line', () => {
  const depot = findPack('depot');
  const half = L.suggest(depot, 'for');
  assert(half.from === 0 && half.items.includes('forward'), 'a half word must complete from the start');
  const guard = L.suggest(depot, 'if wall ahead: f');
  assert(guard.from === 'if wall ahead: '.length, `the guard completion must start after the colon, got ${guard.from}`);
  assert(guard.items.includes('forward'), 'the guard must hand the list to the verbs');
  const done = L.suggest(depot, 'forward 2');
  assert(done.items.length === 0, 'a finished instruction must be offered nothing');
  return `half:${half.items.length} guard:${guard.items.length} done:${done.items.length}`;
});

check('app: a pack that does not unlock a word never has it offered', () => {
  const narrow = { id: 'narrow-test', verbs: ['forward'], sensors: [] };
  const list = L.suggest(narrow, '');
  assert(!list.items.some((item) => item.includes('grab')), 'grab was offered by a pack without it');
  assert(!list.items.some((item) => item.startsWith('if ')), 'a sensor was offered by a pack without one');
  return `${list.items.length} words offered`;
});

check('app: every verb candidate parses on its own', () => {
  const depot = findPack('depot');
  const verbs = L.suggest(depot, '').items.filter((item) => !item.endsWith(': ') && item.trim() !== 'repeat' && item.trim() !== 'end');
  assert(verbs.length >= 5, `expected the five verbs, found ${verbs.length}`);
  verbs.forEach((verb) => assert(L.parse(verb).ok, `"${verb}" does not parse`));
  return `${verbs.length} verbs parse`;
});

// WHY: the dialog is only useful if every word a pack can offer has plain words behind it. A new
//      word added to a pack fails here until its description is written.
check('app: every offered word carries a description', () => {
  const seen = new Set();
  shelf().forEach((pack) => {
    W.list(pack).forEach((word) => {
      assert(W.describe(word), `${pack.id}: "${word}" has no description`);
      seen.add(word);
    });
  });
  assert(seen.size === 11, `expected eleven words, found ${seen.size}`);
  return `${seen.size} words described`;
});

// ---------------------------------------------------------------- the shipped page

const PAGE_FILES = [
  'index.html',
  'css/app.css',
  'js/engine.js',
  'js/packs/depot.js',
  'js/packs/night-shift.js',
  'js/theme.js',
  'js/board.js',
  'js/evidence.js',
  'js/words.js',
  'js/sound.js',
  'js/app.js'
];

check('app: every shipped file exists', () => {
  PAGE_FILES.forEach((file) => {
    const full = path.join(v1, file);
    assert(statSync(full).isFile(), `${file} is missing`);
  });
  return `${PAGE_FILES.length} files`;
});

check('app: the page loads the theme first, then the rules, the packs and its own modules', () => {
  const page = read(path.join(v1, 'index.html'));
  const scripts = [...page.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
  const expected = ['js/theme.js', 'js/engine.js', 'js/packs/depot.js', 'js/packs/night-shift.js', 'js/board.js', 'js/evidence.js', 'js/words.js', 'js/sound.js', 'js/app.js'];
  assert(JSON.stringify(scripts) === JSON.stringify(expected), `script order is ${scripts.join(', ')}`);
  // WHY: the ramp has to be on the root before the sheet paints, or the first frame flashes the other theme.
  assert(page.indexOf('src="js/theme.js"') < page.indexOf('href="css/app.css"'), 'the theme script runs after the stylesheet');
  return scripts.join(' -> ');
});

check('app: every element the controller looks up is in the page', () => {
  const page = read(path.join(v1, 'index.html'));
  const app = read(path.join(v1, 'js', 'app.js'));
  const ids = [...new Set([...app.matchAll(/\bid\('([a-z0-9-]+)'\)/g)].map((match) => match[1]))];
  const missing = ids.filter((name) => !page.includes(`id="${name}"`));
  assert(missing.length === 0, `the page has no ${missing.join(', ')}`);
  return `${ids.length} elements found`;
});

check('app: every src and href is relative and lands on a real file', () => {
  const page = read(path.join(v1, 'index.html'));
  const urls = [...page.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  urls.forEach((url) => {
    if (url.startsWith('#') || url.startsWith('data:')) return;
    assert(!url.includes('://'), `${url} leaves this machine`);
    assert(!url.startsWith('/'), `${url} assumes a site root`);
    const clean = url.split('?')[0].split('#')[0];
    if (!clean) return;
    assert(statSync(path.join(v1, clean)).isFile(), `${url} has no file`);
  });
  return `${urls.length} links checked`;
});

// WHY: the app has to open from disk and from a Pages folder that can move. A remote stylesheet or
//      a module import would work in exactly one of those places and fail in the other.
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const v1Files = walk(v1);
const v1Text = v1Files.filter((file) => /\.(html|css|js)$/.test(file));

check('app: nothing loads from another machine', () => {
  v1Text.forEach((file) => {
    // WHY: a data: URI is carried inside the file, but an SVG namespace inside it starts with
    //      http://, which is not a request. Mask those payloads before looking for remote URLs.
    const text = read(file)
      .replace(/(?:href|src)="data:[^"]*"/g, 'data:')
      .replace(/url\((['"]?)data:[^)]*\)/g, 'url(data:)');
    assert(!/https?:\/\//i.test(text), `${path.relative(v1, file)} names a remote URL`);
    assert(!/\bfetch\s*\(/.test(text), `${path.relative(v1, file)} uses fetch`);
    assert(!/\b(import|export)\b/.test(text), `${path.relative(v1, file)} uses a module keyword`);
  });
  return `${v1Text.length} files stay local`;
});

check('app: no drive letter or absolute machine path is written down', () => {
  v1Text.forEach((file) => {
    const text = read(file);
    // WHY: a scheme such as `file://` ends in a letter-colon-slash, but not at a path boundary.
    assert(!/(?:^|[^A-Za-z0-9+.-])[A-Za-z]:[\\/]/.test(text), `${path.relative(v1, file)} has a drive letter`);
    assert(!/\/mnt\/[a-z]\/|\/Users\/|\/home\//i.test(text), `${path.relative(v1, file)} has a machine path`);
  });
  return 'all paths are relative';
});

check('app: the repository root redirects to v1', () => {
  const page = read(path.join(appRoot, 'index.html'));
  assert(/url=\.\/v1\//.test(page), 'the root page does not point at v1/');
  return 'root -> v1/';
});

check('app: only the three documented storage keys are used', () => {
  const found = new Set();
  v1Text.forEach((file) => {
    // WHY: quoted only - `Loopworks.register` and `Loopworks.machine` are API names, not keys.
    for (const match of read(file).matchAll(/['"](loopworks\.[a-z0-9.]+)['"]/gi)) found.add(match[1]);
  });
  const keys = [...found].sort();
  assert(keys.length === 3, `expected three keys, found ${keys.join(', ')}`);
  assert(keys[0] === 'loopworks.app.progress.v1', `unexpected key ${keys[0]}`);
  assert(keys[1] === 'loopworks.app.sound.v1', `unexpected key ${keys[1]}`);
  assert(keys[2] === 'loopworks.app.theme.v1', `unexpected key ${keys[2]}`);
  return keys.join(', ');
});

// WHY: the sound module is a plain script like the engine, so a fake AudioContext proves the cue
//      table and the mute without a speaker. It records each scheduled source instead of making a
//      noise, which keeps the check runnable on a silent machine and in CI.
function fakeSoundHost(storeSeed) {
  const starts = [];
  const writes = [];
  function param() {
    return {
      value: 0,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {}
    };
  }
  function node(extra) {
    return Object.assign({ connect() { return this; } }, extra);
  }
  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 8000;
      this.currentTime = 1;
      this.destination = {};
    }
    createDynamicsCompressor() {
      return node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
    }
    createGain() { return node({ gain: param() }); }
    createBuffer(channels, length) {
      return { getChannelData() { return new Float32Array(length); } };
    }
    createOscillator() {
      return node({
        type: '',
        frequency: param(),
        start() { starts.push('tone'); },
        stop() {}
      });
    }
    createBufferSource() {
      return node({
        buffer: null,
        start() { starts.push('noise'); },
        stop() {}
      });
    }
    createBiquadFilter() { return node({ type: '', frequency: param(), Q: param() }); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  const attrs = new Map();
  const button = new Map();
  const store = new Map(storeSeed || []);
  const host = {
    console,
    document: {
      hidden: false,
      documentElement: { setAttribute(name, value) { attrs.set(name, value); } },
      addEventListener() {},
      querySelector(selector) {
        return selector === '[data-action="toggle-sound"]'
          ? { setAttribute(name, value) { button.set(name, value); } }
          : null;
      }
    },
    AudioContext: FakeAudioContext,
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { writes.push([key, value]); store.set(key, value); }
    }
  };
  host.globalThis = host;
  host.window = host;
  return { host, starts, writes, attrs, button, store };
}

check('app: the sound module plays all eight palette A cues and mute stops them', () => {
  const fake = fakeSoundHost();
  vm.createContext(fake.host);
  runScript(fake.host, path.join(v1, 'js', 'sound.js'));
  const sound = fake.host.LoopworksSound;
  assert(sound, 'sound.js did not define the LoopworksSound global');
  assert(fake.attrs.get('data-sound') === 'on', 'sound must default on');
  assert(fake.button.get('aria-label') === 'Mute sound', 'the button must start saying Mute sound');
  const cues = ['move', 'grab', 'bump', 'code', 'fuel', 'steps', 'ended', 'solved'];
  cues.forEach((name) => {
    const before = fake.starts.length;
    sound.play(name);
    assert(fake.starts.length > before, `the ${name} cue scheduled no source`);
  });
  const total = fake.starts.length;
  sound.toggle();
  assert(fake.attrs.get('data-sound') === 'off', 'muting does not turn the speaker off');
  assert(fake.button.get('aria-label') === 'Turn sound on', 'muting does not name the next action');
  sound.play('move');
  assert(fake.starts.length === total, 'a muted cue still made a sound');
  sound.toggle();
  assert(fake.attrs.get('data-sound') === 'on', 'unmuting does not turn the speaker back on');
  sound.play('solved');
  assert(fake.starts.length > total, 'sound does not come back after unmuting');
  assert(fake.writes.some(([key, value]) => key === 'loopworks.app.sound.v1' && value === 'off'), 'the off choice is not stored');
  return `${cues.length} cues, mute stops and resumes`;
});

check('app: a remembered mute starts silent', () => {
  const fake = fakeSoundHost([['loopworks.app.sound.v1', 'off']]);
  vm.createContext(fake.host);
  runScript(fake.host, path.join(v1, 'js', 'sound.js'));
  assert(fake.attrs.get('data-sound') === 'off', 'the stored mute is not painted at load');
  assert(fake.button.get('aria-label') === 'Turn sound on', 'the stored mute does not name the next action');
  fake.host.LoopworksSound.play('move');
  assert(fake.starts.length === 0, 'a stored mute still made a sound');
  return 'off survives a reload';
});

check('app: the cue table is palette A and the graph is the audition quiet level', () => {
  const sound = read(path.join(v1, 'js', 'sound.js'));
  [
    ['f0: 392', 'the solved chime root'],
    ['f0: 523', 'the solved fifth'],
    ['f0: 1046', 'the solved octave'],
    ['f0: 260, f1: 210', 'the move tick'],
    ['f0: 100, f1: 52', 'the bump body'],
    ['master.gain.value = 0.7', 'the master gain'],
    ['comp.threshold.value = -15', 'the compressor threshold']
  ].forEach(([needle, what]) => assert(sound.includes(needle), `${what} is missing (${needle})`));
  assert(!/\bele[ck]\b|\bchime\b/.test(sound), 'the module still carries a palette he did not choose');
  return 'wood table, 0.7 into -15 dB';
});

check('app: the speaker sits beside the theme and carries the two states', () => {
  const page = read(path.join(v1, 'index.html'));
  const css = read(path.join(v1, 'css', 'app.css'));
  const head = page.slice(page.indexOf('<header'), page.indexOf('</header>'));
  assert(/data-sound="on"/.test(page), 'the root carries no default sound state');
  assert(/data-action="toggle-sound"/.test(head), 'the top bar has no speaker button');
  assert(head.indexOf('data-action="toggle-sound"') > head.indexOf('data-action="toggle-theme"'), 'the speaker does not sit beside the theme');
  assert(head.indexOf('data-action="toggle-sound"') > head.indexOf('</nav>'), 'the speaker sits inside a view-specific group');
  assert(/icon-sound-on/.test(head) && /icon-sound-off/.test(head), 'the speaker has no on and off icon');
  assert(/\[data-sound="on"\] \.icon-sound-on\s*{\s*display:\s*block/.test(css), 'the on icon never paints');
  assert(/\[data-sound="off"\] \.icon-sound-off\s*{\s*display:\s*block/.test(css), 'the crossed icon never paints');
  return 'beside the theme, one icon per state, both views';
});

check('app: the controller ties each cue to the line and the ending', () => {
  const app = read(path.join(v1, 'js', 'app.js'));
  assert(/const LoopworksSound = host\.LoopworksSound/.test(app), 'the controller never reaches the sound module');
  assert(/function tickCue\(event\)[\s\S]*?action === 'grab'[\s\S]*?'grab' : 'move'/.test(app), 'a hand or a line does not choose its cue');
  assert(/function endingCue\(status\)[\s\S]*?'solved'[\s\S]*?'bump'[\s\S]*?'fuel'[\s\S]*?'steps'[\s\S]*?'ended'/.test(app), 'an ending has no cue');
  assert(/cue\(tickCue\(event\)\)/.test(app), 'a tick never plays a cue');
  assert(/cue\(endingCue\(status\)\)/.test(app), 'an ending never plays a cue');
  assert((app.match(/cue\('code'\)/g) || []).length === 2, 'a parse error does not cue on both Run and Step');
  return 'tick, hand, ending, parse error';
});

check('app: sound adds no audio file, element or slider', () => {
  v1Text.forEach((file) => {
    const text = read(file);
    assert(!/<audio\b/i.test(text), `${path.relative(v1, file)} carries an audio element`);
    assert(!/\bnew\s+Audio\s*\(/.test(text), `${path.relative(v1, file)} builds an audio element`);
    assert(!/\.(mp3|wav|ogg|m4a|aac|flac)\b/i.test(text), `${path.relative(v1, file)} names an audio file`);
    assert(!/type="range"/i.test(text), `${path.relative(v1, file)} carries a slider`);
  });
  return 'synthesised only, one fixed level';
});

check('app: the screen never uses rating words', () => {
  const banned = /\b(score|scores|scored|stars?|xp|streak|percent|percentage|leaderboard|badges?)\b/i;
  v1Text.forEach((file) => {
    assert(!banned.test(spoken(file)), `${path.relative(v1, file)} uses a rating word`);
  });
  return 'no rating vocabulary';
});

check('app: the drone is a nav arrow turned by quarter turns only', () => {
  const board = read(path.join(v1, 'js', 'board.js'));
  assert(/M12 2\.2/.test(board), 'the nav-arrow path is missing');
  [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([dir, angle]) => {
    assert(new RegExp(`${dir}:\\s*${angle}\\b`).test(board), `${dir} must turn ${angle} degrees`);
  });
  return '0/90/180/270';
});

check('app: both theme ramps answer every colour word', () => {
  const css = read(path.join(v1, 'css', 'app.css'));
  const dark = themeBlock(css, 'dark');
  const light = themeBlock(css, 'light');
  const darkVars = cssVars(dark);
  const lightVars = cssVars(light);
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)\)/gi)].map((match) => match[1]));
  assert(used.size > 0, 'the sheet uses no colour words');
  used.forEach((name) => {
    assert(darkVars.has(name), `${name} is missing from the dark ramp`);
    assert(lightVars.has(name), `${name} is missing from the light ramp`);
  });
  return `${used.size} words in both ramps`;
});

check('app: every text colour is readable on both surfaces', () => {
  const css = read(path.join(v1, 'css', 'app.css'));
  const pairs = [
    ['--ink', '--bg'], ['--ink', '--panel'], ['--ink', '--panel-2'],
    ['--muted', '--panel'], ['--muted', '--panel-2'],
    ['--amber-ink', '--panel'], ['--green', '--panel'], ['--danger', '--panel']
  ];
  const notes = [];
  ['dark', 'light'].forEach((theme) => {
    const vars = cssVars(themeBlock(css, theme));
    pairs.forEach(([ink, surface]) => {
      const ratio = contrast(vars.get(ink), vars.get(surface));
      assert(ratio >= 4.5, `${theme}: ${ink} on ${surface} is ${ratio.toFixed(2)}:1`);
      notes.push(`${theme}:${ratio.toFixed(1)}`);
    });
  });
  return `lowest ${Math.min(...notes.map((note) => Number(note.split(':')[1]))).toFixed(1)}:1`;
});

check('app: scrollbars are thin and carry no arrow buttons', () => {
  const css = read(path.join(v1, 'css', 'app.css'));
  assert(/scrollbar-width:\s*thin/.test(css), 'scrollbars are not thin');
  assert(/scrollbar-color:/.test(css), 'the scrollbar has no ramp colour');
  assert(/::-webkit-scrollbar-button\s*{\s*display:\s*none/.test(css), 'the arrow buttons are still shown');
  return 'thin, flat, ramp-coloured';
});

check('app: every board role the renderer emits is painted', () => {
  const board = read(path.join(v1, 'js', 'board.js'));
  const css = read(path.join(v1, 'css', 'app.css'));
  const roles = [...board.matchAll(/'(is-[a-z-]+)'/g)].map((match) => match[1]);
  assert(roles.length >= 5, `the renderer names ${roles.length} roles, expected five`);
  const unique = [...new Set(roles)];
  unique.forEach((role) => assert(css.includes(`.${role}`), `${role} has no paint`));
  return unique.join(', ');
});

check('app: the shell carries both views, the program drawer and the compact log', () => {
  const page = read(path.join(v1, 'index.html'));
  const app = read(path.join(v1, 'js', 'app.js'));
  assert(/data-view="work"/.test(page), 'the Work tab is missing');
  assert(/data-view="evidence"/.test(page), 'the Evidence tab is missing');
  assert(/id="splitter"[^>]*role="separator"/.test(page), 'the drawer has no separator');
  assert(/role="separator"[^>]*aria-orientation="horizontal"/.test(page), 'the drawer separator is not horizontal');
  assert(/role="separator"[^>]*tabindex="0"/.test(page), 'the drawer cannot be reached by keyboard');
  assert(/initSplitter/.test(app) && /setPointerCapture/.test(app), 'the drawer does not drag');
  assert(/ArrowUp/.test(app) && /ArrowDown/.test(app), 'the drawer ignores the arrow keys');
  assert(/id="log-list"[^>]*hidden/.test(page), 'the full trace is open at rest');
  assert(/function toggleLog/.test(app), 'the trace toggle has no behaviour');
  assert(/id="next-level"/.test(page), 'the Work view has no next-level control');
  assert(/id="prev-level"/.test(page), 'the Work view has no previous-level control');
  assert(/id="goal-top"/.test(page), 'the top bar carries no goal line');
  assert(/id="goal-status"/.test(page), 'the status bar carries no goal line for narrow screens');
  assert(!/class="rail"/.test(page), 'the sidebar is still in the page');
  assert(/function lineAt/.test(app) && /el\.nextLevel\.hidden = !next/.test(app) && /el\.prevLevel\.hidden = !prev/.test(app), 'the level controls do not walk the level line');
  assert(/Loopworks\.machine/.test(app) && /Loopworks\.suggest/.test(app), 'the controller does not call the engine');
  assert(/Stuck/.test(app) && /Solved/.test(app), 'the verdict words are missing');
  return 'two views, one drawer, a compact log';
});

check('app: the level arrows follow the line in both directions and only show in Work', () => {
  const page = read(path.join(v1, 'index.html'));
  const app = read(path.join(v1, 'js', 'app.js'));
  const head = page.slice(page.indexOf('<header'), page.indexOf('</header>'));
  const controls = page.slice(page.indexOf('class="controls"'), page.indexOf('</section>', page.indexOf('class="controls"')));
  assert(/id="next-level"/.test(controls), 'the next arrow left the run controls');
  assert(/id="prev-level"/.test(controls), 'the previous arrow is not beside the next one');
  assert(/class="level-pair"/.test(controls), 'the two level arrows do not sit together');
  assert(!/id="next-level"|id="prev-level"/.test(head), 'a level arrow is still in the top bar');
  assert(/const onWork = view === 'work'/.test(app) && /onWork \? lineAt\(-1\) : null/.test(app) && /onWork \? lineAt\(1\) : null/.test(app), 'the arrows ignore the current view');
  const show = app.slice(app.indexOf('function showView'), app.indexOf('function pick'));
  assert(/updateLevelNav\(\);/.test(show), 'switching views does not refresh the arrows');
  return 'Work only, both directions, paired beside Run';
});

check('app: the run control is a bigger icon on the right', () => {
  const page = read(path.join(v1, 'index.html'));
  const css = read(path.join(v1, 'css', 'app.css'));
  const app = read(path.join(v1, 'js', 'app.js'));
  const controls = page.slice(page.indexOf('class="controls"'), page.indexOf('</section>', page.indexOf('class="controls"')));
  assert(controls.indexOf('class="controls-left"') >= 0 && controls.indexOf('class="controls-right"') >= 0, 'the controls are not split into two sides');
  assert(controls.indexOf('class="controls-left"') < controls.indexOf('class="controls-right"'), 'the run side is not on the right');
  assert(/id="run"[\s\S]*class="sr-only" id="run-label"/.test(controls), 'the run control still shows a word');
  assert(/\.controls \.primary\s*{[^}]*width:\s*52px/.test(css), 'the run button still stretches');
  assert(/\.controls \.primary\s*{[^}]*min-height:\s*40px/.test(css), 'the run button is not the bigger one');
  assert(/\.controls \.icon-only\s*{[^}]*width:\s*44px/.test(css), 'the quiet controls changed size');
  assert(/rotate\(-45 12 12\)/.test(app), 'the play glyph is not tilted up');
  assert(/\.level-pair\s*{\s*display:\s*flex/.test(css), 'the level arrows are not one pair');
  return 'a larger icon on the right, level arrows beside it';
});

check('app: the first load carries no favicon round trip', () => {
  const page = read(path.join(v1, 'index.html'));
  assert(/<link rel="icon" href="data:image\/svg\+xml,/.test(page), 'the browser will still ask for /favicon.ico');
  return 'inline icon, no extra request';
});

check('app: a phone can type without zooming the page', () => {
  const css = read(path.join(v1, 'css', 'app.css'));
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  assert(/#code,\s*\.gutter\s*{[^}]*font-size:\s*16px/.test(narrow), 'the editor is under 16px on a phone');
  assert(/#code,\s*\.gutter\s*{[^}]*line-height:\s*24px/.test(narrow), 'the gutter and the code have different line heights');
  return '16px code and gutter on phones';
});

check('app: the words live in a dialog opened from the top bar', () => {
  const page = read(path.join(v1, 'index.html'));
  const app = read(path.join(v1, 'js', 'app.js'));
  const words = read(path.join(v1, 'js', 'words.js'));
  assert(/<dialog[^>]*id="words-modal"/.test(page), 'the words have no dialog');
  assert(/id="words-open"/.test(page), 'the top bar has no words button');
  assert(/id="words-close"/.test(page), 'the dialog has no close button');
  assert(/showModal\(\)/.test(app), 'the dialog never opens');
  assert(/Loopworks\.suggest\(pack, ''\)/.test(words), 'the dialog keeps a word list of its own');
  return 'a dialog, opened from the top bar';
});

check('app: the budget, the charge and the words sit in the top bar', () => {
  const page = read(path.join(v1, 'index.html'));
  const head = page.slice(page.indexOf('<header'), page.indexOf('</header>'));
  assert(/id="budget-fact"/.test(head), 'the line budget left the top bar');
  assert(/id="fuel-fact"/.test(head), 'the charge left the top bar');
  assert(/id="words-open"/.test(head), 'the words button left the top bar');
  const css = read(path.join(v1, 'css', 'app.css'));
  assert(/body\.is-evidence \.tools\s*{\s*display:\s*none/.test(css), 'Evidence still shows the Work tools');
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  assert(!/\.tools\s*{\s*display:\s*none/.test(narrow), 'the narrow bar hides the budget and the charge');
  return 'budget, charge, words in one group';
});

check('app: the narrow bar keeps the title and the goal moves to the status bar', () => {
  const page = read(path.join(v1, 'index.html'));
  const app = read(path.join(v1, 'js', 'app.js'));
  const css = read(path.join(v1, 'css', 'app.css'));
  const head = page.slice(page.indexOf('<header'), page.indexOf('</header>'));
  assert(/id="where-level"/.test(head) && /id="goal-top"/.test(head), 'the top bar lost the level or the goal');
  assert(!/id="level-title"|id="pack-name"|id="goal-line"/.test(page), 'the level is still named twice');
  assert(!/max-width:\s*1150px/.test(css), 'the goal leaves the bar before it runs out of room');
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  const drops = (selector) => {
    const at = narrow.indexOf(selector);
    assert(at >= 0, `the narrow bar does not mention ${selector}`);
    assert(/display:\s*none/.test(narrow.slice(at, narrow.indexOf('}', at))), `${selector} is still shown on the narrow bar`);
  };
  ['.where', '.goal-top', '.tab span', '.statusbar .status-note'].forEach(drops);
  assert(!/\.brand-name[^{]*{[^}]*display:\s*none/.test(narrow), 'the game title still disappears on a phone');
  assert(/\.brand-name\s*{[^}]*text-overflow:\s*ellipsis/.test(css), 'the title has no ellipsis');
  assert(/\.goal-status\s*{\s*display:\s*none/.test(css), 'the status goal is shown beside the header goal');
  const statusAt = narrow.indexOf('.goal-status');
  assert(statusAt >= 0, 'the narrow status bar has no goal');
  const statusRule = narrow.slice(statusAt, narrow.indexOf('}', statusAt));
  assert(/display:\s*block/.test(statusRule), 'the status goal is still hidden on a phone');
  assert(/text-overflow:\s*ellipsis/.test(statusRule), 'the status goal cannot truncate');
  assert(/el\.whereLevel\.textContent = level\.title/.test(app), 'the top bar level is never written');
  assert(/el\.goalTop\.textContent = level\.goalSentence/.test(app), 'the top bar goal is never written');
  assert(/el\.goalStatus\.textContent = level\.goalSentence/.test(app), 'the status bar goal is never written');
  return 'title stays, goal moves to the status bar, both truncate';
});

check('app: only the board is sized, so the verdict keeps its width', () => {
  const app = read(path.join(v1, 'js', 'app.js'));
  const css = read(path.join(v1, 'css', 'app.css'));
  assert(/el\.board\.style\.width/.test(app), 'the board does not take the fitted width');
  assert(!/el\.stage\.style\.width/.test(app), 'the stage still shrinks with the board and squeezes the verdict');
  assert(/\.board\s*{[^}]*margin-inline:\s*auto/.test(css), 'the board is not centred in the wider stage');
  return 'text rows stay wide, board stays square';
});

check('app: the editor follows the last line and moves the indent with the block', () => {
  const app = read(path.join(v1, 'js', 'app.js'));
  assert(/function snapToLastLine/.test(app), 'the editor never snaps to the last line');
  assert(/indexOf\('\\n', el\.code\.selectionStart\)/.test(app), 'the snap agrees to yank an earlier line');
  assert(/if \(snapGuard\)/.test(app), 'the snap dismisses the completion list it just positioned');
  assert(/\/\^repeat \\d\+\$\/\.test\(line\.text\.trim\(\)\)/.test(app), 'a repeat line does not open its body');
  assert(/opens \? '  ' : ''/.test(app), 'Enter does not add the repeat body indent');
  assert(/function repeatIndent/.test(app) && /line\.text\.trim\(\) !== 'end'/.test(app), 'end does not snap back');
  assert(/event\.shiftKey[\s\S]*?outdentLine\(\)/.test(app), 'Shift+Tab has no outdent');
  assert(/insertText\('  '\)/.test(app), 'Tab does not insert the two spaces');
  assert(/\\s\$\/\.test\(item\) \? item : `\$\{item\} `/.test(app), 'an accepted verb gets no space after it');
  assert(/const flip = height > below/.test(app), 'the completion list only opens downward');
  assert(/execCommand\('insertText'/.test(app), 'typing help does not join the undo history');
  return 'snap, repeat indent, end dedent, Tab/Shift+Tab, flip, undo';
});

check('app: Evidence prints a cost against a budget', () => {
  const evidence = read(path.join(v1, 'js', 'evidence.js'));
  assert(/budget/.test(evidence) && /lines/.test(evidence), 'Evidence does not name lines and budget');
  assert(/progress/.test(evidence), 'Evidence does not read the progress record');
  return 'lines/budget';
});

// WHY: reading only the theme block keeps a stray root variable from hiding a missing ramp value.
function themeBlock(css, theme) {
  const marker = `[data-theme="${theme}"]`;
  const start = css.indexOf(marker);
  assert(start >= 0, `the ${theme} ramp is missing`);
  const open = css.indexOf('{', start);
  assert(open >= 0, `the ${theme} ramp has no body`);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`the ${theme} ramp never closes`);
}
function cssVars(block) {
  const vars = new Map();
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) vars.set(match[1], match[2].trim());
  return vars;
}
function hexRgb(value) {
  const text = String(value || '').trim();
  const short = /^#([0-9a-f]{3})$/i.exec(text);
  const long = /^#([0-9a-f]{6})$/i.exec(text);
  const hex = short ? short[1].split('').map((ch) => ch + ch).join('') : long ? long[1] : null;
  assert(hex, `"${text}" is not a hex colour`);
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
}
function contrast(a, b) {
  const la = luminance(hexRgb(a));
  const lb = luminance(hexRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WHY: a failure has to say which promise broke, so the report names the check and the reason.
const failed = results.filter((result) => !result.ok);
results.forEach((result) => {
  const mark = result.ok ? 'ok  ' : 'FAIL';
  process.stdout.write(`${mark}  ${result.name}${result.detail ? ` - ${result.detail}` : ''}\n`);
});
process.stdout.write(`\n${results.length - failed.length}/${results.length} checks passed\n`);
if (failed.length > 0) process.exit(1);
