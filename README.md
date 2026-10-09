# James Ciclitira — Portfolio

Personal product design portfolio for James Ciclitira. A set of static, hand-coded HTML pages — no framework, no build step. Live at [www.jciclitira.com](https://www.jciclitira.com).

## Structure

```
index.html           Homepage
cv.html              Résumé (screen sheet + a single-page A4 print sheet;
                     "Download CV" serves CV/James_Ciclitira_Lebenslauf.pdf)
404.html             Not found
lab.html             Experiments — side projects, Wayward first (the game lives in its own repo).
                     Footer-linked, noindexed, deliberately absent from
                     sitemap.xml

enter.html           Case study — Enter (energy tech)
coup.html            Case study — Coup Mobility
cooler-future.html   Case study — Cooler Future
vivy.html            Case study — Vivy

partials/            The shared chrome — nav, site menu, footer, head boilerplate,
                     plus the game board, which only the homepage carries
build.js             Stamps partials/ into every page. See "The chrome" below

css/swiss.css        The whole design system — every page loads this
css/about.css        About-only. Outside the case-study vocabulary on purpose
css/cv.css           Résumé-only screen styles + the A4 print sheet
css/game.css         Chrome for the hidden easter egg. Fetched on first launch
js/swiss.js          Shared behaviour (reveals, menu, theme, grid overlay, launcher)
js/about.js          About-only. Makes the photo pile clickable, and nothing else
js/game.js           The easter egg itself. Fetched on first launch

fonts/               TeX Gyre Heros, self-hosted (GUST Font License)
img/                 Case study screenshots and image assets
CNAME                Custom domain config for GitHub Pages
.nojekyll            Disables Jekyll processing so assets serve as-is

TONE-OF-VOICE.md     How the copy is written. Read before editing any text
COPY-REVIEW.md       Record of the copy revision pass, with the reasoning
```

## Voice

`TONE-OF-VOICE.md` is the rule for every line on the site: headlines, body copy,
case studies, metadata, buttons and error messages. The short version is *report
the work, don't review it*, with the homepage as the benchmark. It sets word
limits for every slot (work card, tagline, glance cell, headline, lede), bans
writing tricks such as contrast headlines and colon reveals, and carries a list
of words that are never used here (seamless, unlock, empower, leverage, journey,
stakeholders and about forty more), UK spelling throughout, contractions where a
person would use them, and numbers one to nine spelled out with 10 and above as
figures. Check new copy against it before publishing, not after.

## Design system

Swiss / International Typographic Style: one grotesque, a strict grid, hairline
rules, one accent. All of it lives in `css/swiss.css`.

- **Type** — TeX Gyre Heros, a free cut to Helvetica's metrics, self-hosted from
  `fonts/`. Regular and Bold only; there is no third weight by design. There
  is an italic cut, used in exactly one place — the reader quotes in the Cooler
  Future audience blocks, which are a plain `<em>` in a plain `<p>` and so miss
  every `font-style:normal` reset the component rules apply. It is not
  preloaded; that page fetches it when it needs it.
  Every uppercase micro-label shares one size (`--t-lab`) and one tracking
  (`--tr-lab`) — change the token, not the rule.
- **Colour** — paper `--paper`, ink `--ink`, one accent `--red`. Dark mode swaps
  the tokens under `[data-theme="dark"]`; nothing else changes. Hairlines are
  alpha (`--rule`, `--rule-2`) rather than solid tints, so they sit correctly on
  paper, `--sheet` and `--warm` alike. `--red-bright` is for hover/active only.
  The accent appears at most once per viewport — a number, a status dot, one
  CTA — never as a decorative fill.
- **Layout** — `.edge` for page margins, `.sechd` for the label + hairline
  section headers, and two section densities that alternate: `.blk` for the
  argument sections (work, figures, clients, process) and `.blk-air` for the
  reflective ones (about, contact), plus `.blk-tight` for a band that continues
  the one above it rather than starting a new beat. `.div-ink` is the one
  full-bleed ink rule, used above Contact to split the page into three acts.
- **Imagery** — framed media gets a fixed ratio and `object-fit: cover`, never
  natural height; the sources run from portrait to wide, so the frame imposes
  the crop. The exception is a banner carrying its own typography, which has
  nothing spare to lose — those take `.is-art` (`.wproj-fig.is-art` on the
  homepage, `.hero-img.is-art` on a case study) and keep their own ratio.
- **Emphasis** — never bold inside body copy, on any page. Rank comes from
  scale, position and the numbered system; a figure that matters gets its own
  column in a hairlined definition list (`.wmeta` on the work cards). The one
  surviving `<strong>` is structural, not emphasis: `.mcard strong` is the
  card's heading and renders as a block at `--t-h3`. The single exception is
  the homepage work cards, where `.wproj-d strong` sets the opening verb phrase
  (what I did) in bold so the card can be skimmed in two lines.
- **Semantics** — one `<h1>` per page, every section label (`.lab`, `.sec-lbl`)
  is a real `<h2>`, and every page has a skip link and a `<main id="main">`.
  The mobile menu is closed with `visibility:hidden`, not clip-path alone —
  clipping leaves its links in the tab order.
- **Typography** — apostrophes and quotation marks are typographic (’ “ ”);
  ranges take an en-dash (2016–2026), and body copy carries no em-dashes at
  all. Break a sentence with a comma, a colon or a full stop instead, and use
  the middot (`·`) where a label needs a separator (`01 · Enter`). Never run a text-level find-and-replace over a whole HTML file: the
  inline `<script>` blocks live in the body and string literals get mangled.
- **Motion** — one treatment, and it goes on **sections, not elements**. Put
  `data-reveal` on a section and it rises 14px and fades in once as it arrives,
  as a single object; its contents are not observed and do not animate
  separately. There is nothing to stagger and no delay to set.

  This replaced a per-element ladder — `.r` fade-ups, `.rl` line masks, `.rw`
  rule wipes, `.rm` image clips, all stepped with `data-delay` — which meant
  six things moving in one viewport and anything scrolled past quickly being
  read mid-fade. Those class names are gone from the CSS; if you find one in
  markup it is a leftover and does nothing. No hover scale, no shadows, no
  gradients: hover is an accent swap and a hairline underline. Everything is
  disabled under `prefers-reduced-motion`.

  Two traps if you extend this. Every hidden start state is prefixed `html.js`,
  so the matching `.in` rule needs the same prefix or the start state
  out-specifies it. And `.sechd` draws its hairline with a pseudo-element
  rather than a border, so anything setting `border-bottom` on it will fight.

Case study pages share one class vocabulary (`cs-hero`, `glance`, `section`,
`lede`, `prose`, `two`/`three`/`four`, `stats`, `pbox`, `pq`, `cards`,
`dark-band`, `warm-band`, `next`), so restyling them means editing `swiss.css`
rather than the pages.

They also share one structure, written for a reader with five minutes:

- **Hero**: title, a one-sentence tagline, and Role · Years · Shipped.
- **`glance`**: the problem, what I did, the result. One sentence or two each.
  Somebody who reads nothing else should still leave with the whole case.
- **Numbered chapters** (`<span class="lbl-n">01</span>` in the label). Each has
  one headline that makes one claim and one `lede` beside it, set larger than
  body copy. Headline plus lede is the skim path; anything after the lede is
  the second read, so keep it short and let the screens carry the detail.
- **`stats`**, the figures band under the hero image, only where the figures
  add something the glance doesn't: Enter's measured results, Coup's scale.
  Cooler Future and Vivy carry none, because every figure they had restated
  a line from the glance or a headline.
- **Captions** are sentence case, not tracked capitals, because they are
  sentences.

Adding a chapter means adding a headline and a lede, not another paragraph.

Image size follows the story, not the slot. The screens that carry a chapter
run large (Coup's ride flow at the full measure); scene-setting ones sit beside
the text at half the measure (Vivy's onboarding); a sequence runs as one row
in reading order (Enter's report, Vivy's sprint days). No render is taller
than a laptop viewport: `device-wide` caps a laptop mockup at 1040px.
Photographs are greyscale; product renders stay in colour, including a hero
made of them (`hero-img is-screens`).

They also form one chain: the homepage links all four, and each page's `.next`
card carries you to the following one — Enter → Coup → Cooler Future → Vivy,
which ends on a card back to the portfolio. Every case study is reachable from
the homepage index, so keep the two in step if you add another.

Two easter eggs: **G** overlays the 12-column grid on any page (hinted once in
the footer), and the game opens from the homepage's corner launcher or by
pressing **B**. The launcher collapses to its sprite until you approach it and
stands down entirely over the footer, where it otherwise covered "Back to top".

`lab.html` used to carry the same board and open it from a named button
(`#play-game`). It now leads with Wayward, which is built and deployed from its
own repo, so the homepage is the only page with the board. The loader in
`swiss.js` still binds `#play-game` if a page ever brings it back.

The game's 52KB (gzipped) of CSS and JavaScript is not on the homepage's
critical path: the page ships a control and an empty `#astro-stage`, and the
first press fetches the pair. The stage is `hidden` until `css/game.css` has
loaded, because every rule that positions and hides the board lives in that
stylesheet — open the stage early and you get a canvas, a HUD and two dialogs
laid out in normal flow at the bottom of the page.

## The chrome

The nav, the site menu, the footer and the boilerplate at the top of `<head>`
are identical on all nine pages. They live in `partials/`, and `build.js`
stamps them into each page between a pair of marker comments:

```html
<!-- @nav -->  … everything here is generated …  <!-- /@nav -->
```

```bash
node build.js
```

It rewrites only the marked regions, so the committed `.html` files stay
complete, readable, working HTML — open one from the filesystem and it renders,
and GitHub Pages serves it as it is. There is no template language and nothing
at runtime. Running it twice changes nothing.

One region is optional. `@game` is the board itself, and it is stamped only
into the pages that carry the marker pair, which today is just the homepage.
Every other region is chrome that all nine pages want, so a page missing one of
those markers is a mistake and the build says so.

Four values differ between pages and are set in the `PAGES` table at the top of
`build.js`: `home` (a nav link is `#work` on the homepage and `index.html#work`
everywhere else), `intro` and `curtain` (only the homepage has the intro
curtain, and the boot script has to know before first paint), `keys` (the grid
hint appears once, in the homepage footer) and `reveal` (only the homepage
footer fades in).

Those last three are the lesson of this arrangement: a shared region is only
shared to the extent that every page really does want the same thing. The
`@chrome` region runs from the skip link to the grid hint, and on the homepage
the intro curtain sits between the two — so the first version of the partial,
which did not carry it, silently deleted it.

Before committing a change to the chrome:

```bash
node build.js --check
```

which writes nothing and exits non-zero if any page has drifted from
`partials/`. That check is the point of the whole arrangement: the nine copies
had already diverged — the homepage and the 404 wrote `é` and `↗` as literal
characters, the other six wrote `&eacute;` and `&#8599;` — and nothing compared
them, so nobody knew.

The Cloudflare Web Analytics beacon is a marked region too (`@analytics`). It
is one script tag and it was pasted into all nine pages by hand, which is
exactly the thing `--check` is for and exactly the thing it could not see while
the tag sat outside the markers.

**Edit `partials/`, not the marked regions.** Anything you write between the
markers is overwritten on the next build.

## Before you deploy

A short checklist, because these are the things that rot between releases:

- `node build.js --check` passes. If it does not, run `node build.js` and
  commit the result.
- `sitemap.xml` lists only the seven indexable pages and carries a `<lastmod>`
  — bump the dates when you publish. `lab.html` and `404.html` are deliberately
  absent, and both carry `noindex`; if either ever earns a place in the
  sitemap, the robots line comes out in the same commit.
- Meta descriptions are kept under ~160 characters so search results do not
  truncate them mid-sentence. Both `description` and `og:description` carry the
  same string, so change them together.
- Every `<img>` needs `width` and `height` (prevents layout shift) and
  `loading="lazy"` — except the one hero image per page, which stays eager and
  carries `fetchpriority="high"`. On `about.html` that is the portrait in the
  photo pile: it is the LCP element, so lazy-loading it delays the only paint
  anyone measures.
- Each GIF in `img/GIF/` has a `-still.png` beside it, and the `<picture>` on
  `about.html` serves the still under `prefers-reduced-motion`. Re-encode a GIF
  and the still goes stale silently — regenerate it in the same commit. Three
  animations that loop forever with no way to pause them is the thing that
  setting exists to answer.
- The contact form loads EmailJS from jsdelivr pinned to an exact version with
  a subresource integrity hash. Bumping the version means recomputing the hash,
  or the browser refuses the file and the form stops working:
  `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`
- PNGs here are transparent device renders, so they cannot be converted to JPEG.
  They have been re-encoded losslessly; if you add more, run them through
  ImageOptim or Squoosh first — the originals were ~15% larger than necessary.
- External links to former employers go stale. `joincoup.com` is gone and
  `vivy.com` now redirects to a domain broker, so both are plain text rather
  than links on the résumé.

## Running locally

Serve the folder with any static file server, e.g.:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploying

Hosted on GitHub Pages, deployed from the `main` branch. Pushing to `main` triggers an automatic rebuild — changes are usually live within a minute or two.

GitHub Pages serves the repository as-is; `build.js` runs on your machine, not
there, so the stamped HTML has to be committed.

```bash
node build.js --check   # or: node build.js, then review the diff
git add .
git commit -m "Update"
git push
```

## Custom domain

Already configured — the `CNAME` file points at `www.jciclitira.com`, with DNS records pointed at GitHub Pages. No action needed unless the domain changes.

## Contact form

The homepage contact form sends via EmailJS:
- Service: `service_rwv0n4u`
- Template: `template_0zf917w`

If it stops working, check the account's monthly send quota at emailjs.com (200/month on the free tier).
