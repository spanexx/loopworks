// WHY: the acceptance evidence for App v1. It proves three things without a browser: the app is
//      still using the tested rules unchanged, the two packs still solve, and the page carries no
//      external asset, absolute path, stray storage key or unreadable colour. Exits non-zero when
//      any check fails, so it can be the only gate the app repository needs.
// PACK: loopworks-app
// 2026-11-04 qoder-agent: written before the page existed, so the promises in
//                          PRD-TRD-loopworks-app.md are the specification, not a description.
// 2026-11-04 qoder-agent: six typing and phone-layout checks, written against PRD-TRD section 28
//                          and GRILL entry 32 before the sheet and the controller changed.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const v1 = path.join(appRoot, 'v1');
const source = path.resolve(appRoot, '..', 'wireframe', 'loopworks');

const results = [];
const pending = [];
// WHY: a check can only run where its inputs live. Returning `{ skip: reason }` records a check that
//      had nothing to compare against, so a standalone clone reports it honestly instead of failing
//      the gate that protects every other promise.
function check(name, fn) {
  try {
    const detail = fn();
    if (detail && typeof detail.then === 'function') {
      const slot = { name, ok: false, detail: 'never settled' };
      results.push(slot);
      pending.push(detail.then(
        (value) => {
          if (value && typeof value === 'object') { slot.skipped = true; slot.detail = value.skip; }
          else { slot.ok = true; slot.detail = value || ''; }
        },
        (err) => { slot.ok = false; slot.detail = err.message; }
      ));
    } else if (detail && typeof detail === 'object') {
      results.push({ name, ok: true, skipped: true, detail: detail.skip });
    } else {
      results.push({ name, ok: true, detail: detail || '' });
    }
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
// WHY: every script the app ships, found on disk instead of named in this file. Naming them made a new
//      module an edit to the harness, which is the bookkeeping the authoring pack removed.
function jsUnder(dir, base) {
  return readdirSync(dir).sort().flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return jsUnder(full, `${base}${name}/`);
    return name.endsWith('.js') ? [`${base}${name}`] : [];
  });
}
const shippedScripts = jsUnder(path.join(v1, 'js'), 'js/');
const shippedPacks = shippedScripts
  .filter((from) => from.startsWith('js/packs/'))
  .map((from) => from.split('/').pop());
shippedPacks.forEach((name) => runScript(ctx, path.join(v1, 'js', 'packs', name)));
runScript(ctx, path.join(v1, 'js', 'words.js'));
const L = ctx.Loopworks;
assert(L, 'the app engine did not define the Loopworks global');
const W = ctx.LoopworksWords;
assert(W, 'the words module did not define the LoopworksWords global');

// WHY: the answer key lives in this tools folder as a copy of the authored one, so a bare clone of the
//      app repository still runs its own checks. A missing copy reads as an empty table on purpose: the
//      checks below then fail by level name instead of the harness dying on a file error.
const answersPath = path.join(appRoot, 'tools', 'solutions.js');
function readSolutions() {
  if (!existsSync(answersPath)) return {};
  const answers = freshContext();
  runScript(answers, answersPath);
  assert(answers.LoopworksSolutions, `${path.relative(appRoot, answersPath)} did not define LoopworksSolutions`);
  return answers.LoopworksSolutions;
}
const SOLUTIONS = readSolutions();

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
//      rules pretending to be the first, which is exactly what the layering rule forbids. The list of
//      files to compare comes from the prototype folder, so a pack that was never copied is red here
//      rather than simply absent from the shelf.
check('app: the engine, the checker, every pack and the answer key are byte-for-byte copies', () => {
  if (!existsSync(source)) {
    return { skip: `the game workspace with ${path.relative(appRoot, source)} is not here` };
  }
  const originals = readdirSync(path.join(source, 'packs'))
    .filter((name) => name.endsWith('.js'))
    .sort();
  const copies = shippedPacks;
  const neverCopied = originals.filter((name) => !copies.includes(name));
  const noOriginal = copies.filter((name) => !originals.includes(name));
  assert(neverCopied.length === 0, `${path.relative(appRoot, source)} has packs the app does not ship: ${neverCopied.join(', ')} - run npm run sync`);
  assert(noOriginal.length === 0, `the app ships packs with no original in the prototype tree: ${noOriginal.join(', ')}`);
  const pairs = [
    [path.join(v1, 'js', 'engine.js'), path.join(source, 'engine.js')],
    [path.join(v1, 'js', 'prover.js'), path.join(source, 'prover.js')],
    [answersPath, path.join(source, 'solutions.js')],
    ...originals.map((name) => [path.join(v1, 'js', 'packs', name), path.join(source, 'packs', name)])
  ];
  pairs.forEach(([local, original]) => {
    assert(existsSync(local), `${path.relative(appRoot, local)} is missing - run npm run sync from the game root`);
    assert(readFileSync(local).equals(readFileSync(original)), `${path.relative(appRoot, local)} no longer matches ${path.relative(appRoot, original)}`);
  });
  return `${pairs.length} copies match`;
});

// WHY: the rules a level count used to stand in for. A count only proved nobody had edited the data;
//      these hold whatever the shelf grows into, and they are the same three rules the prototype
//      harness applies, so neither copy of the app can drift from the other's promise.
check('app: every pack on the shelf validates, holds a level, and matches the files that ship', () => {
  const entries = L.packs();
  assert(entries.length > 0, 'the shelf holds no packs at all');
  assert(entries.length === shippedPacks.length, `the shelf holds ${entries.length} packs but ${shippedPacks.length} pack files ship`);
  entries.forEach((entry) => {
    assert(entry.errors.length === 0, `${entry.pack.id} rejected: ${entry.errors.join('; ')}`);
    assert(entry.pack.levels.length > 0, `${entry.pack.id} holds no levels at all`);
  });
  const ids = [];
  entries.forEach((entry) => entry.pack.levels.forEach((level) => ids.push(level.id)));
  const repeats = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  assert(repeats.length === 0, `a level id appears in two packs: ${repeats.join(', ')}`);
  const orphans = Object.keys(SOLUTIONS).filter((id) => !ids.includes(id));
  assert(orphans.length === 0, `tools/solutions.js answers levels that are not on the shelf: ${orphans.join(', ')}`);
  return entries.map((entry) => `${entry.pack.id}:${entry.pack.levels.length}`).join(' ');
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

// WHY: the checker is a second file the engine's rules flow through, so the same rule reaches it - and the
//      words are taken from the shelf this app actually ships, so a third pack that names its own subject
//      in the checker is caught without anyone editing a list here. "sentence" is the app's own word for
//      what a Goal reads as, so it is asked for as a subject phrase, not as a bare word.
check('app: the checker names no subject either', () => {
  const subject = new Set(['market', 'warehouse', 'sentence pack']);
  shelf().forEach((pack) => {
    `${pack.id} ${pack.name}`.toLowerCase().split(/[^a-z0-9]+/).forEach((word) => {
      if (word.length > 4) subject.add(word);
    });
  });
  const text = read(path.join(v1, 'js', 'prover.js')).toLowerCase();
  const named = [...subject].filter((word) => text.includes(word)).sort();
  assert(named.length === 0, `js/prover.js names ${named.join(', ')}`);
  assert(/loopworks-level-proving/.test(text), 'js/prover.js carries no PACK line, so its copy has no origin');
  return `${subject.size} subject words from ${shelf().length} packs, none in the checker`;
});

// WHY: the published solutions come from tools/solutions.js, read once at the top of this file. They
//      used to be typed in here as a second copy of the prototype's table, and a table kept twice is a
//      promise that can be broken in one place and still look true in the other.
check('app: every published solution solves inside its budget', () => {
  const rows = [];
  for (const pack of shelf()) {
    for (const level of pack.levels) {
      const program = SOLUTIONS[level.id];
      assert(program, `${level.id} has no published solution in tools/solutions.js`);
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
  assert(verbs.length >= 6, `expected the six verbs, found ${verbs.length}`);
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
  assert(seen.size === 12, `expected twelve words, found ${seen.size}`);
  return `${seen.size} words described`;
});

// ---------------------------------------------------------------- the shipped page

// WHY: the app's own page files. The scripts come off disk, so a module added to the folder is on this
//      list without anyone editing the harness, and forgetting its file is red instead of invisible.
const PAGE_FILES = ['index.html', 'css/app.css', ...shippedScripts];

check('app: every shipped file exists', () => {
  PAGE_FILES.forEach((file) => {
    const full = path.join(v1, file);
    assert(statSync(full).isFile(), `${file} is missing`);
  });
  return `${PAGE_FILES.length} files`;
});

// WHY: file:// cannot list a folder, so the page has to name what it loads (GRILL decision 6). That
//      makes one script tag per file the only bookkeeping left, and this check is what turns forgetting
//      it red instead of shipping a shelf that quietly holds one level fewer. The order of the app's own
//      modules cannot be read off disk, so that one list stays named.
check('app: the page loads the theme first, then the rules, every pack on disk, then its own modules', () => {
  const page = read(path.join(v1, 'index.html'));
  const scripts = [...page.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
  const isPack = (src) => /^js\/packs\/[a-z0-9-]+\.js$/.test(src);
  const own = scripts.filter((src) => !isPack(src));
  const expected = ['js/theme.js', 'js/engine.js', 'js/prover.js', 'js/board.js', 'js/evidence.js', 'js/words.js', 'js/studio.js', 'js/studio-view.js', 'js/sound.js', 'js/level-prompt.js', 'js/user-packs.js', 'js/app.js', 'js/pwa.js'];
  assert(JSON.stringify(own) === JSON.stringify(expected), `the app's own scripts are ${own.join(', ')}`);

  const untagged = shippedScripts.filter((from) => !scripts.includes(from));
  const phantom = scripts.filter((src) => !shippedScripts.includes(src));
  assert(untagged.length === 0, `nothing loads ${untagged.join(', ')} - a script file needs one <script> tag in index.html`);
  assert(phantom.length === 0, `the page loads scripts that are not on disk: ${phantom.join(', ')}`);

  const packsAt = scripts.reduce((list, src, i) => (isPack(src) ? [...list, i] : list), []);
  assert(scripts[0] === 'js/theme.js', `the theme has to load first, found ${scripts[0]}`);
  assert(scripts[1] === 'js/engine.js', `the engine has to load second, found ${scripts[1]}`);
  assert(Math.min(...packsAt) > 1, 'a pack loads before the engine it registers with');
  assert(Math.max(...packsAt) < scripts.indexOf('js/board.js'), 'the packs must all load before the app reads the shelf');
  assert(scripts.indexOf('js/user-packs.js') < scripts.indexOf('js/app.js'), 'an added pack has to be registered before the controller reads the shelf');

  // WHY: the ramp has to be on the root before the sheet paints, or the first frame flashes the other theme.
  assert(page.indexOf('src="js/theme.js"') < page.indexOf('href="css/app.css'), 'the theme script runs after the stylesheet');
  return scripts.join(' -> ');
});

// WHY: derived from every module the page loads, not just the controller, so a lookup written in a new
//      file is caught by the same rule. A missing element is a silent no-op in the browser.
check('app: every element the modules look up is in the page', () => {
  const page = read(path.join(v1, 'index.html'));
  const ids = [...new Set(shippedScripts.flatMap((from) => {
    const src = read(path.join(v1, from));
    return [...src.matchAll(/\bid\('([a-z0-9-]+)'\)/g)].map((match) => match[1]);
  }))];
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

// ---------------------------------------------------------------- installable

// WHY: installable is a promise the browser checks, not one a README can make - a manifest that starts
//      the app in its own folder, icon files that really are PNGs of the size they declare, and a worker
//      that answers when the network cannot. Each part is read or run here, so a missing one is red
//      before a phone finds out.
const manifestPath = path.join(v1, 'manifest.webmanifest');
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(file) {
  const bytes = readFileSync(file);
  assert(bytes.subarray(0, 8).equals(pngSignature), `${path.relative(v1, file)} is not a PNG`);
  assert(bytes.toString('ascii', 12, 16) === 'IHDR', `${path.relative(v1, file)} has no IHDR header`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length };
}

check('app: the manifest starts the app where it sits and carries both icon sizes', () => {
  const manifest = JSON.parse(read(manifestPath));
  assert(manifest.name === 'Loopworks', `the manifest names "${manifest.name}"`);
  assert(typeof manifest.short_name === 'string' && manifest.short_name.length > 0 && manifest.short_name.length <= 12,
    `short_name "${manifest.short_name}" does not fit a launcher label`);
  ['id', 'start_url', 'scope'].forEach((field) => {
    assert(manifest[field] === './', `${field} is "${manifest[field]}" - the app has to start in its own folder, never at a host root`);
  });
  assert(manifest.display === 'standalone', `display is "${manifest.display}", so an installed app would keep browser chrome`);
  assert(/^#[0-9a-f]{6}$/i.test(manifest.background_color || ''), 'background_color is not a hex colour');
  assert(/^#[0-9a-f]{6}$/i.test(manifest.theme_color || ''), 'theme_color is not a hex colour');
  assert(manifest.background_color.toLowerCase() === manifest.theme_color.toLowerCase(),
    'the launch background and the theme strip disagree, so the first frame would flash');

  const icons = manifest.icons || [];
  ['192x192', '512x512'].forEach((size) => {
    assert(icons.some((icon) => icon.sizes === size && icon.type === 'image/png' && icon.purpose === 'any'),
      `no ${size} PNG icon is declared for the launcher`);
  });
  assert(icons.some((icon) => icon.purpose === 'maskable'), 'no maskable icon is declared');
  icons.forEach((icon) => {
    assert(!icon.src.includes('://') && !icon.src.startsWith('/'), `${icon.src} leaves the app folder`);
    const file = path.join(v1, icon.src);
    assert(statSync(file).isFile(), `${icon.src} has no file`);
    const [width, height] = icon.sizes.split('x').map(Number);
    const actual = pngSize(file);
    assert(actual.width === width && actual.height === height,
      `${icon.src} is ${actual.width}x${actual.height} but is declared ${icon.sizes}`);
    assert(actual.bytes > 200, `${icon.src} is ${actual.bytes} bytes, too small to be a drawn icon`);
  });
  return `${icons.length} icons, ${manifest.display}, starts at ${manifest.start_url}`;
});

check('app: the page names the manifest, both theme ramps and the touch icon', () => {
  const page = read(path.join(v1, 'index.html'));
  assert(/<link rel="manifest" href="manifest\.webmanifest">/.test(page), 'the page does not link the manifest');
  assert(/<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/.test(page), 'the page has no apple touch icon');
  const themes = [...page.matchAll(/<meta name="theme-color" content="([^"]+)"/g)].map((match) => match[1]);
  assert(themes.length === 2, `the page carries ${themes.length} theme colours, expected one per ramp`);
  assert(/<meta name="apple-mobile-web-app-title" content="Loopworks">/.test(page), 'the home-screen label is not set');
  const touch = path.join(v1, 'icons', 'apple-touch-icon.png');
  const size = pngSize(touch);
  assert(size.width === 180 && size.height === 180, `the touch icon is ${size.width}x${size.height}, expected 180x180`);
  return `${themes.length} theme colours, ${path.basename(touch)} at ${size.width}px`;
});

// WHY: the worker is loaded into a vm holding only the globals it touches, so these checks run the real
//      handlers instead of reading their source. A worker that only looks right is the failure this pack
//      exists to prevent.
function workerHost() {
  const listeners = {};
  const stores = new Map();
  const calls = { skipped: 0, claimed: 0, deleted: [], fetched: [], puts: [] };
  let offline = false;
  const reply = (body, ok = true) => ({ ok, body, clone() { return reply(body, ok); } });
  // WHY: Cache.match resolves a relative string against the worker's own URL, so the fake does too;
  //      that is what makes the worker's "./index.html" fallback reachable in the test at all.
  const keyOf = (request) => (typeof request === 'string'
    ? new URL(request, 'https://example.test/v1/sw.js').href
    : request.url);
  function store(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }
  const caches = {
    async open(name) {
      const shelf = store(name);
      return {
        async put(request, response) { calls.puts.push(keyOf(request)); shelf.set(keyOf(request), response); },
        async match(request) { return shelf.get(keyOf(request)) || null; }
      };
    },
    async match(request) {
      for (const shelf of stores.values()) {
        const hit = shelf.get(keyOf(request));
        if (hit) return hit;
      }
      return null;
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { calls.deleted.push(name); return stores.delete(name); }
  };
  const ctx = {
    console,
    URL,
    Promise,
    caches,
    fetch: async (request) => {
      calls.fetched.push(keyOf(request));
      if (offline) throw new Error('the network is gone');
      return reply(`network:${keyOf(request)}`);
    },
    Response: { error: () => reply('', false) }
  };
  ctx.location = { origin: 'https://example.test' };
  ctx.self = {
    location: ctx.location,
    addEventListener(type, fn) { listeners[type] = fn; },
    async skipWaiting() { calls.skipped += 1; },
    clients: { async claim() { calls.claimed += 1; } }
  };
  vm.createContext(ctx);
  runScript(ctx, path.join(v1, 'sw.js'));
  const settle = () => new Promise((done) => setTimeout(done, 0));
  async function signal(type) {
    const waiting = [];
    listeners[type]({ waitUntil(promise) { waiting.push(promise); } });
    await Promise.all(waiting);
    await settle();
  }
  async function ask(request) {
    let answered = null;
    listeners.fetch({ request, respondWith(promise) { answered = promise; } });
    return answered === null ? null : await answered;
  }
  return { calls, stores, signal, ask, settle, goOffline: () => { offline = true; } };
}

check('app: the worker installs, takes over, and serves the app when the network is gone', async () => {
  const worker = workerHost();
  await worker.signal('install');
  assert(worker.calls.skipped === 1, 'install did not take over from the page that is already open');

  worker.stores.set('an-old-scheme', new Map([['https://example.test/v1/old.js', 'old']]));
  await worker.signal('activate');
  assert(worker.calls.deleted.includes('an-old-scheme'), 'activate kept a cache from an older scheme');
  assert(!worker.calls.deleted.includes('loopworks-v1-r2'), 'activate deleted the cache it is meant to keep');
  assert(worker.calls.claimed === 1, 'activate did not claim the open page');

  const page = { method: 'GET', mode: 'navigate', url: 'https://example.test/v1/index.html' };
  const live = await worker.ask(page);
  assert(live && live.body === `network:${page.url}`, 'a page on a live network did not come from the network');
  await worker.settle();
  assert(worker.calls.puts.includes(page.url), 'the page that loaded online was not kept for the next visit');

  const assetUrl = 'https://example.test/v1/js/app.js';
  const cold = await worker.ask({ method: 'GET', mode: 'cors', url: assetUrl });
  assert(cold && cold.body === `network:${assetUrl}`, 'an asset seen for the first time did not come from the network');
  await worker.settle();

  // WHY: a returning browser must not pin an old sheet under a fresh page. While the worker answered an
  //      asset from the shelf first, the first open after a deploy could paint the new markup with the
  //      previous stylesheet and break the layout (docs/drift.md D-20). The live network has to win;
  //      the shelf is only the answer when the network is gone, which the offline checks below prove.
  const staleUrl = 'https://example.test/v1/css/app.css?v=old-deploy';
  const staleResponse = { ok: true, body: 'cached:old-sheet', clone() { return staleResponse; } };
  worker.stores.get('loopworks-v1-r2').set(staleUrl, staleResponse);
  const fresh = await worker.ask({ method: 'GET', mode: 'cors', url: staleUrl });
  assert(fresh && fresh.body === `network:${staleUrl}`,
    'a cached asset outranked the network, so a new page could be painted with an old sheet');
  await worker.settle();

  worker.goOffline();
  const offlinePage = await worker.ask(page);
  assert(offlinePage && offlinePage.body === `network:${page.url}`, 'an offline page did not come back from the cache');
  const fallback = await worker.ask({ method: 'GET', mode: 'navigate', url: 'https://example.test/v1/' });
  assert(fallback && fallback.body === `network:${page.url}`, 'an offline page with no exact entry did not fall back to index.html');
  const warm = await worker.ask({ method: 'GET', mode: 'cors', url: assetUrl });
  assert(warm && warm.body === `network:${assetUrl}`, 'an offline asset did not come back from the cache');
  const never = await worker.ask({ method: 'GET', mode: 'cors', url: 'https://example.test/v1/js/never-seen.js' });
  assert(never && never.ok === false, 'an offline asset that was never kept did not answer with a plain error');

  const away = await worker.ask({ method: 'GET', mode: 'cors', url: 'https://cdn.example.net/library.js' });
  assert(away === null, 'the worker answered for another machine');
  const post = await worker.ask({ method: 'POST', mode: 'cors', url: 'https://example.test/v1/import' });
  assert(post === null, 'the worker answered a request that is not a read');
  return 'install, activate, page first, asset first, offline page, offline asset, pass-through';
});

// WHY: the one-time bridge out of the first worker. A browser that has not yet taken the new worker
//      still holds the old sheet under the unversioned URL, and the first deploy after D-20 has to
//      reach it on the next open without asking the learner to hard-refresh. New deploys do not bump
//      this; the worker is network-first now, so the cache is only the offline answer.
check('app: the sheet carries a version the old cache-first worker never saw', () => {
  const page = read(path.join(v1, 'index.html'));
  assert(/href="css\/app\.css\?v=[0-9][0-9-]*"/.test(page),
    'the stylesheet URL is unversioned, so the old cache-first worker can answer it with the previous deploy');
  return 'the sheet URL carries the one-time cache-buster';
});

check('app: the page registers the worker on http, and stays quiet on disk', () => {
  function started(env) {
    const calls = [];
    const ctx = { console };
    ctx.globalThis = ctx;
    ctx.window = ctx;
    if (env.navigator) ctx.navigator = env.navigator(calls);
    if (env.location) ctx.location = env.location;
    vm.createContext(ctx);
    runScript(ctx, path.join(v1, 'js', 'pwa.js'));
    return calls;
  }
  const worker = (calls) => ({ serviceWorker: { register: (url) => { calls.push(url); return Promise.resolve(); } } });
  assert(started({ navigator: worker, location: { protocol: 'https:' } }).join() === 'sw.js', 'https did not register sw.js');
  assert(started({ navigator: worker, location: { protocol: 'http:' } }).join() === 'sw.js', 'a local http page did not register sw.js');
  assert(started({ navigator: worker, location: { protocol: 'file:' } }).length === 0, 'a page opened from disk tried to register a worker');
  assert(started({ navigator: () => ({}), location: { protocol: 'https:' } }).length === 0, 'a browser without workers was not left alone');
  assert(statSync(path.join(v1, 'sw.js')).isFile(), 'the page registers a file that is not there');
  return 'https and http register once, file:// and no-worker stay quiet';
});

check('app: the worker names no subject and carries its pack line', () => {
  const text = read(path.join(v1, 'sw.js')).toLowerCase();
  const names = new Set();
  shelf().forEach((pack) => {
    [pack.id, pack.name].forEach((value) => { if (value) names.add(String(value).toLowerCase()); });
  });
  const named = [...names].filter((word) => text.includes(word));
  assert(named.length === 0, `v1/sw.js names ${named.join(', ')}`);
  assert(/loopworks-installable/.test(text), 'v1/sw.js carries no PACK line, so its copy has no origin');
  return `${names.size} subject words from ${shelf().length} packs, none in the worker`;
});

// WHY: the publish job copies a named list into the deploy branch, so a file added to the app but not to
//      that list sits on the commit and is missing from the site. This check expands the job's own copy
//      rules and asks them about every file the page and the manifest name.
check('app: every file the page and the manifest name reaches the deploy branch', () => {
  const workflow = read(path.join(appRoot, '.github', 'workflows', 'deploy.yml'));
  const rules = [...workflow.matchAll(/^\s*cp\s+(\S+)\s+"\$site\/([^"]*)"/gm)]
    .map((match) => ({ from: match[1], to: match[2] }));
  assert(rules.length >= 6, `the publish step has ${rules.length} copy rules to read`);

  function reaches(file) {
    return rules.some((rule) => {
      if (rule.to === file) return true;
      if (!rule.from.includes('*')) return rule.to.endsWith('/') && `${rule.to}${path.posix.basename(rule.from)}` === file;
      const shape = new RegExp(`^${rule.from.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
      return shape.test(file);
    });
  }

  const manifest = JSON.parse(read(manifestPath));
  const page = read(path.join(v1, 'index.html'));
  const links = [...page.matchAll(/\b(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => !url.startsWith('#') && !url.startsWith('data:'))
    .map((url) => `v1/${url.split('?')[0].split('#')[0]}`);
  const required = [...new Set([
    'v1/index.html',
    'v1/manifest.webmanifest',
    'v1/sw.js',
    ...links,
    ...manifest.icons.map((icon) => `v1/${icon.src}`)
  ])];
  const missing = required.filter((file) => !reaches(file));
  assert(missing.length === 0, `the deploy branch would miss ${missing.join(', ')}`);
  return `${rules.length} copy rules cover ${required.length} files`;
});

// WHY: the app has to open from disk and from a Pages folder that can move. A remote stylesheet or
//      a module import would work in exactly one of those places and fail in the other. The worker is
//      the one file allowed to call fetch, and its own check proves every call stays on this origin.
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const v1Files = walk(v1);
const v1Text = v1Files.filter((file) => /\.(html|css|js)$/.test(file));
const pageText = v1Text.filter((file) => file !== path.join(v1, 'sw.js'));

check('app: nothing loads from another machine', () => {
  pageText.forEach((file) => {
    // WHY: a data: URI is carried inside the file, but an SVG namespace inside it starts with
    //      http://, which is not a request. Mask those payloads before looking for remote URLs.
    const text = read(file)
      .replace(/(?:href|src)="data:[^"]*"/g, 'data:')
      .replace(/url\((['"]?)data:[^)]*\)/g, 'url(data:)');
    assert(!/https?:\/\//i.test(text), `${path.relative(v1, file)} names a remote URL`);
    assert(!/\bfetch\s*\(/.test(text), `${path.relative(v1, file)} uses fetch`);
    const syntax = moduleSyntax(text);
    assert(!syntax, `${path.relative(v1, file)} is a module (${syntax})`);
  });
  return `${v1Text.length} files stay local`;
});
// WHY: the promise is that the app opens without a server, so what is refused is module syntax. An
//      unanchored "import" also fired on a comment naming a document - and it read the same either way,
//      so the one form that actually breaks file://, a dynamic import() inside a function body, was only
//      caught by luck. These three patterns are the forms, and the check below calibrates them.
function moduleSyntax(src) {
  const forms = [
    ['a module declaration', /^\s*(?:import|export)\s/m],
    ['a dynamic import', /\bimport\s*\(/],
    ['import.meta', /\bimport\.meta\b/]
  ];
  const hit = forms.find(([, pattern]) => pattern.test(src));
  return hit ? hit[0] : '';
}

const KEY_PATTERN = "['\"](loopworks\\.[a-z0-9.\\-]+)['\"]";
function storageKeys(text) {
  return [...text.matchAll(new RegExp(KEY_PATTERN, 'gi'))].map((match) => match[1]);
}

check('app: the two text guards read what they claim to read', () => {
  assert(moduleSyntax("import 'x';") === 'a module declaration', 'a module import slipped past the guard');
  assert(moduleSyntax('  export const a = 1;') === 'a module declaration', 'an indented export slipped past the guard');
  assert(moduleSyntax("const m = await import('x');") === 'a dynamic import', 'a dynamic import slipped past the guard');
  assert(moduleSyntax('const where = import.meta.url;') === 'import.meta', 'import.meta slipped past the guard');
  assert(moduleSyntax('// built to PRD-TRD-loopworks-level-import.md') === '', 'the guard reads prose, not code');
  assert(moduleSyntax('<span>an import of a level pack</span>') === '', 'the guard reads prose, not code');
  const keys = storageKeys("const KEY = 'loopworks.app.user-packs.v1';");
  assert(keys.length === 1 && keys[0] === 'loopworks.app.user-packs.v1', `the key guard missed a hyphenated key, read ${JSON.stringify(keys)}`);
  return 'four module forms refused, two prose lines spared, a hyphenated key read';
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

// WHY: the keys are listed here on purpose, so a fifth one is a decision someone wrote down and not a
//      stray line of code. Every one of them holds only player data on the player's own machine.
check('app: only the documented storage keys are used', () => {
  const documented = [
    'loopworks.app.progress.v1',
    'loopworks.app.sound.v1',
    'loopworks.app.theme.v1',
    'loopworks.app.user-packs.v1',
    'loopworks.app.words.v1'
  ].sort();
  const found = new Set();
  v1Text.forEach((file) => {
    // WHY: quoted only - `Loopworks.register` and `Loopworks.machine` are API names, not keys.
    for (const key of storageKeys(read(file))) found.add(key);
  });
  const keys = [...found].sort();
  const stray = keys.filter((key) => !documented.includes(key));
  const unwritten = documented.filter((key) => !keys.includes(key));
  assert(stray.length === 0, `keys nobody documented: ${stray.join(', ')}`);
  assert(unwritten.length === 0, `documented keys no file writes: ${unwritten.join(', ')}`);
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
    ['--amber-ink', '--panel'], ['--amber-ink', '--panel-2'],
    ['--green', '--panel'], ['--green', '--panel-2'], ['--danger', '--panel']
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
  // WHY: a role can share a class string with another ("crate is-labelled"), so the tokens are read
  //      out of every quoted class list. Matching only a string that is exactly one role let a paint
  //      disappear without this check noticing (drift review, 2026-11-13).
  const roles = [];
  for (const match of board.matchAll(/'([^']*)'/g)) {
    match[1].split(/\s+/).filter((token) => /^is-[a-z-]+$/.test(token)).forEach((role) => roles.push(role));
  }
  assert(roles.length >= 6, `the renderer names ${roles.length} roles, expected six`);
  const unique = [...new Set(roles)];
  unique.forEach((role) => assert(css.includes(`.${role}`), `${role} has no paint`));
  return unique.join(', ');
});

check('app: a hole goal draws one slot per label and never a fraction', () => {
  const app = read(path.join(v1, 'js', 'app.js'));
  const css = read(path.join(v1, 'css', 'app.css'));
  assert(/goal\.kind === 'hole'/.test(app), 'the goal bar does not look for a hole goal');
  const at = app.indexOf('function paintGoal');
  assert(at >= 0, 'the goal bar has no paint step');
  const body = app.slice(at, app.indexOf('\n  }', at));
  assert(/goal-slot/.test(body), 'the slots are not created');
  assert(/is-landed/.test(body), 'a landed label is not marked');
  assert(/landed\[index\]/.test(body), 'a slot does not take the label the hole holds');
  assert(!/%|\d+\s*(of|\/)\s*\d+/.test(body), 'the goal bar counts instead of naming');
  assert(/\.goal-slot/.test(css) && /\.goal-slot\.is-landed/.test(css), 'the slots have no paint');
  return 'one slot per label, filled from the snapshot';
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
  const editorBox = page.slice(page.indexOf('class="editor"'), page.indexOf('class="hint"'));
  assert(/id="next-level"/.test(editorBox), 'the next arrow left the typing box');
  assert(/id="prev-level"/.test(editorBox), 'the previous arrow is not beside the next one');
  assert(/class="level-pair"/.test(editorBox), 'the two level arrows do not sit together');
  assert(!/id="next-level"|id="prev-level"/.test(head), 'a level arrow is still in the top bar');
  assert(/const onWork = view === 'work'/.test(app) && /onWork \? lineAt\(-1\) : null/.test(app) && /onWork \? lineAt\(1\) : null/.test(app), 'the arrows ignore the current view');
  const show = app.slice(app.indexOf('function showView'), app.indexOf('function pick'));
  assert(/updateLevelNav\(\);/.test(show), 'switching views does not refresh the arrows');
  return 'Work only, both directions, paired inside the typing box';
});

check('app: the run control is a bigger icon inside the typing box', () => {
  const page = read(path.join(v1, 'index.html'));
  const css = read(path.join(v1, 'css', 'app.css'));
  const app = read(path.join(v1, 'js', 'app.js'));
  const editorBox = page.slice(page.indexOf('class="editor"'), page.indexOf('class="hint"'));
  assert(editorBox.indexOf('class="program-tools"') >= 0, 'the run controls are not inside the typing box');
  assert(editorBox.indexOf('class="level-pair"') < editorBox.indexOf('id="run"'), 'the run side is not on the right');
  assert(/id="run"[\s\S]*class="sr-only" id="run-label"/.test(editorBox), 'the run control still shows a word');
  assert(/\.program-tools \.primary\s*{[^}]*width:\s*52px/.test(css), 'the run button still stretches');
  assert(/\.program-tools \.primary\s*{[^}]*min-height:\s*40px/.test(css), 'the run button is not the bigger one');
  assert(/\.tool\.icon-only\s*{[^}]*width:\s*44px/.test(css), 'the quiet controls changed size');
  assert(/rotate\(-45 12 12\)/.test(app), 'the play glyph is not tilted up');
  assert(/\.level-pair\s*{\s*display:\s*flex/.test(css), 'the level arrows are not one pair');
  return 'a larger icon in the box, level arrows beside it';
});

check('app: Step and Reset live in the corners of the drone panel', () => {
  const page = read(path.join(v1, 'index.html'));
  const css = read(path.join(v1, 'css', 'app.css'));
  const stage = page.slice(page.indexOf('class="stage"'), page.indexOf('</section>', page.indexOf('class="stage"')));
  const editorBox = page.slice(page.indexOf('class="editor"'), page.indexOf('class="hint"'));
  assert(/class="stage-tools left"[\s\S]*id="step"/.test(stage), 'Step is not in the panel top-left corner');
  assert(/class="stage-tools right"[\s\S]*id="reset"/.test(stage), 'Reset is not in the panel top-right corner');
  assert(stage.indexOf('class="stage-tools left"') < stage.indexOf('class="stage-tools right"'), 'the two corners are the same side');
  assert(!/id="step"|id="reset"/.test(editorBox), 'a world control is still beside the typed line');
  assert(/\.stage\s*{[^}]*position:\s*relative/.test(css), 'the stage gives the corners nothing to sit on');
  assert(/\.stage-tools\s*{[^}]*position:\s*absolute/.test(css), 'the corner tools are in the flow');
  assert(/\.stage-tools\.left\s*{\s*left:\s*0/.test(css) && /\.stage-tools\.right\s*{\s*right:\s*0/.test(css), 'the corners are not the panel edges');
  return 'Step top-left, Reset top-right, nothing beside the line';
});

check('app: a touch acts on the first tap, before the keyboard closes', () => {
  const app = read(path.join(v1, 'js', 'app.js'));
  assert(/function press\(/.test(app), 'there is no single place that reads a press');
  assert(/pointerdown/.test(app) && /pointerType !== 'touch'/.test(app), 'a tap is still read only on click, after the blur');
  assert(/preventDefault\(\)/.test(app.slice(app.indexOf('function press('), app.indexOf('function press(') + 700)), 'the tap does not hold the keyboard still while it acts');
  ['run', 'step', 'reset', 'prevLevel', 'nextLevel'].forEach((name) => {
    assert(new RegExp('press\\(el\\.' + name).test(app), 'the ' + name + ' control is not wired through press');
  });
  return 'touch -> pointerdown -> act, then the deliberate close';
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

// WHY: the learner's phone showed the board panned out of sight the moment the keyboard opened.
//      The fix is a second layout that only exists while the editor holds focus, so these checks
//      pin the whole chain: the page asks for it, the sheet owns it, the controller drives it.
check('app: the page lets a keyboard take the layout height, not just the view', () => {
  const page = read(path.join(v1, 'index.html'));
  const meta = page.match(/<meta name="viewport" content="([^"]+)"/);
  assert(meta, 'the page has no viewport meta');
  assert(/interactive-widget=resizes-content/.test(meta[1]), 'a keyboard only slides the window, hiding the board');
  return meta[1];
});

check('app: the typing layout pins the app to the visible height and clears the lower row', () => {
  const css = read(path.join(v1, 'css', 'app.css'));
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  assert(/body\.is-typing \.app\s*{[^}]*height:\s*var\(--app-visible/.test(narrow), 'the app does not take the visible height while typing');
  assert(/body\.is-typing \.verdict[^}]*body\.is-typing \.log\s*{[^}]*display:\s*none/.test(narrow), 'the verdict and the log keep their room');
  assert(/body\.is-typing \.field\s*{[^}]*min-height:\s*0/.test(narrow), 'the field keeps a floor while typing');
  assert(!/is-typing \.splitter/.test(narrow), 'the drawer edge leaves while typing, so the row cannot be pulled taller');
  assert(/body\.is-typing \.program\s*{[^}]*height:\s*50px/.test(narrow), 'the row grows with the program instead of scrolling to the caret');
  return 'a compact layout under a keyboard';
});

check('app: the phone drawer is one row with the buttons inside the typing box', () => {
  const css = read(path.join(v1, 'css', 'app.css'));
  const app = read(path.join(v1, 'js', 'app.js'));
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  assert(/\.program\s*{[^}]*align-items:\s*stretch/.test(narrow), 'the box does not fill the drawer row');
  assert(/\.program \.editor\s*{[^}]*flex:\s*1 1 auto/.test(narrow), 'the line does not take the whole row');
  assert(!/\.program \.controls/.test(narrow), 'the old control row is still in the sheet');
  assert(/\.editor \{\s*grid-template-columns:\s*24px/.test(narrow), 'the gutter still takes a thumb of the line');
  assert(/\.program-tools\s*{[^}]*right:\s*4px/.test(narrow) && /\.program-tools\s*{[^}]*bottom:\s*4px/.test(narrow), 'the buttons left the bottom-right of the typing box');
  assert(/\.tool\s*{\s*width:\s*28px/.test(narrow), 'the work buttons keep their desktop size on a phone');
  assert(/\.tool\.icon-only\s*{\s*width:\s*28px/.test(narrow), 'the arrow buttons keep their wide width and squeeze the line');
  assert(/\.stage-tools\s*{[^}]*top:\s*0/.test(narrow), 'the panel corners do not meet the panel edge on a phone');
  assert(/\.topbar\s*{\s*gap:\s*4px;\s*padding:\s*4px 8px/.test(narrow), 'the narrow bar is as tall as a work row');
  assert(/const ONE_LINE = 50;/.test(app) && /function drawerFloor\(\) \{ return isNarrow\(\) \? ONE_LINE : MIN_PROGRAM; \}/.test(app), 'the drawer cannot be pulled down to one line on a phone');
  assert(/setProgramHeight\(drawerDefault\(\)\)/.test(app), 'the phone drawer opens at the desktop height');
  assert(/\.splitter\s*{[^}]*background:\s*transparent/.test(narrow), 'the drag edge paints its own container above the input');
  assert(/\.splitter-grip\s*{[^}]*bottom:\s*-4px/.test(narrow), 'the grip floats in a band instead of straddling the input box');
  return 'one line, free left, buttons inside the box, grip on the box';
});

// WHY: the learner asked for the program label bar to go and for the word to live inside the box as
//      a subtle wallpaper (docs/features/loopworks-input-area, GRILL 7). The PRD says the box keeps
//      only the lines being typed, so a bar above it is chrome the drawer should not carry; the word
//      and the line count stay, both inside the editor, and the phone row is left alone.
check('app: the program label is a wallpaper inside the editor, not a bar above it', () => {
  const page = read(path.join(v1, 'index.html'));
  const css = read(path.join(v1, 'css', 'app.css'));
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  const editorBox = page.slice(page.indexOf('class="editor"'), page.indexOf('class="hint"'));
  assert(!/class="program-head"/.test(page), 'the label bar is still above the typing box');
  assert(/class="editor-wallpaper"[^>]*aria-hidden="true"[^>]*>Program</.test(editorBox), 'the word Program is not a decorative wallpaper inside the editor');
  assert(/id="line-count"/.test(editorBox), 'the line count left the editor with the bar');
  assert(/\.editor-wallpaper\s*{[^}]*position:\s*absolute/.test(css), 'the wallpaper is not a layer inside the box');
  assert(/\.editor-wallpaper\s*{[^}]*pointer-events:\s*none/.test(css), 'the wallpaper can eat a press meant for the line');
  const rule = css.match(/\.editor-wallpaper\s*{([^}]*)}/);
  const opacity = rule && rule[1].match(/opacity:\s*([0-9.]+)/);
  assert(opacity && Number(opacity[1]) <= 0.1, 'the wallpaper is not subtle enough to sit behind the line');
  assert(/\.editor-wallpaper[^{]*{[^}]*display:\s*none/.test(narrow), 'the wallpaper crowds the one-row phone drawer');
  assert(/\.editor-count[^{]*{[^}]*display:\s*none/.test(narrow), 'the line count crowds the one-row phone drawer');
  return 'no bar, the word is a faint wallpaper, the count lives in the box';
});

// WHY: the learner looked at the shipped drawer and said "the program wallpaper should be in the middle,
//      also i still see a space at the top of the input that suggests a container, we do not need it"
//      (docs/drift.md D-21). A band of panel above the box is the same chrome as the label bar he has
//      removed twice: it holds nothing and still reads as a container. The editor's own top border has
//      to be the drawer's top edge, and the word belongs behind the middle of the line, not its corner.
check('app: the wallpaper sits in the middle and the editor starts at the drawer top', () => {
  const css = read(path.join(v1, 'css', 'app.css'));
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  const blockOf = (selector, source) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = source.match(new RegExp(`(?:^|\\n)[ \\t]*${escaped}[ \\t]*{([^}]*)}`, 'm'));
    return found ? found[1] : '';
  };
  const declared = (block, name) => {
    const found = block.match(new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`, 'm'));
    return found ? found[1].trim() : '';
  };
  // WHY: the top side may be written as the first value of a shorthand or as its own longhand; both
  //      mean the same thing to the box, so the check reads either instead of pinning one spelling.
  const topOf = (block, kind) => {
    const longhand = declared(block, `${kind}-top`);
    const first = longhand || (declared(block, kind).split(/\s+/)[0] || '');
    const value = parseFloat(first);
    return Number.isFinite(value) ? value : null;
  };

  const wallpaper = blockOf('.editor-wallpaper', css);
  assert(declared(wallpaper, 'left') === '50%', 'the wallpaper is not pulled to the middle of the box');
  assert(/^translate\(-50%,\s*-50%\)$/.test(declared(wallpaper, 'transform')), 'the wallpaper is not centred on its own middle');
  assert(!/px$/.test(declared(wallpaper, 'right')), 'a fixed right edge still pins the wallpaper to the corner');

  const program = blockOf('.program', css);
  const editor = blockOf('.editor', css);
  assert(topOf(program, 'padding') === 0, 'the drawer keeps a band of padding above the editor, so it still reads as a container');
  assert(topOf(editor, 'margin') === 0, 'the editor is pushed down from the drawer top, so the band survives');

  const phoneProgram = blockOf('.program', narrow);
  const phoneEditor = blockOf('.program .editor', narrow);
  assert(topOf(phoneProgram, 'padding') === 0, 'the phone drawer grew a top gap');
  assert(topOf(phoneEditor, 'margin') === 0, 'the phone box does not start at the drawer row top');
  return 'the word is centred, the box is the drawer top, the phone row is unchanged';
});

// WHY: the learner looked at the wide screen and said the band is not needed, that he still has to be
//      able to drag the drawer, and that the phone's "tiny line in the middle ... to show that user can
//      drag it" is enough (docs/drift.md D-22, GRILL 6). So the edge keeps its hit area and its cursor
//      and paints nothing: one small grip on the seam is the whole mark, on both widths.
check('app: the drawer edge is a bare grip on both widths, not a band', () => {
  const css = read(path.join(v1, 'css', 'app.css'));
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  const blockOf = (selector, source) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = source.match(new RegExp(`(?:^|\\n)[ \\t]*${escaped}[ \\t]*{([^}]*)}`, 'm'));
    return found ? found[1] : '';
  };
  const declared = (block, name) => {
    const found = block.match(new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`, 'm'));
    return found ? found[1].trim() : '';
  };

  const splitter = blockOf('.splitter', css);
  assert(declared(splitter, 'background') === 'transparent', 'the drag edge still paints a band above the box');
  assert(/^(0|none)$/.test(declared(splitter, 'border')), 'the drag edge still draws its own frame');
  assert(declared(splitter, 'height') === '9px', 'the drag edge lost the hit area a mouse can grab');
  assert(declared(splitter, 'cursor') === 'row-resize', 'the drag edge no longer says it can be dragged');
  assert(declared(splitter, 'touch-action') === 'none', 'the drag edge lets a touch scroll instead of resize');

  const grip = blockOf('.splitter-grip', css);
  assert(declared(grip, 'bottom') === '0', 'the grip floats away from the seam instead of marking it');
  assert(/var\(--grip\)/.test(declared(grip, 'background')), 'the one mark on the seam is invisible');
  assert(declared(grip, 'width') === '44px' && declared(grip, 'height') === '2px', 'the grip is not the small line the learner asked to keep');

  const phoneSplitter = blockOf('.splitter', narrow);
  const phoneGrip = blockOf('.splitter-grip', narrow);
  assert(declared(phoneSplitter, 'background') === 'transparent', 'the phone edge grew a band back');
  assert(/^(0|none)$/.test(declared(phoneSplitter, 'border')), 'the phone edge draws a frame again');
  assert(declared(phoneGrip, 'bottom') === '-4px' && declared(phoneGrip, 'height') === '3px', 'the phone grip left the box it marks');
  return 'no band on either width, a 9 px grab area, one grip on the seam';
});

check('app: the controller reads the visible viewport and marks the screen as typing', () => {
  const app = read(path.join(v1, 'js', 'app.js'));
  assert(/host\.visualViewport/.test(app), 'nothing measures the visible height');
  assert(/visualViewport\.addEventListener\('resize'/.test(app), 'a keyboard opening is never noticed');
  assert(/classList\.toggle\('is-typing'/.test(app), 'the typing class is never set');
  assert(/setProperty\('--app-visible'/.test(app), 'the sheet is never told the visible height');
  assert(/doc\.activeElement === el\.code/.test(app), 'nothing knows whether the editor holds focus');
  return 'visualViewport -> is-typing -> --app-visible';
});

check('app: the board is refitted to the room typing leaves, and a run hands the screen back', () => {
  const app = read(path.join(v1, 'js', 'app.js'));
  assert(/heightRoom = el\.field\.clientHeight - roomY - stagePad - \(typing \? 0 : 98\)/.test(app), 'the board still reserves the hidden verdict row while typing');
  assert(/parseFloat\(pad\.paddingTop\)/.test(app), 'the board is sized against a guessed field padding, not the one the sheet gives');
  assert(/stagePad = Math\.round\(parseFloat\(host\.getComputedStyle\(el\.stage\)\.paddingTop\) \|\| 0\)/.test(app), 'the board ignores the strip the panel corners take from it');
  assert(/Math\.max\(typing \? 120 : 200,/.test(app), 'the board keeps its wide-screen floor while typing, and overflows the drawer');
  assert(/el\.program\.style\.height = ''/.test(app), 'the dragged drawer height outranks the typing layout');
  assert(/function closeKeyboard\(\)[\s\S]{0,80}el\.code\.blur\(\)/.test(app), 'a run does not close the keyboard');
  const run = app.slice(app.indexOf('function startRun()'));
  assert(/closeKeyboard\(\)/.test(run.slice(0, 300)), 'Run leaves the keyboard over the board');
  return 'board follows the room, Run clears the keyboard';
});

check('app: a short visible window spends the status line on the board', () => {
  const css = read(path.join(v1, 'css', 'app.css'));
  const app = read(path.join(v1, 'js', 'app.js'));
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  assert(/const TIGHT_HEIGHT = 340;/.test(app), 'nothing knows where the typing layout runs out of room');
  assert(/visibleHeight\(\) < TIGHT_HEIGHT/.test(app), 'the tight class is never decided by the visible height');
  assert(/body\.is-typing-tight \.statusbar\s*{\s*display:\s*none/.test(narrow), 'the status line keeps its room in a tight window');
  return 'one row of work, no status line, below 340 px visible';
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
  assert(/function renderGoal[\s\S]{0,260}paintGoal\(el\.goalTop/.test(app), 'the top bar goal is never written');
  assert(/paintGoal\(el\.goalStatus/.test(app), 'the status bar goal is never written');
  assert(/mount\.textContent = level\.goalSentence/.test(app), 'the goal sentence is never written into a bar');
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

// WHY: a text check cannot tell a folded index from a flat list - both name lines and budget. The
//      fold is proved by running evidence.js against a fake DOM and a synthetic shelf of 1,000
//      packs, in the same vm + fake-host style as fakeSoundHost() above, so the gate stays
//      dependency-free and runnable on plain node.
function fakeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    className: '',
    dataset: {},
    children: [],
    attrs: new Map(),
    listeners: new Map(),
    _text: '',
    _html: '',
    set textContent(value) {
      this._text = String(value);
      if (value === '') this.children = [];
    },
    get textContent() { return this._text; },
    set innerHTML(value) { this._html = String(value); },
    get innerHTML() { return this._html; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    },
    setAttribute(name, value) { this.attrs.set(name, String(value)); },
    getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; },
    classList: {
      add(...names) {
        const parts = el.className ? el.className.split(/\s+/) : [];
        names.forEach((name) => { if (!parts.includes(name)) parts.push(name); });
        el.className = parts.join(' ');
      }
    },
    closest(selector) {
      let node = this;
      while (node) {
        if (selector === '[data-level]' && node.dataset && node.dataset.level) return node;
        if (selector === '[data-pack-row]' && node.dataset && node.dataset.packRow) return node;
        node = node.parent || null;
      }
      return null;
    },
    querySelector() { return null; }
  };
  return el;
}

function fakeEvidenceHost() {
  const host = {
    console,
    document: { createElement(tag) { return fakeElement(tag); } },
    localStorage: {
      getItem() { return null; },
      setItem() {}
    }
  };
  host.globalThis = host;
  host.window = host;
  return host;
}

function syntheticShelf(packCount, levelsPerPack) {
  const shelf = [];
  for (let p = 0; p < packCount; p += 1) {
    const levels = [];
    for (let l = 0; l < levelsPerPack; l += 1) {
      levels.push({ id: `pack-${p}-level-${l}`, title: `Level ${l + 1}`, budget: 4 });
    }
    shelf.push({ id: `pack-${p}`, name: `Pack ${p}`, levels });
  }
  return shelf;
}

function collectByClass(root, className) {
  const found = [];
  const walk = (node) => {
    if (node.className && node.className.split(/\s+/).includes(className)) found.push(node);
    (node.children || []).forEach(walk);
  };
  walk(root);
  return found;
}

function collectText(root) {
  const texts = [];
  const walk = (node) => {
    if (node._text) texts.push(node._text);
    (node.children || []).forEach(walk);
  };
  walk(root);
  return texts;
}

function fireClick(mount, target) {
  const handlers = mount.listeners.get('click') || [];
  handlers.forEach((fn) => fn({ target }));
}

// WHY: the studio view is a real surface, so its check needs a DOM small enough to read and complete
//      enough to press. This helper is not a browser: it stores text, classes, values and listeners,
//      which is exactly what the view touches, and nothing else.
function fakeStudioNode(tag) {
  const node = {
    tagName: String(tag || '').toUpperCase(),
    children: [],
    listeners: new Map(),
    attrs: new Map(),
    className: '',
    value: '',
    disabled: false,
    hidden: false,
    dataset: {},
    parent: null,
    _text: '',
    appendChild(child) {
      child.parent = node;
      node.children.push(child);
      return child;
    },
    addEventListener(type, fn) {
      if (!node.listeners.has(type)) node.listeners.set(type, []);
      node.listeners.get(type).push(fn);
    },
    setAttribute(name, value) { node.attrs.set(name, String(value)); },
    getAttribute(name) { return node.attrs.has(name) ? node.attrs.get(name) : null; },
    focus() { node.focused = true; },
    fire(type, event) {
      (node.listeners.get(type) || []).forEach((fn) => fn(event || { target: node, preventDefault() {} }));
    },
    classList: {
      add(...names) {
        const parts = node.className ? node.className.split(/\s+/) : [];
        names.forEach((name) => { if (!parts.includes(name)) parts.push(name); });
        node.className = parts.join(' ');
      },
      remove(...names) {
        const parts = node.className ? node.className.split(/\s+/) : [];
        node.className = parts.filter((name) => !names.includes(name)).join(' ');
      },
      contains(name) { return (node.className || '').split(/\s+/).includes(name); }
    }
  };
  Object.defineProperty(node, 'textContent', {
    get() { return node._text; },
    set(value) {
      node._text = String(value);
      if (value === '') node.children = [];
    }
  });
  return node;
}

function fakeStudioHost(initial) {
  const store = new Map(Object.entries(initial || {}));
  const host = {
    console,
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); }
    },
    document: { createElement(tag) { return fakeStudioNode(tag); } }
  };
  host.globalThis = host;
  host.window = host;
  return host;
}

function collectByTag(root, tag) {
  const found = [];
  const wanted = String(tag).toUpperCase();
  const walk = (node) => {
    if (node.tagName === wanted) found.push(node);
    (node.children || []).forEach(walk);
  };
  walk(root);
  return found;
}

function findButton(root, text) {
  return collectByTag(root, 'button').filter((button) => button.textContent === text)[0] || null;
}

function answerBlank(mount, value) {
  const input = collectByTag(mount, 'input')[0];
  assert(input, 'the context drew no input');
  input.value = value;
  input.fire('input');
}

check('app: the evidence view folds levels under their pack and never repeats the pack name', () => {
  const host = fakeEvidenceHost();
  vm.createContext(host);
  runScript(host, path.join(v1, 'js', 'evidence.js'));
  const evidence = host.LoopworksEvidence;
  assert(evidence, 'evidence.js did not define the LoopworksEvidence global');
  const shelf = syntheticShelf(1000, 10);
  const mount = fakeElement('div');
  const picked = [];
  evidence.render(mount, shelf, {}, (packId, levelId) => picked.push([packId, levelId]), '');
  const packRows = collectByClass(mount, 'evidence-pack');
  let levelRows = collectByClass(mount, 'evidence-row');
  assert(packRows.length === 1000, `expected 1,000 pack lines, drew ${packRows.length}`);
  assert(levelRows.length === 0, `expected every pack closed by default, drew ${levelRows.length} level lines`);
  const texts = collectText(mount);
  const nameHits = texts.filter((text) => text === 'Pack 0').length;
  assert(nameHits === 1, `pack name printed ${nameHits} times, expected once`);
  // WHY: opening a pack is a click away, and the levels (with their pick callback) are built then.
  fireClick(mount, packRows[0]);
  levelRows = collectByClass(mount, 'evidence-row');
  assert(levelRows.length === 10, `expected 10 level lines after opening one pack, drew ${levelRows.length}`);
  const firstLevel = levelRows[0];
  assert(firstLevel.dataset.pack === 'pack-0' && firstLevel.dataset.level === 'pack-0-level-0',
    'a level row does not carry its pack and level');
  fireClick(mount, firstLevel);
  assert(picked.length === 1 && picked[0][0] === 'pack-0' && picked[0][1] === 'pack-0-level-0',
    'a level click did not call back with its pack and level');
  return '1,000 packs, closed by default, 10 level lines after open, name once, pick intact';
});

check('app: the evidence search narrows the list and opens the match', () => {
  const host = fakeEvidenceHost();
  vm.createContext(host);
  runScript(host, path.join(v1, 'js', 'evidence.js'));
  const evidence = host.LoopworksEvidence;
  const shelf = syntheticShelf(1000, 10);
  shelf[42].name = 'Łódź Market';
  shelf[42].levels[3].title = 'Night Drop';

  const mount = fakeElement('div');
  evidence.render(mount, shelf, {}, () => {}, 'night drop');
  let packRows = collectByClass(mount, 'evidence-pack');
  let levelRows = collectByClass(mount, 'evidence-row');
  assert(packRows.length === 1, `a level-title query drew ${packRows.length} pack lines, expected 1`);
  assert(levelRows.length === 1 && levelRows[0].dataset.level === 'pack-42-level-3',
    'a level-title query did not open its pack with only the matching level');

  const mount2 = fakeElement('div');
  evidence.render(mount2, shelf, {}, () => {}, 'lodz');
  packRows = collectByClass(mount2, 'evidence-pack');
  assert(packRows.length === 1, `an accent-folded query drew ${packRows.length} pack lines, expected 1`);

  const mount3 = fakeElement('div');
  evidence.render(mount3, shelf, {}, () => {}, 'no such pack anywhere');
  const empty = collectByClass(mount3, 'evidence-empty');
  assert(empty.length === 1, 'a query with no match drew no empty line');
  assert(/No pack or level matches/.test(empty[0].textContent), 'the empty line does not say what happened');

  const mount4 = fakeElement('div');
  evidence.render(mount4, shelf, {}, () => {}, 'pack');
  packRows = collectByClass(mount4, 'evidence-pack');
  const more = collectByClass(mount4, 'evidence-more');
  assert(packRows.length === 200, `a broad query drew ${packRows.length} pack lines, expected the 200 ceiling`);
  assert(more.length === 1 && /keep typing/.test(more[0].textContent),
    'a broad query did not say how many matched and ask for more letters');

  const mount5 = fakeElement('div');
  evidence.render(mount5, shelf, {}, () => {}, '');
  packRows = collectByClass(mount5, 'evidence-pack');
  assert(packRows.length === 1000, `an empty query drew ${packRows.length} pack lines, expected every pack`);
  return 'level-title, accent, empty, ceiling and full browse';
});

check('app: the evidence view names the work to do and never a score', () => {
  const page = read(path.join(v1, 'index.html'));
  const evidence = read(path.join(v1, 'js', 'evidence.js'));
  const css = read(path.join(v1, 'css', 'app.css'));
  assert(/id="evidence-next"/.test(page), 'the Work to do line is missing from the Evidence view');
  assert(/id="evidence-search"/.test(page), 'the search box is missing from the Evidence view');
  assert(/for="evidence-search"/.test(page), 'the search box has no label');
  assert(/Find a pack or a level/.test(page), 'the search box does not say what it finds');
  assert(/evidence-pack/.test(css) && /content-visibility:\s*auto/.test(css),
    'off-screen pack lines are not kept out of layout');
  const spoken = evidence.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert(!/percent|%|ratio|rank|score|stars|badge|bar\b/i.test(spoken),
    'the evidence module speaks in scores');
  assert(/levels/.test(evidence), 'a pack line does not say how many levels it holds');
  return 'next line, search, no score';
});

check('app: the word record keeps a completed context and ignores a corrupt one', () => {
  const host = fakeStudioHost();
  vm.createContext(host);
  runScript(host, path.join(v1, 'js', 'studio.js'));
  const S = host.LoopworksStudio;
  assert(S, 'studio.js did not define the LoopworksStudio global');
  assert(JSON.stringify(S.CONTEXTS) === JSON.stringify(['story', 'spelling', 'forms', 'dialogue', 'matching']),
    'the context order is not the locked one');
  let record = S.read();
  assert(record.words && Object.keys(record.words).length === 0, 'a fresh record is not empty');
  record = S.mark('polish', 'biuro', 'story');
  assert(S.isDone(record, 'polish', 'biuro', 'story'), 'the mark did not land');
  record = S.mark('polish', 'biuro', 'story');
  assert(S.isDone(record, 'polish', 'biuro', 'story'), 'a repeated mark lost the first');
  assert(S.isDone(S.read(), 'polish', 'biuro', 'story'), 'the mark did not survive a read');
  host.localStorage.setItem('loopworks.app.words.v1', '{broken');
  record = S.read();
  assert(Object.keys(record.words).length === 0, 'a corrupt record was not ignored');
  host.localStorage.setItem('loopworks.app.words.v1',
    JSON.stringify({ version: 1, words: { 'polish:biuro': { story: 'yes', spelling: true, chatter: true } } }));
  record = S.read();
  assert(!S.isDone(record, 'polish', 'biuro', 'story'), 'a non-boolean mark was kept');
  assert(!S.isDone(record, 'polish', 'biuro', 'chatter'), 'an unknown context was kept');
  assert(S.isDone(record, 'polish', 'biuro', 'spelling'), 'a true mark was dropped');
  assert(S.nextContext({ story: true }, {}) === 'spelling', 'nextContext did not skip a done context');
  const changing = { forms: [{ label: 'kind', to: 'changed', en: 'meaning', why: 'why', use: { pl: 'a ____', en: 'a line', answer: 'changed' } }] };
  assert(S.nextContext({ story: true, spelling: true }, changing) === 'forms',
    'a word with a Form does not walk through it');
  assert(S.nextContext({ story: true, spelling: true }, {}) === 'dialogue',
    'a word with no Form does not skip the Forms context');
  assert(S.nextContext({ story: true, spelling: true, forms: true }, {}) === 'dialogue',
    'an old Forms mark blocks a word that carries no Form');
  assert(JSON.stringify(S.contexts(changing)) === JSON.stringify(['story', 'spelling', 'forms', 'dialogue', 'matching']),
    'the walk for a changing word is not five contexts');
  assert(JSON.stringify(S.contexts({ forms: [] })) === JSON.stringify(['story', 'spelling', 'dialogue', 'matching']),
    'an empty forms list did not keep the four-context walk');
  return 'mark round-trip, corrupt ignored, order locked, Forms only when carried';
});

check('app: a met word comes from a solved level and its pack word', () => {
  const host = fakeStudioHost();
  vm.createContext(host);
  runScript(host, path.join(v1, 'js', 'studio.js'));
  const S = host.LoopworksStudio;
  const data = {
    en: 'office', pl: 'biuro',
    story: [{ pl: 'Pracuję ____ biurze.', en: 'I work in an office.', answer: 'w' }],
    match: [{ pl: 'Pracuję', en: 'I work' }, { pl: 'okien', en: 'windows' }],
    dialog: { q: 'Gdzie pracujesz?', qGloss: 'Where do you work?', opts: ['W biurze.'], right: 0, reply: 'Dobrze.' }
  };
  const wordPack = {
    id: 'polish', name: 'The Workplace', language: 'Polish', aim: 'the words of the workplace',
    words: { biuro: data },
    levels: [{ id: 'polish-4', word: 'biuro' }, { id: 'polish-5', word: 'biuro' }]
  };
  const plain = { id: 'depot', name: 'The Depot', levels: [{ id: 'depot-1' }] };
  const broken = { id: 'user', name: 'User', language: 'Userese', words: { word: null }, levels: [{ id: 'u-1', word: 'word' }] };
  const shelf = [wordPack, plain, broken];
  assert(S.met(shelf, {}, {}).length === 0, 'an unsolved shelf met a word');
  const met = S.met(shelf, { 'polish-4': { lines: 10 } }, {});
  assert(met.length === 1 && met[0].packId === 'polish' && met[0].word === 'biuro',
    'a solved word level did not meet its word');
  assert(met[0].data === data, 'the met entry did not carry the pack word');
  assert(S.met(shelf, { 'polish-4': {}, 'polish-5': {}, 'u-1': {} }, {}).length === 1,
    'one word from two levels was listed twice');
  const aim = S.aim(shelf, { 'polish-4': {} });
  assert(aim && aim.language === 'Polish' && aim.target === 'the words of the workplace',
    'the aim did not carry the pack language and target');
  assert(Array.isArray(aim.words) && aim.words.length === 1 && aim.words[0] === 'biuro',
    'the aim did not name the met word');
  assert(S.aim([plain], {}) === null, 'a pack with no language produced an aim');
  return 'met from progress, deduped, missing data skipped, aim from pack';
});

check('app: the studio walks four contexts when the word carries no Form', () => {
  const host = fakeStudioHost();
  vm.createContext(host);
  runScript(host, path.join(v1, 'js', 'studio.js'));
  runScript(host, path.join(v1, 'js', 'studio-view.js'));
  const view = host.LoopworksStudioView;
  assert(view, 'studio-view.js did not define the LoopworksStudioView global');
  const data = {
    en: 'office', pl: 'biuro',
    story: [
      { pl: 'Pracuję ____ biurze.', en: 'I work in an office.', answer: 'w' },
      { pl: 'W ____ jest dużo okien.', en: 'There are many windows in the office.', answer: 'biurze' },
      { pl: 'W biurze pracuje mój ____.', en: 'My brother works in the office.', answer: 'brat' }
    ],
    match: [
      { pl: 'Pracuję', en: 'I work' },
      { pl: 'biurze', en: 'office' },
      { pl: 'okien', en: 'windows' }
    ],
    dialog: {
      q: 'Gdzie pracujesz?', qGloss: 'Where do you work?',
      opts: ['W biurze.', 'W szkole.'], right: 0, reply: 'Dobrze. Biuro to dobre miejsce.'
    }
  };
  const met = [{ packId: 'polish', packName: 'The Workplace', word: 'biuro', data, done: {} }];
  const marks = [];
  const exits = [];
  const mount = fakeStudioNode('div');
  view.render(mount, met, (...args) => marks.push(args), () => exits.push('done'));

  assert(collectByClass(mount, 'tab').length === 0 && collectByClass(mount, 'studio-tabs').length === 0,
    'the studio drew a tab');
  const sentence = collectByClass(mount, 'studio-sentence')[0];
  assert(sentence && sentence.children.some((child) => child.tagName === 'INPUT'),
    'the story blank is not inside the sentence');
  assert(collectByTag(mount, 'input').length === 1, 'the story drew more than the blank input');
  assert(!findButton(mount, 'Check'), 'the story has a Check button');
  let next = findButton(mount, 'Next');
  assert(next && next.disabled === true, 'Next is not refused before the story is done');
  assert(findButton(mount, 'Back').disabled === true, 'Back is offered on the first context');

  ['w', 'biurze', 'brat'].forEach((answer) => answerBlank(mount, answer));
  assert(marks.length === 1 && marks[0][2] === 'story', 'finishing the story did not mark it');
  next = findButton(mount, 'Next');
  assert(next.disabled === false, 'Next is still refused after the story is done');
  next.fire('click');

  assert(collectByTag(mount, 'input').length === 1, 'spelling did not draw one input');
  answerBlank(mount, 'biuro');
  findButton(mount, 'Check').fire('click');
  assert(marks.some((args) => args[2] === 'spelling'), 'spelling did not mark');
  findButton(mount, 'Next').fire('click');

  findButton(mount, 'W biurze.').fire('click');
  assert(marks.some((args) => args[2] === 'dialogue'), 'dialogue did not mark');
  findButton(mount, 'Next').fire('click');

  [['Pracuję', 'I work'], ['biurze', 'office'], ['okien', 'windows']].forEach((pair) => {
    findButton(mount, pair[0]).fire('click');
    findButton(mount, pair[1]).fire('click');
  });
  assert(marks.length === 4 && marks[3][2] === 'matching', 'matching did not mark the last context');
  assert(findButton(mount, 'Next') === null, 'Next is still offered after the fourth context');
  assert(findButton(mount, 'Back') === null, 'Back is still the only control after the fourth context');
  const done = findButton(mount, 'Done');
  assert(done, 'the finished studio offers no Done');
  done.fire('click');
  assert(exits.length === 1, 'Done did not end the studio');
  assert(collectText(mount).join(' ').includes('All 4 contexts are met'),
    'the finished studio does not say the four contexts are met');
  assert(!collectText(mount).join(' ').includes('Forms'),
    'a word with no Form still shows a Forms context');
  return 'story, spelling, dialogue, matching; blank as input; Next gated; Done ends it; no tabs';
});

check('app: the studio teaches a Form between Spelling and Dialogue', () => {
  const host = fakeStudioHost();
  vm.createContext(host);
  runScript(host, path.join(v1, 'js', 'studio.js'));
  runScript(host, path.join(v1, 'js', 'studio-view.js'));
  const view = host.LoopworksStudioView;
  const data = {
    en: 'office', pl: 'biuro',
    story: [{ pl: 'Pracuję ____ biurze.', en: 'I work in an office.', answer: 'w' }],
    forms: [{
      label: 'locative',
      to: 'biurze',
      en: 'in the office',
      why: 'After "w" (in), the ending -o becomes -e, and the r softens to rz.',
      use: { pl: 'Rozmawiamy o ____ przez telefon.', en: 'We are talking about the office on the phone.', answer: 'biurze' }
    }],
    match: [{ pl: 'biuro', en: 'office' }, { pl: 'biurze', en: 'in the office' }],
    dialog: {
      q: 'Gdzie pracujesz?', qGloss: 'Where do you work?',
      opts: ['W biurze.', 'W szkole.'], right: 0, reply: 'Dobrze.'
    }
  };
  const met = [{ packId: 'polish', packName: 'The Workplace', word: 'biuro', data, done: { story: true, spelling: true } }];
  const marks = [];
  const exits = [];
  const mount = fakeStudioNode('div');
  view.render(mount, met, (...args) => marks.push(args), () => exits.push('done'));

  const step = () => collectByClass(mount, 'studio-step')[0].textContent;
  assert(step() === 'Forms - 3 of 5', `the Form is not the third of five contexts: "${step()}"`);
  const pair = collectByClass(mount, 'studio-form-pair');
  assert(pair.length === 1, 'the Form did not draw its pair');
  const pairText = collectText(pair[0]);
  assert(pairText.includes('biuro') && pairText.includes('biurze'),
    `the pair does not show the base and the changed form: ${JSON.stringify(pairText)}`);
  const chips = collectByClass(mount, 'studio-chip').map((chip) => chip.textContent);
  assert(chips.includes('locative') && chips.includes('in the office'),
    `the Form does not name the change and its meaning: ${JSON.stringify(chips)}`);
  const why = collectByClass(mount, 'studio-form-why')[0];
  assert(why && why.textContent.includes('softens'), 'the reason the language changes the word is not shown');
  assert(collectByTag(mount, 'input').length === 1, 'the Form drew more than one input');

  answerBlank(mount, 'biuroo');
  assert(marks.length === 0, 'a wrong changed form marked the context');
  assert(collectByTag(mount, 'input')[0].className.includes('is-wrong'), 'a wrong changed form is not marked on the blank');

  answerBlank(mount, 'biurze');
  assert(marks.length === 1 && marks[0][2] === 'forms', 'the right changed form did not mark the Forms context');
  const doneLine = collectByClass(mount, 'studio-done')[0];
  assert(doneLine && doneLine.textContent === 'Form completed - biurze.', 'the Form does not end on the changed word');
  const next = findButton(mount, 'Next');
  assert(next && next.disabled === false, 'Next is refused after the Form is done');
  next.fire('click');
  assert(step() === 'Dialogue - 4 of 5', `Dialogue does not follow the Form: "${step()}"`);

  findButton(mount, 'W biurze.').fire('click');
  findButton(mount, 'Next').fire('click');
  assert(step() === 'Matching - 5 of 5', `Matching is not the last context: "${step()}"`);
  findButton(mount, 'biurze').fire('click');
  findButton(mount, 'in the office').fire('click');
  findButton(mount, 'biuro').fire('click');
  findButton(mount, 'office').fire('click');
  assert(marks.length === 3 && marks[2][2] === 'matching', 'the five-context walk did not finish on matching');
  assert(collectText(mount).join(' ').includes('All 5 contexts are met'), 'the walk does not say all five contexts are met');
  findButton(mount, 'Done').fire('click');
  assert(exits.length === 1, 'Done did not end the five-context studio');
  return 'Forms third of five, pair and reason first, changed form marks it, five contexts end in Done';
});

check('app: the studio names no subject of its own', () => {
  const tokens = new Set();
  L.packs().forEach(({ pack }) => {
    if (typeof pack.language === 'string' && pack.language) tokens.add(pack.language);
    Object.keys(pack.words || {}).forEach((word) => tokens.add(word));
    (pack.levels || []).forEach((level) => { if (level.word) tokens.add(level.word); });
  });
  const files = ['studio.js', 'studio-view.js'];
  const bad = [];
  files.forEach((name) => {
    const src = read(path.join(v1, 'js', name));
    tokens.forEach((token) => {
      if (!token) return;
      const hit = token[0] === token[0].toUpperCase()
        ? src.includes(token)
        : new RegExp(`\\b${token}\\b`, 'i').test(src);
      if (hit) bad.push(`${name} names "${token}"`);
    });
  });
  assert(tokens.size > 0, 'no pack carries a subject to guard');
  assert(bad.length === 0, bad.join('; '));
  return `${files.length} files free of ${tokens.size} subject words`;
});

check('app: the claw is one fact, and only a word level shows it', () => {
  const host = freshContext();
  runScript(host, path.join(v1, 'js', 'board.js'));
  const B = host.LoopworksBoard;
  assert(B.carried(null) === '', 'no snapshot should mean an empty claw');
  assert(B.carried({ carries: false }) === '', 'an empty claw should read empty');
  assert(B.carried({ carries: true, carryLabel: 'b' }) === 'b', 'a label did not read back');
  assert(B.carried({ carries: true, carryLabel: null }) === 'crate', 'an anonymous crate did not read as a crate');
  const app = read(path.join(v1, 'js', 'app.js'));
  assert(/LoopworksBoard\.carried/.test(app), 'the controller never reads the claw');
  assert(/clawFact\.hidden\s*=\s*!wordLevel/.test(app), 'the controller does not hide the claw fact');
  return 'label, crate, empty, word levels only';
});

check('app: the studio opens after a solve with work left, and Done returns to Work', () => {
  const app = read(path.join(v1, 'js', 'app.js'));
  assert(/function offerStudio\(/.test(app), 'the controller has no way to offer the studio');
  const write = app.indexOf('progress = LoopworksEvidence.writeEntry(level.id, entry)');
  const ask = app.indexOf('const met = level.word ? LoopworksStudio.met(shelf, progress, wordsRecord) : []');
  assert(write >= 0, 'the controller no longer writes the solved entry');
  assert(ask > write, 'the solved word is not read back before the offer');
  assert(/nextContext\(metWord\.done, metWord\.data\)/.test(app), 'the offer does not wait for studio work to remain');
  assert(/if \(metWord && LoopworksStudio\.nextContext\(metWord\.done, metWord\.data\)\) offerStudio\(\);/.test(app),
    'a solve with studio work left does not offer the studio');
  assert(/host\.setTimeout\(/.test(app) && /host\.clearTimeout\(/.test(app), 'the offer cannot be cancelled');
  assert(/if \(view !== 'work' \|\| running\) return;/.test(app), 'the offer can steal a screen the learner chose');
  assert(/studioOffered\.has\(wordKey\)/.test(app), 'the same word can pull the learner out twice');
  assert(/showView\('studio'\)/.test(app), 'the offer never opens the studio');
  assert(/LoopworksStudioView\.render\(el\.studioBody, met,[\s\S]*?\(\) => showView\('work'\)\)/.test(app),
    'the studio has no exit back to Work');
  return 'only with work left, once per word, cancellable pause, Done returns to Work';
});

check('app: the aim band and the studio view are on the page', () => {
  const page = read(path.join(v1, 'index.html'));
  ['view-studio', 'studio-body', 'claw-fact', 'claw', 'aim', 'aim-line', 'aim-words'].forEach((name) => {
    assert(new RegExp(`id="${name}"`).test(page), `the page has no #${name}`);
  });
  assert(/data-view="studio"/.test(page), 'the page has no Studio tab');
  // WHY: the page's own intro must describe the walk a Word actually has. It promised four contexts
  //      for every Word after Forms made five, which the headless drive caught on 2026-11-14.
  const intro = page.match(/<div class="studio-head">[\s\S]*?<p>([\s\S]*?)<\/p>/);
  assert(intro, 'the studio page no longer carries its intro paragraph');
  assert(/forms/.test(intro[1]), 'the studio intro does not mention the forms a word may take');
  assert(!/in four contexts/.test(intro[1]), 'the studio intro still promises four contexts for every word');
  const app = read(path.join(v1, 'js', 'app.js'));
  assert(/LoopworksStudio\.aim/.test(app), 'the Evidence view never asks for the aim');
  assert(/LoopworksStudio\.met/.test(app), 'the studio view never asks for met words');
  return 'studio tab, aim band, claw fact, intro that matches the walk';
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

// ---------------------------------------------------------- packs the player adds on this machine

// WHY: a browser cannot list a folder and this app must never run a stranger's script, so a level
//      arrives as data and lives in the machine's own storage. These checks hand the module a host with
//      a storage stub, which is the same shape a browser gives it, and every one of them names the
//      refusal it expects instead of trusting a silent pass.
const addOnPath = path.join(v1, 'js', 'user-packs.js');

function storeStub(seed) {
  const data = Object.assign({}, seed);
  return {
    data,
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; }
  };
}

// WHY: a fresh engine and a fresh shelf per check, so one check's registration can never be the reason
//      the next one passes.
function addOnHost(packed) {
  assert(existsSync(addOnPath), 'js/user-packs.js is missing, so nothing adds a pack at runtime');
  const box = freshContext();
  runScript(box, path.join(v1, 'js', 'engine.js'));
  runScript(box, path.join(v1, 'js', 'prover.js'));
  assert(box.LoopworksProver, 'js/prover.js did not define the LoopworksProver global');
  shippedPacks.forEach((name) => runScript(box, path.join(v1, 'js', 'packs', name)));
  runScript(box, addOnPath);
  assert(box.LoopworksUserPacks, 'js/user-packs.js did not define the LoopworksUserPacks global');
  const U = box.LoopworksUserPacks;
  const store = storeStub(packed === undefined ? {} : { [U.KEY]: packed });
  const shelfIds = () => box.Loopworks.packs().map((entry) => entry.pack);
  return { box, U, store, host: { localStorage: store }, shelfIds, shelf: () => box.Loopworks.packs() };
}

function addedLevel(overrides) {
  return Object.assign({
    id: 'sandbox-1',
    title: 'Straight Line',
    teaches: 'sequence',
    budget: 3,
    goal: { kind: 'visit', count: 1 },
    goalSentence: 'Walk onto the marked pad.',
    teachesSentence: 'One instruction after another.',
    rows: ['#####', '#...#', '#####'],
    start: { x: 1, y: 1, dir: 'E' },
    pads: [[3, 1]],
    crates: []
  }, overrides || {});
}

function addedPack(overrides) {
  return Object.assign({
    id: 'sandbox',
    name: 'The Sandbox',
    subject: 'programming logic',
    blurb: 'A level made on this machine.',
    verbs: ['forward', 'turn left', 'turn right'],
    sensors: ['wall ahead', 'clear ahead'],
    rules: {},
    levels: [addedLevel()]
  }, overrides || {});
}

check('app: a pack the player adds on this machine reaches the shelf and plays', () => {
  const g = addOnHost(JSON.stringify([addedPack()]));
  const before = g.shelf().length;
  const result = g.U.load(g.host);
  assert(result.ok, `the good pack was refused: ${result.errors.join('; ')}`);
  assert(g.shelf().length === before + 1, `the shelf held ${before} packs and now holds ${g.shelf().length}`);
  const entry = g.shelf().find((item) => item.pack.id === 'sandbox');
  assert(entry, 'the added pack never reached the shelf');
  assert(entry.errors.length === 0, `the engine rejected the added pack: ${entry.errors.join('; ')}`);
  const run = g.box.Loopworks.run(entry.pack, 'sandbox-1', 'forward 2');
  assert(run.status === 'solved', `the added level did not play out: ${run.status} / ${run.reason}`);
  return `shelf ${before} -> ${g.shelf().length}, solved in ${run.linesUsed} lines`;
});

check('app: a board that does not line up is refused in the words the engine uses', () => {
  const g = addOnHost();
  const ragged = addedPack({ levels: [addedLevel({ rows: ['#####', '#...#', '####'] })] });
  const verdict = g.U.validate([ragged], g.shelfIds());
  assert(!verdict.ok, 'a board with a short row was accepted');
  const text = verdict.errors.join(' ');
  assert(/row 2 is 4 cells wide, the others are 5/.test(text), `the engine's own sentence is missing: ${text}`);
  const unknown = addedPack({ verbs: ['forward', 'hover'] });
  const second = g.U.validate([unknown], g.shelfIds());
  assert(!second.ok && /"hover" is not a verb the engine knows/.test(second.errors.join(' ')), `a word the drone cannot do slipped through: ${second.errors.join(' ')}`);
  const badText = g.U.parse('{ this is not a level pack ');
  assert(!badText.ok && /is not a level pack/.test(badText.errors.join(' ')), 'text that is not a level pack was accepted');
  assert(badText.packs.length === 0, 'unparseable text still produced packs');
  return verdict.errors[0];
});

check('app: a pack id already on the shelf is refused by name', () => {
  const g = addOnHost();
  const verdict = g.U.validate([addedPack({ id: 'depot' })], g.shelfIds());
  assert(!verdict.ok, 'a second pack called depot was accepted');
  assert(/"depot"/.test(verdict.errors.join(' ')), `the refusal does not name the id: ${verdict.errors.join(' ')}`);
  assert(g.shelf().length === g.shelfIds().length, 'a refused pack still reached the shelf');
  return verdict.errors.join('; ');
});

check('app: a level id already used is refused by name, shipped or added', () => {
  const g = addOnHost();
  const shipped = g.U.validate([addedPack({ levels: [addedLevel({ id: 'depot-1' })] })], g.shelfIds());
  assert(!shipped.ok, 'a level called depot-1 was accepted beside the real one');
  assert(/"depot-1"/.test(shipped.errors.join(' ')), `the refusal does not name the id: ${shipped.errors.join(' ')}`);
  const twins = g.U.validate([addedPack({ levels: [addedLevel(), addedLevel()] })], g.shelfIds());
  assert(!twins.ok, 'two levels with the same id in one pack were accepted');
  assert(/"sandbox-1"/.test(twins.errors.join(' ')), `the twin refusal does not name the id: ${twins.errors.join(' ')}`);
  return shipped.errors[0];
});

check('app: an oversized board and an overlong pack are refused', () => {
  const g = addOnHost();
  assert(g.U.MAX_CELLS === 24, `the board cap reads ${g.U.MAX_CELLS}, not the twenty-four cells the layout is proven at`);
  assert(g.U.MAX_LEVELS === 20, `the pack cap reads ${g.U.MAX_LEVELS}, not the twenty levels the GRILL locked`);
  const tall = [];
  for (let y = 0; y < 25; y += 1) tall.push(y === 0 || y === 24 ? '#####' : '#...#');
  const tooBig = g.U.validate([addedPack({ levels: [addedLevel({ rows: tall })] })], g.shelfIds());
  assert(!tooBig.ok, 'a board of twenty-five rows was accepted');
  assert(/24/.test(tooBig.errors.join(' ')) && /sandbox-1/.test(tooBig.errors.join(' ')), `the size refusal is unclear: ${tooBig.errors.join(' ')}`);
  const wide = '#' + '.'.repeat(30) + '#';
  const tooWide = g.U.validate([addedPack({ levels: [addedLevel({ rows: [wide, wide, wide], pads: [[2, 1]] })] })], g.shelfIds());
  assert(!tooWide.ok, `a board ${wide.length} cells across was accepted`);
  assert(/24/.test(tooWide.errors.join(' ')) && /sandbox-1/.test(tooWide.errors.join(' ')), `the width refusal is unclear: ${tooWide.errors.join(' ')}`);
  const many = [];
  for (let i = 0; i < 21; i += 1) many.push(addedLevel({ id: `sandbox-${i + 1}` }));
  const tooLong = g.U.validate([addedPack({ levels: many })], g.shelfIds());
  assert(!tooLong.ok, 'a pack of twenty-one levels was accepted');
  assert(/20/.test(tooLong.errors.join(' ')), `the length refusal does not name the cap: ${tooLong.errors.join(' ')}`);
  return `board ${g.U.MAX_CELLS} cells, pack ${g.U.MAX_LEVELS} levels`;
});

check('app: a store that holds anything else leaves the shelf alone and is never run', () => {
  const g = addOnHost('globalThis.PWNED = 1');
  const before = g.shelf().length;
  const result = g.U.load(g.host);
  assert(g.box.PWNED === undefined, 'text from storage was executed');
  assert(g.shelf().length === before, `the shelf changed from ${before} packs to ${g.shelf().length}`);
  assert(!result.ok, 'an unreadable store reported no problem');
  assert(result.errors.join(' ').includes(g.U.KEY), `the report does not name the key: ${result.errors.join(' ')}`);
  assert(result.loaded.length === 0, 'an unreadable store still loaded something');
  const asText = g.U.read(g.host, (message) => message);
  assert(Array.isArray(asText) && asText.length === 0, 'a corrupt store did not read as an empty list');
  return result.errors.join('; ');
});

check('app: removing an added pack takes it off the shelf on the next read', () => {
  const g = addOnHost(JSON.stringify([addedPack()]));
  const before = g.shelf().length;
  g.U.load(g.host);
  assert(g.shelf().length === before + 1, 'the added pack never reached the shelf');
  g.U.remove('sandbox', g.host);
  const left = JSON.parse(g.store.data[g.U.KEY]);
  assert(Array.isArray(left) && left.length === 0, `removing it left ${JSON.stringify(left)}`);
  const again = addOnHost(g.store.data[g.U.KEY]);
  assert(again.shelf().length === before, `a fresh read of that store holds ${again.shelf().length} packs, expected ${before}`);
  const loaded = again.U.load(again.host);
  assert(loaded.ok && loaded.loaded.length === 0, `the emptied store reported ${loaded.errors.join('; ')}`);
  return `shelf ${before + 1} -> ${before}, and the record is left alone`;
});

check('app: an added pack is stored as data the engine can still check', () => {
  const g = addOnHost();
  const written = g.U.write([addedPack()], g.host);
  assert(written.ok, `writing a good pack failed: ${written.errors.join('; ')}`);
  const raw = g.store.data[g.U.KEY];
  assert(typeof raw === 'string', 'the store holds something that is not text');
  const parsed = JSON.parse(raw);
  assert(Array.isArray(parsed) && parsed.length === 1, `the store holds ${JSON.stringify(parsed)}`);
  assert(parsed[0].levels[0].rows[0] === '#####', 'the board did not survive the round trip');
  const reload = addOnHost(raw);
  const result = reload.U.load(reload.host);
  assert(result.ok && result.loaded.length === 1, `a pack read back from storage refused: ${result.errors.join('; ')}`);
  return `${raw.length} characters round-trip`;
});

// WHY: the word lesson is checked before it can reach a learner. The base fixture is the shipped Word
//      pack with new ids, so each fault below is one break in an otherwise valid lesson - the same shape
//      a chat model is asked for. The engine still checks the boards; this check is about the words.
function wordLesson() {
  const pack = JSON.parse(JSON.stringify(findPack('polish')));
  pack.id = 'lesson';
  pack.levels.forEach((level, index) => { level.id = `lesson-${index + 1}`; });
  return pack;
}

check('app: a broken word lesson is refused by name', () => {
  const g = addOnHost();
  const plain = g.U.validate([wordLesson()], g.shelfIds());
  assert(plain.ok, `a good word lesson was refused: ${plain.errors.join('; ')}`);
  const faults = [
    ['no language', (pack) => { delete pack.language; }, 'no language'],
    ['no story', (pack) => { delete pack.words.biuro.story; }, 'has no story'],
    ['a story line with no blank', (pack) => { pack.words.biuro.story[0].pl = 'No blank here.'; }, 'story 1 needs exactly one ____ blank'],
    ['a Form with no reason', (pack) => { pack.words.biuro.forms[0].why = ''; }, 'form 1 has no why'],
    ['no forms list', (pack) => { delete pack.words.biuro.forms; }, 'has no forms list'],
    ['a matching pair with no meaning', (pack) => { pack.words.biuro.match[0] = { pl: 'biuro' }; }, 'match 1 needs a word and its English meaning'],
    ['a dialogue pointing nowhere', (pack) => { pack.words.biuro.dialog.right = 9; }, 'points at an option that is not there'],
    ['a level word the pack does not carry', (pack) => { pack.levels.find((level) => level.word).word = 'missing'; }, 'names the word "missing"'],
    ['a goal that does not spell the word', (pack) => { pack.levels.find((level) => level.word).goal.sequence[0] = 'z'; }, 'goal sequence spells'],
    ['a hole with no crate for a letter', (pack) => {
      const level = pack.levels.find((entry) => entry.word);
      level.crates = level.crates.filter((crate) => crate[2] !== 'u');
    }, 'no crate carries "u"']
  ];
  faults.forEach(([label, breakIt, needle]) => {
    const pack = wordLesson();
    breakIt(pack);
    const verdict = g.U.validate([pack], g.shelfIds());
    assert(!verdict.ok, `${label}: the broken lesson was accepted`);
    assert(verdict.errors.some((message) => message.includes(needle)),
      `${label}: no message says "${needle}" - ${verdict.errors.join(' | ')}`);
  });
  assert(g.U.validate([addedPack()], g.shelfIds()).ok, 'a logic pack is now refused because it carries no words');
  return `${faults.length} faults named, the good lesson and a logic pack still pass`;
});

// WHY: one board family, three verdicts. It takes two lines to win - a turn and a walk - so the same
//      rows show a Budget too small, a proof that walks into a wall, and a proof that is the truth.
function twistLevel(overrides) {
  return addedLevel(Object.assign({
    id: 'twist-1',
    rows: ['#####', '#.#.#', '#...#', '#.#.#', '#####'],
    start: { x: 1, y: 1, dir: 'E' },
    pads: [[1, 3]],
    budget: 3
  }, overrides || {}));
}
function twistPack(overrides) {
  return addedPack({ levels: [twistLevel(overrides)] });
}
function sealedAdded() {
  return addedPack({
    levels: [addedLevel({
      id: 'sealed-1',
      rows: ['#######', '#.....#', '#.###.#', '#.#.#.#', '#.###.#', '#######'],
      start: { x: 1, y: 1, dir: 'E' },
      pads: [[3, 3]],
      budget: 6
    })]
  });
}

// WHY: the promise this whole pack exists for - an added level is answered, not assumed. The two halves
//      are the two halves of the wait: the page load must not search, because a player opens this app on a
//      phone; the press of "Add it" must search, because a level from somewhere else is a claim about a
//      board nobody has proved.
check('app: the added level\'s proof is checked', () => {
  const g = addOnHost();
  const plain = g.U.validate([addedPack()], g.shelfIds());
  assert(plain.ok, `a good pack was refused before any checking: ${plain.errors.join('; ')}`);
  assert(plain.notes.length === 0, `a verdict arrived when nobody asked for one: ${plain.notes.join('; ')}`);
  const proved = g.U.validate([addedPack()], g.shelfIds(), { prove: true });
  assert(proved.ok, `the proven pack was refused: ${proved.errors.join('; ')}`);
  assert(proved.notes.length === 1, `expected one verdict line, got ${proved.notes.length}`);
  assert(/proven - 1 lines inside a Budget of 3/.test(proved.notes[0]), `the verdict reads "${proved.notes[0]}"`);
  assert(!/forward/.test(proved.notes.join(' ')), `the verdict printed the program: ${proved.notes[0]}`);
  const stored = addOnHost(JSON.stringify([addedPack()]));
  const boot = stored.U.load(stored.host);
  assert(boot.ok, `a stored pack that had been checked would not boot: ${boot.errors.join('; ')}`);
  assert(boot.notes.length === 0, 'the page load searched the shelf again');
  return proved.notes[0];
});

check('app: an unwinnable level is refused and the shelf does not change', () => {
  const g = addOnHost();
  const pack = sealedAdded();
  const before = g.shelf().length;
  const engineSays = g.box.Loopworks.validatePack(pack);
  assert(engineSays.length === 0, `the engine itself refused the fixture, so this proves the wrong thing: ${engineSays.join('; ')}`);
  const verdict = g.U.validate([pack], g.shelfIds(), { prove: true });
  assert(!verdict.ok, 'a board walled shut was accepted');
  assert(/"sealed-1"/.test(verdict.errors.join(' ')), `the refusal does not name the level: ${verdict.errors.join(' ')}`);
  assert(/no program can reach this goal/.test(verdict.errors.join(' ')), `the refusal does not say why: ${verdict.errors.join(' ')}`);
  assert(g.store.data[g.U.KEY] === undefined, 'checking a pack wrote to the store');
  assert(g.shelf().length === before, `a refused pack reached the shelf: ${before} -> ${g.shelf().length}`);
  return verdict.errors.join('; ');
});

// WHY: the other half of the honesty. A search that ran out of room says so and keeps the level, because
//      "not proven" is a fact about this search and not a fact about the board - and the app must not
//      throw away a playable level to sound certain.
check('app: not proven still adds', () => {
  const g = addOnHost();
  const pack = twistPack({ budget: 1 });
  const verdict = g.U.validate([pack], g.shelfIds(), { prove: true });
  assert(verdict.ok, `a level nobody proved was refused: ${verdict.errors.join('; ')}`);
  const said = verdict.notes.join(' ');
  assert(/not proven/.test(said), `the note does not say not proven: ${said}`);
  assert(/takes 2 lines/.test(said), `the note does not say what it found: ${said}`);
  assert(!/no program can reach/.test(said), 'a level that can be won was called unwinnable');
  const written = g.U.write([pack], g.host);
  assert(written.ok, `the not-proven pack could not be stored: ${written.errors.join('; ')}`);
  const again = addOnHost(g.store.data[g.U.KEY]);
  const loaded = again.U.load(again.host);
  assert(loaded.ok && loaded.loaded.length === 1, `the not-proven level would not open: ${loaded.errors.join('; ')}`);
  const entry = again.shelf().find((item) => item.pack.id === 'sandbox');
  assert(entry, 'the added pack never reached the fresh shelf');
  const run = again.box.Loopworks.run(entry.pack, 'twist-1', 'turn right\nforward 2');
  assert(run.status === 'solved', `the level that is not proven cannot be played: ${run.status} / ${run.reason}`);
  assert(run.linesUsed > 1, `its own Budget of 1 should be too small for a 2-line win, got ${run.linesUsed}`);
  return `${said} - and playable in ${run.linesUsed} lines`;
});

check('app: a proof that does not win refuses the level', () => {
  const g = addOnHost();
  const lying = twistPack({ proof: 'forward 2' });
  const verdict = g.U.validate([lying], g.shelfIds(), { prove: true });
  assert(!verdict.ok, `a level whose proof walks into a wall was accepted: ${verdict.notes.join('; ')}`);
  assert(/cannot be added/.test(verdict.errors.join(' ')), `the refusal does not read as one: ${verdict.errors.join(' ')}`);
  assert(/bump/.test(verdict.errors.join(' ')), `the engine's own reason is missing: ${verdict.errors.join(' ')}`);
  const honest = twistPack({ proof: 'turn right\nforward 2' });
  const kept = g.U.validate([honest], g.shelfIds(), { prove: true });
  assert(kept.ok, `a level carrying a true proof was refused: ${kept.errors.join('; ')}`);
  assert(/proven - 2 lines inside a Budget of 3/.test(kept.notes.join(' ')), `the carried proof reads "${kept.notes.join(' ')}"`);
  return verdict.errors.join('; ');
});

// WHY: the four words are the whole contract, so a fifth is a bug the player would read as a promise.
check('app: the checker answers in the four words this pack promised', () => {
  const g = addOnHost();
  const fixtures = [
    addedPack(),
    sealedAdded(),
    twistPack({ budget: 1 }),
    twistPack({ proof: 'forward 2' }),
    twistPack({ proof: 'turn right\nforward 2' })
  ];
  const seen = new Set();
  fixtures.forEach((pack) => {
    const verdict = g.U.validate([pack], g.shelfIds(), { prove: true });
    verdict.errors.concat(verdict.notes).forEach((line) => {
      // WHY: "not proven" is checked first, because it contains the other word and a set built from a
      //      test that matches both would report four verdicts where three were said.
      const word = /not proven/.test(line) ? 'not proven'
        : /proven - /.test(line) ? 'proven'
          : /no program can reach this goal/.test(line) ? 'unwinnable'
            : /cannot be added/.test(line) ? 'proof fails' : `unknown: ${line}`;
      seen.add(word);
      assert(!/^unknown/.test(word), `a verdict line this pack does not know: ${line}`);
    });
  });
  ['proven', 'not proven', 'unwinnable', 'proof fails'].forEach((word) => {
    assert(seen.has(word), `the word "${word}" was never answered by any of the four fixtures`);
  });
  return [...seen].sort().join(', ');
});

// ---------------------------------------------------------- the prompt a player copies

// WHY: the prompt is a request written into a chat model, so its words are the contract. Every one of these
//      checks reads the assembled text against something the running app already knows - the glossary, the
//      engine's own refusals, the importer's caps - because a prompt typed out by hand is a second copy of
//      the rules, and second copies are what this project keeps removing.
const promptPath = path.join(v1, 'js', 'level-prompt.js');

function promptHost(packed) {
  assert(existsSync(promptPath), 'js/level-prompt.js is missing, so nothing builds the prompt a player copies');
  const g = addOnHost(packed);
  runScript(g.box, path.join(v1, 'js', 'words.js'));
  runScript(g.box, promptPath);
  assert(g.box.LoopworksLevelPrompt, 'js/level-prompt.js did not define the LoopworksLevelPrompt global');
  const shelf = g.box.Loopworks.packs();
  assert(shelf.length > 0, 'the shelf is empty, so the prompt has no real level to show');
  return { box: g.box, L: g.box.LoopworksLevelPrompt, U: g.U, W: g.box.LoopworksWords,
    pack: shelf[0].pack, level: shelf[0].pack.levels[0] };
}

// WHY: a pack that unlocks three verbs and one sensor. The point of handing it to the prompt is the words
//      that are NOT there - a model that writes a carrying puzzle for a player who cannot carry has written
//      a level this app will refuse.
function subsetPack() {
  return {
    id: 'quay', name: 'The Quay', subject: 'programming logic', blurb: 'Three words and a wall.',
    verbs: ['forward', 'turn left', 'turn right'], sensors: ['wall ahead'], rules: {},
    levels: [{
      id: 'quay-1', title: 'Round The Corner', teaches: 'sequence', budget: 4,
      goal: { kind: 'visit', count: 1 }, goalSentence: 'Walk onto the pad.',
      rows: ['#####', '#...#', '#####'], start: { x: 1, y: 1, dir: 'E' }, pads: [[3, 1]], crates: []
    }]
  };
}

check('app: the prompt names every word the Dictionary names, and no word it does not', () => {
  const g = promptHost();
  const lines = g.L.words(g.box, g.pack);
  const labels = g.W.list(g.pack);
  assert(labels.length > 0, `the glossary lists no words for pack "${g.pack.id}", so the prompt would be silent`);
  labels.forEach((word) => {
    const joined = lines.join('\n');
    assert(joined.includes(word), `the prompt never names "${word}"`);
    const said = g.W.describe(word);
    assert(said !== '', `"${word}" has no description, so the prompt would offer a bare word`);
    assert(joined.includes(said), `the prompt names "${word}" without the rule the Dictionary states for it`);
  });
  const subset = g.L.words(g.box, subsetPack());
  const joinedSubset = subset.join('\n');
  ['grab', 'drop', 'clear ahead', 'crate ahead', 'pad ahead'].forEach((word) => {
    assert(!joinedSubset.includes(word), `the prompt offered "${word}" to a pack that does not unlock it`);
  });
  assert(joinedSubset.includes('forward'), 'a pack that unlocks forward got a prompt with no forward');
  return `${labels.length} words in the prompt, ${subset.length} for a three-word pack`;
});

check('app: the prompt states the board alphabet in the engine\'s own sentence', () => {
  const g = promptHost();
  const broken = JSON.parse(JSON.stringify(g.level));
  broken.rows[0] = `${broken.rows[0]}x`;
  const pack = JSON.parse(JSON.stringify(g.pack));
  pack.levels = [broken];
  const errors = g.box.Loopworks.validatePack(pack);
  const sentence = errors.find((message) => /character that is not/.test(message));
  assert(sentence, `the engine stopped refusing an unknown character: ${JSON.stringify(errors)}`);
  const said = g.L.grammar(g.box, g.pack).join('\n');
  assert(said.includes(sentence), `the prompt does not carry the engine's own words:\n  engine: ${sentence}\n  prompt: ${said}`);
  return sentence;
});

check('app: the prompt states the goal kinds in the engine\'s own sentence', () => {
  const g = promptHost();
  const pack = JSON.parse(JSON.stringify(g.pack));
  pack.levels = [Object.assign({}, g.level, { goal: { kind: 'deliver', count: 1 } })];
  const errors = g.box.Loopworks.validatePack(pack);
  const sentence = errors.find((message) => /goal kind/.test(message));
  assert(sentence, `the engine stopped refusing an unknown goal kind: ${JSON.stringify(errors)}`);
  assert(/visit/.test(sentence) && /fill/.test(sentence), `the refusal names neither kind: ${sentence}`);
  const said = g.L.grammar(g.box, g.pack).join('\n');
  assert(said.includes(sentence), `the prompt does not carry the engine's own words:\n  engine: ${sentence}\n  prompt: ${said}`);
  return sentence;
});

check('app: the prompt warns that crates need the carrying words, in the engine\'s own sentence', () => {
  const g = promptHost();
  const pack = JSON.parse(JSON.stringify(g.pack));
  pack.verbs = ['forward', 'turn left', 'turn right'];
  const level = Object.assign({}, g.level, { crates: g.level.pads ? [[g.level.start.x + 1, g.level.start.y]] : [[1, 1]] });
  pack.levels = [level];
  const errors = g.box.Loopworks.validatePack(pack);
  const sentence = errors.find((message) => /places crates but the pack does not unlock/.test(message));
  assert(sentence, `the engine stopped refusing crates without the words: ${JSON.stringify(errors)}`);
  const said = g.L.grammar(g.box, g.pack).join('\n');
  assert(said.includes(sentence), `the prompt does not carry the engine's own words:\n  engine: ${sentence}\n  prompt: ${said}`);
  return sentence;
});

check('app: the prompt asks for a pack and stays inside the limits the importer enforces', () => {
  const g = promptHost();
  const text = g.L.text(g.box);
  assert(g.L.LEVEL_MAX <= g.U.MAX_LEVELS, `the prompt asks for ${g.L.LEVEL_MAX} levels and the importer refuses above ${g.U.MAX_LEVELS}`);
  assert(text.includes(`${g.L.LEVEL_MIN} to ${g.L.LEVEL_MAX}`), `the ask is not the numbers the module holds (${g.L.LEVEL_MIN}/${g.L.LEVEL_MAX})`);
  assert(text.includes(String(g.U.MAX_CELLS)), `the prompt never names the ${g.U.MAX_CELLS}-cell board limit the importer enforces`);
  assert(!text.includes('one level and nothing else'), 'the prompt asks for a single level, which the learner refused');
  return `asks ${g.L.LEVEL_MIN} to ${g.L.LEVEL_MAX} levels under a ${g.U.MAX_CELLS}-cell and ${g.U.MAX_LEVELS}-level ceiling`;
});

check('app: the prompt carries the shape of a real level, not a described one', () => {
  const g = promptHost();
  const shown = g.L.exampleJson(g.box);
  const text = g.L.text(g.box);
  assert(text.includes(shown), 'the assembled prompt does not contain the example it claims to carry');
  const pack = JSON.parse(shown);
  assert(Array.isArray(pack.levels) && pack.levels.length > 0, `the example is not a pack with levels: ${shown.slice(0, 80)}`);
  const errors = g.box.Loopworks.validatePack(pack);
  assert(errors.length === 0, `the example the player is told to copy is refused by the engine: ${JSON.stringify(errors)}`);
  const keys = Object.keys(pack.levels[0]).join(',');
  assert(text.includes(Object.keys(g.level).join(', ')) || text.includes(keys),
    'the prompt never names the fields the example level actually carries');
  return `${pack.id}/${pack.levels[0].id} as the shape, ${Object.keys(pack.levels[0]).length} fields named`;
});

check('app: the word prompt asks for a word lesson around the learner\'s word', () => {
  const g = promptHost();
  const line = 'a word - a language - what it means';
  const text = g.L.text(g.box, null, line);
  assert(text.includes(`The learner is learning: ${line}.`), 'the word prompt does not carry the learner\'s own line');
  assert(g.L.WORD_LEVEL_MAX <= g.U.MAX_LEVELS,
    `the word prompt asks for ${g.L.WORD_LEVEL_MAX} levels and the importer refuses above ${g.U.MAX_LEVELS}`);
  assert(text.includes(`${g.L.WORD_LEVEL_MIN} to ${g.L.WORD_LEVEL_MAX}`),
    'the word prompt does not ask for the two-board minimum and the four-level ceiling');
  ['language:', 'aim:', 'words:', 'story', 'match', 'dialog', 'forms',
    'label, to, en, why and use', 'fresh sentence', 'precise meaning',
    '"kind": "hole"', '"sequence"', '[x, y, "letter"]', 'decoy', 'Word studio', 'blocks movement', 'prefer raw JSON'].forEach((piece) => {
    assert(text.includes(piece), `the word prompt never names "${piece}"`);
  });
  assert(/goal sequence spells that word exactly/.test(text), 'the word prompt does not tie the goal to the word');
  const fieldsLine = text.split('Every level is an object with these fields:\n')[1].split('\n')[0];
  assert(fieldsLine.includes('word') && fieldsLine.includes('holes'),
    `the level fields leave out a word-bearing level's keys: ${fieldsLine}`);
  return `${text.length} characters, every word-lesson field named, ${g.L.WORD_LEVEL_MIN}-${g.L.WORD_LEVEL_MAX} levels`;
});

check('app: the word prompt carries a real word pack, not a described one', () => {
  const g = promptHost();
  const shown = g.L.exampleJson(g.box, 'a word - a language - what it means');
  const pack = JSON.parse(shown);
  assert(pack.words && Object.keys(pack.words).length > 0, `the word example carries no words: ${shown.slice(0, 80)}`);
  assert(Array.isArray(pack.levels) && pack.levels.length === 1, 'the word example is not one level');
  const carried = pack.levels[0];
  assert(typeof carried.word === 'string' && carried.word, 'the word example level names no word');
  assert(pack.words[carried.word], `the word example level names "${carried.word}" but the pack does not carry it`);
  const errors = g.box.Loopworks.validatePack(JSON.parse(JSON.stringify(pack)));
  assert(errors.length === 0, `the word example is refused by the engine: ${JSON.stringify(errors)}`);
  const text = g.L.text(g.box, null, 'a word - a language - what it means');
  assert(text.includes(shown), 'the assembled word prompt does not contain the word example it claims to carry');
  const exampleFields = Object.keys(carried).join(', ');
  const exampleFieldsLine = text.split('Every level is an object with these fields:\n')[1].split('\n')[0];
  assert(exampleFieldsLine === exampleFields, 'the level fields line does not match the example level');
  return `${pack.id}/${carried.id} carries ${carried.word}, engine-valid, ${Object.keys(pack.words).length} word in the block`;
});

check('app: the prompt stays the logic prompt when no word is named', () => {
  const g = promptHost();
  const logic = g.L.text(g.box);
  assert(g.L.text(g.box, null, '') === logic, 'an empty word field changed the logic prompt');
  assert(g.L.text(g.box, null, '   ') === logic, 'a whitespace word field changed the logic prompt');
  assert(logic.includes('teaches programming logic'), 'the empty field no longer asks for a logic pack');
  assert(!logic.includes('"forms"') && !logic.includes('forms is an array'),
    'the logic prompt carries a word-lesson block');
  return `${logic.length} characters, no word block`;
});

check('app: the copied prompt carries no learner record and no pack the player added', () => {
  const stored = JSON.stringify([{
    id: 'courtyard', name: 'The Courtyard', subject: 'programming logic',
    verbs: ['forward'], sensors: [], rules: {},
    levels: [{ id: 'courtyard-1', title: 'Yard', teaches: 'sequence', budget: 2,
      goal: { kind: 'visit', count: 1 }, rows: ['###', '#.#', '###'], start: { x: 1, y: 1, dir: 'E' },
      pads: [[1, 1]], crates: [] }]
  }]);
  const g = promptHost(stored);
  const text = g.L.text(g.box);
  assert(!/loopworks\.app\./.test(text), 'the prompt names a storage key, so it carries the machine record out');
  ['courtyard', 'courtyard-1', 'The Courtyard'].forEach((name) => {
    assert(!text.includes(name), `the prompt carries "${name}", which only exists because this player added it`);
  });
  return `${text.length} characters, no key and no added pack in it`;
});

check('app: the prompt module is assembled from the shelf, so its file names no subject', () => {
  const text = read(promptPath).toLowerCase();
  const names = new Set();
  shelf().forEach((pack) => {
    [pack.id, pack.name].forEach((value) => { if (value) names.add(String(value).toLowerCase()); });
    Object.keys(pack.words || {}).forEach((word) => { if (word) names.add(String(word).toLowerCase()); });
  });
  const named = [...names].filter((word) => text.includes(word));
  assert(named.length === 0, `js/level-prompt.js names ${named.join(', ')}`);
  assert(/loopworks-level-prompt/.test(text), 'js/level-prompt.js carries no PACK line, so its copy has no origin');
  return `${names.size} subject words from ${shelf().length} packs, none in the prompt module`;
});

// WHY: everything above is pure text. These three drive the dialog itself, which until this pack had never
//      been exercised outside a browser - the click, the clipboard's two answers, and the file picker.
function dialogHost(seed) {
  assert(existsSync(promptPath), 'js/level-prompt.js is missing, so nothing builds the prompt a player copies');
  const box = freshContext();
  runScript(box, path.join(v1, 'js', 'engine.js'));
  runScript(box, path.join(v1, 'js', 'prover.js'));
  shippedPacks.forEach((name) => runScript(box, path.join(v1, 'js', 'packs', name)));
  runScript(box, path.join(v1, 'js', 'words.js'));
  runScript(box, promptPath);

  const nodes = (name) => ({
    name, value: '', textContent: '', className: '', hidden: true, type: '', dataset: {},
    files: [], handlers: {},
    addEventListener(type, fn) { this.handlers[type] = fn; },
    setAttribute() {}, close() {}, focus() { this.focused = true; }, select() { this.selected = true; },
    appendChild(child) { (this.children = this.children || []).push(child); return child; },
    closest() { return null; }
  });
  const made = {};
  const timers = [];
  const reloads = { count: 0 };
  const readers = { built: 0 };
  box.document = {
    getElementById(name) { made[name] = made[name] || nodes(name); return made[name]; },
    createElement: (name) => nodes(name)
  };
  box.FileReader = class {
    constructor() { readers.built += 1; this.result = ''; this.onload = null; this.onerror = null; }
    readAsText(file) { this.result = file.text; if (this.onload) this.onload(); }
  };
  box.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  box.location = { reload: () => { reloads.count += 1; } };
  const store = storeStub(seed);
  box.localStorage = store;
  box.navigator = {};
  runScript(box, path.join(v1, 'js', 'user-packs.js'));
  assert(box.LoopworksUserPacks, 'js/user-packs.js did not define the LoopworksUserPacks global');
  const turn = () => new Promise((resolve) => setImmediate(() => timers.forEach((t) => t.fn())));
  return { box, made, timers, reloads, readers, store, turn };
}

check('app: a clipboard that will not take it puts the prompt in the box and says so', async () => {
  const g = dialogHost();
  const copy = g.made['pack-prompt-copy'];
  assert(copy && copy.handlers.click, 'the dialog never wired #pack-prompt-copy, so the button does nothing');
  await copy.handlers.click();
  const expected = g.box.LoopworksLevelPrompt.text(g.box);
  assert(g.made['pack-add-error'].className.includes('note'),
    `the fallback line is not in the note tone: "${g.made['pack-add-error'].className}"`);
  assert(g.made['pack-add-text'].value === expected, 'the box did not end up holding the prompt the button was asked to copy');
  assert(g.made['pack-add-text'].selected === true, 'the text was put in the box but never selected for a long-press copy');
  assert(/clipboard/.test(g.made['pack-add-error'].textContent),
    `the line does not say the clipboard refused: "${g.made['pack-add-error'].textContent}"`);
  return `fallback paints the amber line and fills the box with ${expected.length} characters`;
});

check('app: a clipboard that takes it says copied and leaves the paste box alone', async () => {
  const g = dialogHost();
  const written = [];
  g.box.navigator.clipboard = { writeText: (text) => { written.push(text); return Promise.resolve(); } };
  await g.made['pack-prompt-copy'].handlers.click();
  assert(written.length === 1, `the clipboard was asked to write ${written.length} times`);
  assert(written[0] === g.box.LoopworksLevelPrompt.text(g.box), 'what the clipboard got is not the prompt the module builds');
  assert(g.made['pack-add-text'].value === '', 'a copy that worked still rewrote the paste box, wiping what the player had there');
  assert(g.made['pack-add-error'].className.includes('said'),
    `a successful copy is not in the green tone: "${g.made['pack-add-error'].className}"`);
  assert(/copied/.test(g.made['pack-add-error'].textContent), 'the line does not say copied when the clipboard took it');
  return 'clipboard first, one write, green line, box untouched';
});

check('app: a word in the Add-a-level field reaches the copied prompt', async () => {
  const g = dialogHost();
  const line = 'a word - a language - what it means';
  g.made['pack-word'].value = line;
  const written = [];
  g.box.navigator.clipboard = { writeText: (value) => { written.push(value); return Promise.resolve(); } };
  await g.made['pack-prompt-copy'].handlers.click();
  assert(written.length === 1, `the clipboard was asked to write ${written.length} times`);
  assert(written[0] === g.box.LoopworksLevelPrompt.text(g.box, null, line),
    'the copied text is not the word prompt the module builds');
  assert(written[0].includes(`The learner is learning: ${line}.`), 'the copied word prompt lost the learner\'s line');
  g.made['pack-word'].value = '';
  await g.made['pack-prompt-copy'].handlers.click();
  assert(written.length === 2, 'the second copy did not happen');
  assert(written[1] === g.box.LoopworksLevelPrompt.text(g.box), 'emptying the field did not return the logic prompt');
  assert(!written[1].includes('The learner is learning:'), 'the emptied field still copied a word lesson');
  return 'filled field copies the word lesson, empty field copies the logic prompt';
});

check('app: a picked .json file lands in the box as the player wrote it', async () => {
  const g = dialogHost();
  const pack = JSON.stringify(subsetPack());
  g.made['pack-add-file'].files = [{ name: 'quay.json', text: pack }];
  await g.made['pack-add-file'].handlers.change();
  assert(g.made['pack-add-text'].value === pack, 'the picked file did not reach the paste box');
  assert(/quay\.json/.test(g.made['pack-add-error'].textContent),
    `the line never names the file it read: "${g.made['pack-add-error'].textContent}"`);
  const parsed = g.box.LoopworksUserPacks.parse(g.made['pack-add-text'].value);
  assert(parsed.packs && parsed.packs.length === 1, `the box text no longer parses as a pack: ${JSON.stringify(parsed.errors)}`);
  return `read quay.json into the box and named it - ${pack.length} characters`;
});

check('app: a picked file that is not .json is refused before it is read', async () => {
  const g = dialogHost();
  g.made['pack-add-file'].files = [{ name: 'quay.js', text: '{"id": "quay"}' }];
  const before = g.readers.built;
  await g.made['pack-add-file'].handlers.change();
  assert(g.readers.built === before, `a script file was opened by a reader anyway (${g.readers.built - before} new)`);
  assert(g.made['pack-add-text'].value === '', 'the box was overwritten with a file this app refuses to read');
  assert(/\.json/.test(g.made['pack-add-error'].textContent),
    `the refusal does not name the shape to pick: "${g.made['pack-add-error'].textContent}"`);
  return 'quay.js refused by name, the reader never built';
});

// WHY: a failure has to say which promise broke, so the report names the check and the reason. The dialog
//      checks settle on a later turn, so the report waits for every one of them before it reads the slate.
await Promise.all(pending);
const failed = results.filter((result) => !result.ok);
const skipped = results.filter((result) => result.skipped);
const runnable = results.length - skipped.length;
results.forEach((result) => {
  const mark = result.skipped ? 'SKIP' : result.ok ? 'ok  ' : 'FAIL';
  process.stdout.write(`${mark}  ${result.name}${result.detail ? ` - ${result.detail}` : ''}\n`);
});
const skipNote = skipped.length
  ? `, ${skipped.length} skipped - ${skipped.map((result) => result.detail).join('; ')}`
  : '';
process.stdout.write(`\n${runnable - failed.length}/${runnable} checks passed${skipNote}\n`);
if (failed.length > 0) process.exit(1);
