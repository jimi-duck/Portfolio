#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Stamp the shared chrome into every page.

   The nav, the site menu, the footer and the boilerplate at the top of <head>
   are the same on all eight pages. They used to be eight copies — about 41KB,
   a fifth of all the HTML on the site — and they had already drifted: the 404
   and the homepage wrote é and ↗ as literals, the other six wrote &eacute; and
   &#8599;, and nobody had noticed because nothing compares them.

   So the source of truth for those blocks is partials/, and this writes them
   into each page between a pair of marker comments:

       <!-- @nav -->  … everything here is generated …  <!-- /@nav -->

   What it does NOT do is turn the pages into templates. The committed .html
   files stay complete, readable, working HTML — you can open one in a browser
   from the filesystem, and GitHub Pages serves them as they are. This only
   rewrites the marked regions, which is why it is safe to run at any time and
   why running it twice changes nothing.

       node build.js          stamp the partials into every page
       node build.js --check  report any page that is out of date, and exit 1

   --check is the one to run before you commit, or in CI. It never writes.

   TO ADD A PAGE: add it to PAGES below, and put the six chrome marker pairs in
   it. The @game pair is optional and only the two pages that open the game
   carry it.
   TO CHANGE THE NAV OR FOOTER: edit partials/, then run this.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PARTIALS = path.join(ROOT, 'partials');

/* The grid overlay is hinted once, on the homepage, and nowhere else — finding
   it on every page of the site would stop it being something you find. */
const GRID_HINT = '\n      <span class="f-keys">Press <kbd>G</kbd> for the grid</span>';

/* The intro curtain, which only the homepage has. It lives here rather than in
   chrome.html because the shared region runs from the skip link to the grid
   hint, and on the homepage the curtain sits between the two — a partial that
   did not carry it simply deleted it. */
const CURTAIN = `

<!-- ═══ INTRO CURTAIN ═══════════════════════════════════════════════════════ -->
<div id="intro" aria-hidden="true">
  <span class="col"></span><span class="col"></span><span class="col"></span><span class="col"></span><span class="col"></span>
  <div class="brand"><span>James Ciclitira</span><span class="ct">000</span></div>
</div>
`;

/* Every page, and the four things that differ between them.

   home   what a nav or footer link to a homepage section points at. On the
          homepage itself that is a bare "#work"; everywhere else the same
          link has to carry the file, "index.html#work".
   intro  the homepage is the only page with the intro curtain, and the boot
          script has to mark the document as introing before first paint or
          the curtain has nothing to sit on top of.
   keys   the grid hint, homepage only.
   curtain the intro curtain, homepage only.
   reveal the homepage footer fades in with the rest of the page; on every
          other page it is simply there. Keeping that per-page rather than
          giving every footer the reveal, which is what the shared partial
          did at first — a behaviour the other seven pages never had.
   root   prefixed to every file the chrome links to. Empty everywhere but
          the 404, because GitHub Pages serves that page at whatever address
          went missing: at /enter/ or /work/coup a relative css/swiss.css
          resolves to /enter/css/swiss.css, and the page arrived unstyled with
          every link in it broken. The 404's own links outside the markers
          are written root-absolute by hand for the same reason. */
const PAGES = {
  'index.html':          { home: '',           intro: ' introing', keys: GRID_HINT, reveal: ' data-reveal', curtain: CURTAIN, root: '' },
  'about.html':          { home: 'index.html', intro: '',          keys: '',        reveal: '', curtain: '', root: '' },
  'lab.html':            { home: 'index.html', intro: '',          keys: '',        reveal: '', curtain: '', root: '' },
  'cv.html':             { home: 'index.html', intro: '',          keys: '',        reveal: '', curtain: '', root: '' },
  'enter.html':          { home: 'index.html', intro: '',          keys: '',        reveal: '', curtain: '', root: '' },
  'coup.html':           { home: 'index.html', intro: '',          keys: '',        reveal: '', curtain: '', root: '' },
  'cooler-future.html':  { home: 'index.html', intro: '',          keys: '',        reveal: '', curtain: '', root: '' },
  'vivy.html':           { home: 'index.html', intro: '',          keys: '',        reveal: '', curtain: '', root: '' },
  '404.html':            { home: 'index.html', intro: '',          keys: '',        reveal: '', curtain: '', root: '/' },
};

/* marker name → the partial that fills it */
const BLOCKS = {
  head:         'head.html',
  'head-assets':'head-assets.html',
  chrome:       'chrome.html',
  nav:          'nav.html',
  footer:       'footer.html',
  game:         'game.html',
  analytics:    'analytics.html',
};

/* Blocks only some pages carry. The six above are the shared chrome and every
   page wants all of them, so a page missing one of those markers is a mistake
   and stamp() says so. The game board is not chrome: it belongs to the two
   pages that can open it, and everywhere else its absence is the right answer
   rather than an error. */
const OPTIONAL = new Set(['game']);

/* Does this page carry the marker pair for a block? */
function has(html, name) {
  return html.includes(`<!-- @${name} -->`) && html.includes(`<!-- /@${name} -->`);
}

const read = f => fs.readFileSync(f, 'utf8');

/* {{home}} and friends. An unknown token is a typo in a partial, not an empty
   string — say so rather than quietly stamping a hole into eight pages. */
function fill(template, vars, where) {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key) => {
    if (!(key in vars)) throw new Error(`${where}: no value for {{${key}}}`);
    return vars[key];
  });
}

/* Replace what sits between <!-- @name --> and <!-- /@name -->, keeping the
   markers and the indentation of the opening one. */
function stamp(html, name, body, file) {
  const open = `<!-- @${name} -->`;
  const close = `<!-- /@${name} -->`;
  const re = new RegExp(
    `([ \\t]*)${open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?` +
    close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  if (!re.test(html)) throw new Error(`${file}: missing the ${open} … ${close} markers`);
  return html.replace(re, (_, indent) => {
    const inner = body.trimEnd().split('\n')
      .map(line => (line ? indent + line : line))
      .join('\n');
    return `${indent}${open}\n${inner}\n${indent}${close}`;
  });
}

function build(file) {
  const vars = PAGES[file];
  let html = read(path.join(ROOT, file));
  for (const [name, partial] of Object.entries(BLOCKS)) {
    if (OPTIONAL.has(name) && !has(html, name)) continue;
    const body = fill(read(path.join(PARTIALS, partial)), vars, partial);
    html = stamp(html, name, body, file);
  }
  return html;
}

const check = process.argv.includes('--check');
let stale = 0;

for (const file of Object.keys(PAGES)) {
  const before = read(path.join(ROOT, file));
  const after = build(file);
  if (before === after) continue;
  stale++;
  if (check) {
    console.error(`out of date: ${file}`);
  } else {
    fs.writeFileSync(path.join(ROOT, file), after);
    console.log(`stamped: ${file}`);
  }
}

if (check) {
  if (stale) {
    console.error(`\n${stale} page(s) do not match partials/. Run: node build.js`);
    process.exit(1);
  }
  console.log(`${Object.keys(PAGES).length} pages match partials/`);
} else if (!stale) {
  console.log('every page already matches partials/');
}
