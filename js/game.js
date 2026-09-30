(function(){
  var avail   = document.querySelector('.avail');
  var canvas  = document.getElementById('astroCanvas');
  // The file is fetched on demand now (see game() in swiss.js), so it can in
  // principle arrive on a page that has no board to draw on. Without this the
  // very next line throws and takes the rest of the page's scripts with it.
  if (!canvas) return;
  var ctx     = canvas.getContext('2d');
  var exitBtn = document.getElementById('astroExit');
  var tipEl   = document.getElementById('astroTip');
  var scoreEl = document.getElementById('astroScoreVal');
  var livesEl = document.getElementById('astroLives');
  var shieldEl= document.getElementById('astroShieldBuff');
  var rapidEl = document.getElementById('astroRapidBuff');
  var xpBarEl = document.getElementById('astroXp');
  var xpFillEl= document.getElementById('astroXpFill');
  var xpNumEl = document.getElementById('astroXpVal');
  var xpNeedEl= document.getElementById('astroXpNeed');
  var lvlNumEl= document.getElementById('astroLevelVal');
  var coreEl    = document.getElementById('astroCore');
  var coreFillEl= document.getElementById('astroCoreFill');
  var coreLabEl = document.getElementById('astroCoreLabel');
  var chainEl   = document.getElementById('astroChain');
  var chainValEl= document.getElementById('astroChainVal');
  var releaseBtn   = document.getElementById('astroRelease');
  var tipTimer = null;

  var NOSE_OFFSET = 17;

  // Base handling. All timings are in SECONDS and all motion is scaled by a
  // per-frame step factor, so the run plays the same on a 60Hz and a 120Hz
  // screen — and a stalled frame can never teleport the field.
  // SHOT_COOLDOWN was 0.22 before Aug 2026 and briefly 0.255, which is a 16% cut
// to the base rate — not "slight", and it compounds because every cannon level
// and the rapid drop all multiply this one number. 0.235 is ~7% off the
// original: a real reduction that does not quietly rescale the whole run.
var ROT_SPEED = 0.06, THRUST = 0.155, BULLET_SPEED = 11, SHOT_COOLDOWN = 0.235, BOUNCE = 0.4;
  // A hard floor on the automatic gun, applied after every multiplier rather
  // than before one. Rapid fire used to be a x0.4 on top of an already-clamped
  // cooldown, which is how a maxed ship reached 180 bullets a second and simply
  // deleted the field. Nothing may now fire faster than this.
  var MIN_COOLDOWN = 0.075;
  // Extra barrels are no longer free. Each level of Spread Shot multiplies the
  // cooldown, so the fan trades rate for coverage instead of adding both.
  var SPREAD_DRAG = 1.22, RAPID_MULT = 0.55;
  // ── Photon torpedoes ─────────────────────────────────────────────────────
  // The second weapon, and deliberately the opposite of the phaser in every
  // respect: slow to travel, slow to reload, and it does its damage in a
  // radius rather than at a point. Phasers are the answer to one target on the
  // nose; torpedoes are the answer to a wall of rock, which is the situation
  // the phaser handles worst. The bay stays cold until the upgrade is taken.
  var TORP_SPEED = 5.4, TORP_LIFE = 2.6, TORP_R = 5;
  var TORP_COOLDOWN = 3.4, TORP_BLAST = 78, TORP_DMG = 4;
  // Torpedoes seek *ships*. A rock is never a target, only an obstacle, and a
  // torpedo that has a lock flies straight through the field to reach it —
  // which is the whole point: a three-and-a-half second reload spent cracking
  // a rock that the phaser was going to clear anyway is a wasted torpedo, and
  // the bay's real job is the warbird sitting behind the rock.
  //
  // With nothing to lock onto it behaves exactly as it always did: straight
  // line, detonates on the first thing it touches. So it is still the answer
  // to a wall of rock when there is no better answer to be had.
  //
  // TORP_TURN is in radians per second. What it really sets is the turn
  // *circle*: at 324px/s, 2.2 rad/s is a 147px radius, which measured as a
  // torpedo that curves onto a stationary warbird and then sails past it 4px
  // wide. 4.2 gives a 77px circle — it comes round onto a target that holds
  // still, and still loses one that keeps turning, which is the trade the
  // weapon is supposed to have.
  //
  // TORP_FUSE is a proximity fuse in pixels on top of the contact radius. A
  // guided warhead that has to physically touch a 15px saucer is a warhead
  // that misses for reasons the player cannot see.
  // TORP_LEAD is a cap, in frames, on how far ahead of a target a torpedo is
  // allowed to aim. Pure pursuit — steering at where the target *is* — tracks
  // a stationary hull perfectly and tail-chases a moving one forever: measured
  // against a bobbing scout it closed to 35px and then trailed it. Leading by
  // the flight time turns the chase into an intercept. The cap matters because
  // at 400px the raw flight time is 80 frames, and leading a bobbing target by
  // eighty frames aims at somewhere it is never going to be.
  var TORP_SEEK_R = 520, TORP_TURN = 4.2, TORP_FUSE = 13, TORP_LEAD = 30;
  // ── mines ───────────────────────────────────────────────────────────
  // The third weapon, and the third answer to the same question. The phaser
  // hits what is in front of you and the torpedo hits what it can see; a mine
  // hits whatever arrives after you have gone. It is the only ordnance in the
  // game that is aimed by *where you flew*, which makes running away a way of
  // laying a trap rather than a way of losing ground.
  //
  // Three rules keep it from being a second wake. It arms on a short fuse, so
  // a mine dropped on top of a rock does not go off in your own exhaust. It
  // triggers on rock as readily as on Klingons, because a field the player has
  // to keep flying through is the thing a mine is for. And the rack holds a
  // fixed number: lay the next one past the cap and the oldest goes cold, so
  // the weapon covers the ground you are using rather than the whole sector.
  //
  // It never touches your own hull. A mine that could kill you would make the
  // card a trap dressed as a weapon, and the ship has no way to pick one up.
  var MINE_COOLDOWN = 4.2, MINE_LIFE = 16, MINE_ARM = 0.8, MINE_R = 6;
  var MINE_TRIG = 44, MINE_BLAST = 96, MINE_DMG = 5, MINE_RACK = 4;
  var MINE_RGB = '199,125,255';
  // ── Navigational deflector ───────────────────────────────────────────────
  // Rock is ~70% of all damage taken, and every other defensive card answers
  // it indirectly — this one answers it by name. It is a shove, not a wall:
  // late-run rocks are fast enough to punch through the field, so it lowers
  // the rate you get hit rather than making you immune to the thing.
  var DEFLECT_R = 74, DEFLECT_PUSH = 4.0;
  // ── warp plasma vent ─────────────────────────────────────────────────────
  // Venting drive plasma into the wake behind a pursuer is a real trick out of
  // the shows, and it is the only card in the deck that turns running away
  // into an attack — which is the one thing this ship could not do. It only
  // lays while the impulse engines are actually lit, so the trail is drawn by
  // flying, not by existing: a tight turn under power writes a wall, and
  // coasting writes nothing.
  //
  // Plasma burns *ships*. Rock is inert and sails straight through it, which
  // keeps the card off the 70% of the damage that the deflector answers and
  // stops it quietly becoming a second field-clearer.
  var WAKE_LIFE = 2.4, WAKE_R = 11, WAKE_GAP = 0.055, WAKE_TICK = 0.35;
  var wake = [], nextEmber = 0;
  // ── hull arc ─────────────────────────────────────────────────────────────
  // Every other weapon on this ship rewards standing off. The arc is the one
  // that pays for the opposite, and the price is set by the radius: at 43px a
  // 21px rock is inside the field about thirteen pixels before it is inside
  // the hull, so using this card at all means flying close enough that a
  // mistake is a hull plate. It burns rock as readily as Klingons — the risk
  // is the same either way and the fantasy does not survive an arc that
  // politely ignores the thing about to kill you.
  var ARC_STANDOFF = 34, ARC_DPS = 2.6;
  // ── ramming speed ────────────────────────────────────────────────────────
  // The one card that changes what a collision *is*. Two things keep it from
  // being flat immunity to the field, which is the single most dangerous thing
  // you can hand a player in this game:
  //
  //  · it only arms at nearly full impulse, with the engines lit, against
  //    something you are actually driving at — a rock that clips your flank at
  //    a standstill still takes a hull plate;
  //  · every ram costs you most of your momentum, which disarms it. You cannot
  //    bulldoze a line through the field, because the first rock stops you
  //    dead in the middle of it and you have to build speed again.
  //
  // Capital ships are exempt. A dreadnought is not something you shunt.
  var RAM_BLEED = 0.45, RAM_ARC = 0.95;
  function ramThreshold(){ return 0.86 - 0.06 * (up.ram - 1); }
  function ramDamage(){ return 1 + 3 * up.ram + up.dmg; }
  // terminal speed falls out of thrust against the hull's own per-frame drag.
  // It used to assume 0.98 for every ship, which put the ram threshold out of
  // reach on any hull that bleeds speed faster than that.
  function terminalSpeed(){ return thrustPower() / (1 - hullMods().drag); }
  function ramArmed(tx, ty){
    if(up.ram <= 0 || !ship.thrusting) return false;
    var sp = Math.hypot(ship.vx, ship.vy);
    if(sp < terminalSpeed() * ramThreshold()) return false;
    // it has to be in front of where you are going, not where you are pointing:
    // a ram is a thing your momentum does
    return Math.abs(angDiff(Math.atan2(ty - ship.y, tx - ship.x),
                            Math.atan2(ship.vy, ship.vx))) < RAM_ARC;
  }
  // 0 to 1, for the renderer: a bow shield that fades in as the speed builds
  // tells the player where the threshold is. A shield that simply appears at
  // 86% tells them nothing until they have already guessed wrong once.
  function ramCharge(){
    if(up.ram <= 0 || !ship.thrusting) return 0;
    var need = terminalSpeed() * ramThreshold();
    return Math.max(0, Math.min(1, Math.hypot(ship.vx, ship.vy) / need));
  }
  function ramBleed(){
    ship.vx *= RAM_BLEED; ship.vy *= RAM_BLEED;
    burst(ship.x, ship.y, 12, '111,232,255');
    shake(0.3); freeze(0.03);
  }
  // ── the graze, the core, and overcharging it ─────────────────────────────
  // This ship had no button. Both guns fire themselves, the upgrades apply
  // themselves, and the whole input vocabulary was steering — which is fine
  // for a minute and thin for ten. What was missing was not another weapon: it
  // was a reason to fly *at* the field instead of around it, and something to
  // spend the nerve on once you had.
  //
  //   graze      · passing through a rock's shadow without touching it
  //                overcharges the warp core. Only ever while you are actually
  //                vulnerable — with a deflector up, or inside respawn
  //                invulnerability, nothing counts — so the meter can never be
  //                farmed from safety, which is the one way a mechanic like
  //                this quietly becomes free.
  //   overcharge · at a full core, one press lets it go. A surge of drive
  //                plasma sweeps out from the hull, burns through rock,
  //                warbirds and incoming fire alike, and leaves the phaser
  //                array overloaded for a few seconds afterwards.
  //
  // It was called "the vent" until Sep 2026 and nobody could work out what it
  // was for. "Overcharge" says both halves of it — the thing fills up, and
  // what it does when it is full is let go of what it filled up with.
  //
  // Charge is a flat award per graze rather than a rate per second, and the
  // difference matters: a rate pays for parking beside a rock, a flat award
  // pays for threading the field and coming out the other side. Kills pay a
  // trickle as well, so a player who never takes the risk still gets to vent
  // — slowly, and having earned it the duller way.
  var GRAZE_BAND = 32, GRAZE_FIRE_BAND = 17, GRAZE_COOL = 1.1;
  var CORE_MAX = 100;
  var CORE_ROCK = 5.5, CORE_SHIP = 9, CORE_FIRE = 5;
  var CORE_KILL_ROCK = 1.2, CORE_KILL_SHIP = 4, CORE_KILL_BOSS = 22;
  var SURGE_R = 320, SURGE_TIME = 0.42, SURGE_DMG = 4, SURGE_OVERLOAD = 3;
  var core = 0, overcharged = false, grazeTotal = 0, overchargeCount = 0;
  // how long the gauge keeps saying it fired. Long enough to be read on the
  // way past, short enough that it is gone before the core starts refilling.
  var RELEASE_SAY = 1.5;
  var releasedT = 0;
  var surges = [];

  function addCore(n){
    if(core >= CORE_MAX) return;
    core = Math.min(CORE_MAX, core + n);
    // Restart the gauge's flash on every charge. The forced reflow is what
    // makes a CSS animation replay, and this only runs on a graze or a kill,
    // so it is nowhere near a per-frame cost. Without it the gauge creeps up
    // silently and the player never connects the flying to the filling.
    if(coreEl){
      coreEl.classList.remove('charge');
      void coreEl.offsetWidth;
      coreEl.classList.add('charge');
    }
    if(core >= CORE_MAX && !overcharged){
      overcharged = true;
      // the one moment the core announces itself on the field rather than only
      // in the rail: the player's eyes are on the rock, not on the gauge
      bloom(ship.x, ship.y, 56, '125,249,255');
      sparks(ship.x, ship.y, 16, '125,249,255', 1.1);
      if(!overchargeCount){
        showTip('<span>Overcharge ready</span><span>' + (isCoarse
                  ? 'Tap <b>release</b> to let it go.'
                  : 'Press <b>space</b> to release it.') + '</span>', 6);
      }
    }
  }

  // Credited once per object per GRAZE_COOL, and the cooldown lives on the
  // object rather than on the ship: flying the length of one rock should pay
  // once, and threading four rocks should pay four times.
  function graze(o, amount, x, y){
    if(shieldTime > 0 || ship.invuln > 0) return;
    if(gameTime < (o.grazeT || 0)) return;
    o.grazeT = gameTime + GRAZE_COOL;
    grazeTotal++;
    sparks(x, y, 3, '125,249,255', 0.55);
    addCore(amount);
    teach('graze', '<span>Close pass</span><span>Near misses charge your overcharge.</span>', 5);
  }

  function tryOvercharge(){
    if(!overcharged || gameOver || isPaused()) return false;
    core = 0; overcharged = false;
    releasedT = gameTime + RELEASE_SAY;
    overchargeCount++;
    surges.push({ x: ship.x, y: ship.y, r: 0, max: SURGE_R, hit: [], t: 0 });
    // The overload is the same one the rare rock drops, deliberately: it reads
    // on the hull and in the bottom rail already, and a second vocabulary for
    // "the guns are hot" would only be a second thing to learn.
    rapidTime = Math.max(rapidTime, SURGE_OVERLOAD);
    bloom(ship.x, ship.y, 150, '125,249,255');
    burst(ship.x, ship.y, 34, '125,249,255', 1.6);
    shake(0.82); freeze(0.08);
    return true;
  }

  function surgeDamage(){ return SURGE_DMG + up.dmg * 2; }

  // The front expands and burns what it reaches in the order it reaches it —
  // the rock on the hull goes first and the far edge of the field goes last,
  // which is what makes it read as a pressure wave rather than as a circle of
  // things all ceasing to exist on the same frame. Each object is marked as it
  // is burned, so the front passes over it once however long it lingers.
  function updateSurges(dt){
    for(var i=surges.length-1;i>=0;i--){
      var v = surges[i];
      v.t += dt;
      v.r = v.max * Math.min(1, v.t / SURGE_TIME);
      var R2 = v.r * v.r, dmg = surgeDamage(), k, o, dx, dy;

      for(k=asteroids.length-1;k>=0;k--){
        o = asteroids[k];
        if(v.hit.indexOf(o.id) !== -1) continue;
        dx = o.x - v.x; dy = o.y - v.y;
        if(dx*dx + dy*dy > R2) continue;
        v.hit.push(o.id);
        o.hp -= dmg; o.hitT = 0.14;
        if(o.hp <= 0) killAsteroid(k);
      }
      for(k=aliens.length-1;k>=0;k--){
        o = aliens[k];
        if(v.hit.indexOf(o.id) !== -1) continue;
        dx = o.x - v.x; dy = o.y - v.y;
        if(dx*dx + dy*dy > R2) continue;
        v.hit.push(o.id);
        o.hitT = 0.14;
        if(alienHurt(o, dmg)) killAlien(k);
      }
      if(bossTargetable() && v.hit.indexOf(boss.id) === -1){
        dx = boss.x - v.x; dy = boss.y - v.y;
        if(dx*dx + dy*dy <= R2){
          v.hit.push(boss.id);
          // a capital ship is one target rather than forty, so the front does
          // not simply evaporate against it
          hurtBoss(dmg * 2, 0.14);
        }
      }
      for(k=alienBullets.length-1;k>=0;k--){
        var ab = alienBullets[k];
        dx = ab.x - v.x; dy = ab.y - v.y;
        if(dx*dx + dy*dy <= R2) alienBullets.splice(k,1);
      }

      if(v.t >= SURGE_TIME * 1.55) surges.splice(i,1);
    }
  }

  // ── the kill chain ───────────────────────────────────────────────────────
  // Score, and only score. It never touches XP, hull, drops or the spawn
  // table, so it cannot move the health economy the whole run is balanced on.
  // What it buys is a reason to keep pressing rather than to disengage and
  // circle — which is the difference between a shooter and a driving game.
  var CHAIN_WINDOW = 2.6, CHAIN_CAP = 25;
  var chain = 0, chainT = 0, chainBest = 0;
  function chainMult(){ return 1 + Math.min(chain, CHAIN_CAP) * 0.04; }
  function scored(n){
    chain++; chainT = CHAIN_WINDOW;
    if(chain > chainBest) chainBest = chain;
    bonus += Math.round(n * chainMult());
  }

  var SHIP_RADIUS = 9, INVULN = 1.1, RESPAWN_INVULN = 2.2;
  var START_LIVES = 3, MAX_LIVES = 5;
  // Rock is ~70% of all damage taken, so this pair is the field's pressure
  // almost by itself. It was 20/54, which filled the view faster than the
  // guns could ever clear it and read as the rocks taking the run over.
  var START_ROCKS = 15, MAX_ROCKS = 34;
  var BULLET_LIFE = 1.35, MAX_STEP = 3;
  // how far past each edge of the view the rock field extends, in screens. The
  // population lives in a band of (1 + 2 x BAND_PAD) screens, so roughly 40% of
  // it is in front of the player at any moment.
  var BAND_PAD = 0.75;

  var active = false, raf = null, keys = {}, docH = 0;
  // analog touch input: the stick steers and throttles, and that is the whole
  // touch vocabulary now — the guns look after themselves
  var pad = { angle: 0, mag: 0 };
  var isCoarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  // Reduced motion is honoured on the canvas, not only in the stylesheet. Four
  // things in here strobe, and two of them sit in the band that actually
  // matters: the respawn blink runs at ~6.5Hz and the boss charge telegraph at
  // ~2.9Hz. A CSS media query cannot reach any of them, so the flag is read
  // here and each effect resolves to a steady state instead of being switched
  // off — the information they carry (invulnerable, winding up, low hull) still
  // has to reach the player.
  var motionQ = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduceMotion = !!(motionQ && motionQ.matches);
  if(motionQ && motionQ.addEventListener){
    motionQ.addEventListener('change', function(e){ reduceMotion = e.matches; });
  }
  var ship, bullets, particles, destroyed, asteroids, pickups;
  // torpedoes fly in their own list because they are the only projectile that
  // survives its first contact long enough to detonate, and shockwaves are
  // pure decoration with a damage pass already applied when they were born
  var torpedoes = [], shockwaves = [], mines = [];

  // ── the language of impact ───────────────────────────────────────────────
  // Everything below this line is presentation, and all of it speaks the same
  // three-word grammar so that a phaser hit, a warbird going up and a capital
  // ship breaking apart read as the same event at three volumes:
  //
  //   bloom   · the flash. What turns "the rock stopped being drawn" into
  //             "the rock blew up".
  //   trauma  · the shake. Squared on its way to an offset, which is the whole
  //             trick — otherwise a graze and a dreadnought rattle the screen
  //             by about the same amount and neither one means anything.
  //   freeze  · the held frame. Weight, bought for a fifteenth of a second.
  //
  // None of it touches the simulation. freeze() in particular stops the run
  // clock along with everything else, so the beat it buys is not paid for in
  // difficulty, score or cooldowns.
  var blooms = [];
  var trauma = 0, hitStop = 0;
  var SHAKE_MAX = 15, TRAUMA_DECAY = 2.0, HITSTOP_MAX = 0.11;
  function shake(a){
    if(reduceMotion) return;
    trauma = Math.min(1, trauma + a);
  }
  function freeze(s){
    if(reduceMotion) return;
    hitStop = Math.min(HITSTOP_MAX, Math.max(hitStop, s));
  }
  function bloom(x, y, r, rgb){
    // spin and spoke count are rolled once, so the spikes hold still for the
    // tenth of a second the flash lasts instead of strobing
    blooms.push({ x:x, y:y, max:r, life:1, rgb: rgb || '255,238,200',
                  spin: Math.random() * Math.PI, n: 6 + Math.floor(r / 14) });
  }

  // A blit is only a straight copy while its destination lands on whole
  // device pixels, and the camera eases — so camY, and every parallax offset
  // taken off it, is fractional on nearly every frame. Everything that
  // positions a baked layer goes through snap() first. See the note above
  // bakeSky() for what it is worth.
  var viewDpr = 1;
  function snap(v){ return Math.round(v * viewDpr) / viewDpr; }

  // ── an honest frame budget ───────────────────────────────────────────────
  // The backdrop is two full-screen blits, and on a canvas that is not
  // GPU-accelerated that is comfortably the most expensive thing in the frame:
  // measured at about 8ms against 3.6ms for the entire rest of the field. So
  // rather than guess which machines can afford it, the run measures itself.
  // A rolling average of the frame interval, sampled only on frames that were
  // actually simulated — a stalled tab or a sleeping laptop is not a
  // measurement — and if it settles below roughly 38fps the backdrop goes and
  // everything else stays exactly as it is. It never comes back: a background
  // that flickers in and out as the field thins is worse than either state,
  // and without the backdrop the canvas simply clears to the dimmed page the
  // way it always used to.
  // Two steps now, cheapest-to-lose first. If the average settles below ~48fps
  // the canvas drops to 1x resolution (a one-off repaint of the hull
  // sprites), which cuts the fill cost of everything; only if it is STILL
  // below ~38fps a few seconds later does the backdrop go too.
  var frameAvg = 0, frameSamples = 0, backdropOn = true, lowRes = false;
  function budget(dt){
    if(dt <= 0 || dt > 0.05) return;
    frameAvg += (dt - frameAvg) * 0.05;
    if(!backdropOn || ++frameSamples < 180) return;
    if(!lowRes && frameAvg > 0.021 && viewDpr > 1){
      lowRes = true; frameSamples = 0;
      resize(); prebakeHulls();
      return;
    }
    if(frameAvg > 0.026) backdropOn = false;
  }

  // ── deep space ───────────────────────────────────────────────────────────
  // The canvas used to clear to nothing and let the dimmed page show through,
  // which meant that flying flat out across an empty stretch of sector looked
  // exactly like sitting still. Two layers fix that: a baked backdrop of cloud
  // and stars, and a live near layer that streaks along the ship's own
  // velocity — which is the speed readout this game never had. At full impulse
  // the near stars draw as lines and you can feel the throttle without a gauge.
  //
  // There was a third: a planet in the middle distance, and a graticule of
  // range rings centred on the ship. Both are gone at James's request. They
  // were doing real work — depth, and a sense of distance — but the sector is
  // the backdrop to a fight, not the subject of one, and between them they
  // were the two biggest things on screen that the player never had to look at.
  //
  // TWO RULES GOVERN ALL OF IT, and between them they are worth more than the
  // entire rest of the frame. Both were learned the expensive way: the first
  // build of this layer ran the game at 29fps.
  //
  // 1 · A baked layer is baked at DEVICE resolution and blitted at exactly its
  //     own size, onto whole device pixels. A drawImage is a straight copy
  //     only under those conditions; miss any of them and it is resampled.
  //     Measured here, for the same five full-screen blits:
  //
  //         whole device pixels ................  3.2ms
  //         fractional destination ............. 26.2ms
  //         inside a 0.07-degree rotation ...... 33.7ms
  //
  //     The camera eases, so camY is fractional on nearly every frame and so
  //     is every parallax offset derived from it — hence snap() on every
  //     destination. The shake is snapped for the same reason and has no
  //     rotation at all.
  //
  // 2 · Count the full-screen blits, because a canvas that is not
  //     GPU-accelerated pays for every one of them in fill rate. This layer
  //     started as five — a nebula, two star layers of two tiles each — and it
  //     is now two, because the parallax that separated them was not buying
  //     anything: at a tenth of the scroll, across a nine-thousand-pixel page,
  //     the star layer travels about nine hundred pixels over an ENTIRE RUN.
  //     Nobody can perceive a parallax difference against a background that
  //     moves nine hundred pixels in ten minutes, so the cloud and the stars
  //     are baked into one tile and share one rate. What actually sells the
  //     depth is the near layer, which moves six times faster and is live.
  var SKY_B = 20;                       // bleed, so the shake never opens a bare edge
  var skyTile = null, skyH = 0;
  var motes = [], moteH = 900;
  var skyW = 0, skyVH = 0, skyDpr = 0;  // the viewport the current bake was cut for

  function bakeLayer(wCss, hCss, paint){
    var c = document.createElement('canvas');
    if(!c || !c.getContext) return null;
    // Baked at exactly the canvas's resolution. It used to be min(3, dpr)
    // against a canvas capped lower, so on a 3x phone every frame resampled
    // the sky down to the canvas — the most expensive blit there is.
    var d = viewDpr;
    c.width  = Math.max(1, Math.round(wCss * d));
    c.height = Math.max(1, Math.round(hCss * d));
    var g = c.getContext('2d');
    if(!g || !g.scale) return null;
    g.scale(d, d);
    paint(g, wCss, hCss);
    return c;
  }

  function paintNebula(g, w, h){
    if(!g.createRadialGradient) return;
    // Violet and teal, the two colours the rocks and the LCARS chrome already
    // carry. Nothing in here goes near the hot pink: that is the alert colour
    // and it has to stay the only thing on screen wearing it.
    var clouds = [[0.28,0.16,0.5,'92,58,190'], [0.78,0.42,0.42,'0,136,178'],
                  [0.44,0.72,0.38,'132,52,168'], [0.08,0.58,0.34,'32,104,160']];
    // Every cloud is painted three times — in place, and one tile-height above
    // and below. The tile repeats vertically, and a cloud that simply stops at
    // the tile edge draws a hard horizontal line straight across the sky when
    // the seam scrolls into view. It DOES scroll into view: at a tenth of the
    // scroll across a nine-thousand-pixel page the backdrop travels about nine
    // hundred pixels, and the tile is nine hundred and twenty-eight tall, so
    // the seam crosses the screen roughly once a run. This is what makes the
    // tile wrap seamlessly; the stars need no such help, being noise.
    for(var i=0;i<clouds.length;i++){
      var cl = clouds[i], cx = cl[0]*w, r = cl[2]*Math.max(w, h);
      for(var k=-1;k<=1;k++){
        var cy = cl[1]*h + k*h;
        var gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        // a quarter down from where this started. The cloud is the room the
        // fight happens in, and it was lit about as brightly as the fight.
        gr.addColorStop(0,    'rgba(' + cl[3] + ',.19)');
        gr.addColorStop(0.55, 'rgba(' + cl[3] + ',.065)');
        gr.addColorStop(1,    'rgba(' + cl[3] + ',0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }
    }
  }

  function paintBackdrop(g, w, h){
    paintNebula(g, w, h);
    // Weighted hard toward plain white. A sky where every star is tinted reads
    // as confetti; two in thirty reads as a sky with some colour in it. Three
    // sizes, because one plane of identical dots is what a starfield looks
    // like when it has been generated rather than drawn.
    var n = Math.round(w * h / 2100);
    for(var i=0;i<n;i++){
      var far = Math.random();
      var s = far < 0.62 ? 0.45 + Math.random()*0.35
                         : (far < 0.92 ? 0.8 + Math.random()*0.5 : 1.3 + Math.random()*0.7);
      var a = far < 0.62 ? 0.16 + Math.random()*0.24
                         : (far < 0.92 ? 0.34 + Math.random()*0.3 : 0.6 + Math.random()*0.35);
      var tint = Math.random();
      var col = tint > 0.94 ? '125,249,255' : (tint > 0.88 ? '199,125,255' : '226,233,255');
      g.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')';
      g.beginPath(); g.arc(Math.random()*w, Math.random()*h, s, 0, Math.PI*2); g.fill();
    }
  }

  function bakeSky(){
    var W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    skyW = W; skyVH = H; skyDpr = viewDpr;
    // a tile one screen plus a margin tall always covers the view in exactly
    // two blits, whatever offset the scroll lands on
    skyH = H + 160;
    skyTile = bakeLayer(W + SKY_B * 2, skyH, paintBackdrop);
    // the live band has to be at least a screen tall or motes wrap inside the
    // view, which reads as stars popping in and out of existence
    moteH = Math.max(760, H + 240);
    motes = [];
    for(var i=0; i<Math.round(W / 22); i++){
      motes.push({ x: Math.random()*W, y: Math.random()*moteH, r: 0.55 + Math.random()*1.15 });
    }
  }

  // ── the run clock ────────────────────────────────────────────────────────
  // gameTime only advances on frames we actually simulate, so switching tabs,
  // sleeping the laptop or opening an upgrade card costs nothing and gains
  // nothing. Everything — score, difficulty, cooldowns, drop timers — reads it.
  var gameTime = 0, lastFrame = 0, autoPaused = false, levelOpen = false;
  function isPaused(){ return autoPaused || levelOpen || hailOpen; }

  // ── Red Alert ────────────────────────────────────────────────────────────
  // Below a third of the hull the ship goes to red alert: the screen edges
  // pulse and the sector gets busier. It is a real risk multiplier, not just a
  // light — but it only ever fires when the run is already going badly, and it
  // clears the moment a repair lands, so it reads as a comeback state rather
  // than a death spiral. RED_ALERT_AT is a fraction of MAX_LIVES so it tracks
  // the hull the player actually has rather than a hard-coded life count.
  // The pressure is deliberately mild. Red alert only ever fires from a losing
  // position, so anything heavier stops being an adrenaline spike and becomes a
  // trapdoor — the run is already at one hull and cannot answer more traffic.
  // Measured hull loss inside the alert runs ~2.8x the rate outside it even
  // with these multipliers set to nothing, so the drama can come from the
  // presentation and the spawn table can stay close to neutral.
  var RED_ALERT_AT = 0.3, RED_ALERT_SPAWN = 0.85, RED_ALERT_ROCKS = 2;
  var redAlert = false;
  function redAlertActive(){ return lives > 0 && lives <= Math.floor(MAX_LIVES * RED_ALERT_AT + 0.001); }

  // ── continuous progression ───────────────────────────────────────────────
  // The field's pressure is a smooth function of gameTime, so it rises every
  // second rather than in visible steps. The player's own power curve is the
  // opposite: it moves in discrete jumps, one per level. The run is the race
  // between the two.
  // PAST_OPEN is the extra pressure layered on after the first minute (Sep
  // 2026, "slightly too easy"). The opening minute is left exactly as it was
  // on purpose: raising it once made the first minute 80% more lethal and read
  // as a worse game rather than a harder one. From a minute in, rock gets a
  // little faster, one more rock every half minute, and one more hull is
  // allowed on the field. Measured with the scripted pilot, runs came out
  // about a fifth shorter than before the upgrade pacing changed.
  var PAST_OPEN = 60;
  function pastOpen(t){ return Math.max(0, t - PAST_OPEN); }
  function speedMultAt(t){ return Math.min(5.4, 1.30 + t * 0.015 + pastOpen(t) * 0.004); }
  function rockTargetAt(t){
    return Math.min(MAX_ROCKS, START_ROCKS + Math.floor(t / 16) + Math.floor(pastOpen(t) / 30));
  }
  function alienInterval(t){ return Math.max(2.4, 7.5 - t * 0.030); }
  // Every hull on the field now fires slower than it used to. That is what
  // pays for there being two to three times as many of them: the run should
  // read as more ships, not as more plasma.
  function alienCooldown(t){ return Math.max(0.70, 2.2 - t * 0.009); }
  function alienSpread(t){   return Math.max(0.07, 0.26 - t * 0.0014); }
  function alienBulletSpeed(t){ return Math.min(5.6, 3.1 + t * 0.012); }
  // The warbird count is the one curve with no ceiling. Everything else flattens
  // out inside five minutes, and a run whose pressure stops climbing is a run
  // you can settle into and hold forever — which is what this one was doing.
  function alienMax(t){ return Math.min(9, 3 + Math.floor(t / 24) + (t > PAST_OPEN ? 1 : 0)); }
  function alienHpScale(t){ return 1 + Math.min(1.7, t / 125); }
  // Rocks harden slowly, so Heavy Rounds still earns its slot at minute four
  // instead of one-shotting the entire field from level three onwards.
  function rockHp(r, t){
    return r >= 22 ? Math.min(5, 2 + Math.floor(t / 95)) : (t > 150 ? 2 : 1);
  }

  // ── the enemy roster ─────────────────────────────────────────────────────
  // Seven hulls across five factions, unlocked on the clock, and the point of
  // every one of them is that it asks a DIFFERENT question. A roster of
  // reskins is one encounter with four paint jobs; what makes a sky worth
  // flying through is that the answer which just worked stops working.
  //
  //   scout   · Klingon Bird-of-Prey. Strafes past, takes pot shots. The
  //             baseline, and the thing every other hull is a departure from.
  //   raptor  · Klingon K'Tinga. Does not circle and does not track: it lines
  //             up, commits to a run straight THROUGH you at speed, shoots
  //             only while it is on that line, then coasts out and comes back.
  //             Briefly harmless, briefly lethal, on a rhythm you can learn.
  //   lancer  · Cardassian Galor. A slow platform that fires in fans. Answered
  //             by getting out of the cone rather than out of the way.
  //   stalker · Klingon Bird-of-Prey, heavy. Steers at you and leads its
  //             shots — the first hull that a straight line away does not beat.
  //   warbird · Romulan Warbird. Never closes: holds station at four hundred
  //             pixels and slides sideways to keep it, so flying away does
  //             nothing. Lobs one slow plasma torpedo that follows you — and
  //             that you can SHOOT DOWN, which is the only enemy ordnance in
  //             the game your guns can answer.
  //   drone   · Borg cube. Straight at you, slowly, for ever. Does not dodge,
  //             does not lead, does not break off, takes a great deal of
  //             killing — and ADAPTS, taking half damage once it has absorbed
  //             enough, so the answer is to kill it quickly or not at all.
  //             Cuts with a tracking beam rather than shooting.
  //   weaver  · Tholian web ship. Is not trying to hit you at all. It flies to
  //             a point, stops, spins a web, and leaves. The web is what hurts
  //             you, and the shape of the field has changed. Killing it before
  //             the web sets is the entire interaction.
  //
  // `cap` is how many of a kind may be on the field at once, and it is doing
  // real work: two Borg cubes is pressure, four is a wall, and one web is an
  // obstacle where three is a cage.
  var ALIEN_TYPES = {
    scout:   { r:15, hp:2, speed:1.55, bonus:150, heart:0.28, gems:1, bob:26,
               rgb:'255,122,99', stroke:'#ff7a63', at:0, weight:3, cd:1.00, shots:1,
               cap:4, faction:'Klingon' },
    raptor:  { r:17, hp:4, speed:1.35, bonus:300, heart:0.30, gems:2, bob:0,
               rgb:'255,122,99', stroke:'#ff8f6e', at:40, weight:2, cd:1.00, shots:2,
               cap:2, faction:'Klingon', move:'run', fire:'burst', face:'heading' },
    lancer:  { r:19, hp:5, speed:0.95, bonus:280, heart:0.36, gems:2, bob:15,
               rgb:'240,168,72', stroke:'#f0a848', at:70, weight:2, cd:1.55, shots:3,
               cap:2, faction:'Cardassian' },
    warbird: { r:21, hp:6, speed:1.05, bonus:420, heart:0.34, gems:3, bob:0,
               rgb:'96,224,150', stroke:'#7fd6a6', at:95, weight:2, cd:2.30, shots:1,
               cap:2, faction:'Romulan', move:'standoff', fire:'plasma', ttl:22, face:'heading' },
    stalker: { r:16, hp:4, speed:1.15, bonus:340, heart:0.40, gems:2, bob:0,
               rgb:'255,122,99', stroke:'#ff7a63', at:115, weight:2, cd:1.30, shots:1,
               cap:2, faction:'Klingon', move:'chase', fire:'lead', ttl:24, face:'heading' },
    drone:   { r:20, hp:14, speed:0.52, bonus:520, heart:0.42, gems:3, bob:0,
               rgb:'126,255,110', stroke:'#8fb4c9', at:138, weight:2, cd:1.00, shots:0,
               cap:2, faction:'Borg', move:'grind', fire:'beam', face:'none', plume:false },
    weaver:  { r:15, hp:3, speed:1.45, bonus:380, heart:0.30, gems:2, bob:0,
               rgb:'255,159,67', stroke:'#ff9f43', at:158, weight:2, cd:1.00, shots:0,
               cap:1, faction:'Tholian', move:'anchor', fire:'none', face:'heading' }
  };  // ── the two hazards that are not bullets ─────────────────────────────────
  // A Borg cutting beam and a Tholian web are both area denial rather than
  // projectiles, and both needed their own collision: a ray and a set of line
  // segments. Between them they are the only things on the field you cannot
  // answer by shooting at the thing that made them.
  var PLASMA_SPEED = 2.2, PLASMA_TURN = 1.05, PLASMA_HP = 3, PLASMA_R = 8;
  var BEAM_WIND = 1.05, BEAM_FIRE = 1.35, BEAM_LEN = 540, BEAM_W = 7, BEAM_TRACK = 0.85;
  var WEB_SPIN = 1.5, WEB_R = 86, WEB_LIFE = 12, WEB_W = 6, WEB_GROW = 0.55;
  // Damage absorbed before a cube halves what it takes. It has to be well
  // UNDER the cube's own hull or the adaptation never happens at all: at 16
  // against 14 hull the thing simply died first, every time, and the most
  // characterful mechanic in the roster was unreachable. At 6 the cube costs
  // about 22 damage to kill and announces, visibly and halfway through, that
  // it has started resisting.
  var BORG_ADAPT = 6;
  var webs = [];

  // shortest distance from a point to a ray of finite length
  function rayDist(px, py, ax, ay, ang, len){
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var k = (px - ax) * dx + (py - ay) * dy;
    if(k < 0) k = 0; else if(k > len) k = len;
    return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
  }

  // and to a line segment
  function segDist(px, py, x1, y1, x2, y2){
    var dx = x2 - x1, dy = y2 - y1;
    var L = dx*dx + dy*dy;
    var k = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
    if(k < 0) k = 0; else if(k > 1) k = 1;
    return Math.hypot(px - (x1 + dx * k), py - (y1 + dy * k));
  }

  function spawnWeb(x, y, life, grow){
    var n = 7, pts = [], segs = [], i;
    for(i=0;i<n;i++){
      var a = i / n * Math.PI * 2 + Math.random() * 0.25;
      var rr = WEB_R * (0.82 + Math.random() * 0.36);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    for(i=0;i<n;i++) segs.push([pts[i][0], pts[i][1], pts[(i+1)%n][0], pts[(i+1)%n][1]]);
    // chords across the middle, which is what makes it a web and not a hoop
    for(i=0;i<n;i++) segs.push([pts[i][0], pts[i][1], pts[(i+3)%n][0], pts[(i+3)%n][1]]);
    // capped, oldest first: a Tholian flagship spins cages faster than they
    // expire, and a screen of overlapping webs is a wall, not a fight
    if(webs.length >= 9) webs.shift();
    webs.push({ x:x, y:y, pts:pts, segs:segs, life: life || WEB_LIFE, grow:0, growT: grow || WEB_GROW });
    shake(0.18);
  }

  function updateWebs(dt){
    for(var i=webs.length-1;i>=0;i--){
      var w = webs[i];
      if(w.grow < 1) w.grow = Math.min(1, w.grow + dt / (w.growT || WEB_GROW));
      w.life -= dt;
      if(w.life <= 0){ webs.splice(i,1); continue; }
      // it only bites once it has finished drawing itself, so the wind-up is
      // a real warning rather than a decoration on top of a hit
      if(w.grow < 1 || ship.invuln > 0 || shieldTime > 0) continue;
      if(Math.hypot(ship.x - w.x, ship.y - w.y) > WEB_R * 1.5) continue;
      for(var s=0;s<w.segs.length;s++){
        var g = w.segs[s];
        if(segDist(ship.x, ship.y, g[0], g[1], g[2], g[3]) < WEB_W + SHIP_RADIUS){
          burst(ship.x, ship.y, 12, '255,159,67');
          // Return, not break: a hit that respawns the ship tears down the
          // webs around the respawn point, so the list this loop is walking
          // has just changed under it. Carrying on read past its end and
          // threw, which stopped the whole game. Nothing else can hit a hull
          // that has just been given its respawn grace anyway.
          hitShip('fire');
          return;
        }
      }
    }
  }

  // Beams live on the cube that fired them rather than in a list of their own:
  // there is only ever one per hull, it starts at the hull, and it dies with
  // it — which is exactly the lifetime an object on the emitter already has.
  function updateBeams(dt, sf, t){
    for(var i=0;i<aliens.length;i++){
      var al = aliens[i];
      if(!al.beamT) continue;
      al.beamT -= dt;
      if(al.beamT <= 0){ al.beamT = 0; continue; }
      var want = Math.atan2(ship.y - al.y, ship.x - al.x);
      al.beamAng += angDiff(want, al.beamAng) * (1 - Math.pow(1 - BEAM_TRACK * dt, sf));
      if(al.beamT > BEAM_FIRE) continue;             // still winding up
      if(ship.invuln > 0 || shieldTime > 0) continue;
      if(rayDist(ship.x, ship.y, al.x, al.y, al.beamAng, BEAM_LEN) < BEAM_W + SHIP_RADIUS){
        burst(ship.x, ship.y, 14, ALIEN_TYPES[al.kind].rgb);
        hitShip('fire');
      }
    }
  }

  function drawWebs(camY){
    if(!webs.length) return;
    ctx.save();
    for(var i=0;i<webs.length;i++){
      var w = webs[i];
      var fade = Math.min(1, w.life / 2.5);
      var a = (w.grow < 1 ? w.grow * 0.5 : 0.5) * fade;
      // the strands draw themselves outward from the anchor while it spins,
      // so a half-built web is visibly half-built
      ctx.strokeStyle = 'rgba(199,125,255,' + (a + 0.25 * fade).toFixed(3) + ')';
      ctx.shadowColor = '#c77dff';
      ctx.shadowBlur = w.grow < 1 ? 6 : 10;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for(var s=0;s<w.segs.length;s++){
        var g = w.segs[s];
        ctx.moveTo(g[0], g[1] - camY);
        ctx.lineTo(g[0] + (g[2] - g[0]) * w.grow, g[1] + (g[3] - g[1]) * w.grow - camY);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // anchors
      ctx.fillStyle = 'rgba(255,159,67,' + (0.7 * fade).toFixed(3) + ')';
      for(var p=0;p<w.pts.length;p++){
        ctx.beginPath();
        ctx.arc(w.pts[p][0], w.pts[p][1] - camY, 2.2, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── drawing the capital ships and their wings ────────────────────────────
  // A ray in the cutting-beam grammar: a hairline telegraph while it winds
  // up, then a three-layer beam that snaps off rather than fading.
  function drawRay(x, y, ang, len, winding, wind, hot, rgb){
    var ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    if(winding){
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.14 + 0.3 * wind).toFixed(3) + ')';
      ctx.lineWidth = 1 + wind * 1.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.3 * hot).toFixed(3) + ')';
      ctx.lineWidth = BEAM_W * 2.4 * hot;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.85 * hot).toFixed(3) + ')';
      ctx.lineWidth = BEAM_W * hot;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 * hot).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, BEAM_W * 0.34 * hot);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.restore();
  }

  // The wing's own telegraphs: the beams strung between hulls, and the point
  // a Klingon pincer is about to dive through. Drawn under the hulls.
  function drawWings(camY){
    if(!wings.length) return;
    var pulse = reduceMotion ? 1 : 0.5 + 0.5 * Math.sin(gameTime * 14);
    for(var wi=0; wi<wings.length; wi++){
      var w = wings[wi];
      if(w.done) continue;
      var rgb = ALIEN_TYPES[w.kind].rgb, i, al;
      if(w.pattern === 'pincer' && w.phase === 'mark'){
        ctx.save();
        if(ctx.setLineDash) ctx.setLineDash([5, 7]);
        ctx.lineDashOffset = reduceMotion ? 0 : -gameTime * 70;
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.3 + 0.35 * pulse).toFixed(3) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for(i=0;i<w.slots.length;i++){
          al = w.slots[i]; if(!al) continue;
          ctx.moveTo(al.x, al.y - camY); ctx.lineTo(w.tx, w.ty - camY);
        }
        ctx.stroke();
        if(ctx.setLineDash) ctx.setLineDash([]);
        // the point itself: where not to be in a second's time
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.5 + 0.4 * pulse).toFixed(3) + ')';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(w.tx, w.ty - camY, 24, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w.tx - 34, w.ty - camY); ctx.lineTo(w.tx - 14, w.ty - camY);
        ctx.moveTo(w.tx + 14, w.ty - camY); ctx.lineTo(w.tx + 34, w.ty - camY);
        ctx.moveTo(w.tx, w.ty - camY - 34); ctx.lineTo(w.tx, w.ty - camY - 14);
        ctx.moveTo(w.tx, w.ty - camY + 14); ctx.lineTo(w.tx, w.ty - camY + 34);
        ctx.stroke();
        ctx.restore();
      }
      var segs = wingTethers(w);
      if(!segs.length || (!w.lit && !w.arming)) continue;
      ctx.save();
      ctx.lineCap = 'round';
      if(w.lit){
        ctx.globalCompositeOperation = 'lighter';
        var passes = [[TETHER_W * 2.4, 0.26], [TETHER_W, 0.8]];
        for(var p=0;p<passes.length;p++){
          ctx.strokeStyle = 'rgba(' + rgb + ',' + passes[p][1] + ')';
          ctx.lineWidth = passes[p][0];
          ctx.beginPath();
          for(i=0;i<segs.length;i++){ ctx.moveTo(segs[i][0].x, segs[i][0].y - camY); ctx.lineTo(segs[i][1].x, segs[i][1].y - camY); }
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for(i=0;i<segs.length;i++){ ctx.moveTo(segs[i][0].x, segs[i][0].y - camY); ctx.lineTo(segs[i][1].x, segs[i][1].y - camY); }
        ctx.stroke();
      } else {
        // arming: the line is there before it can hurt, so it can be read
        if(ctx.setLineDash) ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = reduceMotion ? 0 : -gameTime * 40;
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.22 + 0.25 * pulse).toFixed(3) + ')';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for(i=0;i<segs.length;i++){ ctx.moveTo(segs[i][0].x, segs[i][0].y - camY); ctx.lineTo(segs[i][1].x, segs[i][1].y - camY); }
        ctx.stroke();
        if(ctx.setLineDash) ctx.setLineDash([]);
      }
      ctx.restore();
    }
  }

  function drawTractorBeam(b, camY){
    if(b.tractorT <= 0) return;
    var rgb = BOSS_TYPES[b.fac].rgb, y = b.y - camY, sy = ship.y - camY;
    ctx.save();
    if(b.lockT > 0){
      // the lock: a thin line reaching for the hull, pulsing as it tightens
      var k = 1 - b.lockT / TRACTOR_LOCK;
      if(ctx.setLineDash) ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = reduceMotion ? 0 : gameTime * 60;
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.25 + 0.5 * k).toFixed(3) + ')';
      ctx.lineWidth = 1 + k * 1.5;
      ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(ship.x, sy); ctx.stroke();
      if(ctx.setLineDash) ctx.setLineDash([]);
    } else {
      // the pull: a cone from the hull to the ship, dragging inward
      var a = Math.atan2(sy - y, ship.x - b.x), px = -Math.sin(a), py = Math.cos(a);
      var wBase = b.r * 0.5, wTip = 14;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(' + rgb + ',.16)';
      ctx.beginPath();
      ctx.moveTo(b.x + px * wBase, y + py * wBase);
      ctx.lineTo(ship.x + px * wTip, sy + py * wTip);
      ctx.lineTo(ship.x - px * wTip, sy - py * wTip);
      ctx.lineTo(b.x - px * wBase, y - py * wBase);
      ctx.closePath(); ctx.fill();
      if(ctx.setLineDash) ctx.setLineDash([2, 9]);
      ctx.lineDashOffset = reduceMotion ? 0 : gameTime * 90;      // it flows toward the cube
      ctx.strokeStyle = 'rgba(' + rgb + ',.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ship.x, sy); ctx.lineTo(b.x, y); ctx.stroke();
      if(ctx.setLineDash) ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawCapital(b, camY){
    var BT = BOSS_TYPES[b.fac];
    // the telegraph: the hull whites out and swells for the beat before a
    // Klingon charge commits, which is the whole reason a charge is survivable
    var winding = b.phase === 'charge' && !b.charged;
    // under reduced motion it holds at full rather than disappearing
    var flash = winding ? (reduceMotion ? 1 : 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 18))) : 0;
    // The lane. For the whole wind-up a dashed line runs from her bow to
    // your hull, which is where she will come, so the dodge is a sidestep
    // out of a line you can see rather than a guess about when the flash
    // ends. Gold, the colour of the burst she commits with.
    if(winding){
      ctx.save();
      if(ctx.setLineDash) ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = reduceMotion ? 0 : -gameTime * 60;
      ctx.strokeStyle = 'rgba(255,209,102,' + (0.2 + 0.28 * flash).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y - camY); ctx.lineTo(ship.x, ship.y - camY); ctx.stroke();
      if(ctx.setLineDash) ctx.setLineDash([]);
      ctx.restore();
    }
    drawTractorBeam(b, camY);
    for(var bi=0; bi<b.beams.length; bi++){
      var bm = b.beams[bi], wnd = bm.t > bm.fire;
      drawRay(b.x, b.y - camY, bm.ang, BEAM_LEN * 1.15, wnd,
              wnd ? 1 - (bm.t - bm.fire) / BEAM_WIND : 1, Math.min(1, bm.t / 0.18), BT.rgb);
    }

    var crgb = b.enraged ? '255,77,109' : BT.rgb;
    var R = b.r;

    // A cloak is a shimmer the eye can follow, never a hole: the hull fades
    // to a ghost and a thin ring breathes around where she is.
    if(b.cloak > 0.02){
      ctx.save();
      ctx.strokeStyle = 'rgba(' + BT.rgb + ',' + (0.1 + 0.12 * Math.sin(gameTime * 7) * b.cloak + 0.1).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      if(ctx.setLineDash) ctx.setLineDash([2, 6]);
      ctx.lineDashOffset = reduceMotion ? 0 : gameTime * 20;
      ctx.beginPath(); ctx.arc(b.x, b.y - camY, R * 1.15, 0, Math.PI*2); ctx.stroke();
      if(ctx.setLineDash) ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 1 - 0.9 * b.cloak;
    ctx.translate(b.x, b.y - camY);
    ctx.lineJoin = 'round';

    // Exhaust first, under the hull; then the painted hull (paintKlingonCap,
    // paintWinged or paintCube at capital scale — the faction's escort,
    // built big); then what moves on it. A Klingon's engines go to full
    // during a charge, which is a second telegraph on top of the flash.
    var FR = BT.hull === 'drone' ? R * 1.25 : (b.fac === 'klingon' ? R : R * 1.12);
    // a cube has no bow, and its sprite is drawn in perspective, so it is
    // never turned
    if(BT.hull !== 'drone') ctx.rotate(b.face);
    ctx.scale(HULL_VIS * (1 + flash * 0.06), HULL_VIS * (1 + flash * 0.06));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if(b.fac === 'klingon'){
      var burn = winding ? 1 : 0.45 + 0.1 * Math.sin(gameTime * 3);
      plumeTrail(-R*0.72, 0,        R * (1.1 + burn * 1.5), R*0.15, crgb, 0.5 * burn + 0.2);
      plumeTrail(-R*0.62, -R*0.30, R * (0.8 + burn * 1.1), R*0.09, crgb, 0.45 * burn + 0.15);
      plumeTrail(-R*0.62,  R*0.30, R * (0.8 + burn * 1.1), R*0.09, crgb, 0.45 * burn + 0.15);
      plumeTrail(-R*0.86, -R*0.62, R * (0.6 + burn * 0.9), R*0.07, crgb, 0.35 * burn + 0.12);
      plumeTrail(-R*0.86,  R*0.62, R * (0.6 + burn * 0.9), R*0.07, crgb, 0.35 * burn + 0.12);
    } else if(ALIEN_TYPES[BT.hull].plume !== false){
      var eb = 0.5 + 0.12 * Math.sin(gameTime * 3);
      plumeTrail(-FR*0.62, 0, FR * (1.5 + eb), FR*0.15, crgb, 0.5);
      plumeTrail(-FR*0.56, -FR*0.34, FR * (0.9 + eb * 0.6), FR*0.08, crgb, 0.34);
      plumeTrail(-FR*0.56,  FR*0.34, FR * (0.9 + eb * 0.6), FR*0.08, crgb, 0.34);
    }
    ctx.restore();
    blit(capitalSprite(b, b.enraged ? 'rage' : ''));
    // the hit flash and the charge telegraph: the hull whites out
    // Under a steady stream of phaser fire hitT never reaches zero, so a
    // strong hit flash turned the flagship white for the whole fight and hid
    // the painted hull. A light tint for hits; the full whiteout is kept for
    // the charge telegraph, which is information.
    var whiteout = Math.max(b.hitT > 0 ? 0.28 * Math.min(1, b.hitT / 0.12) : 0, flash * 0.75);
    if(whiteout > 0) blit(capitalSprite(b, 'mask'), whiteout);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if(b.fac === 'tholian'){
      // the web the ship is always spinning, around it
      ctx.strokeStyle = 'rgba(199,125,255,.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(var k=0;k<8;k++){
        var wa = k / 8 * Math.PI * 2 + gameTime * 0.6, wb = (k + 3) / 8 * Math.PI * 2 + gameTime * 0.6;
        ctx.moveTo(Math.cos(wa) * FR * 1.35, Math.sin(wa) * FR * 1.35);
        ctx.lineTo(Math.cos(wb) * FR * 1.35, Math.sin(wb) * FR * 1.35);
      }
      ctx.stroke();
    } else if(b.fac === 'cardassian'){
      // the spiral emitter at the bow, turning with the barrage — and
      // venting white when it is spent, which is the window to shoot
      if(b.phase === 'vent'){
        ctx.fillStyle = 'rgba(255,240,210,' + (0.35 + 0.3 * Math.sin(gameTime * 10)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(FR * 0.72, 0, 9, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(' + crgb + ',.9)';
      for(var e2=0;e2<3;e2++){
        var ea = b.spin + e2 / 3 * Math.PI * 2;
        ctx.beginPath(); ctx.arc(FR * 0.72 + Math.cos(ea) * 5, Math.sin(ea) * 5, 1.8, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
    if(b.fac === 'klingon'){
      var kon = reduceMotion ? 0.8 : (Math.sin(gameTime * 5.5 + b.id) > 0.72 ? 1 : 0.15);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * kon).toFixed(3) + ')';
      for(var ks=-1; ks<=1; ks+=2){ ctx.beginPath(); ctx.arc(-R*1.0, ks*R*0.86, R*0.035*(0.8 + 0.4*kon), 0, Math.PI*2); ctx.fill(); }
      ctx.restore();
    } else strobes(BT.hull, FR, b.id);

    // the core, which on a Klingon is also the charge telegraph: it swells
    // and whites out on the beat before the hull commits. A cube has its own
    // core burning out of its top face, painted in.
    if(BT.hull !== 'drone') hullCore(R*0.05, R * (0.24 + 0.03 * Math.sin(gameTime * (b.enraged ? 9 : 4)) + flash * 0.16),
             crgb, 0.85 + flash * 0.15);
    ctx.restore();

    // an adapted cube wears its shield: a white hexagon, fading as it drops
    if(b.shieldT > 0){
      ctx.save();
      ctx.strokeStyle = 'rgba(235,255,240,' + (0.35 + 0.5 * Math.min(1, b.shieldT)).toFixed(3) + ')';
      ctx.shadowColor = '#c8ffd2'; ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for(var hx=0; hx<=6; hx++){
        var ha = hx / 6 * Math.PI * 2 + gameTime * 0.8, hr = R * 1.4;
        if(hx) ctx.lineTo(b.x + Math.cos(ha) * hr, b.y - camY + Math.sin(ha) * hr);
        else ctx.moveTo(b.x + Math.cos(ha) * hr, b.y - camY + Math.sin(ha) * hr);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBeams(camY){
    for(var i=0;i<aliens.length;i++){
      var al = aliens[i];
      if(!al.beamT) continue;
      var AT = ALIEN_TYPES[al.kind];
      var winding = al.beamT > BEAM_FIRE;
      var y = al.y - camY;
      var ex = al.x + Math.cos(al.beamAng) * BEAM_LEN;
      var ey = y + Math.sin(al.beamAng) * BEAM_LEN;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      if(winding){
        // the telegraph: a hairline along the line it is about to cut, so the
        // beam is survivable by anyone paying attention
        var wind = 1 - (al.beamT - BEAM_FIRE) / BEAM_WIND;
        ctx.strokeStyle = 'rgba(' + AT.rgb + ',' + (0.14 + 0.3 * wind).toFixed(3) + ')';
        ctx.lineWidth = 1 + wind * 1.6;
        ctx.beginPath(); ctx.moveTo(al.x, y); ctx.lineTo(ex, ey); ctx.stroke();
      } else {
        var hot = Math.min(1, al.beamT / 0.18);       // it snaps off, not fades
        ctx.strokeStyle = 'rgba(' + AT.rgb + ',' + (0.3 * hot).toFixed(3) + ')';
        ctx.lineWidth = BEAM_W * 2.4 * hot;
        ctx.beginPath(); ctx.moveTo(al.x, y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(' + AT.rgb + ',' + (0.85 * hot).toFixed(3) + ')';
        ctx.lineWidth = BEAM_W * hot;
        ctx.beginPath(); ctx.moveTo(al.x, y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 * hot).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1, BEAM_W * 0.34 * hot);
        ctx.beginPath(); ctx.moveTo(al.x, y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.restore();
    }
  }

  // ── how each hull flies ──────────────────────────────────────────────────
  // One function per flight style, picked by name off the type table. The
  // shared work — drift, graze, collision, shields, ramming, loot — stays in
  // the update loop where it was; only the steering and the trigger moved out.
  var ALIEN_MOVE = {};
  var ALIEN_FIRE = {};

  // strafe: across the screen at a constant speed, bobbing. The default.
  ALIEN_MOVE.strafe = function(al, dt, sf, t, AT){
    al.x += al.vx * sf;
    al.y = al.baseY + Math.sin(al.t) * AT.bob;
  };

  // chase: steers at the ship under thrust and drag rather than tracking it
  // exactly, so it overshoots and swings back — dodgeable, but only if you
  // keep turning. Burns fuel; when it runs dry it breaks off and goes.
  ALIEN_MOVE.chase = function(al, dt, sf, t, AT){
    al.ttl -= dt;
    if(al.ttl > 0){
      var sdx = ship.x - al.x, sdy = ship.y - al.y, sd = Math.hypot(sdx, sdy) || 1;
      al.vx += (sdx / sd) * 0.06 * sf;
      al.vy += (sdy / sd) * 0.06 * sf;
    } else if(!al.fleeing){
      al.fleeing = true;
      var fdx = al.x - ship.x, fdy = al.y - ship.y, fd = Math.hypot(fdx, fdy) || 1;
      al.vx = fdx / fd * AT.speed * 2.4;
      al.vy = fdy / fd * AT.speed * 2.4;
    }
    if(!al.fleeing){
      var sdrag = Math.pow(0.975, sf);
      al.vx *= sdrag; al.vy *= sdrag;
      var spd = Math.hypot(al.vx, al.vy), cap = AT.speed * 1.9;
      if(spd > cap){ al.vx = al.vx / spd * cap; al.vy = al.vy / spd * cap; }
    }
    al.x += al.vx * sf; al.y += al.vy * sf;
    al.baseY = al.y;
  };

  // run: the attack pass. Backs off while it lines up, then commits to a
  // straight line through the player at nearly three times its cruise and
  // does not steer again until the run is spent. The whole hull is a rhythm:
  // two seconds of being shot at, two seconds of it being somewhere else.
  ALIEN_MOVE.run = function(al, dt, sf, t, AT){
    al.runT -= dt;
    if(al.phase === 'line'){
      var wantA = Math.atan2(ship.y - al.y, ship.x - al.x);
      al.face += angDiff(wantA, al.face) * (1 - Math.pow(1 - 0.05, sf));
      var s = AT.speed * 0.5;
      al.vx = Math.cos(al.face + Math.PI) * s;
      al.vy = Math.sin(al.face + Math.PI) * s;
      if(al.runT <= 0){
        al.phase = 'run'; al.runT = 2.0;
        al.vx = Math.cos(al.face) * AT.speed * 2.7;
        al.vy = Math.sin(al.face) * AT.speed * 2.7;
        burst(al.x, al.y, 8, AT.rgb, 0.7);
      }
    } else if(al.runT <= 0){
      al.phase = 'line'; al.runT = 1.5 + Math.random() * 0.8;
    }
    al.x += al.vx * sf; al.y += al.vy * sf;
    al.baseY = al.y;
  };

  // standoff: holds a set range and slides sideways to keep it. Pushes out
  // when you close and pulls in when you run, which is what makes this the
  // one hull that flying away does not answer.
  ALIEN_MOVE.standoff = function(al, dt, sf, t, AT){
    al.ttl -= dt;
    if(al.ttl <= 0){
      if(!al.fleeing){
        al.fleeing = true;
        var ex = al.x - ship.x, ey = al.y - ship.y, ed = Math.hypot(ex, ey) || 1;
        al.vx = ex / ed * AT.speed * 2.4; al.vy = ey / ed * AT.speed * 2.4;
      }
      al.x += al.vx * sf; al.y += al.vy * sf; al.baseY = al.y;
      return;
    }
    var dx = ship.x - al.x, dy = ship.y - al.y, d = Math.hypot(dx, dy) || 1;
    var push = (d - 380) * 0.0016;
    al.vx += (dx / d) * push * sf;
    al.vy += (dy / d) * push * sf;
    al.slideT -= dt;
    if(al.slideT <= 0){ al.slide = -al.slide; al.slideT = 2 + Math.random() * 2.5; }
    al.vx += (-dy / d) * 0.014 * al.slide * sf;
    al.vy += ( dx / d) * 0.014 * al.slide * sf;
    var dr = Math.pow(0.97, sf);
    al.vx *= dr; al.vy *= dr;
    var sp = Math.hypot(al.vx, al.vy), cap = AT.speed * 1.7;
    if(sp > cap){ al.vx = al.vx / sp * cap; al.vy = al.vy / sp * cap; }
    al.x += al.vx * sf; al.y += al.vy * sf;
    al.baseY = al.y;
  };

  // grind: straight at you, slowly, for ever.
  // wing: steer to the slot the wing has computed, arriving rather than
  // overshooting. A member on a committed run just flies its line. Once the
  // wing is disbanded (the flagship is dead or gone) every member breaks off.
  ALIEN_MOVE.wing = function(al, dt, sf, t, AT){
    var w = al.wing;
    if(w.done){
      if(!al.fleeing){
        al.fleeing = true; al.commit = false; al.cloak = 0;
        var fx = al.x - ship.x, fy = al.y - ship.y, fd = Math.hypot(fx, fy) || 1;
        al.vx = fx / fd * AT.speed * 2.6; al.vy = fy / fd * AT.speed * 2.6;
      }
    } else if(!al.commit){
      var dx = al.tx - al.x, dy = al.ty - al.y, d = Math.hypot(dx, dy);
      var want = Math.min(al.maxV || 3, d * 0.06);
      var wx = d ? dx / d * want : 0, wy = d ? dy / d * want : 0;
      var k = 1 - Math.pow(1 - 0.12, sf);
      al.vx += (wx - al.vx) * k; al.vy += (wy - al.vy) * k;
    }
    al.x += al.vx * sf; al.y += al.vy * sf;
    al.baseY = al.y;
  };

  // retreat: ordinary traffic clearing out for a capital ship. It holds its
  // fire and flies straight out of the band.
  ALIEN_MOVE.retreat = function(al, dt, sf, t, AT){
    if(!al.fleeing){
      al.fleeing = true;
      var fx = al.x - ship.x, fy = al.y - ship.y, fd = Math.hypot(fx, fy) || 1;
      al.vx = fx / fd * Math.max(1.6, AT.speed * 2.4); al.vy = fy / fd * Math.max(1.6, AT.speed * 2.4);
      al.beamT = 0;
    }
    al.x += al.vx * sf; al.y += al.vy * sf;
    al.baseY = al.y;
  };

  ALIEN_MOVE.grind = function(al, dt, sf, t, AT){
    var dx = ship.x - al.x, dy = ship.y - al.y, d = Math.hypot(dx, dy) || 1;
    al.vx = dx / d * AT.speed;
    al.vy = dy / d * AT.speed;
    al.x += al.vx * sf; al.y += al.vy * sf;
    al.baseY = al.y;
  };

  // anchor: fly to a spot, stop, spin, leave. It never attacks; what it
  // leaves behind does.
  ALIEN_MOVE.anchor = function(al, dt, sf, t, AT){
    if(al.phase === 'seek'){
      var dx = al.ax - al.x, dy = al.ay - al.y, d = Math.hypot(dx, dy) || 1;
      if(d < 14){
        al.phase = 'spin'; al.spinT = WEB_SPIN; al.vx = 0; al.vy = 0;
      } else {
        al.vx = dx / d * AT.speed * 1.8;
        al.vy = dy / d * AT.speed * 1.8;
      }
    } else if(al.phase === 'spin'){
      al.spinT -= dt;
      if(al.spinT <= 0){
        spawnWeb(al.x, al.y);
        al.phase = 'leave';
        var fx = al.x - ship.x, fy = al.y - ship.y, fd = Math.hypot(fx, fy) || 1;
        al.vx = fx / fd * AT.speed * 2.3;
        al.vy = fy / fd * AT.speed * 2.3;
      }
    }
    al.x += al.vx * sf; al.y += al.vy * sf;
    al.baseY = al.y;
  };

  // ── and how each one shoots ──────────────────────────────────────────────
  ALIEN_FIRE.fan = function(al, t, AT){
    var asp = alienBulletSpeed(t);
    var aimA = Math.atan2(ship.y - al.y, ship.x - al.x) + (Math.random() - 0.5) * 2 * alienSpread(t);
    for(var sh=0; sh<AT.shots; sh++){
      var sa = aimA + (sh - (AT.shots - 1) / 2) * 0.2;
      alienBullets.push({ x: al.x, y: al.y, vx: Math.cos(sa) * asp, vy: Math.sin(sa) * asp,
                          life: 2.9, r: 3, rgb: AT.rgb });
    }
  };

  // leads its target, which is what stops a long straight burn away from it
  // being the whole answer
  ALIEN_FIRE.lead = function(al, t, AT){
    var asp = alienBulletSpeed(t);
    var lead = Math.hypot(ship.x - al.x, ship.y - al.y) / asp;
    var tx = ship.x + ship.vx * lead * 0.55, ty = ship.y + ship.vy * lead * 0.55;
    var sa = Math.atan2(ty - al.y, tx - al.x) + (Math.random() - 0.5) * 2 * alienSpread(t);
    alienBullets.push({ x: al.x, y: al.y, vx: Math.cos(sa) * asp, vy: Math.sin(sa) * asp,
                        life: 2.9, r: 3, rgb: AT.rgb });
  };

  // twin bolts down the run line, and only while it is ON the run — off it,
  // the raptor is a hull flying away from you and nothing else
  ALIEN_FIRE.burst = function(al, t, AT){
    if(al.phase !== 'run'){ al.nextShot = t + 0.25; return; }
    var asp = alienBulletSpeed(t) * 1.15;
    for(var s=-1; s<=1; s+=2){
      alienBullets.push({
        x: al.x - Math.sin(al.face) * s * al.r * 0.5,
        y: al.y + Math.cos(al.face) * s * al.r * 0.5,
        vx: Math.cos(al.face) * asp, vy: Math.sin(al.face) * asp,
        life: 2.6, r: 3, rgb: AT.rgb });
    }
  };

  // One heavy plasma torpedo: slow, homing, and the only thing an enemy fires
  // that the player's own guns can destroy. That is the whole design of it —
  // a threat you answer by shooting rather than by dodging, because nothing
  // else in the game lets you do that.
  ALIEN_FIRE.plasma = function(al, t, AT){
    var a = Math.atan2(ship.y - al.y, ship.x - al.x);
    alienBullets.push({
      x: al.x, y: al.y,
      vx: Math.cos(a) * PLASMA_SPEED, vy: Math.sin(a) * PLASMA_SPEED,
      life: 8, r: PLASMA_R, rgb: AT.rgb, id: ++uid,
      hp: PLASMA_HP, seek: PLASMA_TURN, heavy: true });
    burst(al.x, al.y, 8, AT.rgb, 0.8);
  };

  // the cutting beam: a long wind-up you can see and get out of, then a
  // sweep that tracks slowly. It is not aimed at where you are; it is aimed
  // at where you were when it started, and it catches up.
  ALIEN_FIRE.beam = function(al, t, AT){
    al.beamT = BEAM_WIND + BEAM_FIRE;
    al.beamAng = Math.atan2(ship.y - al.y, ship.x - al.x);
    al.nextShot = t + 5.4;
  };

  ALIEN_FIRE.none = function(){};

  var ALIEN_FIRST = 4;
  var aliens = [], alienBullets = [], nextAlienAt = ALIEN_FIRST, bonus = 0;

  // ── bosses ───────────────────────────────────────────────────────
  // The one fight in the run that does not drift past. It holds station on the
  // ship, cycles three attacks, calls in escorts, and turns nastier at half
  // hull. It is also where a late run finds the XP for its next upgrade, so
  // the answer to a capital ship is never simply to run away from it.
  var BOSS_FIRST = 110, BOSS_GAP = 68, BOSS_WARN = 2.6, BOSS_R = 44;
  var boss = null, bossWarn = 0, bossCount = 0, bossKills = 0, nextBossAt = BOSS_FIRST;
  // ── the engagement hail ──────────────────────────────────────────────
  // A capital ship no longer simply arrives. It is announced, and then the run
  // halts on a two-way choice: hold the sector, or break off. That turns the
  // one scripted event in the run into the only real decision in it — every
  // other panel asks which upgrade, this one asks whether to take the fight at
  // all — and it gives the answer at one hull a name other than "die here".
  //
  // The two sides have to stay genuinely uneven in opposite directions or the
  // choice collapses into a default. Standing pays the biggest bounty on the
  // board, a guaranteed refit and two hull; running costs nothing in damage and
  // everything in tempo — no loot, no XP, and the next contact comes at a
  // little over half the usual gap. What a withdrawal really spends is the
  // level economy: under the current XP curve a late run cannot reach its next
  // refit off rocks alone, so a run that flees every hail slowly stops growing
  // while the field keeps escalating.
  var BOSS_FLEE_GAP = 0.55;      // fraction of a normal gap before the next hail
  var BOSS_FLEE_GRACE = 2.6;     // the evasive burn, in seconds of invulnerability
  var BOSS_KILL_HEARTS = 2;
  var hailOpen = false, bossFled = 0;
  var speedMult = 1.35, rockSpawnAcc = 0;
  var gameOver = false;
  var overEl = document.getElementById('astroOver');
  var bossBarEl  = document.getElementById('astroBoss');
  var bossFillEl = document.getElementById('astroBossFill');
  var bossNameEl = document.getElementById('astroBossName');
  var warnEl     = document.getElementById('astroWarn');
  var hailEl       = document.getElementById('astroHail');
  var hailNameEl   = document.getElementById('astroHailName');
  var hailBountyEl = document.getElementById('astroHailBounty');
  var hailThreatEl = document.getElementById('astroHailThreat');
  var hailWhyEl    = document.getElementById('astroHailWhy');
  var hailFleeDEl  = document.getElementById('astroHailFleeD');
  var hailHintEl   = document.getElementById('astroHailHint');
  var hailLootEl   = document.getElementById('astroHailLoot');
  var hailFightEl  = document.getElementById('astroHailFight');
  var hailFleeEl   = document.getElementById('astroHailFlee');
  var finalEl = document.getElementById('astroFinal');
  var finalSubEl = document.getElementById('astroFinalSub');
  var againEl = document.getElementById('astroAgain');
  var tilesEl = document.getElementById('astroTiles');
  var chartEl = document.getElementById('astroChart');

  // ── drops ────────────────────────────────────────────────────────────────
  // XP that evaporates before it can be reached punishes the player for the
  // fight that produced it, so crystals outlive the old coins and the collection
  // radius is generous by default — hoovering loot up is the loop, not a skill
  // check. the Tractor Beam then widens what is already a comfortable baseline.
  var COIN_TTL = 10, HEART_TTL = 9, POWER_TTL = 10;
  var MAGNET_R = 165, PICKUP_R = SHIP_RADIUS + 13;
  var lives = START_LIVES;

  // ── XP and levels ────────────────────────────────────────────────────────
  // Dilithium is the only currency now and they buy exactly one thing: the next
  // upgrade card. The curve is deliberately shallow at the front so the first
  // level lands inside ten seconds and teaches the loop before it can bite.
  var xp = 0, level = 1, pendingLevels = 0;
  // The first card still lands inside ten seconds and teaches the loop before
  // it can bite. After that the gaps widen on purpose. Until Sep 2026 the rail
  // filled every twelve seconds or so, five cards in the first minute, and a
  // card that arrives that often is something that happens to you rather than
  // something you earned. Measured with the scripted pilot:
  //
  //                     1st   2nd   3rd   4th   5th   6th
  //   before (4+5n)      5s   12s   21s   33s   49s   67s
  //   first pass (8+11n) 8s   20s   40s   67s   96s  122s
  //   now  (12+22n)     11s   29s   59s  100s  139s  155s
  //
  // Two or three cards in the first minute instead of five, and after that
  // one every thirty to forty seconds. The first pass halved the gap and was
  // still "too quick"; this one roughly triples it. To keep a card worth the
  // wait, the weakest per-level steps got bigger at the same time (see
  // FIRE_STEP) and a full rail now plays a beat before the cards deal (see
  // refitReady).
  function xpNeed(l){ return 12 + (l - 1) * 22 + Math.floor(Math.pow(l - 1, 2) * 0.9); }

  // ── timed power-ups ──────────────────────────────────────────────────────
  // These never pause anything: they land on the ship the instant it touches
  // them and run down on the clock in the HUD.
  var POWER_TIME = 10;
  var shieldTime = 0, rapidTime = 0;

  // ── the three hulls ──────────────────────────────────────────────────────
  // Every hull is the same ship with five numbers moved, and those five
  // numbers are the whole difference between them: how hard it pushes, how
  // fast it comes round, how much speed it bleeds when you stop pushing, how
  // quickly the phasers cycle, and how many plates it carries. Before this
  // the three hulls flew identically and only the opening weapon differed,
  // which made the first panel of the run a weapon menu wearing three ship
  // names.
  //
  // `drag` is the one that is not obvious. It is the per-frame speed bleed,
  // so a HIGHER number is a ship that KEEPS its speed. Top speed works out at
  // thrust / (1 - drag), which means drag sets the ceiling and thrust sets how
  // long you take to reach it. The Sovereign is slow because it has both
  // against it; the Defiant is quick because it has both for it.
  //
  // Retuned Sep 2026 because all three were too fast and too slippery. The
  // old drags (0.979-0.9825) kept the ship coasting for most of a second
  // after you let go, and the Defiant topped out near 640px/s — past the
  // point where a player can steer through a field of rock. Drag now bleeds
  // speed roughly twice as fast, so the ship goes where it is pointed and
  // stops soon after you stop pushing, and every top speed came down:
  //
  // Pulled further apart later in Sep 2026, because the three still flew
  // within about fifteen percent of each other on every axis and the pick
  // read as one ship in three paint jobs. Each hull now owns one axis
  // outright and pays for it on another:
  //
  //             top speed   coast (1/e)   turn     phasers    hull
  //   Defiant    ~450px/s      0.42s      227°/s   x1.22      3    the fast one
  //   Nova       ~420px/s      0.43s      275°/s   x0.87      2    the nimble one
  //   Sovereign  ~315px/s      0.72s      155°/s   x1.00      4    the heavy one
  //
  // The Defiant also has `grip`, and is the only hull that does. It was
  // given the most speed and the least control over it: at top speed a 90°
  // dodge carried it 334px further along its old line (Nova 221, Sovereign
  // 293), and it took 298px to turn round. It was the fastest ship and the
  // hardest to fly. It now pushes harder and bleeds speed sooner (it gets
  // going and stops in less room than before), comes round a little
  // quicker, and while the engines are lit the slide across its nose bleeds
  // away (see applyGrip). Its top speed also came down from ~500 to 450px/s
  // ("still too fast"), still the quickest of the three. A 90° dodge now
  // costs 194px and turning round 189px, a little under the Nova's, while
  // the Nova keeps the tightest turn and the fastest nose.
  //
  // (The Sovereign's phaser figure looks ordinary, but it fires a three-beam
  // cone from the first second, which is two and a half times the beams of
  // either escort. On the pick card that is what the Phasers row counts.)
  //
  // Thrust is set from those figures, not the other way round: thrust =
  // top speed per frame * (1 - drag) / drag. The enemies cruise at 1-4px a
  // frame, so even the Sovereign outruns everything on the field.
  //
  // These are the only per-hull numbers in the game. Nothing else branches on
  // which ship you picked, so a hull can be retuned here without hunting
  // through the flight code.
  var HULL_MODS = {
    torp:   { thrust:1.965, rot:1.10, drag:0.961, cool:0.82, lives:3, magnet:1,  grip:0.05 },
    spread: { thrust:0.80, rot:0.76, drag:0.977, cool:1.00, lives:4, magnet:1,   grip:0 },
    mine:   { thrust:1.78, rot:1.34, drag:0.962, cool:1.15, lives:2, magnet:1.8, grip:0 }
  };
  // The unmodified ship. It is never flown — a run always has a hull by the
  // time anything moves — but every stat function reads through hullMods(),
  // and those functions are also called by the upgrade cards before the pick
  // panel has closed. This is what they read until then.
  var HULL_BASE = { thrust:1, rot:1, drag:0.98, cool:1, lives:START_LIVES, magnet:1, grip:0 };
  function hullMods(){ return HULL_MODS[hull] || HULL_BASE; }
  // Grip, for a hull that has it: while the engines are lit, the part of the
  // ship's velocity running across its nose bleeds away at `g` a frame, and
  // GRIP_CARVE of what it sheds comes back as speed along the nose. The ship
  // carves a turn instead of skidding through it. Most of the slide turns
  // into forward speed rather than simply vanishing, so a turn is not also a
  // brake. It only acts under thrust: let go and the ship drifts as every
  // hull does, which is still how you slide past a rock with the guns on it.
  var GRIP_CARVE = 0.6;
  function applyGrip(g, sf){
    var hx = Math.cos(ship.angle), hy = Math.sin(ship.angle);
    var f = ship.vx * hx + ship.vy * hy, l = ship.vy * hx - ship.vx * hy;
    var nl = l * Math.pow(1 - g, sf);
    if(f > 0) f = Math.sqrt(f * f + (l * l - nl * nl) * GRIP_CARVE);
    ship.vx = f * hx - nl * hy; ship.vy = f * hy + nl * hx;
  }

  // ── permanent upgrades ───────────────────────────────────────────────────
  var up = { fire:0, thrust:0, spread:0, pierce:0, dmg:0, magnet:0, range:0, guard:0,
             torp:0, seek:0, deflector:0, armour:0, wake:0, arc:0, ram:0, mine:0 };
  var nextGuard = 0, nextTorp = 0, nextMine = 0;
  // Ablative armour is a single charge that regrows on a clock, not a pool —
  // one plate, taken off you by the next hit and back a while later. It is
  // stored as a boolean plus the time it returns so nothing has to be
  // decremented every frame.
  var armourReady = false, armourAt = 0;
  var nextWake = 0;

  // Cooldown is assembled in one place, in one order — cannon levels, then the
  // weight of the extra barrels, then the rapid-fire drop, then the clamp — so
  // no combination of the three can outrun MIN_COOLDOWN. cooldownWith() takes
  // its levels as arguments because the upgrade cards quote the figure the
  // player would get *after* picking, and a card must never promise a rate the
  // ship cannot actually reach.
  // Three systems reach the same ceiling they always did in fewer, bigger
  // steps. Cards got rarer in Sep 2026, and a card you waited a minute for
  // has to feel like it did something: +14% thrust does not. The end states
  // are unchanged (Phaser Array 0.855^5 = 0.457 against 0.88^6 = 0.464;
  // Impulse Drive +84% thrust either way; Tractor Beam +141% against +140%),
  // so nothing past the last card moved, and MAX is now reachable in a run.
  var FIRE_STEP = 0.855, THRUST_STEP = 0.21, TURN_STEP = 0.15, MAGNET_STEP = 0.47;
  function rawCooldown(l){ return SHOT_COOLDOWN * Math.pow(FIRE_STEP, l); }
  function cooldownWith(fireL, spreadL, rapid){
    var c = rawCooldown(fireL) * hullMods().cool * Math.pow(SPREAD_DRAG, spreadL);
    if(rapid) c *= RAPID_MULT;
    return Math.max(MIN_COOLDOWN, c);
  }
  function shotCooldown(){ return cooldownWith(up.fire, up.spread, rapidTime > 0); }
  function barrels(l){ return 1 + l * 2; }
  // A wider fan with every level: the extra barrels buy the screen in front of
  // you, not a tighter beam, so spread stays a crowd answer and a poor one
  // against a single large target.
  function fanStep(l){ return 0.12 + 0.022 * l; }
  function bulletDamage(){ return 1 + up.dmg; }
  function bulletSpeed(){ return BULLET_SPEED * (1 + 0.12 * up.range); }
  function bulletLife(){  return BULLET_LIFE  * (1 + 0.15 * up.range); }
  function thrustPower(){ return THRUST * hullMods().thrust * (1 + THRUST_STEP * up.thrust); }
  function rotPower(){ return ROT_SPEED * hullMods().rot * (1 + TURN_STEP * up.thrust); }
  function magnetRange(){ return MAGNET_R * hullMods().magnet * (1 + MAGNET_STEP * up.magnet); }
  // The torpedo bay reloads faster and hits harder with every level, but the
  // travel time never changes — the weapon is supposed to be something you
  // fire into where the field is *going* to be, not where it is.
  function torpCooldown(){ return TORP_COOLDOWN * Math.pow(0.82, Math.max(0, up.torp - 1)); }
  function torpDamage(){ return TORP_DMG + (up.torp - 1) + up.dmg; }
  function torpBlast(){ return TORP_BLAST * (1 + 0.12 * (up.torp - 1)); }
  // Targeting sensors sharpen the lock rather than the warhead: further to see
  // a target, faster to come round onto one. They cannot make a torpedo hit
  // harder — that is the warhead's card, and this one has to stay the pick you
  // take because your torpedoes keep missing.
  function torpSeekRange(){ return TORP_SEEK_R * (1 + 0.30 * up.seek); }
  function torpTurnRate(){  return TORP_TURN   * (1 + 0.45 * up.seek); }
  // Levels buy the rack four ways at once — more mines, laid sooner, armed
  // wider, hitting harder — because any one of them alone is imperceptible on
  // a weapon you do not aim. The trigger is what a player actually feels: it
  // is the difference between a mine that catches the rock and one the rock
  // sails past.
  function mineCooldown(){ return MINE_COOLDOWN * Math.pow(0.82, Math.max(0, up.mine - 1)); }
  function mineDamage(){ return MINE_DMG + (up.mine - 1) + up.dmg; }
  function mineBlast(){ return MINE_BLAST * (1 + 0.12 * (up.mine - 1)); }
  function mineTrigger(){ return MINE_TRIG + 7 * (up.mine - 1); }
  function mineRack(){ return MINE_RACK + 2 * up.mine; }
  function deflectRange(){ return up.deflector ? DEFLECT_R * (1 + 0.30 * (up.deflector - 1)) : 0; }
  function armourEvery(l){ return 44 - l * 7; }      // 37s → 30s → 23s
  // levels buy how long the trail hangs and how hard it burns, not how wide it
  // is — a wider trail would start catching things you never flew near
  function wakeLife(){ return WAKE_LIFE * (1 + 0.35 * (up.wake - 1)); }
  function wakeDamageAt(l){ return l + Math.floor(up.dmg / 2); }
  function wakeDamage(){ return wakeDamageAt(up.wake); }
  function arcRangeAt(l){ return l ? SHIP_RADIUS + ARC_STANDOFF + 8 * (l - 1) : 0; }
  function arcRange(){ return arcRangeAt(up.arc); }
  function arcDps(){ return ARC_DPS * up.arc + up.dmg * 0.8; }
  function guardEvery(l){ return 40 - l * 7; }        // 33s → 26s → 19s
  var GUARD_TIME = 5;

  function computeDocHeight(){
    docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  }

  function resize(){
    // Capped at 2. Everything in here is neon vector work with a glow, and
    // nobody can see the difference between 2x and 3x on it — but fill cost
    // goes with the square, so a 3x phone was paying 2.25 times a 2x phone's
    // bill for the backdrop and the shadow passes. This is the single
    // cheapest thing that protects a handset.
    //
    // Then capped again at 1.5 (Sep 2026, "jittery"): on a Retina screen the
    // backing store at 2x is four times the pixels of the page, and at 1.5 it
    // is a little over half that, for a softness nobody sees on neon over a
    // starfield. And if the run still cannot hold its frame rate, budget()
    // drops it to 1x for good (lowRes).
    var dpr = Math.min(lowRes ? 1 : 1.5, window.devicePixelRatio || 1);
    viewDpr = dpr;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeDocHeight();
    // The baked layers are cut to one exact viewport, so a resize is the one
    // thing that genuinely invalidates them — but a resize event that did not
    // change the viewport (an on-screen keyboard, a scrollbar appearing) must
    // not spend two large bakes on nothing.
    if(!skyTile || skyW !== window.innerWidth || skyVH !== window.innerHeight || skyDpr !== viewDpr) bakeSky();
  }

  function resetShip(inv){
    ship = { x: window.innerWidth/2, y: window.scrollY + window.innerHeight/2, vx: 0, vy: 0,
             angle: -Math.PI/2, thrusting: false, invuln: inv || INVULN, lastShot: -99,
             muzzle: 0 };
  }

  // ── debris ───────────────────────────────────────────────────────────────
  // Four kinds, because one kind of particle makes every explosion look like
  // the same explosion no matter how many of them you spawn:
  //
  //   spark · fast, additive, stretched along its own velocity. The flash.
  //   ember · slow, glowing, outlives the rest. What hangs in the air after.
  //   shard · a tumbling line of hull or rock, and the only opaque one — it
  //           is what stops a burst reading as pure light.
  //   dust  · the original square, kept for the cheap incidental hits.
  //
  // burst() mixes them by weight rather than spawning one type, so a 26-piece
  // burst is an event with a shape instead of more of the same dot. The
  // signature is unchanged — twenty call sites pass (x, y, n, col) and all of
  // them get the new mix for free — with an optional power multiplier on the
  // end for the handful of places that want a bigger one.
  function burst(x, y, n, col, power){
    var p = power || 1;
    for(var i=0;i<n;i++){
      var a = Math.random()*Math.PI*2, roll = Math.random(), sp;
      if(roll < 0.44){
        sp = (2.2 + Math.random()*5.2) * p;
        particles.push({ t:'spark', x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                         life:1, decay: 2.8 + Math.random()*2.6, drag:0.90, col: col || null });
      } else if(roll < 0.72){
        sp = (0.5 + Math.random()*1.6) * p;
        particles.push({ t:'ember', x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                         life:1, decay: 1.0 + Math.random()*0.9, drag:0.968,
                         r: 1.0 + Math.random()*1.9, col: col || null });
      } else if(roll < 0.89){
        sp = (1.3 + Math.random()*3.4) * p;
        particles.push({ t:'shard', x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                         life:1, decay: 1.4 + Math.random()*1.0, drag:0.955,
                         rot: Math.random()*Math.PI*2, vr: (Math.random()-0.5)*0.46,
                         len: 2.6 + Math.random()*5, col: col || null });
      } else {
        sp = (1.5 + Math.random()*3) * p;
        particles.push({ t:'dust', x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                         life:1, decay: 2.4, drag:0.94, col: col || null });
      }
    }
  }

  // Sparks alone, for the places that want a flash rather than wreckage: a
  // phaser landing, the muzzle, a deflected rock.
  function sparks(x, y, n, col, power){
    var p = power || 1;
    for(var i=0;i<n;i++){
      var a = Math.random()*Math.PI*2, sp = (2.6 + Math.random()*5.4) * p;
      particles.push({ t:'spark', x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                       life:1, decay: 3.4 + Math.random()*2.6, drag:0.89, col: col || null });
    }
  }

  // ── rare rocks ───────────────────────────────────────────────────────────
  // A handful of the field is worth chasing rather than avoiding: bigger, more
  // armoured, lit in their drop's own colour, and carrying a timed power-up
  // instead of gems. Capped at two on the field so they stay an event.
  var SPECIALS = {
    shield: { stroke:'#00c2ff', glow:'#00c2ff', rgb:'0,194,255' },
    rapid:  { stroke:'#ffb347', glow:'#ffa726', rgb:'255,179,71' }
  };
  var SPECIAL_CHANCE = 0.055, MAX_SPECIAL = 2;
  var uid = 0;

  function specialCount(){
    var n = 0;
    for(var i=0;i<asteroids.length;i++) if(asteroids[i].special) n++;
    return n;
  }
  function rollSpecial(){
    if(specialCount() >= MAX_SPECIAL) return null;
    if(Math.random() >= SPECIAL_CHANCE) return null;
    return Math.random() < 0.5 ? 'shield' : 'rapid';
  }

  function makeAsteroid(mode, special, size){
    var r = special ? 22 + Math.random()*7
                    : (size === 'mini' ? 7 + Math.random()*4.5 : 14 + Math.random()*14);
    var n = 8 + Math.floor(Math.random()*3);
    var pts = [];
    for(var i=0;i<n;i++){
      var a = (i/n)*Math.PI*2;
      var rad = r * (0.7 + Math.random()*0.5);
      pts.push([Math.cos(a)*rad, Math.sin(a)*rad]);
    }
    // sf is the rock's own share of the current speed band; velocity is derived
    // from it every frame, so the whole field speeds up as the run wears on
    // without anyone ever getting a sudden shove. Rare rocks drift slower —
    // they are a prize, and a prize you cannot catch is just a tease.
    var sf = (0.4 + Math.random()*0.8) * (special ? 0.62 : 1);
    // Chords between vertex pairs, rolled once. The renderer opens one more of
    // them for every point of hull the rock has lost, so damage shows on the
    // rock. Rolled at birth rather than per frame because cracks that re-roll
    // every frame read as television static, not as damage.
    var cracks = [];
    for(var ci=0; ci<4; ci++){
      var v0 = Math.floor(Math.random()*n);
      cracks.push([v0, (v0 + 2 + Math.floor(Math.random()*(n-3))) % n]);
    }
    // There used to be a `lit0` here — the vertex a rock's lit faces started
    // from, rolled once at birth. The renderer stopped reading it when the key
    // light became world-fixed: which way the light falls is now a property of
    // the sector, not of the rock, so the roll is gone with it.
    var top = window.scrollY, vh = window.innerHeight, vw = window.innerWidth;
    var x, y, ang, entering = false;

    if(mode === 'edge'){
      // drift in from just outside a screen edge, heading across the view —
      // nothing ever blinks into existence in front of the player
      var m = r + 8, side = Math.floor(Math.random()*4);
      if(side === 0){      x = -m;      y = top + Math.random()*vh; }
      else if(side === 1){ x = vw + m;  y = top + Math.random()*vh; }
      else if(side === 2){ x = Math.random()*vw; y = top - m; }
      else {               x = Math.random()*vw; y = top + vh + m; }
      var tx = vw * (0.2 + Math.random()*0.6);
      var ty = top + vh * (0.2 + Math.random()*0.6);
      ang = Math.atan2(ty - y, tx - x) + (Math.random()-0.5)*0.7;
      entering = true;
    } else {
      // opening field: scattered through the band that travels with the camera,
      // but never inside the current view
      var band = vh * BAND_PAD;
      var tries = 0;
      do {
        x = Math.random()*vw;
        y = top - band + Math.random()*(vh + band*2);
        tries++;
      } while(tries < 25 && y > top - 60 && y < top + vh + 60);
      ang = Math.random()*Math.PI*2;
    }

    return { id: ++uid, x:x, y:y, ang:ang, sf:sf,
             vx: Math.cos(ang)*sf*speedMult, vy: Math.sin(ang)*sf*speedMult,
             r:r, pts:pts, hp: special ? 4 : rockHp(r, gameTime), hitT: 0,
             maxHp: special ? 4 : rockHp(r, gameTime), cracks: cracks,
             special: special || null, pulse: Math.random()*Math.PI*2,
             rot: Math.random()*Math.PI*2, rotSpeed: (Math.random()-0.5)*0.02,
             entering: entering };
  }

  function spawnSafeAsteroid(){
    // reject openings that send a rock straight down the player's throat
    var special = rollSpecial();
    var a, tries = 0;
    do {
      a = makeAsteroid('edge', special); tries++;
      var len = Math.hypot(a.vx, a.vy) || 1;
      var px = ship.x - a.x, py = ship.y - a.y;
      var t = (px*a.vx + py*a.vy) / (len*len);
      var miss = t > 0 ? Math.hypot(px - a.vx*t, py - a.vy*t) : Math.hypot(px, py);
      if(miss > 110) break;
    } while(tries < 8);
    return a;
  }

  // ── how rock arrives ─────────────────────────────────────────────────────
  // Three shapes now, not one: a single rock, a cluster of small ones
  // travelling together, or a big one with a couple of attendants. The
  // population CAP is untouched — a cluster of four counts as four against
  // rockTargetAt — so what this varies is the distribution of the field's mass
  // rather than how much of it there is.
  //
  // That distinction is the whole reason it is safe to do at all. Rock is
  // about 70% of every point of damage the player takes, so a change to
  // density is a change to the health economy; a change to how that density is
  // parcelled up is a change to what the field asks of you. A cluster cannot
  // be cleared with one shot and cannot be threaded; a lone boulder can be
  // both. Measured either side of this at N=64 and the survival curve did not
  // move, which is the result it was built to get.
  var CLUSTER_CHANCE = 0.22, ESCORT_CHANCE = 0.18;

  // a small one travelling WITH its parent: same heading, near enough the same
  // speed, so a cluster holds together across the screen instead of dispersing
  // on the first frame
  function shardOf(a, dist){
    var ang = Math.random() * Math.PI * 2;
    var m = makeAsteroid('field', null, 'mini');
    m.x = a.x + Math.cos(ang) * dist;
    m.y = a.y + Math.sin(ang) * dist;
    m.ang = a.ang + (Math.random() - 0.5) * 0.3;
    m.sf = a.sf * (0.92 + Math.random() * 0.24);
    m.entering = a.entering;
    return m;
  }

  function spawnWave(target){
    var a = spawnSafeAsteroid();
    asteroids.push(a);
    var room = target - asteroids.length;
    if(room <= 0 || a.special) return;
    var roll = Math.random(), i;
    if(roll < CLUSTER_CHANCE){
      var k = Math.min(room, 3 + Math.floor(Math.random() * 3));
      for(i=0;i<k;i++) asteroids.push(shardOf(a, 24 + Math.random() * 24));
    } else if(roll < CLUSTER_CHANCE + ESCORT_CHANCE && a.r >= 22){
      var m = Math.min(room, 1 + Math.floor(Math.random() * 2));
      for(i=0;i<m;i++) asteroids.push(shardOf(a, a.r + 12 + Math.random() * 18));
    }
  }

  function spawnFieldAsteroid(){
    var a, tries = 0;
    do { a = makeAsteroid('field'); tries++; } while(tries < 10 && Math.hypot(a.x-ship.x, a.y-ship.y) < 180);
    return a;
  }

  function spawnAsteroids(){
    asteroids = [];
    // most of the field sits off-view down the page; a handful fly in from the
    // edges straight away so the opening screen isn't empty
    var EDGE_SEED = 9;
    for(var i=0;i<START_ROCKS-EDGE_SEED;i++) asteroids.push(spawnFieldAsteroid());
    for(var j=0;j<EDGE_SEED;j++) asteroids.push(spawnSafeAsteroid());
  }

  // Weighted draw over whatever the clock has unlocked, so the newer hulls
  // dilute the scouts rather than replacing them.
  // a hull is gone once it is well clear of the band the camera travels in,
  // whichever direction it left by
  // Which way a hull points. Strafers flip to face their lane; everything
  // that manoeuvres points along its own velocity — except that a hull holding
  // station has no velocity worth speaking of and points at the player
  // instead, and a cube has no bow at all.
  function alienFacing(al, AT){
    if(AT.face === 'none') return 0;
    if(al.wing || al.retreat){
      if(Math.hypot(al.vx, al.vy) < 1.1) return Math.atan2(ship.y - al.y, ship.x - al.x);
      return Math.atan2(al.vy, al.vx);
    }
    if(AT.face === 'heading'){
      if(Math.hypot(al.vx, al.vy) < 0.25) return Math.atan2(ship.y - al.y, ship.x - al.x);
      return Math.atan2(al.vy, al.vx);
    }
    return al.vx < 0 ? Math.PI : 0;
  }

  function offBand(al){
    return al.x < -al.r * 4 || al.x > window.innerWidth + al.r * 4 ||
           al.y < window.scrollY - window.innerHeight * 0.8 ||
           al.y > window.scrollY + window.innerHeight * 1.8;
  }

  // Borg cubes learn. EVERY source of damage to a hull goes through here, so
  // the adaptation cannot be sidestepped by switching weapon — which is the
  // entire point of it, and the reason this is a function rather than a line
  // in the bullet loop.
  function alienHurt(al, dmg){
    if(al.adapt !== undefined){
      if(al.adapted) dmg *= 0.5;
      else {
        al.adapt += dmg;
        if(al.adapt >= BORG_ADAPT){
          al.adapted = true;
          burst(al.x, al.y, 12, '255,255,255', 0.9);
        }
      }
    }
    al.hp -= dmg;
    return al.hp <= 0;
  }

  function pickAlienKind(t){
    var roster = [], total = 0, k, i;
    // Caps are per kind and they are doing real work: two Borg cubes is
    // pressure and four is a wall; one web is an obstacle and three is a cage.
    var live = {};
    for(i=0;i<aliens.length;i++) live[aliens[i].kind] = (live[aliens[i].kind] || 0) + 1;
    for(k in ALIEN_TYPES){
      var T = ALIEN_TYPES[k];
      if(t < T.at) continue;
      if(T.cap && (live[k] || 0) >= T.cap) continue;
      roster.push(k); total += T.weight;
    }
    if(!roster.length) return 'scout';
    var r = Math.random() * total;
    for(i=0;i<roster.length;i++){
      r -= ALIEN_TYPES[roster[i]].weight;
      if(r <= 0) return roster[i];
    }
    return roster[roster.length - 1];
  }

  function spawnAlien(kind){
    kind = kind || pickAlienKind(gameTime);
    var T = ALIEN_TYPES[kind];
    // rolled once and used for both, so the damage bar can never open a run
    // already showing a dent — the day alienHpScale grows any jitter, two
    // calls would have meant hp and maxHp disagreeing on the spawn frame
    var alienHp = Math.max(1, Math.round(T.hp * alienHpScale(gameTime)));
    var fromLeft = Math.random() < 0.5;
    var y = window.scrollY + window.innerHeight * (0.2 + Math.random() * 0.6);
    var al = {
      id: ++uid, kind: kind, r: T.r,
      x: fromLeft ? -T.r * 2 : window.innerWidth + T.r * 2,
      y: y, baseY: y,
      vx: (fromLeft ? 1 : -1) * T.speed, vy: 0,
      t: Math.random() * Math.PI * 2,
      hp: alienHp, hitT: 0,
      maxHp: alienHp,
      // chasers and standoff hulls burn fuel; when it runs dry they break off
      ttl: T.ttl || 0, fleeing: false,
      nextShot: gameTime + 0.7   // a beat before it opens fire
    };
    // Per-hull state, set up here rather than lazily, so a flight style never
    // has to guess whether its own fields exist yet.
    if(T.move === 'run'){
      al.phase = 'line'; al.runT = 0.8; al.face = fromLeft ? 0 : Math.PI;
    } else if(T.move === 'standoff'){
      al.slide = Math.random() < 0.5 ? 1 : -1; al.slideT = 2;
    } else if(T.move === 'grind'){
      al.adapt = 0; al.adapted = false; al.beamT = 0; al.beamAng = 0;
      al.nextShot = gameTime + 2.6;
    } else if(T.move === 'anchor'){
      // it anchors off the player's shoulder rather than on top of them, so
      // the web is an obstacle to fly around and not an ambush to fly into
      var wa = Math.random() * Math.PI * 2;
      al.phase = 'seek';
      al.ax = Math.max(WEB_R, Math.min(window.innerWidth - WEB_R, ship.x + Math.cos(wa) * 215));
      al.ay = ship.y + Math.sin(wa) * 215;
    }
    aliens.push(al);
  }

  // ── drops ────────────────────────────────────────────────────────────────
  // Everything a kill leaves behind is on a timer: grab it or lose it. The last
  // stretch of that timer is spent blinking so the loss never feels arbitrary.
  function pickupTtl(kind){
    if(kind === 'heart') return HEART_TTL;
    if(kind === 'shield' || kind === 'rapid') return POWER_TTL;
    return COIN_TTL;
  }
  function dropPickup(x, y, kind){
    var a = Math.random()*Math.PI*2, sp = 0.4 + Math.random()*0.9;
    var ttl = pickupTtl(kind);
    pickups.push({
      x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, kind:kind,
      value: kind === 'gem' ? 5 : 1,
      life: ttl, max: ttl,
      t: Math.random()*Math.PI*2
    });
  }
  // Rocks pay in XP, with one exception: a ship that has already been hit can
  // turn up a repair. It is deliberately conditional rather than a flat drop —
  // a player who is not losing lives never sees one, so this cannot become the
  // old economy where health arrived faster than the field could take it. It
  // only ever softens a bad run's slide, and never rewards a clean one.
  var ROCK_HEART = 0.013;
  // Repairs thin out once a run is long. The whole run is balanced on hull
  // gained minus hull lost being negative, and a strong late build was
  // finding repairs as fast as it lost plates: one scripted run lost 29
  // plates over fifteen minutes and ended it at full hull. Untouched for the
  // first three minutes, half by six, a third from seven on.
  function heartFade(t){ return t < 180 ? 1 : Math.max(0.35, 1 - (t - 180) / 360); }
  function dropRockLoot(x, y){
    if(lives < MAX_LIVES && Math.random() < ROCK_HEART * heartFade(gameTime)){ dropPickup(x, y, 'heart'); return; }
    // 0.38, not 0.25: a third fewer rocks means a third fewer kills, and at
    // the old rate the thinner field cost most of a level per run.
    dropPickup(x, y, Math.random() < 0.38 ? 'gem' : 'coin');
  }

  function currentScore(){
    return Math.floor(gameTime * 10) + bonus;
  }

  // ── the run recorder ─────────────────────────────────────────────────────
  // Everything the summary screen needs, gathered while the run is happening
  // because none of it can be reconstructed afterwards. It is READ-ONLY with
  // respect to the simulation: nothing in here is ever consulted by update(),
  // so a recorder that broke outright would cost a chart and nothing else.
  //
  // The curve is sampled on the run clock rather than per frame — a frame
  // counter would give a player on a 144Hz screen a different shaped run from
  // one on a 60Hz screen. A run long enough to overflow the buffer drops every
  // other sample and doubles the interval, so a forty-minute run keeps the
  // same shape a two-minute one has instead of having its tail thrown away.
  var dilithium = 0;
  var runSeries = [], runStep = 2, runNext = 0, RUN_MAX = 90;

  function sampleRun(){
    if(gameTime < runNext) return;
    runNext = gameTime + runStep;
    runSeries.push([gameTime, currentScore()]);
    if(runSeries.length > RUN_MAX){
      var thin = [], i;
      for(i=0;i<runSeries.length;i+=2) thin.push(runSeries[i]);
      runSeries = thin;
      runStep *= 2;
    }
  }

  // The best run ever flown on this browser. Storage is allowed to be absent,
  // full, or throw outright — a private window does all three — so every path
  // through here has to be able to hand back null and let the panel render a
  // first run with nothing to compare against.
  var BEST_KEY = 'ab.bridge.best.v1';
  function loadBest(){
    try {
      var raw = window.localStorage.getItem(BEST_KEY);
      if(!raw) return null;
      var b = JSON.parse(raw);
      if(!b || typeof b.score !== 'number') return null;
      if(!b.series || !b.series.length) b.series = [];
      return b;
    } catch(e){ return null; }
  }
  function saveBest(b){
    try { window.localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch(e){}
  }
  // Each figure keeps its own record. Storing the best-scoring run wholesale
  // and reading the tiles off it was wrong in a way that only shows up on the
  // second run: a player who flew a monster chain in a run that ended early
  // was told their best chain was whatever the high-scoring run happened to
  // manage. The curve and the headline score still come from one run — they
  // have to, a curve is a run — but the four figures are maxima in their own
  // right, which is what "best chain" says on the tin.
  function mergeBest(now, best){
    if(!best) return now;
    var keep = now.score > best.score ? now : best;
    return { score:keep.score, t:keep.t, refit:keep.refit, series:keep.series,
             chain:   Math.max(now.chain   || 0, best.chain   || 0),
             salvage: Math.max(now.salvage || 0, best.salvage || 0),
             over:    Math.max(now.over    || 0, best.over    || 0),
             bosses:  Math.max(now.bosses  || 0, best.bosses  || 0) };
  }

  function runStats(){
    return { score: currentScore(), t: Math.round(gameTime), refit: level,
             chain: chainBest, salvage: dilithium, over: overchargeCount,
             bosses: bossKills, series: runSeries.slice() };
  }

  // ── the run summary ──────────────────────────────────────────────────────
  // What a hull breach screen is actually for. The run is over, and there are
  // only two useful questions: how did that go, and was it better than last
  // time. The panel answers both and then gets out of the way.
  //
  // ONE MEASURE, ONE AXIS. The obvious summary chart plots score, chain,
  // dilithium and overcharges on the same grid — and it cannot be read,
  // because a chain of 14 and a score of 4970 do not share a scale: the three
  // small series lie flat along the floor pretending to be zero, and the only
  // line anyone can actually see is score. So the chart plots SCORE over time
  // and nothing else, and the other three become tiles, which is the right
  // form for a single number anyway.
  //
  // The second line is the SAME measure at a different time — your best run —
  // so it is the same hue a step darker rather than a second category. It is
  // also dashed and labelled at its end, which means identity never rests on
  // colour alone. Checked with the palette validator: ΔE 26.9 deuteranopia,
  // 27.7 normal vision, both well clear. The bright step sits above the usual
  // lightness band on purpose — cyan is the player in this game, everywhere,
  // and the run you just flew is the player.
  var TILES = [
    { k:'chain',   lab:'Best chain',    icon:'chain' },
    { k:'salvage', lab:'Dilithium',     icon:'gem'   },
    { k:'over',    lab:'Overcharges',   icon:'bolt'  },
    { k:'bosses',  lab:'Capital ships', icon:'ship'  }
  ];
  var TILE_ICONS = {
    chain:'<path d="M9.5 14.5l5-5"/><path d="M13 6.5l1.8-1.8a3.4 3.4 0 0 1 4.8 4.8L17.8 11.3"/>' +
          '<path d="M11 17.5L9.2 19.3a3.4 3.4 0 0 1-4.8-4.8L6.2 12.7"/>',
    gem:  '<path d="M12 2.5l6.5 5.5-6.5 13.5L5.5 8z"/><path d="M5.5 8h13"/><path d="M12 2.5v19"/>',
    bolt: '<path d="M13.5 2.5L6 13h5l-1.5 8.5L18 11h-5.2z"/>',
    ship: '<path d="M2.5 12h6.5"/><path d="M20 12a5.5 3 0 1 1-11 0 5.5 3 0 0 1 11 0z"/>' +
          '<path d="M8 7.5h8M8 16.5h8"/>'
  };

  function fmtAxis(v){ return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)); }

  // Time does not step in powers of ten — 100 seconds is not a mark anybody
  // reads. The unit is chosen ONCE for the whole axis from a ladder of real
  // clock intervals, so the ticks are all seconds or all whole minutes and
  // never both. Deriving each label from its own value instead is what put
  // "3m" on the axis twice: 150s and 200s both round to three minutes.
  var TIME_STEPS = [10,15,20,30,60,120,180,300,600,900,1800,3600];
  function niceTime(span, want){
    for(var i=0;i<TIME_STEPS.length;i++) if(span / TIME_STEPS[i] <= want) return TIME_STEPS[i];
    return TIME_STEPS[TIME_STEPS.length - 1];
  }
  function fmtClock(sec, step){ return step >= 60 ? (sec / 60) + 'm' : sec + 's'; }

  // a 1 / 2 / 5 × 10ⁿ step, so the gridlines land on numbers a person would
  // have chosen rather than on maxY/4
  function niceStep(span, want){
    var raw = span / want;
    if(!(raw > 0)) return 1;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }

  // A run that ends in the first couple of seconds has one sample or none, and
  // a path with a single moveto draws nothing at all — so the curve always
  // starts from the origin it actually started from.
  function prepSeries(a){
    var out = (a && a.length) ? a.slice() : [];
    if(!out.length || out[0][0] > 0.01) out.unshift([0, 0]);
    return out;
  }

  function seriesPath(a, sx, sy){
    var d = '', i;
    for(i=0;i<a.length;i++) d += (i ? 'L' : 'M') + sx(a[i][0]).toFixed(1) + ' ' + sy(a[i][1]).toFixed(1);
    return d;
  }

  function renderChart(run, best){
    if(!chartEl) return;
    // The SVG scales to the panel, so everything inside it shrinks with the
    // screen — at phone width the 9px axis type lands at about five real
    // pixels, which is not type any more. The viewBox text is scaled back up
    // in CSS, and the end labels lose their prose so the bigger lettering
    // still fits in the margin kept for it.
    var narrow = window.innerWidth < 760;
    var W = 720, H = 188, L = narrow ? 62 : 54, R = narrow ? 84 : 112, T = 16, B = 30, i, v, gy;
    var bs = (best && best.series && best.series.length) ? prepSeries(best.series) : null;
    var maxT = run[run.length - 1][0], maxY = 0;
    if(bs) maxT = Math.max(maxT, bs[bs.length - 1][0]);
    for(i=0;i<run.length;i++) maxY = Math.max(maxY, run[i][1]);
    if(bs) for(i=0;i<bs.length;i++) maxY = Math.max(maxY, bs[i][1]);
    maxT = Math.max(maxT, 10); maxY = Math.max(maxY, 10);
    var yStep = niceStep(maxY, 5), yTop = Math.ceil(maxY / yStep) * yStep;
    var xStep = niceTime(maxT, 5), xEnd = Math.ceil(maxT / xStep) * xStep;
    var pw = W - L - R, ph = H - T - B;
    function sx(t){ return L + pw * (t / xEnd); }
    function sy(q){ return T + ph * (1 - q / yTop); }

    // the grid, kept recessive: it is there to be measured against, not read
    var g = '';
    for(v = 0; v <= yTop + yStep * 0.01; v += yStep){
      gy = sy(v);
      g += '<line x1="' + L + '" y1="' + gy.toFixed(1) + '" x2="' + (L + pw) +
           '" y2="' + gy.toFixed(1) + '" class="cg"/>' +
           '<text x="' + (L - 9) + '" y="' + (gy + 3.4).toFixed(1) +
           '" class="cl cly">' + fmtAxis(v) + '</text>';
    }
    for(v = 0; v <= xEnd + xStep * 0.01; v += xStep){
      g += '<text x="' + sx(v).toFixed(1) + '" y="' + (H - 9) +
           '" class="cl clx">' + (v ? fmtClock(v, xStep) : '0') + '</text>';
    }

    var re = run[run.length - 1], ry = sy(re[1]), rx = sx(re[0]);
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ac-svg" role="img" aria-label="' +
              'Score over time. This run reached ' + re[1] +
              (bs ? '. Previous best reached ' + best.score : '. No previous run') + '.">' + g;
    if(bs){
      var be = bs[bs.length - 1], by = sy(be[1]), bx = sx(be[0]);
      // two labels at the same height collide into one illegible line, so the
      // quieter of the pair gives way
      var gap = by - ry;
      if(Math.abs(gap) < 15) by = ry + (gap < 0 ? -15 : 15);
      out += '<path d="' + seriesPath(bs, sx, sy) + '" class="cp cp-best"/>' +
             '<circle cx="' + bx.toFixed(1) + '" cy="' + sy(be[1]).toFixed(1) +
             '" r="3.4" class="ce ce-best"/>' +
             '<text x="' + (bx + 11).toFixed(1) + '" y="' + (by + 3.6).toFixed(1) +
             '" class="cl cn cn-best">BEST ' + best.score + '</text>';
    }
    out += '<path d="' + seriesPath(run, sx, sy) + '" class="cp cp-run"/>' +
           '<circle cx="' + rx.toFixed(1) + '" cy="' + ry.toFixed(1) + '" r="4.4" class="ce ce-run"/>' +
           '<text x="' + (rx + 11).toFixed(1) + '" y="' + (ry + 3.6).toFixed(1) +
           '" class="cl cn cn-run">' + (narrow ? '' : 'THIS RUN ') + re[1] + '</text>' +
           '</svg>';
    chartEl.innerHTML = out;
  }

  // The delta is an ABSOLUTE difference, not a percentage. Three more
  // overcharges than last time is a fact a player can act on; "+67%" is the
  // same fact wearing a costume, and on a denominator of three it is noise.
  function tileHtml(spec, now, best){
    var v = now[spec.k], p = best ? best[spec.k] : null, d = '';
    if(p === null || p === undefined) d = '<span class="at-d">first run</span>';
    else if(v > p) d = '<span class="at-d is-up">▲ +' + (v - p) + '</span>' +
                       '<span class="at-p">best ' + p + '</span>';
    else if(v < p) d = '<span class="at-d is-dn">▼ ' + (v - p) + '</span>' +
                       '<span class="at-p">best ' + p + '</span>';
    else d = '<span class="at-d">matched</span><span class="at-p">best ' + p + '</span>';
    return '<div class="ao-tile' + (p !== null && p !== undefined && v > p ? ' is-best' : '') + '">' +
             '<svg class="at-i" viewBox="0 0 24 24" aria-hidden="true">' + TILE_ICONS[spec.icon] + '</svg>' +
             '<span class="at-l">' + spec.lab + '</span>' +
             '<b class="at-v">' + v + '</b>' +
             '<span class="at-r">' + d + '</span>' +
           '</div>';
  }

  function renderSummary(){
    var now = runStats();
    // the curve has to end where the run ended, not up to a sample interval
    // short of it — the last thing that happened is usually the interesting one
    now.series.push([gameTime, now.score]);
    var best = loadBest();
    var beat = !best || now.score > best.score;
    if(finalEl) finalEl.textContent = now.score;
    if(finalSubEl) finalSubEl.textContent =
      now.t + 's adrift · refit ' + now.refit +
      (best ? (beat ? ' · new best' : ' · best ' + best.score) : ' · first run');
    if(tilesEl) tilesEl.innerHTML = TILES.map(function(t){ return tileHtml(t, now, best); }).join('');
    renderChart(prepSeries(now.series), best);
    // always, not only on a new high score: a run that scored badly can still
    // have set the longest chain or killed the most capital ships, and those
    // records are lost the moment they are not written down
    saveBest(mergeBest(now, best));
  }

  function heartMarkup(){
    var s = '';
    for(var i=0;i<MAX_LIVES;i++) s += '<i class="px-hull' + (i < lives ? ' on' : '') + '"></i>';
    return s;
  }

  // syncHud runs on every simulated frame, so each field is compared before it
  // is written — the lives row in particular is markup, and rebuilding it 60
  // times a second for a value that changes twice a run is pure layout churn.
  var hudLast = { score:-1, lives:-1, xp:-1, need:-1, level:-1, shield:-1, rapid:-1, boss:-1,
                  core:-1, overcharged:null, coreLab:'', chain:-1 };

  // Red alert is derived, never set: anything that moves `lives` — a hit, a
  // repair, a run reset — lands here on the next frame and the class follows.
  // Storing it as a flag that each of those sites had to remember to update is
  // exactly how a screen ends up stuck flashing red after a repair.
  function syncRedAlert(){
    var on = redAlertActive();
    if(on === redAlert) return;
    redAlert = on;
    document.body.classList.toggle('astro-red-alert', on);
  }

  function syncHud(){
    var sc = currentScore();
    syncRedAlert();
    // Only the figure is written now — the word beside it is authored in the
    // markup and never changes, and rewriting it sixty times a second was
    // rebuilding a text node to say "Stardate" again.
    if(scoreEl && sc !== hudLast.score){ scoreEl.textContent = sc; hudLast.score = sc; }
    if(livesEl && lives !== hudLast.lives){ livesEl.innerHTML = heartMarkup(); hudLast.lives = lives; }

    var need = xpNeed(level);
    if(xp !== hudLast.xp || need !== hudLast.need){
      if(xpFillEl) xpFillEl.style.width = Math.max(0, Math.min(100, xp / need * 100)).toFixed(1) + '%';
      // the crystals in hand and the crystals wanted are two tiers, not one
      // string: the left number is what moved, the right one is the target
      if(xpNumEl) xpNumEl.textContent = xp;
      if(xpNeedEl) xpNeedEl.textContent = '/ ' + need;
      hudLast.xp = xp; hudLast.need = need;
    }
    if(lvlNumEl && level !== hudLast.level){ lvlNumEl.textContent = level; hudLast.level = level; }

    // the timers only ever need whole seconds, so they are only touched when
    // that whole second actually ticks over
    var sSec = Math.ceil(shieldTime), rSec = Math.ceil(rapidTime);
    if(shieldEl && sSec !== hudLast.shield){
      shieldEl.textContent = 'Shields ' + sSec + 's';
      shieldEl.classList.toggle('on', shieldTime > 0);
      hudLast.shield = sSec;
    }
    if(rapidEl && rSec !== hudLast.rapid){
      rapidEl.textContent = 'Phasers ' + rSec + 's';
      rapidEl.classList.toggle('on', rapidTime > 0);
      hudLast.rapid = rSec;
    }

    // The core is quantised to whole percent — it is a nine-pixel ladder and
    // nothing finer than a percent can land on a different segment.
    var cPct = Math.round(core / CORE_MAX * 100);
    if(coreFillEl && cPct !== hudLast.core){
      coreFillEl.style.width = cPct + '%';
      hudLast.core = cPct;
    }
    if(overcharged !== hudLast.overcharged){
      // on the body rather than on the gauge, because the touch vent button
      // lives at the other end of the screen and has to answer the same state
      document.body.classList.toggle('astro-core-ready', overcharged);
      hudLast.overcharged = overcharged;
    }
    // The gauge has three states and the label only ever had words for two of
    // them: a press that emptied a full bar looked exactly like a bar that had
    // never filled. Charging is the noun, ready is the order, released is the
    // receipt. Derived here rather than written at the press, because
    // `overcharged` flips false on release and the branch above would
    // overwrite anything set from outside this function on the next frame.
    var cLab = overcharged ? 'Overcharge ready'
             : (gameTime < releasedT ? 'Overcharge released' : 'Overcharge');
    if(coreLabEl && cLab !== hudLast.coreLab){
      coreLabEl.textContent = cLab;
      coreLabEl.classList.toggle('is-released', cLab === 'Overcharge released');
      hudLast.coreLab = cLab;
    }
    // The chain only exists once it is worth something. Sitting at x1.00 for
    // most of a run, it would be a readout that means "nothing is happening".
    var cm = chain >= 3 ? chainMult() : 0;
    if(chainEl && cm !== hudLast.chain){
      if(cm && chainValEl) chainValEl.textContent = '\u00d7' + cm.toFixed(2);
      chainEl.classList.toggle('on', cm > 0);
      hudLast.chain = cm;
    }

    // the hull bar is the only readout that has to move smoothly, so it is
    // quantised to tenths of a percent rather than compared as a raw float
    if(bossFillEl){
      var bp = boss ? Math.round(Math.max(0, boss.hp) / boss.max * 1000) : -1;
      if(bp !== hudLast.boss){
        if(bp >= 0){
          bossFillEl.style.width = (bp / 10).toFixed(1) + '%';
          bossFillEl.classList.toggle('rage', !!(boss && boss.enraged));
        }
        hudLast.boss = bp;
      }
    }
  }

  // `src` is 'rock' or 'fire' — a rock you flew into, or something a Klingon
  // did to you. Nothing else in here cares, but ablative armour does: it is
  // the plating that vaporises under a disruptor and does nothing at all about
  // a lump of nickel-iron closing at forty metres a second.
  function hitShip(src){
    // a live shield is flat invincibility for its whole ten seconds — it does
    // not burn out on contact, which is the entire point of chasing the rock
    if(gameOver || ship.invuln > 0 || shieldTime > 0) return;
    // Ablative armour is spent before the hull is. It buys a plate and a beat
    // of grace — enough to get clear of whatever just hit you, since taking a
    // free hit and then immediately taking a real one is not a save.
    if(armourReady && src !== 'rock'){
      armourReady = false;
      armourAt = gameTime + armourEvery(up.armour);
      ship.invuln = Math.max(ship.invuln, 1.0);
      burst(ship.x, ship.y, 20, '111,232,255');
      bloom(ship.x, ship.y, 48, '111,232,255');
      shake(0.34); freeze(0.04);
      return;
    }
    lives--;
    // Losing a hull plate is the worst thing that happens to the player, so it
    // gets the second-loudest entry in the grammar — and it is the one place
    // the alert colour is allowed into a bloom.
    burst(ship.x, ship.y, 30, null, 1.4);
    bloom(ship.x, ship.y, 62, '255,45,120');
    shake(0.78); freeze(0.07);
    if(lives > 0){
      resetShip(RESPAWN_INVULN);
      // The ship comes back at the centre of the view, and a web does not
      // move. Respawning inside one meant the hull was lost again the moment
      // the grace ran out — a chain nobody could fly out of. Any web on the
      // respawn point is torn down with the old hull.
      for(var wb=webs.length-1; wb>=0; wb--){
        if(Math.hypot(webs[wb].x - ship.x, webs[wb].y - ship.y) < WEB_R * 1.2 + 90){
          burst(webs[wb].x, webs[wb].y, 10, '199,125,255', 0.7);
          webs.splice(wb, 1);
        }
      }
      syncHud();
      return;
    }
    lives = 0;
    gameOver = true;                    // loop() paints this frame, then stops
    // The whole panel — hero figure, tiles, curve — is one call, and it is
    // the only thing that ever writes it. The run used to be summarised as a
    // middot-separated sentence here; everything that sentence carried is now
    // a tile with last run's figure beside it.
    renderSummary();
    if(overEl) overEl.classList.add('on');
    // dying mid-fight left the hull bar and the inbound warning stranded on top
    // of the game-over card until the next run reset them
    if(bossBarEl) bossBarEl.classList.remove('on');
    if(warnEl) warnEl.classList.remove('on');
    hailOpen = false;
    if(hailEl) hailEl.classList.remove('on');
    closeLevel(true);
    syncHud();
  }

  // wipe the run back to zero — clock, XP, upgrades, buffs, rocks and warbirds
  function resetRun(){
    preloadArt();
    bullets = []; particles = []; aliens = []; alienBullets = []; pickups = [];
    bonus = 0; nextAlienAt = ALIEN_FIRST;
    boss = null; bossWarn = 0; bossCount = 0; bossKills = 0; bossFled = 0; nextBossAt = BOSS_FIRST;
    wings = []; contact = null; lastFac = null; bossSeen = {}; warpReady = true;
    hailOpen = false;
    if(bossBarEl) bossBarEl.classList.remove('on');
    if(hailEl) hailEl.classList.remove('on');
    if(warnEl) warnEl.classList.remove('on');
    gameTime = 0; lastFrame = performance.now();
    speedMult = speedMultAt(0); rockSpawnAcc = 0;
    lives = START_LIVES;
    xp = 0; level = 1; pendingLevels = 0; refitDealt();
    shieldTime = 0; rapidTime = 0; nextGuard = 0;
    armourReady = false; armourAt = 0;
    for(var k in up) up[k] = 0;
    hull = null; refits = 0;
    autoPaused = false;
    torpedoes = []; shockwaves = []; mines = []; wake = []; arcOn = [];
    blooms = []; trauma = 0; hitStop = 0;
    surges = []; webs = []; core = 0; overcharged = false; releasedT = 0;
    grazeTotal = 0; overchargeCount = 0;
    dilithium = 0; runSeries = []; runStep = 2; runNext = 0;
    chain = 0; chainT = 0; chainBest = 0;
    nextTorp = 0; nextMine = 0; nextWake = 0; nextEmber = 0;
    redAlert = true;                 // force syncRedAlert to re-evaluate
    syncRedAlert();
    closeLevel(true);
    resetShip(INVULN);
    spawnAsteroids();
    for(var f in hudLast) hudLast[f] = -1;   // force a full repaint of the HUD
    syncHud();
  }

  function restart(){
    if(!gameOver) return;
    gameOver = false;
    if(overEl) overEl.classList.remove('on');
    resetRun();
    openPick();
    raf = requestAnimationFrame(loop);
  }

  // ── hulls, and the three cards they own ────────────────────────────
  // Three of the sixteen cards are not upgrades at all: they are whole
  // weapons, and which one you have decides how the first two minutes of a
  // run are actually flown. Drawing one of those three at refit 2 used to be
  // the single biggest thing that happened to a run, and it happened to you
  // rather than being chosen — so they are now the hull you pick before the
  // field spawns, and the run opens with the weapon already warm.
  //
  // The other two are not gone, they are held back. The first opens at refit
  // 3 and the second at refit 5, counted in cards actually taken rather than
  // in the XP level, so a run that took three salvage cards off capital ships
  // reaches them three cards sooner. That ordering is the whole design: the
  // first third of a run is one weapon and the build on top of it, the middle
  // is the second weapon arriving into a ship already shaped, and only a long
  // run ever flies all three. Once a card is open it behaves like every other
  // card in the deck — rolled at random, stacked to its own max, no special
  // case anywhere in choose().
  var SIG = ['torp', 'spread', 'mine'];
  var hull = null;      // which of the three this run started with
  var refits = 0;       // cards taken, salvage included

  // Deterministic, so a run can be read back: the two you did not pick open
  // in SIG order, the first at 3 and the second at 5. They were 6 and 12
  // until the XP curve steepened in Sep 2026; 3 and 5 land at about the same
  // points in the run as 6 and 12 used to (a minute in, and two and a half).
  function sigUnlock(id){
    if(!hull) return Infinity;
    var others = [], i;
    for(i=0;i<SIG.length;i++) if(SIG[i] !== hull) others.push(SIG[i]);
    var at = others.indexOf(id);
    return at < 0 ? 0 : (at === 0 ? 3 : 5);
  }
  function sigOpen(id){ return hull === id || refits >= sigUnlock(id); }

  // The three hulls. This panel opens once, before the field exists, and the
  // question it asks is small: which of these three do I want to be flying.
  // So the card carries the fewest things that can answer it — the ship, its
  // class and type, and the gun it opens with — and nothing else. The gun is
  // named off the upgrade roster rather than typed out here, so the card says
  // exactly what the refit deck will later call it.
  //
  // `art` is the ship as supplied, used as is. It is not the ship the game
  // flies — that one is painted on canvas by paintFed() and has to read at
  // thirty pixels while moving. This is the opposite job: still, large, and looked at
  // for as long as the player wants.
  //
  // `tint` is the card's colour, and it is the only place in the game where a
  // colour is chosen per ship rather than per category. It is safe here
  // because this panel opens once, before the field exists, and the three
  // categories it would otherwise clash with are not on screen: there are no
  // upgrade cards in a hull draft. Amber, cyan, violet in roster order, which
  // is the same three hues the deck uses, so the palette stays closed.
  var SHIPS = [
    { id:'torp',   name:'Defiant class',   role:'Escort',  tint:'gun',  art:'game/escort.svg' },
    { id:'spread', name:'Sovereign class', role:'Cruiser', tint:'hull', art:'game/cruiser.svg' },
    { id:'mine',   name:'Nova class',      role:'Scout',   tint:'ship', art:'game/scout.svg' }
  ];

  function applyHull(id){
    hull = id;
    up[id] = 1;
    // The plate count is part of the hull, not part of the run, so it is set
    // here rather than at reset — reset runs before a hull exists. This is
    // also the only thing on the pick panel that can make a run harder: the
    // Nova opens on two plates, which is a third of the baseline run's health
    // economy gone before anything has spawned.
    lives = Math.min(MAX_LIVES, hullMods().lives);
    if(id === 'torp') nextTorp = gameTime + 0.8;
    if(id === 'mine') nextMine = gameTime + 0.8;
  }

  // ── the upgrade pool ─────────────────────────────────────────────────────
  // Seventeen entries, three offered per level. Every line a card prints is
  // computed from the live stat functions rather than written out, so a card
  // can never promise a number the ship does not actually get.
  //
  // The pool grew from nine in Sep 2026 and that has a cost worth knowing: a
  // specific card now shows up in roughly a fifth of drafts rather than a
  // third. That is the trade a bigger deck makes — more builds, less control
  // over reaching one — and it is why the situational entries are gated
  // rather than always on offer: Targeting Sensors needs a torpedo bay,
  // Damage Control needs a missing hull plate, and the three signature
  // weapons are held behind the hull you picked (see sigOpen). Five of the
  // seventeen are gated, so an early draft is really drawn from fourteen.

  // One arrow, everywhere a figure changes. U+2192 rather than the heavy
  // U+2794 the cards used to carry: at 13px in a mono face the heavy arrow
  // out-weighed the numbers on either side of it, and the numbers are the
  // thing being compared.
  var ARROW = ' \u2192 ';

  // Both weapon cards move the same underlying number, and the Cone moves it
  // the wrong way, so they quote it through one helper. Whole figures read
  // cleaner, but it drops to a decimal when rounding would print the same
  // number twice and make a real change look like a no-op.
  function rateLine(fireL, spreadL){
    var a = 1 / shotCooldown(), b = 1 / cooldownWith(fireL, spreadL, rapidTime > 0);
    var dp = Math.round(a) === Math.round(b) ? 1 : 0;
    return a.toFixed(dp) + ARROW + b.toFixed(dp) + ' shots/sec';
  }
  function pct(from, to){ return '+' + Math.round((to / from - 1) * 100) + '%'; }

  // ── the upgrade roster ───────────────────────────────────────────────────
  // Every card carries four things, and the card is set as a ladder that
  // descends through them in this order: the CATEGORY, so a draw can be sorted
  // at a glance; the NAME, which is the headline — it is what the card is
  // called and it is what you say to yourself when you pick it; then a plain
  // SENTENCE saying what it actually does in ordinary words; then the FIGURES.
  // The name tells you which shipboard system this is; the sentence tells you
  // what taking it does to you. Every tier is smaller and dimmer than the one
  // above it, so the card has a single obvious top.
  //
  // The figures are still computed from the live stat functions rather than
  // written out, so a card can never promise a value the ship does not get,
  // and they are quoted in units a player can feel: shots per second, targets
  // hit, seconds of cover. No pixel counts — nobody can see 165px.
  //
  // ── the four words the whole deck is written in ──────────────────────────
  // A player reading three cards in a frozen second cannot also be learning a
  // vocabulary, so every card uses the same four nouns for the same four
  // things and never a synonym:
  //
  //   shot    one pull of the trigger. Rate is quoted in shots/sec.
  //   beam    one phaser round in flight. Damage, speed, range and how many
  //           targets it passes through are all properties of a BEAM.
  //   torpedo the homing warhead. Never "missile", never "round".
  //   mine    the thing you leave behind you. It is laid, never fired.
  //   hull    the plates you lose on a hit. Never "life", never "health".
  //
  // That is why the Cone quotes "beams per shot" and the Array quotes
  // "shots/sec" — the two figures look alike and mean different things, and
  // the nouns are what tells them apart.
  //
  // Every `benefit` is one short sentence, in the second person, ending in a
  // full stop. It is the line the card is picked on, so it says what YOU get
  // rather than what the system is called.
  var UPGRADES = [
    { id:'fire', cat:'gun', name:'Phaser Array', role:'Rate', max:5,
      benefit:'Your phasers fire faster.',
      lines:function(){ return [rateLine(up.fire + 1, up.spread)]; } },

    { id:'ram', cat:'gun', name:'Ramming Speed', role:'Impact', max:3,
      // the capital-ship exemption has to be on the card. It is not a detail:
      // without it the only way to learn the rule is to ram a dreadnought at
      // full impulse and lose a hull plate finding out.
      benefit:'Fly into asteroids to break them.',
      what:'Not capital ships.',
      lines:function(){
        return up.ram
          ? [ramDamage() + ARROW + (ramDamage() + 3) + ' impact damage',
             'Needs ' + Math.round(ramThreshold() * 100) + '%' + ARROW +
             Math.round((0.86 - 0.06 * up.ram) * 100) + '% of top speed']
          : [(ramDamage() + 3) + ' impact damage',
             'Needs ' + Math.round(0.86 * 100) + '% of top speed'];
      } },

    { id:'thrust', cat:'ship', name:'Impulse Drive', role:'Handling', max:4,
      benefit:'Your ship moves faster and turns quicker.',
      lines:function(){ return ['+' + Math.round(THRUST_STEP * 100) + '% thrust',
                                '+' + Math.round(TURN_STEP * 100) + '% turn rate']; } },

    // The one card in the deck that costs something, and the only one with a
    // `cost` line. It needs one: every other figure on every other card is a
    // gain, so "4 \u2192 3 shots/sec" set in the same cyan as the line above it
    // reads as a third improvement at a glance \u2014 and the sentence that used to
    // carry the warning is only printed the first time the card is offered,
    // which is the one time you are least likely to be taking it.
    { id:'spread', cat:'gun', name:'Phaser Array Cone', role:'Coverage', max:3,
      avail:function(){ return sigOpen('spread'); },
      benefit:'Fire a wider spread of beams.',
      what:'Wider cover, slower cycle.',
      lines:function(){ return [barrels(up.spread) + ARROW + barrels(up.spread + 1) +
                                ' beams per shot']; },
      cost:function(){ return [rateLine(up.fire, up.spread + 1)]; } },

    // The only card that adds a whole weapon rather than moving a number, so
    // it is worth a level of its own before it starts scaling.
    { id:'torp', cat:'gun', name:'Photon Torpedo Bay', role:'Warheads', max:4,
      avail:function(){ return sigOpen('torp'); },
      benefit:'Adds torpedoes that chase their target.',
      what:'They fire and reload on their own.',
      lines:function(){
        return up.torp
          ? [torpDamage() + ARROW + (torpDamage() + 1) + ' blast damage',
             'Reloads every ' + torpCooldown().toFixed(1) + 's' + ARROW +
             (TORP_COOLDOWN * Math.pow(0.82, up.torp)).toFixed(1) + 's']
          : [TORP_DMG + ' blast damage',
             'Reloads every ' + TORP_COOLDOWN.toFixed(1) + 's'];
      },
      apply:function(){ up.torp++; nextTorp = gameTime + 0.8; } },

    // The third whole weapon, and the only one aimed by where you flew rather
    // than by where you are pointing.
    { id:'mine', cat:'gun', name:'Tricobalt Mine Layer', role:'Mines', max:4,
      avail:function(){ return sigOpen('mine'); },
      benefit:'Leave mines behind you that wait for a target.',
      what:'They arm on their own and never touch your hull.',
      lines:function(){
        return up.mine
          ? [mineDamage() + ARROW + (mineDamage() + 1) + ' blast damage',
             'Lays every ' + mineCooldown().toFixed(1) + 's' + ARROW +
             (MINE_COOLDOWN * Math.pow(0.82, up.mine)).toFixed(1) + 's',
             mineRack() + ARROW + (MINE_RACK + 2 * (up.mine + 1)) + ' mines in the rack']
          : [MINE_DMG + ' blast damage',
             'Lays every ' + MINE_COOLDOWN.toFixed(1) + 's'];
      },
      apply:function(){ up.mine++; nextMine = gameTime + 0.8; } },

    { id:'wake', cat:'gun', name:'Warp Plasma Vent', role:'Wake', max:4,
      benefit:'Leave a burning trail behind you.',
      what:'Anything that flies through it takes damage.',
      lines:function(){
        return up.wake
          ? [wakeDamage() + ARROW + wakeDamageAt(up.wake + 1) + ' burn damage',
             'Trail lasts ' + wakeLife().toFixed(1) + 's' + ARROW +
             (WAKE_LIFE * (1 + 0.35 * up.wake)).toFixed(1) + 's']
          : [wakeDamageAt(1) + ' burn damage',
             'Trail lasts ' + WAKE_LIFE.toFixed(1) + 's'];
      } },

    { id:'pierce', cat:'gun', name:'Polarised Emitters', role:'Pierce', max:3,
      benefit:'Your beams pass through targets.',
      what:'One shot can clear a line of rock.',
      lines:function(){ return ['Each beam hits ' + (up.pierce + 1) + ARROW +
                                (up.pierce + 2) + ' targets']; } },

    { id:'dmg', cat:'gun', name:'Warp Core Output', role:'Damage', max:4,
      benefit:'Your weapons deal more damage.',
      lines:function(){ return ['Beam damage ' + bulletDamage() + ARROW + (bulletDamage() + 1),
                                'Torpedoes hit harder']; } },

    { id:'arc', cat:'gun', name:'Hull Arc Coils', role:'Close', max:3,
      benefit:'Burn anything that gets too close.',
      what:'No aiming. It covers the hull.',
      lines:function(){
        return up.arc
          ? [arcDps().toFixed(1) + ARROW + (ARC_DPS * (up.arc + 1) + up.dmg * 0.8).toFixed(1) +
             ' damage/sec', pct(arcRange(), arcRangeAt(up.arc + 1)) + ' reach']
          : [ARC_DPS.toFixed(1) + ' damage/sec', 'At arm\u2019s length'];
      } },

    { id:'range', cat:'gun', name:'Long-Range Emitters', role:'Reach', max:3,
      benefit:'Hit enemies from further away.',
      lines:function(){ return ['+12% beam speed', '+15% beam range']; } },

    // The collector. It was always a magnet; as a tractor beam it finally
    // looks like the thing it has been doing all along, and the draw is drawn
    // on the field, so the range is visible rather than a figure on a card.
    { id:'magnet', cat:'ship', name:'Tractor Beam', role:'Collect', max:3,
      benefit:'Pull dilithium in from further out.',
      // through hullMods() on both sides of the arrow: the Nova already pulls
      // from further out, and a card that quoted the unmodified figure would
      // promise it a jump it does not get.
      lines:function(){ return [pct(magnetRange(),
                                MAGNET_R * hullMods().magnet * (1 + MAGNET_STEP * (up.magnet + 1))) +
                                ' pull range']; } },

    { id:'guard', cat:'hull', name:'Deflector Overcharge', role:'Defence', max:3,
      benefit:'Your shields raise themselves.',
      what:'Runs on a timer. Nothing to press.',
      lines:function(){
        return up.guard
          ? [GUARD_TIME + 's untouchable',
             'Every ' + guardEvery(up.guard) + 's' + ARROW + guardEvery(up.guard + 1) + 's']
          : [GUARD_TIME + 's untouchable', 'Every ' + guardEvery(1) + 's'];
      },
      // the first one should land while the choice is still fresh in mind
      apply:function(){ up.guard++; nextGuard = gameTime + 2; } },

    // Only on offer once there is a bay to point. A tracking card in a deck
    // where the player has no torpedoes is a wasted third of a draft.
    { id:'seek', cat:'gun', name:'Targeting Sensors', role:'Tracking', max:3,
      avail:function(){ return up.torp > 0; },
      benefit:'Your torpedoes track their target better.',
      lines:function(){ return ['+45% turn rate', '+30% lock range']; } },

    // The card that answers rock directly. Everything else defensive in this
    // deck answers "getting hit"; this one answers the thing doing ~70% of it.
    { id:'deflector', cat:'hull', name:'Navigational Deflector', role:'Screen', max:3,
      benefit:'Push asteroids away from your bow.',
      lines:function(){
        return up.deflector
          ? [pct(deflectRange(), DEFLECT_R * (1 + 0.30 * up.deflector)) + ' wider field']
          : ['Always on'];
      } },

    // Deliberately the other half of the Navigational Deflector: that card
    // answers rock, which is ~70% of the damage in this game, and this one
    // answers the Klingons, which is the rest. Measured as a plate that
    // stopped *everything* it was worth a whole extra hull — +22s on a 73s
    // baseline, against +10s for a maxed Deflector Overcharge — because a life
    // in this run is worth about 24 seconds and a free hit is a whole life.
    //
    // It carries no `what`. "It grows back on its own" was the third tier of a
    // card whose second tier already reads "Regrows every 37s".
    { id:'armour', cat:'hull', name:'Ablative Armour', role:'Armour', max:3,
      benefit:'Survive one extra hit.',
      lines:function(){
        return up.armour
          ? ['Regrows every ' + armourEvery(up.armour) + 's' + ARROW +
             armourEvery(up.armour + 1) + 's']
          : ['Absorbs one hit', 'Regrows every ' + armourEvery(1) + 's'];
      },
      apply:function(){ up.armour++; armourReady = true; } },

    { id:'life', cat:'hull', name:'Damage Control', role:'Repair', max:99,
      avail:function(){ return lives < MAX_LIVES; },
      benefit:'Repair a hull plate right now.',
      lines:function(){ return ['Hull ' + lives + ARROW + (lives + 1) + ' plates']; },
      apply:function(){ lives = Math.min(MAX_LIVES, lives + 1); } }
  ];

  function upgradeOpen(u){
    if(u.avail && !u.avail()) return false;
    if(u.id in up) return up[u.id] < u.max;
    return true;
  }

  // Fisher-Yates over what is still on offer, then take the first three. A
  // maxed-out line simply stops appearing rather than showing up greyed.
  // Systems you already fly come up a little more often than ones you don't.
  // With five or six cards in a typical run, a flat draw from fourteen almost
  // never offers the same system twice, so a build never gets finished and
  // MAX is a word nobody sees. OWNED_WEIGHT tilts the draw without fixing it:
  // a draft is still mostly new things. Weighted sampling without
  // replacement: each card's key is random^(1/weight), highest three win.
  var OWNED_WEIGHT = 1.8;
  function rollChoices(){
    var pool = UPGRADES.filter(upgradeOpen).map(function(u){
      var w = (up[u.id] > 0) ? OWNED_WEIGHT : 1;
      return { u: u, k: Math.pow(Math.random(), 1 / w) };
    });
    pool.sort(function(a, b){ return b.k - a.k; });
    return pool.slice(0, 3).map(function(p){ return p.u; });
  }

  // ── level up overlay ─────────────────────────────────────────────────────
  var levelEl     = document.getElementById('astroLevel');
  var levelGridEl = document.getElementById('astroLevelGrid');
  var levelKindEl = document.getElementById('astroLevelKind');
  var levelSubEl  = document.getElementById('astroLevelSub');
  var levelBarEl  = document.getElementById('astroLevelBar');
  var levelHintEl = document.getElementById('astroLevelHint');
  var levelChoices = [];
  // Which card is under the cursor or the keyboard. The panel has no confirm
  // step — a click picks — so "selected" is not a staging area, it is simply
  // the card the next Enter would take. It exists because a keyboard player
  // had no way to see which of the three they were on: focus landed on card
  // one and Tab was swallowed, so the only route in was to already know the
  // number. Arrow keys move it, the mouse moves it, and the header bar shows
  // where it is.
  var levelSel = 0;
  // Where this card came from. A card the XP rail paid for is a refit and is
  // numbered; a card a capital ship paid for is salvage and is not, because
  // beating a boss does not move `level` — the XP curve owns that number, and
  // quietly bumping it would make the *next* refit dearer, which is a hidden
  // penalty dressed as a reward. So the header tells the truth instead.
  var levelKind = '';
  // The panel has two jobs now. It is the refit card, and once a run — before
  // the field exists — it is the hull pick. Same overlay, same three columns,
  // same digit keys and the same selection, because the alternative was a
  // second modal that a player would have to learn to read from scratch for
  // one decision. `levelMode` is the only thing that differs, and it is read
  // in exactly three places: the header, the render, and choose().
  var levelMode = '';

  function renderLevelHeader(){
    if(levelMode === 'pick'){
      if(levelKindEl) levelKindEl.textContent = 'Shakedown';
      // The sub-line's one job is to stop the panel being read as a weapon
      // menu. Three ships that only differed by opening gun is what this used
      // to be, and a player who assumes that still applies will pick on the
      // gun and then wonder why the Sovereign will not turn.
      if(levelSubEl) levelSubEl.innerHTML =
        'Pick a ship \u00b7 each one flies differently';
      if(levelHintEl) levelHintEl.innerHTML =
        'Choose a hull \u00b7 <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>';
      return;
    }
    if(levelHintEl) levelHintEl.innerHTML =
      'Choose an upgrade \u00b7 <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>';
    var salvage = levelKind === 'salvage';
    if(levelKindEl) levelKindEl.textContent = salvage ? 'Battle salvage' : 'Field refit';
    if(levelSubEl) levelSubEl.innerHTML = salvage
      ? 'Hull broken \u00b7 choose one upgrade'
      : 'Refit <b>' + level + '</b> \u00b7 choose one upgrade';
  }

  // The small label above the name. It used to be the card's internal role
  // word — Coverage, Wake, Pierce, Reach — which asked the player to learn a
  // vocabulary to read a card they have one second for. The category answers
  // the only question the label was ever doing useful work on: is this a gun,
  // a hull plate or the ship. It also matches the colour it is already
  // printed in, so the word and the colour now say the same thing.
  var CAT_LABEL = { gun:'Weapons', hull:'Defence', ship:'Ship' };

  // One glyph per upgrade, because three frozen seconds is not long enough to
  // read three names. The icon is the fastest thing on the card: it says gun,
  // shield or engine before a word has been parsed, and it wears the
  // category's own colour so the shape and the hue agree. Stroke-only at 24px,
  // in the same hairline weight the rest of the chrome is drawn in — a filled
  // pictogram would read as borrowed from another game, the same way a solid
  // heart did in the hull row.
  var UP_ICONS = {
    fire:     '<path d="M3 8h11M3 12h14M3 16h11"/><path d="M18 9.5l3.5 2.5-3.5 2.5z"/>',
    ram:      '<path d="M12 3v11"/><path d="M8 10.5l4 4 4-4"/><path d="M4 19h16"/>',
    thrust:   '<path d="M20 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"/><path d="M16.8 12h-.01"/>' +
              '<path d="M9 8H3M9 12H1.5M9 16H4"/>',
    spread:   '<path d="M3 12h4"/><path d="M7 12l13-6M7 12h13M7 12l13 6"/>',
    torp:     '<path d="M8 8.5h7.5l4 3.5-4 3.5H8z"/><path d="M6 12H2M6 9.5H4M6 14.5H4"/>',
    mine:     '<path d="M16.4 12a4.4 4.4 0 1 1-8.8 0 4.4 4.4 0 0 1 8.8 0z"/>' +
              '<path d="M12 2.6v5M12 16.4v5M2.6 12h5M16.4 12h5"/>' +
              '<path d="M5.3 5.3l3.6 3.6M15.1 15.1l3.6 3.6M18.7 5.3l-3.6 3.6M8.9 15.1l-3.6 3.6"/>',
    wake:     '<path d="M21 9.5h-4M21 14.5h-4"/><path d="M17 12c-2.2-2.4-4.4 2.4-6.6 0S6 14.4 3.8 12"/>',
    pierce:   '<path d="M2 12h20"/><path d="M18 8l4 4-4 4"/><path d="M8 6v12M13 6v12"/>',
    dmg:      '<path d="M12 2.6l7.4 4.2v8.4L12 19.4 4.6 15.2V6.8z"/><path d="M13.2 7.6L9.8 12h3.4l-2.4 4.4"/>',
    arc:      '<path d="M13.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0z"/>' +
              '<path d="M8.6 8.2a5 5 0 0 0 0 7.6M15.4 8.2a5 5 0 0 1 0 7.6"/>' +
              '<path d="M5.4 4.8a9.4 9.4 0 0 0 0 14.4M18.6 4.8a9.4 9.4 0 0 1 0 14.4"/>',
    range:    '<path d="M3 7.5v9M21 7.5v9"/><path d="M3 12h18"/><path d="M17 9l3 3-3 3"/>',
    magnet:   '<path d="M3 9.5v5"/><path d="M3 12h2.5"/><path d="M5.5 9l11-3.6M5.5 15l11 3.6"/>' +
              '<path d="M21 12a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0z"/>',
    guard:    '<path d="M12 2.8l7 3v6.2c0 4-3 7-7 9-4-2-7-5-7-9V5.8z"/>' +
              '<path d="M13.2 8.4L10 12.4h3.2l-2.2 4"/>',
    seek:     '<path d="M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>' +
              '<path d="M12.8 12a.8.8 0 1 1-1.6 0 .8.8 0 0 1 1.6 0z"/>',
    deflector:'<path d="M12 2.8l7 3v6.2c0 4-3 7-7 9-4-2-7-5-7-9V5.8z"/>' +
              '<path d="M12 6.8l3.6 1.6v3.2c0 2.1-1.5 3.7-3.6 4.7-2.1-1-3.6-2.6-3.6-4.7V8.4z"/>',
    armour:   '<path d="M12 2.8l7 3v6.2c0 4-3 7-7 9-4-2-7-5-7-9V5.8z"/><path d="M5 10.5h14M5 15h12"/>',
    life:     '<path d="M8.8 3.6h6.4l3.6 3.6v6.4l-3.6 3.6H8.8l-3.6-3.6V7.2z"/>' +
              '<path d="M12 8v5M9.5 10.5h5"/>'
  };
  function upPath(u){
    return UP_ICONS[u.id] ||
      UP_ICONS[u.cat === 'hull' ? 'deflector' : (u.cat === 'ship' ? 'thrust' : 'fire')];
  }
  function upIcon(u){
    return '<svg class="au-i is-' + (u.cat || 'gun') + '" viewBox="0 0 24 24" aria-hidden="true">' +
      upPath(u) + '</svg>';
  }

  // One painting per upgrade, cut from the sheet in game/upgrade.png and named
  // by the upgrade's id, so the roster and the folder can never disagree about
  // which picture belongs to which card.
  var UP_ART = 'assets/upgrades/';
  function upArt(u){ return UP_ART + u.id + '.png'; }
  // Fetched once, when the first run starts rather than when the page loads:
  // most visitors never open the game, and the refit card is up for three
  // frozen seconds, which is no time to watch a picture arrive.
  var artLoaded = false;
  function preloadArt(){
    if(artLoaded) return;
    artLoaded = true;
    UPGRADES.forEach(function(u){ var im = new Image(); im.src = upArt(u); });
  }

  // `benefit` is on every card every time and carries the whole plain meaning.
  // `what` is optional and only set where there is a second thing worth saying —
  // a caveat, or a mechanic you would otherwise have to discover. Eight of the
  // sixteen have one. When every card had one they all restated the benefit in
  // longer words, which is three tiers of card saying one thing.

  // Gains first, then anything the card takes off you. A cost is not set in
  // the cyan the gains are \u2014 it is the card's one line that is not good news,
  // and it carries a down arrow rather than the hairline tick, so which way it
  // points is legible without reading the number and without depending on the
  // colour to say it.
  function figures(u){
    var out = u.lines().map(function(s){ return '<span>' + s + '</span>'; }).join('');
    if(u.cost) out += u.cost().map(function(s){
      return '<span class="is-cost">' + s + '</span>';
    }).join('');
    return out;
  }

  function renderChoices(){
    if(!levelGridEl) return;
    levelChoices = rollChoices();
    levelGridEl.innerHTML = '';
    // The pool can run dry late in a long run and hand back two cards, or one.
    // The count goes on the overlay so the header bar and the grid both read
    // it and stay in step — otherwise a two-card draft comes out as two cards
    // and a hole where the third column was.
    if(levelEl) levelEl.style.setProperty('--al-n', levelChoices.length);
    if(levelBarEl) levelBarEl.innerHTML = '';
    markKeyboard(false);
    levelChoices.forEach(function(u, i){
      var lvl = (u.id in up) ? up[u.id] : 0;
      var stacked = u.id in up;
      // The last level says so. With cards rarer, finishing a system is
      // something to aim at, and "MAX" is the word that tells you you're one
      // pick away from it.
      var badge = !stacked ? 'ONE USE'
                : (lvl === 0 ? 'NEW' : 'LV ' + lvl + ARROW + (lvl + 1 >= u.max ? 'MAX' : lvl + 1));
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'au-opt has-art is-' + (u.cat || 'gun');
      // Category and level share one row, then the name, then the plain
      // sentence, then — only the first time a card is offered — the one
      // muted line that qualifies it, and the figures last, hard against the
      // foot of the card. The name is the largest and brightest thing here and
      // every tier under it steps down in both, which is the whole of why the
      // card reads in one pass.
      //
      // The caveat moved ABOVE the figures to get that last part. Pinning the
      // figures to the bottom of every card puts all three rules on one line
      // across the row, so the numbers can be read as a table rather than
      // hunted for at three different heights — and a four-word caveat belongs
      // next to the sentence it qualifies anyway, not stranded under the
      // numbers it says nothing about.
      //
      // The artwork heads the card and replaces the watermark: the watermark
      // was there to give a tall card some weight, and the art does that job
      // while also being the fastest thing on the card to read. The key cap
      // moves into the label row beside the level pill, because its old
      // corner is now the top of a picture.
      btn.innerHTML =
        '<span class="au-art"><img src="' + upArt(u) + '" alt="" decoding="async"></span>' +
        '<span class="au-l">' + upIcon(u) +
          '<em class="is-' + (u.cat || 'gun') + '">' +
          (CAT_LABEL[u.cat] || CAT_LABEL.gun) + '</em>' +
          '<b class="au-lv' + (lvl === 0 && stacked ? ' is-new' : '') +
          (!stacked ? ' is-once' : '') + '">' + badge + '</b>' +
          '<span class="au-k">' + (i + 1) + '</span></span>' +
        '<span class="au-n">' + u.name + '</span>' +
        '<span class="au-b">' + u.benefit + '</span>' +
        (lvl > 0 || !u.what ? '' : '<span class="au-w">' + u.what + '</span>') +
        '<span class="au-d">' + figures(u) + '</span>';
      // pointerdown, not click: on a phone the 300ms a synthetic click can cost
      // is 300ms of a frozen field, and the overlay is the only thing on screen
      btn.addEventListener('pointerdown', function(e){ e.preventDefault(); choose(i); });
      // The cursor moves the selection so there is only ever one highlighted
      // card, however you are driving it. Mouse and pen only: on a touch
      // screen pointerenter fires as part of the tap that is already picking
      // the card, and lighting it for one frame on the way out is noise.
      btn.addEventListener('pointerenter', function(e){
        if(e.pointerType === 'touch') return;
        markKeyboard(false);
        selectCard(i, false);
      });
      btn.addEventListener('focus', function(){ selectCard(i, false); });
      levelGridEl.appendChild(btn);
      if(levelBarEl) levelBarEl.appendChild(document.createElement('i'));
    });
    selectCard(0, false);
  }

  // Paint the selection onto the cards and onto the header bar. The bar is the
  // reason the selection is worth tracking at all: it used to be a decorative
  // LCARS rule that looked like a progress meter stuck at 70%, which is a
  // readout promising information it did not have. It is now three blocks
  // sitting directly over the three columns, and the lit one is the card you
  // are on — the same fact the card's own edge is showing, said a second time
  // somewhere the eye is already resting.
  function paintSelection(){
    if(!levelGridEl) return;
    var cards = levelGridEl.children, i;
    for(i = 0; i < cards.length; i++){
      var on = i === levelSel;
      cards[i].classList.toggle('is-sel', on);
      cards[i].setAttribute('aria-current', on ? 'true' : 'false');
    }
    if(levelBarEl){
      var segs = levelBarEl.children;
      for(i = 0; i < segs.length; i++) segs[i].classList.toggle('is-on', i === levelSel);
    }
  }

  // Which input last moved the selection. :focus-visible would answer this for
  // free if it could be trusted here, but it is a browser heuristic about real
  // user input and it does not engage for focus moved programmatically — which
  // is exactly how this panel moves it. So the ring is driven off the thing
  // that actually knows: the handler that moved it.
  function markKeyboard(on){
    if(levelGridEl) levelGridEl.classList.toggle('is-key', !!on);
  }

  function selectCard(i, focus){
    if(!levelChoices.length) return;
    levelSel = (i + levelChoices.length) % levelChoices.length;
    paintSelection();
    // preventScroll for the same reason openLevelUp needs it: the run drives
    // window.scrollY every frame and a focus-induced scroll fights the camera
    var el = focus && levelGridEl && levelGridEl.children[levelSel];
    if(el) try { el.focus({ preventScroll:true }); } catch(e){ el.focus(); }
  }

  // ── the hull card ────────────────────────────────────────────────────────
  // This is the one panel in the game that gets a layout of its own rather
  // than reusing the refit card. It earns it: a refit card is read in three
  // frozen seconds against a field that is about to start moving again, so it
  // is four tiers of text and nothing else. The hull pick is read BEFORE the
  // run exists, with no clock running and nothing on screen to get back to —
  // so it can afford to lead on a large picture of each ship, and it needs
  // one, because it is the only panel where the player is comparing three
  // ships rather than three numbers.
  //
  // It still reuses .au-opt for the frame, the selection, the lift and the
  // key cap, because those behaviours are the ones the player is about to see
  // again at every refit for the rest of the run, and re-teaching them here
  // would be a second modal to learn for one decision.

  // How each hull flies, read straight off HULL_MODS so a card can never
  // show a strength the ship does not have. Speed and turning are ten pips
  // scaled to the best of the three, so the fastest hull fills its bar and
  // the others show how far behind it they are. Hull is shown as plates, in
  // the same shape the HUD draws them, so the player has already learned the
  // readout before the run starts.
  function hullTop(m){ return THRUST * m.thrust * m.drag / (1 - m.drag); }
  // Beams a second off the pick panel's starting weapon: the Sovereign opens
  // with a three-beam cone at the drag that cone costs, the other two with
  // one beam. This is what the Phasers row ranks.
  function hullBeams(id, m){
    var spreadL = id === 'spread' ? 1 : 0;
    return barrels(spreadL) / (SHOT_COOLDOWN * m.cool * Math.pow(SPREAD_DRAG, spreadL));
  }
  // The pips RANK the three hulls rather than measuring each one from zero.
  // Measured from zero, a 315px/s ship and a 500px/s one came out as eight
  // pips against ten, and every row on every card looked full — which is how
  // three ships that fly very differently read as the same ship. Now the best
  // hull on a row gets ten, the worst gets three, and the middle one sits
  // where its number puts it, so each card's strong row and weak row show.
  function shipStats(sh){
    var m = HULL_MODS[sh.id] || HULL_BASE, i;
    var rows = { top: [], rot: [], beams: [] };
    for(i = 0; i < SHIPS.length; i++){
      var o = HULL_MODS[SHIPS[i].id] || HULL_BASE;
      rows.top.push(hullTop(o)); rows.rot.push(o.rot); rows.beams.push(hullBeams(SHIPS[i].id, o));
    }
    function rank(list, v){
      var lo = Math.min.apply(null, list), hi = Math.max.apply(null, list);
      return hi > lo ? 0.3 + 0.7 * (v - lo) / (hi - lo) : 1;
    }
    function pips(k, v){
      var n = Math.max(1, Math.min(10, Math.round(v * 10))), out = '';
      for(var j = 1; j <= 10; j++) out += '<i' + (j <= n ? ' class="on"' : '') + '></i>';
      return '<span class="sp-row"><em>' + k + '</em>' +
        '<span class="sp-pips" role="img" aria-label="' + k + ' ' + n + ' of 10">' + out + '</span></span>';
    }
    var plates = '';
    for(i = 0; i < MAX_LIVES; i++) plates += '<i class="px-hull' + (i < m.lives ? ' on' : '') + '"></i>';
    return '<span class="sp-stats">' +
      pips('Speed', rank(rows.top, hullTop(m))) +
      pips('Turning', rank(rows.rot, m.rot)) +
      pips('Phasers', rank(rows.beams, hullBeams(sh.id, m))) +
      '<span class="sp-row"><em>Hull</em>' +
        '<span class="sp-plates" role="img" aria-label="' + m.lives + ' hull plates">' + plates + '</span></span>' +
      '</span>';
  }

  function renderShips(){
    if(!levelGridEl) return;
    levelChoices = SHIPS;
    levelGridEl.innerHTML = '';
    if(levelEl) levelEl.style.setProperty('--al-n', SHIPS.length);
    if(levelBarEl) levelBarEl.innerHTML = '';
    markKeyboard(false);
    SHIPS.forEach(function(sh, i){
      var gun = null;
      for(var n = 0; n < UPGRADES.length; n++) if(UPGRADES[n].id === sh.id) gun = UPGRADES[n];
      var btn = document.createElement('button');
      btn.type = 'button';
      // `is-pick` is the marker, `is-<tint>` is the colour. They have to be
      // different words: the tints are gun/hull/ship, so a marker called
      // `is-hull` collapses into the Sovereign's own tint in any selector
      // that names both, and every card comes out cyan.
      btn.className = 'au-opt is-pick is-' + sh.tint;
      // The ship leads, because the thing being chosen is a ship. Width and
      // height are the file's own, so the band is the right shape before the
      // SVG has arrived and nothing below it jumps when it does.
      btn.innerHTML =
        '<span class="sp-art"><img src="' + sh.art + '" width="610" height="400" alt="" ' +
          'decoding="async" draggable="false"></span>' +
        '<span class="au-n">' + sh.name + '</span>' +
        '<span class="sp-role is-' + sh.tint + '">' + sh.role + '</span>' +
        '<span class="sp-w"><em>Starting weapon <b>Lv 1</b></em>' +
          '<span class="sp-wn">' + upIcon({ id: sh.id, cat: sh.tint }) +
          '<span>' + (gun ? gun.name : '') + '</span></span></span>' +
        shipStats(sh) +
        '<span class="au-k">' + (i + 1) + '</span>';
      btn.addEventListener('pointerdown', function(e){ e.preventDefault(); choose(i); });
      btn.addEventListener('pointerenter', function(e){
        if(e.pointerType === 'touch') return;
        markKeyboard(false);
        selectCard(i, false);
      });
      btn.addEventListener('focus', function(){ selectCard(i, false); });
      levelGridEl.appendChild(btn);
      if(levelBarEl) levelBarEl.appendChild(document.createElement('i'));
    });
    selectCard(0, false);
  }

  // Every panel ignores input for its first moments. A refit or a hail opens
  // mid-flight, while the player is steering and tapping the screen, and
  // without this a keystroke or a thumb meant for the field lands on a card
  // nobody has read yet. The cards deal in over the same stretch, so the wait
  // reads as the cards arriving rather than as lag.
  var PANEL_ARM = 0.4, panelArmAt = 0;
  function armPanel(){ panelArmAt = performance.now() + PANEL_ARM * 1000; }
  function panelArmed(){ return performance.now() >= panelArmAt; }

  // Opens once, on the frame the run is reset and before anything has moved.
  // It halts the field the same way a refit does — which costs nothing here,
  // because nothing has happened yet, but it means the player learns the
  // panel and the pause together.
  function openPick(){
    if(!active || gameOver) return;
    // no board to draw the cards on: hand out the first hull rather than
    // starting a run with no weapon and no way to be given one
    if(!levelEl || !levelGridEl){ applyHull(SHIPS[0].id); return; }
    levelMode = 'pick';
    levelKind = '';
    levelOpen = true;
    keys = {}; pad.mag = 0;
    homeStick();
    renderLevelHeader();
    renderShips();
    armPanel();
    levelEl.classList.add('on');
    document.body.classList.add('astro-paused');
    selectCard(0, true);
  }

  function openLevelUp(kind){
    // A hail and a full rail can land on the same frame. The card waits for
    // the order to be given, and closeHail() deals it.
    if(!active || gameOver || levelOpen || hailOpen) return;
    refitDealt();
    levelKind = kind || '';
    // everything is maxed and health is full: there is nothing to offer, so
    // bank the level as score instead of showing an empty card
    if(rollChoices().length === 0){ pendingLevels = 0; bonus += 400; return; }
    levelOpen = true;
    // Held keys are NOT cleared here, and neither does the hail clear them.
    // They used to be, which meant a player holding thrust through a card
    // came out of it coasting to a dead stop with the key still down: the
    // browser stops auto-repeating a held key the moment another one (the
    // 1, 2 or 3 that picked the card) is pressed, so the game never heard
    // about it again until it was released and pressed afresh. onKeyDown
    // keeps the helm keys up to date while a panel is open instead, and
    // onKeyUp always runs. Only a blur clears them, because only a blur
    // really does lose the key-ups.
    pad.mag = 0;
    homeStick();
    renderLevelHeader();
    renderChoices();
    armPanel();
    if(levelEl) levelEl.classList.add('on');
    document.body.classList.add('astro-paused');
    // Move focus into the panel. Without this the cards are tabbable but never
    // reached — focus is still parked on whatever launched the game, so a
    // keyboard user gets a modal they cannot see the edges of.
    selectCard(0, true);
  }

  function choose(i){
    if(!levelOpen || !panelArmed()) return;
    if(levelMode === 'pick'){
      var sh = SHIPS[i];
      if(!sh) return;
      levelMode = '';
      applyHull(sh.id);
      closeLevel();
      syncHud();
      // The opening tip's five seconds start when the field does, not when the
      // panel went up — otherwise a player who reads three hull cards comes out
      // to a pill already fading behind them.
      if(tipEl && destroyed.indexOf(tipEl) === -1){
        clearTimeout(tipTimer);
        tipTimer = setTimeout(autoHideTip, 5000);
      }
      return;
    }
    var u = levelChoices[i];
    if(!u) return;
    if(u.apply) u.apply(); else up[u.id]++;
    // Counted here rather than off `level`, because a salvage card off a
    // capital ship is a card taken and does not move the XP level. This is
    // the number the two locked weapons are gated on.
    refits++;
    pendingLevels--;
    // enough gems can arrive in one frame to clear two bars; deal them out one
    // card at a time rather than silently dropping the second level
    if(pendingLevels > 0 && rollChoices().length > 0){
      // the salvage card is spent; anything stacked behind it is an ordinary
      // refit and has to be labelled as one
      levelKind = '';
      renderLevelHeader();
      renderChoices();
      armPanel();
      syncHud();
      return;
    }
    pendingLevels = 0;
    levelKind = '';
    closeLevel();
    syncHud();
  }

  function closeLevel(silent){
    levelMode = '';
    if(levelEl) levelEl.classList.remove('on');
    if(!levelOpen){
      if(!autoPaused) document.body.classList.remove('astro-paused');
      return;
    }
    levelOpen = false;
    if(!autoPaused) document.body.classList.remove('astro-paused');
    // drop focus off the card that is about to be removed, or the browser
    // scrolls the page hunting for whatever inherits it
    if(levelGridEl && levelGridEl.contains(document.activeElement)){
      document.activeElement.blur();
    }
    lastFrame = performance.now();
    // a beat of grace so you aren't dropped straight back onto a rock
    if(!silent && ship) ship.invuln = Math.max(ship.invuln, 1.4);
  }

  // ── the engagement hail ──────────────────────────────────────────────────
  // Opens where the capital ship used to simply appear: the inbound warning
  // flashes for its full beat, and then this takes the screen instead of a
  // warbird taking the sector. It halts the field exactly the way a refit card
  // does — same pause, same focus handling, same digit keys — because the
  // player has already learned that a panel means the run has stopped and a
  // decision is owed.
  function openHail(){
    // a dead or dismissed run gets nothing at all; a live run with no panel
    // to show falls back to the old behaviour and lets her decloak
    if(!active || gameOver) return;
    if(!hailEl || !hailFightEl){ spawnBoss(); return; }
    hailOpen = true;
    pad.mag = 0;                     // held keys survive: see openLevelUp
    homeStick();
    // the figures on the cards are the real ones for *this* contact — a panel
    // that quotes a round number the run does not actually pay is worse than a
    // panel with no numbers on it
    if(!contact) contact = pickContact(gameTime);
    var BT = BOSS_TYPES[contact.fac], lock = evadeLock();
    if(hailNameEl){
      hailNameEl.textContent = contact.name;
      hailNameEl.style.color = 'rgb(' + BT.rgb + ')';
    }
    if(hailThreatEl) hailThreatEl.textContent = BT.threat;
    if(hailBountyEl) hailBountyEl.textContent = '+' + bossBounty(bossCount, contact.fac) + ' stardate';
    // only the first kill of a run pays two plates (see killBoss)
    if(hailLootEl) hailLootEl.textContent = '+' + (bossKills ? 1 : BOSS_KILL_HEARTS) + ' hull \u00b7 dilithium \u00b7 a power-up';
    // Evade is not always on the table. The card stays, locked and saying why,
    // because a choice that silently disappears reads as a bug, and the reason
    // is the rule the player needs to learn.
    if(hailFleeEl){
      hailFleeEl.classList.toggle('is-locked', !!lock);
      hailFleeEl.setAttribute('aria-disabled', lock ? 'true' : 'false');
    }
    if(hailWhyEl) hailWhyEl.textContent = lock === 'cube'
      ? 'A cube can\u2019t be outrun. This one has to be fought.'
      : (lock === 'warp'
        ? 'Your warp drive is still recharging from the last break. Fight this one to recharge it.'
        : 'You get clear, but you can\u2019t break away twice running.');
    if(hailFleeDEl) hailFleeDEl.innerHTML = lock
      ? '<span>Not available</span><span>' + (lock === 'cube' ? 'No escape from a cube' : 'Recharges after a fight') + '</span>'
      : '<span>No bounty \u00b7 no refit</span>' +
        '<span>Next contact in ' + Math.round(bossGapFor(bossCount) * BOSS_FLEE_GAP) + 's</span>' +
        '<span>Evasive burn \u00b7 ' + BOSS_FLEE_GRACE + 's</span>';
    if(hailHintEl) hailHintEl.innerHTML = lock
      ? 'Give the order, or press <kbd>1</kbd>'
      : 'Give the order, or press <kbd>1</kbd> <kbd>2</kbd>';
    armPanel();
    hailEl.classList.add('on');
    document.body.classList.add('astro-paused');
    // focus lands on Engage, not because it is the recommended answer but
    // because it is the first card; preventScroll for the same reason the refit
    // card needs it — the run drives window.scrollY every frame
    try { hailFightEl.focus({ preventScroll:true }); } catch(e){ hailFightEl.focus(); }
  }

  function closeHail(fight){
    if(!hailOpen || !panelArmed()) return;
    if(!fight && evadeLock()) return;           // Evade is locked for this one
    hailOpen = false;
    if(hailEl) hailEl.classList.remove('on');
    if(!autoPaused) document.body.classList.remove('astro-paused');
    // drop focus off the card that is about to be hidden, or the browser goes
    // hunting for whatever inherits it and scrolls the page doing it
    if(hailEl && hailEl.contains(document.activeElement)) document.activeElement.blur();
    lastFrame = performance.now();
    if(fight){
      spawnBoss();
      // a beat of grace on the way back in, the same one the refit card gives:
      // the field is exactly where it was when the panel opened
      if(ship) ship.invuln = Math.max(ship.invuln, 1.4);
    } else {
      fleeBoss();
    }
    if(pendingLevels > 0) openLevelUp();
  }

  // Breaking off is free of damage and expensive in everything else. The
  // contact keeps its index, so running never makes the next one stronger —
  // only sooner. The cost is the whole of what was in it: the bounty, the
  // dilithium, the refit and the hull.
  function fleeBoss(){
    bossFled++;
    // one break, then the drive needs a fight to recharge
    warpReady = false;
    spendContact();
    nextBossAt = gameTime + bossGapFor(bossCount) * BOSS_FLEE_GAP;
    // the sector does not go quiet just because the capital ship broke off
    nextAlienAt = gameTime + alienInterval(gameTime) * 0.5;
    if(ship){
      ship.invuln = Math.max(ship.invuln, BOSS_FLEE_GRACE);
      burst(ship.x, ship.y, 26, '0,240,255');
    }
    if(warnEl) warnEl.classList.remove('on');
  }

  if(hailFightEl) hailFightEl.addEventListener('pointerdown', function(e){ e.preventDefault(); closeHail(true); });
  if(hailFleeEl)  hailFleeEl.addEventListener('pointerdown', function(e){ e.preventDefault(); closeHail(false); });

  // ── the refit beat ───────────────────────────────────────────────────────
  // A full rail used to throw the card up on the same frame, so the reward
  // arrived as an interruption: one moment you were flying, the next the run
  // had stopped. Now the ship gets a beat first. A cyan front rolls out from
  // the hull and burns off any plasma near it, the rail flares, the ship holds
  // still in the light for half a second, and only then do the cards deal.
  // The clear is small on purpose — it is the ship's refit crew making room,
  // not a smart bomb — and it only touches fire, never hulls or rock, so it
  // cannot be farmed for kills. The hull is untouchable for the beat, so the
  // pause to celebrate never costs a plate.
  var REFIT_BEAT = 0.55, REFIT_CLEAR = 230, refitDue = 0;
  function refitReady(){
    if(refitDue || !ship) return;
    refitDue = gameTime + REFIT_BEAT;
    ship.invuln = Math.max(ship.invuln, REFIT_BEAT + 0.25);
    for(var q=alienBullets.length-1;q>=0;q--){
      var ab = alienBullets[q];
      if(Math.hypot(ab.x - ship.x, ab.y - ship.y) > REFIT_CLEAR) continue;
      sparks(ab.x, ab.y, 4, ab.rgb || '255,122,99', 0.6);
      alienBullets.splice(q, 1);
    }
    shockwaves.push({ x: ship.x, y: ship.y, r: 14, max: REFIT_CLEAR, life: 1,
                      tint: '125,249,255', glow: '#7df9ff', inner: '255,255,255' });
    bloom(ship.x, ship.y, 140, '125,249,255');
    bloom(ship.x, ship.y, 54, '255,255,255');
    sparks(ship.x, ship.y, 28, '125,249,255', 1.5);
    shake(0.28); freeze(0.07);
    if(xpBarEl) xpBarEl.classList.add('is-full');
  }
  function refitDealt(){
    refitDue = 0;
    if(xpBarEl) xpBarEl.classList.remove('is-full');
  }

  function addXp(n){
    xp += n;
    bonus += n * 10;
    var need = xpNeed(level);
    while(xp >= need){
      xp -= need;
      level++;
      pendingLevels++;
      need = xpNeed(level);
    }
    if(pendingLevels > 0){
      // a one-frame flare on the rail, so the level reads even if the player's
      // eyes never leave the field
      if(xpBarEl){
        xpBarEl.classList.add('pop');
        setTimeout(function(){ xpBarEl.classList.remove('pop'); }, 160);
      }
      refitReady();
    }
    syncHud();
  }

  // ── tab / focus handling ─────────────────────────────────────────────────
  // Leaving the tab used to keep the wall-clock score ticking while the frames
  // stopped, so you came back to a jumped score and a field that lurched. Now
  // the run halts the moment focus goes and waits for a deliberate resume.
  var pauseEl = document.getElementById('astroPause');

  function autoPause(){
    // a level-up card is already a halt of its own — stacking a second pause
    // under it would leave the choice closing into a still-frozen field
    if(!active || gameOver || autoPaused || levelOpen || hailOpen) return;
    autoPaused = true;
    keys = {}; pad.mag = 0;
    homeStick();
    if(pauseEl) pauseEl.classList.add('on');
    document.body.classList.add('astro-paused');
  }

  function autoResume(){
    if(!autoPaused) return;
    autoPaused = false;
    if(pauseEl) pauseEl.classList.remove('on');
    if(!levelOpen && !hailOpen) document.body.classList.remove('astro-paused');
    lastFrame = performance.now();
    if(ship) ship.invuln = Math.max(ship.invuln, 0.9);
    if(!raf) raf = requestAnimationFrame(loop);
  }

  // Key-ups that happen while the window is not focused are never delivered,
  // so a key released during an alt-tab would stay "held" for ever. This is
  // the one place held keys are wiped, and it has to run even when a panel is
  // already up — autoPause() returns early under a panel, which is exactly
  // when nothing else would clear them.
  function onBlur(){
    keys = {};
    autoPause();
  }

  function onVisibility(){
    if(document.hidden){ keys = {}; autoPause(); }
    else lastFrame = performance.now();   // stays paused until the player acts
  }

  function blockClicks(e){
    if(e.target.closest('#astroExit') || e.target.closest('#astroOver') ||
       e.target.closest('#astroLevel') || e.target.closest('#astroPause') ||
       e.target.closest('#astroHail')) return;
    e.preventDefault(); e.stopPropagation();
  }

  function isHelmKey(code){
    return code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight';
  }

  function onKeyDown(e){
    if(e.code === 'Escape'){ stop(); return; }
    // The hull-breach panel is not dismissed by the keyboard. A run ends with
    // the helm keys held down, so "press any key" meant the key already under
    // the player's thumb started the next run before the summary had been
    // read. Only the Play again button closes it now.
    if(gameOver){ e.preventDefault(); return; }
    if(hailOpen){
      // like the refit card this is a decision rather than a dialog, so only
      // the keys that answer it mean anything — nothing here can dismiss it.
      // F and E are here because they are what the two cards are actually
      // called, and a player reading "Engage" should not have to count.
      e.preventDefault();
      // the helm is still in the player's hands: remember it, act on nothing
      if(isHelmKey(e.code)) keys[e.code] = true;
      if(e.repeat) return;           // a held key is not an order
      if(e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'KeyF') closeHail(true);
      else if(e.code === 'Digit2' || e.code === 'Numpad2' || e.code === 'KeyE') closeHail(false);
      return;
    }
    if(levelOpen){
      // The card is a decision, not a dialog: nothing here can dismiss it, and
      // the only keys that mean anything are the ones that move the selection
      // or take it. Tab is caught rather than allowed through — there is
      // nothing behind this panel to tab to — but it cycles the three cards
      // instead of doing nothing, because a keyboard player pressing Tab in a
      // modal is asking to move, not to leave.
      e.preventDefault();
      // Arrows still choose nothing (see below), but a press or a held key
      // is recorded, so the ship is flying the moment the card closes.
      if(isHelmKey(e.code)) keys[e.code] = true;
      if(e.repeat) return;           // a held key is not a decision
      if(e.code === 'Digit1' || e.code === 'Numpad1') choose(0);
      else if(e.code === 'Digit2' || e.code === 'Numpad2') choose(1);
      else if(e.code === 'Digit3' || e.code === 'Numpad3') choose(2);
      // Arrows are the helm, and the card opens mid-flight with one of them
      // held: letting them move the selection meant the ship's last turn also
      // chose the upgrade. They are swallowed here and do nothing. Tab moves
      // the selection instead, because nobody flies with Tab.
      else if(e.code === 'Tab'){ markKeyboard(true); selectCard(levelSel + (e.shiftKey ? -1 : 1), true); }
      // Space is the overcharge vent and is just as likely to be held when the
      // card opens, so it takes nothing here either. Enter is not a flight key.
      else if(e.code === 'Enter' || e.code === 'NumpadEnter') choose(levelSel);
      return;
    }
    // Any key resumes. An arrow also flies: it used to be spent on the resume
    // alone, so the first press after coming back did nothing at all. Space
    // resumes without releasing the overcharge — waking the game is not a
    // decision to spend it.
    if(autoPaused){
      e.preventDefault();
      autoResume();
      if(isHelmKey(e.code)) keys[e.code] = true;
      return;
    }
    if(e.code==='ArrowUp'||e.code==='ArrowDown'||e.code==='ArrowLeft'||e.code==='ArrowRight'||e.code==='Space'){
      e.preventDefault();   // space must never scroll the page underneath
      // A vent is a press, not a hold: a held key repeats keydown, and without
      // this guard the first frame of a full core would spend it three times.
      if(e.code === 'Space' && !keys.Space) tryOvercharge();
      keys[e.code] = true;
    }
  }
  function onKeyUp(e){ keys[e.code] = false; }

  // ── touch: one floating thumbstick ───────────────────────────────────────
  // With the guns automatic there is nothing else a thumb has to do, so the
  // whole screen is the stick's catchment: press anywhere and the ring comes
  // to the thumb instead of the thumb hunting for a ring in the corner.
  var touchEl = document.getElementById('astroTouch');
  var stickEl = document.getElementById('astroStick');
  var knobEl  = document.getElementById('astroKnob');
  var stickId = null;

  function homeStick(){
    stickId = null;
    pad.mag = 0;
    if(!stickEl) return;
    stickEl.classList.remove('on', 'free');
    stickEl.style.left = '';
    stickEl.style.top = '';
    if(knobEl) knobEl.style.transform = '';
  }

  function stickTo(e){
    var r = stickEl.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = e.clientX - cx, dy = e.clientY - cy;
    var max = r.width / 2 - 14;
    var dist = Math.hypot(dx, dy);
    pad.angle = Math.atan2(dy, dx);
    pad.mag = max > 0 ? Math.min(1, dist / max) : 0;
    var kx = Math.cos(pad.angle) * pad.mag * max;
    var ky = Math.sin(pad.angle) * pad.mag * max;
    // the knob is centred by a transform of its own, so its offset has to ride
    // on top of that rather than replace it
    knobEl.style.transform = 'translate(-50%,-50%) translate(' +
      kx.toFixed(1) + 'px,' + ky.toFixed(1) + 'px)';
  }

  function stickDown(e){
    if(gameOver) return;   // the button on the panel is the only way out

    if(autoPaused){ e.preventDefault(); autoResume(); return; }
    if(levelOpen || hailOpen) return;
    if(stickId !== null) return;
    stickId = e.pointerId;
    e.preventDefault();
    // anchor the ring on the thumb, kept far enough from the edges that the
    // full throw is still reachable in every direction
    var half = stickEl.offsetWidth / 2 || 70;
    var px = Math.max(half + 6, Math.min(window.innerWidth  - half - 6, e.clientX));
    var py = Math.max(half + 6, Math.min(window.innerHeight - half - 6, e.clientY));
    stickEl.classList.add('free', 'on');
    stickEl.style.left = px + 'px';
    stickEl.style.top  = py + 'px';
    try { touchEl.setPointerCapture(e.pointerId); } catch(err){}
    stickTo(e);
  }
  function stickMove(e){ if(e.pointerId !== stickId) return; e.preventDefault(); stickTo(e); }
  function stickUp(e){ if(e.pointerId !== stickId) return; homeStick(); }

  // The vent button sits inside #astroTouch, which is the stick's catchment —
  // so it has to stop the event as well as consume it, or every tap on it also
  // anchors the thumbstick under the player's other thumb.
  if(releaseBtn) releaseBtn.addEventListener('pointerdown', function(e){
    e.preventDefault(); e.stopPropagation(); tryOvercharge();
  });
  // One deliberate press on one button, and nothing else in the panel does
  // anything. The summary is worth reading, and a card that closed on any tap
  // anywhere closed itself on the tap that was still landing from the last
  // second of the run — or on the drag that was only scrolling it on a short
  // window. Clicks elsewhere on the panel are swallowed so they cannot reach
  // the page behind it.
  if(againEl) againEl.addEventListener('click', function(e){
    e.preventDefault(); restart();
  });
  if(overEl) overEl.addEventListener('pointerdown', function(e){
    if(!e.target.closest('#astroAgain')) e.preventDefault();
  });
  if(pauseEl) pauseEl.addEventListener('pointerdown', function(e){ e.preventDefault(); autoResume(); });

  if(touchEl && stickEl && knobEl){
    touchEl.addEventListener('pointerdown', stickDown);
    touchEl.addEventListener('pointermove', stickMove);
    touchEl.addEventListener('pointerup', stickUp);
    touchEl.addEventListener('pointercancel', stickUp);
  }

  function killAsteroid(k){
    var ax = asteroids[k];
    if(ax.special){
      // a rare rock pays in a timed power-up rather than gems, and says so with
      // a burst in the colour of whatever it just dropped
      var sp = SPECIALS[ax.special];
      burst(ax.x, ax.y, 24, sp.rgb, 1.15);
      bloom(ax.x, ax.y, ax.r * 3.4, sp.rgb);
      shake(0.2); freeze(0.03);
      dropPickup(ax.x, ax.y, ax.special);
      addCore(CORE_KILL_ROCK);
      scored(60);
    } else {
      // The volume of a kill is scaled by what died. A 14px pebble and a 28px
      // boulder used to make exactly the same ten-piece puff, which is how a
      // field of forty ends up reading as one texture rather than as forty
      // separate things with separate mass.
      var big = ax.r >= 22;
      burst(ax.x, ax.y, big ? 15 : 10, null, big ? 1.2 : 0.9);
      bloom(ax.x, ax.y, ax.r * (big ? 2.6 : 2.0), '199,125,255');
      if(big) shake(0.1);
      dropRockLoot(ax.x, ax.y);
      addCore(CORE_KILL_ROCK);
      scored(15);
    }
    asteroids.splice(k, 1);
  }

  function killAlien(m){
    var al = aliens[m];
    var T = ALIEN_TYPES[al.kind];
    burst(al.x, al.y, 20, T.rgb, 1.25);
    bloom(al.x, al.y, al.r * 3.6, T.rgb);
    shake(0.26); freeze(0.035);
    // A warbird used to be a guaranteed extra life, and with three of them in
    // the sky that was more health than the field could ever take back — most
    // of the reason a careless run never actually ended. Health is a roll now;
    // crystals are the reliable prize, which keeps warbirds worth hunting.
    if(Math.random() < T.heart * heartFade(gameTime)) dropPickup(al.x, al.y, 'heart');
    else for(var g=0; g<T.gems; g++) dropPickup(al.x, al.y, 'gem');
    aliens.splice(m, 1);
    addCore(CORE_KILL_SHIP);
    scored(T.bonus);
  }

  // ── the capital ships ────────────────────────────────────────────────
  // One per faction since Sep 2026. There used to be a single Klingon
  // dreadnought that cycled rings, volleys and a ram, called in lone scouts,
  // and could always be refused at the hail — and once a player had learned
  // it, every capital ship was the same fight or no fight at all. Now each
  // faction sends its own flagship, built from its own escort's silhouette,
  // fighting with its own weapons and bringing a wing of its own hulls that
  // attacks TOGETHER, in formation, rather than one at a time.
  //
  //   Klingon     · rings, aimed volleys, the ram · wing: pincer — three
  //                 Birds-of-Prey surround you, mark a point, and all dive
  //                 through it at once
  //   Cardassian  · rotating spiral barrages, sweeping fans · wing: wall —
  //                 three Galors line abreast and fire in one parallel volley
  //   Romulan     · cloaks (cannot be hit), reappears behind you, homing
  //                 plasma salvo · wing: flank — a cloaked pair that decloaks
  //                 on opposite sides for a crossfire. Never hails: ambushes.
  //   Borg        · tracking cutting beams, a TRACTOR BEAM that drags you in,
  //                 adapts at every quarter of hull · wing: box — four drones
  //                 in a rotating square wired together by cutting beams,
  //                 closing in. Cannot be outrun: the hail offers no escape.
  //   Tholian     · web cages spun around you, shards that split in flight ·
  //                 wing: strand — three weavers sweeping across the field
  //                 with a live strand between them
  //
  // And a capital-ship fight is now the only fight on the field: the ordinary
  // traffic breaks off when she arrives (standDown) and the rock thins, so
  // what is left is her, her wing and you.
  //
  // Hull scales with how many have come before, times a per-faction factor.
  // The square term is for the run that is winning. Every kill pays hull and
  // a card, so a strong build used to snowball: one scripted run killed nine
  // flagships in a row and flew for the full fifteen minutes on four plates.
  // The first two fights are untouched (110, 200); the eighth has nearly
  // twice the hull it used to.
  function bossHpFor(n){ return 110 + n * 80 + n * n * 10; }
  // Shots land on the armoured core rather than the full silhouette, so a wide
  // fan no longer connects with every barrel at once.
  function bossHitR(){ return BOSS_R * 0.82; }
  function bossGapFor(n){ return Math.max(44, BOSS_GAP - n * 4); }
  function clampN(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  var BOSS_TYPES = {
    klingon:    { at:0,   hull:'raptor',  rgb:'255,122,99', stroke:'#ff7a63', glow:'#ff4d2e',
                  names:['I.K.S. Vor’cha', 'I.K.S. Negh’Var', 'I.K.S. Qu’Vat', 'I.K.S. Gr’oth'],
                  hp:1.2, fuse:42, bounty:1, move:'hold', cycle:['ring', 'volley', 'charge'],
                  wing:'pincer', wingN:3, wingHp:0.85,
                  threat:'Disruptor rings and ramming runs, with a Bird-of-Prey wing that dives in together.' },
    cardassian: { at:70,  hull:'lancer',  rgb:'240,168,72', stroke:'#f0a848', glow:'#e07b1a',
                  names:['Keldon-class Trager', 'Keldon-class Koranak', 'Keldon-class Prakesh', 'Keldon-class Rabol'],
                  hp:0.8, fuse:46, bounty:1, move:'platform', cycle:['spiral', 'vent', 'sweep'],
                  wing:'wall', wingN:3, wingHp:0.85,
                  threat:'Spiral barrages from behind a line of Galors that fire as one.' },
    romulan:    { at:95,  hull:'warbird', rgb:'96,224,150', stroke:'#7fd6a6', glow:'#2fbf78',
                  names:['I.R.W. Khazara', 'I.R.W. Valdore', 'I.R.W. Haakona', 'I.R.W. T’Met'],
                  hp:0.85, fuse:46, bounty:1.1, move:'range', cycle:['cloak', 'decloak', 'salvo', 'lance'],
                  wing:'flank', wingN:2, wingHp:0.85, ambush:true,
                  threat:'' },
    borg:       { at:138, hull:'drone',   rgb:'126,255,110', stroke:'#8fb4c9', glow:'#4fdc5a',
                  names:['Tactical Cube 138', 'Tactical Cube 630', 'Tactical Cube 972', 'Tactical Cube 316'],
                  hp:1.15, fuse:55, bounty:1.3, move:'grind', cycle:['beams', 'tractor'],
                  wing:'box', wingN:4, wingHp:0.3, noEvade:true, adapt:true,
                  threat:'Cutting beams, a tractor lock, and drones that box you in.' },
    tholian:    { at:158, hull:'weaver',  rgb:'255,159,67', stroke:'#ff9f43', glow:'#c77dff',
                  names:['Tholian Tarantula', 'Tholian Recluse', 'Tholian Widow', 'Tholian Orb-Weaver'],
                  hp:1.0, fuse:46, bounty:1.1, move:'orbit', cycle:['cage', 'shards'],
                  wing:'strand', wingN:3, wingHp:1,
                  threat:'Web cages and splitting shards, and weavers with a live strand strung between them.' }
  };
  var BOSS_ORDER = ['klingon', 'cardassian', 'romulan', 'borg', 'tholian'];
  function bossBounty(n, fac){
    var BT = BOSS_TYPES[fac || 'klingon'];
    return Math.round((1800 + n * 700) * (BT ? BT.bounty : 1) / 10) * 10;
  }

  // The next contact is chosen when the warning goes up, so the warning, the
  // hail and the ship that arrives all agree. Never the same faction twice
  // running; and the very first contact of a run is always hailed, so the
  // choice is taught before an ambush can skip it.
  var contact = null, lastFac = null, bossSeen = {};
  function pickContact(t){
    var pool = [], i, f;
    for(i=0;i<BOSS_ORDER.length;i++){
      f = BOSS_ORDER[i];
      if(t < BOSS_TYPES[f].at || f === lastFac) continue;
      if(!bossCount && BOSS_TYPES[f].ambush) continue;
      pool.push(f);
    }
    if(!pool.length) pool = ['klingon'];
    f = pool[Math.floor(Math.random() * pool.length)];
    var BT = BOSS_TYPES[f], k = bossSeen[f] || 0;
    var base = BT.names[k % BT.names.length], mk = Math.floor(k / BT.names.length);
    return { fac: f, name: mk ? base + ' MK' + (mk + 1) : base };
  }
  function spendContact(){
    if(!contact) return;
    bossSeen[contact.fac] = (bossSeen[contact.fac] || 0) + 1;
    lastFac = contact.fac;
    contact = null;
  }

  // ── you cannot always run ────────────────────────────────────────────────
  // Breaking away used to be free every time, which made "evade" the answer
  // to every hail once a player knew what the fight cost. Now the warp drive
  // needs a fight to recharge: break off once and the next contact has to be
  // met. A Borg cube can never be outrun, and a Romulan does not hail at all.
  var warpReady = true;
  function evadeLock(){
    if(!contact) return '';
    if(BOSS_TYPES[contact.fac].noEvade) return 'cube';
    if(!warpReady) return 'warp';
    return '';
  }

  // Every source of damage to a capital ship goes through here: a cloaked
  // Romulan cannot be hit at all, and an adapted Borg cube takes a fraction.
  var BORG_SHIELD_TAKE = 0.2, BORG_SHIELD_TIME = 2.2;
  function bossTargetable(){ return !!boss && !boss.leaving && !(boss.cloak > 0.5); }
  function hurtBoss(d, hitT){
    if(!bossTargetable()) return false;
    var b = boss;
    if(b.shieldT > 0) d *= BORG_SHIELD_TAKE;
    b.hp -= d; b.hitT = hitT || 0.12;
    // the cube adapts at every quarter of its hull: a flash of white, and for
    // a few seconds almost nothing gets through — so the answer is to stop
    // shooting, dodge, and come back, rather than to hold the trigger down
    if(BOSS_TYPES[b.fac].adapt && b.hp > 0 && b.hp <= b.max * b.adaptNext){
      b.adaptNext -= 0.25;
      b.shieldT = BORG_SHIELD_TIME;
      burst(b.x, b.y, 22, '255,255,255', 1.1);
      bloom(b.x, b.y, b.r * 2.2, '200,255,210');
      teach('adapt', '<span>The cube has adapted</span><span>It shrugs off fire while it glows. Dodge and wait.</span>', 5);
    }
    if(b.hp <= 0){ killBoss(); return true; }
    return false;
  }

  // Everything else leaves when she arrives. The ordinary traffic breaks off
  // and flies clear, holding its fire, so a capital-ship fight is a duel with
  // her and her wing rather than the same field with one more thing in it.
  function standDown(){
    for(var i=0;i<aliens.length;i++) if(!aliens[i].wing) aliens[i].retreat = true;
  }

  function spawnBoss(){
    if(!contact) contact = pickContact(gameTime);
    var fac = contact.fac, BT = BOSS_TYPES[fac];
    var hp = Math.round(bossHpFor(bossCount) * BT.hp);
    var W = window.innerWidth, top = window.scrollY, H = window.innerHeight;
    boss = {
      id: ++uid, fac: fac, name: contact.name,
      x: W / 2, y: top - BOSS_R * 2, r: BOSS_R,
      vx: 0, vy: 0, hp: hp, max: hp, hitT: 0, t: 0, rot: 0,
      // it drifts in for a beat and a half before it is allowed to shoot
      phase: 'entry', phaseT: 1.4, next: 0, shots: 0, charged: false,
      // eased toward the player every frame rather than snapped, so the hull
      // swings onto its target the way something with mass would
      face: Math.PI / 2,
      enraged: false, index: bossCount, fuse: BT.fuse, leaving: false,
      cloak: 0, shieldT: 0, adaptNext: 0.75,
      spin: Math.random() * Math.PI * 2, spinDir: 1,
      beams: [], lockT: 0, tractorT: 0, orbitA: Math.random() * Math.PI * 2,
      fx: 0, fy: 0, wing: null, wingAt: gameTime + 3.2
    };
    if(BT.ambush){
      // no approach and no hail: she decloaks beside you
      var a = Math.random() * Math.PI * 2;
      boss.x = clampN(ship.x + Math.cos(a) * 300, BOSS_R + 20, W - BOSS_R - 20);
      boss.y = clampN(ship.y + Math.sin(a) * 260, top + BOSS_R + 40, top + H - BOSS_R - 40);
      boss.cloak = 1; boss.phase = 'decloak'; boss.phaseT = 1.1;
      boss.face = Math.atan2(ship.y - boss.y, ship.x - boss.x);
    }
    spendContact();
    // taking a fight is what recharges the warp drive
    warpReady = true;
    bossCount++;
    standDown();
    if(bossNameEl) bossNameEl.textContent = boss.name;
    if(bossBarEl){
      bossBarEl.style.setProperty('--boss-rgb', BT.rgb);
      bossBarEl.classList.add('on');
    }
    hudLast.boss = -1;
  }

  function bossShoot(x, y, ang, speed, r, extra){
    var o = { x:x, y:y, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed,
              life: 3.6, r: r || 4, rgb: boss ? BOSS_TYPES[boss.fac].rgb : '255,122,99' };
    if(extra) for(var k in extra) o[k] = extra[k];
    alienBullets.push(o);
    return o;
  }
  function aimAt(b){ return Math.atan2(ship.y - b.y, ship.x - b.x); }

  // A heavy plasma torpedo, the Romulan signature: slow, homing, and the one
  // enemy round the phasers can shoot down.
  function plasmaFrom(x, y, ang, rgb){
    alienBullets.push({ x:x, y:y, vx: Math.cos(ang) * PLASMA_SPEED * 1.1, vy: Math.sin(ang) * PLASMA_SPEED * 1.1,
                        life: 7, r: PLASMA_R, rgb: rgb, id: ++uid,
                        hp: PLASMA_HP, seek: PLASMA_TURN * 0.9, heavy: true });
  }

  var TRACTOR_R = 560, TRACTOR_LOCK = 0.85, TRACTOR_TIME = 2.0;
  // Under the weakest hull's thrust (the Sovereign's is about 0.124), so
  // there is always a way out — but only for a player who is pushing.
  var TRACTOR_PULL = 0.07;

  // ── the attacks ──────────────────────────────────────────────────────────
  // Each phase stocks a budget in start() and spends it in tick(). A phase is
  // named in its faction's cycle, and bossNextPhase walks the cycle.
  var BOSS_PHASE = {
    entry:  { start: function(){}, tick: function(){} },

    // ── Klingon ──
    ring: {
      start: function(b, t, rage){ b.phaseT = 2.0 / rage; b.shots = b.enraged ? 3 : 2; b.next = t + 0.25; },
      tick: function(b, dt, t, rage){
        if(b.shots <= 0 || t < b.next) return;
        b.shots--; b.next = t + 0.7 / rage;
        var n = Math.min(16, 8 + b.index * 2) + (b.enraged ? 3 : 0);
        var off = Math.random() * Math.PI * 2, sp = (2.5 + b.index * 0.12) * rage;
        for(var i=0;i<n;i++) bossShoot(b.x, b.y, off + i / n * Math.PI * 2, sp, 4);
        burst(b.x, b.y, 8, BOSS_TYPES[b.fac].rgb);
      }
    },
    volley: {
      start: function(b, t, rage){ b.phaseT = 2.2 / rage; b.shots = b.enraged ? 3 : 2; b.next = t + 0.3; },
      tick: function(b, dt, t, rage){
        if(b.shots <= 0 || t < b.next) return;
        b.shots--; b.next = t + 0.42 / rage;
        var sp = alienBulletSpeed(t) * 1.05 * rage, aim = aimAt(b);
        for(var i=-1;i<=1;i++) bossShoot(b.x, b.y, aim + i * 0.17, sp, 4);
      }
    },
    // The ram. It telegraphs for over a second before it commits, with a
    // dashed lane drawn to your hull, so it is always dodged rather than
    // suffered. It was 0.85s at 6.2px a frame until Sep 2026, and ramming
    // was over a third of every hull plate lost to a capital ship.
    charge: {
      start: function(b, t, rage){ b.phaseT = 2.7 / rage; b.shots = 0; b.charged = false; b.next = t + 1.15 / rage; },
      tick: function(b, dt, t, rage){
        if(b.charged || t < b.next) return;
        b.charged = true;
        var d = Math.hypot(ship.x - b.x, ship.y - b.y) || 1, s = 5.2 * rage;
        b.vx = (ship.x - b.x) / d * s;
        b.vy = (ship.y - b.y) / d * s;
        burst(b.x, b.y, 18, '255,209,102');
      }
    },

    // ── Cardassian ──
    // A rotating spiral of bolts from the command ship's forward emitter.
    // The arms turn slowly enough that the gaps between them can be flown,
    // and every spiral turns the other way from the last.
    spiral: {
      start: function(b, t, rage){
        b.phaseT = 2.8; b.spinDir = -b.spinDir; b.next = t + 0.35;
        b.arms = b.enraged ? 4 : 3;
      },
      tick: function(b, dt, t, rage){
        if(t < b.next) return;
        b.next = t + 0.16 / Math.sqrt(rage);
        var sp = 2.35 * Math.sqrt(rage);
        for(var k=0;k<b.arms;k++) bossShoot(b.x, b.y, b.spin + k / b.arms * Math.PI * 2, sp, 3.4);
        b.spin += 0.21 * b.spinDir;
      }
    },
    // After every spiral the emitter vents: a second and a half of glowing
    // silence. The spiral never pauses on its own, and without this there
    // was no moment to turn and shoot back — the platform could not be
    // killed, only outlasted.
    vent: {
      start: function(b, t, rage){ b.phaseT = 1.7 / Math.sqrt(rage); },
      tick: function(){}
    },
    // three wide fans aimed at you, each seven bolts across
    sweep: {
      start: function(b, t, rage){ b.phaseT = 2.2 / rage; b.shots = b.enraged ? 4 : 3; b.next = t + 0.3; },
      tick: function(b, dt, t, rage){
        if(b.shots <= 0 || t < b.next) return;
        b.shots--; b.next = t + 0.6 / rage;
        var aim = aimAt(b) + (Math.random() - 0.5) * 0.2, sp = alienBulletSpeed(t) * 0.95;
        for(var i=-3;i<=3;i++) bossShoot(b.x, b.y, aim + i * 0.16, sp, 3.6);
      }
    },

    // ── Romulan ──
    // Cloaked she cannot be hit and does not collide. She slides round
    // behind the way you are facing, then decloaks — the shimmer is the
    // warning — and fires.
    cloak: {
      start: function(b, t, rage){
        b.phaseT = 2.2 / rage;
        var W = window.innerWidth, top = window.scrollY, H = window.innerHeight;
        var a = ship.angle + Math.PI + (Math.random() - 0.5) * 1.2;
        b.fx = clampN(ship.x + Math.cos(a) * 310, b.r + 20, W - b.r - 20);
        b.fy = clampN(ship.y + Math.sin(a) * 310, top + b.r + 40, top + H - b.r - 40);
      },
      tick: function(b, dt){ b.cloak = Math.min(1, b.cloak + dt * 2.6); }
    },
    decloak: {
      start: function(b){ b.phaseT = 0.8; },
      tick: function(b, dt){ b.cloak = Math.max(0, b.cloak - dt / 0.75); }
    },
    salvo: {
      start: function(b, t, rage){
        b.phaseT = 1.1; b.cloak = 0;
        var rgb = BOSS_TYPES[b.fac].rgb, aim = aimAt(b), n = b.enraged ? 3 : 2;
        for(var i=0;i<n;i++) plasmaFrom(b.x, b.y, aim + (i - (n - 1) / 2) * 0.36, rgb);
        for(var j=-2;j<=2;j++) bossShoot(b.x, b.y, aim + j * 0.2, alienBulletSpeed(t), 3.4);
        burst(b.x, b.y, 14, rgb, 0.9);
      },
      tick: function(){}
    },
    lance: {
      start: function(b, t, rage){ b.phaseT = 2.2; b.shots = b.enraged ? 7 : 5; b.next = t + 0.2; },
      tick: function(b, dt, t, rage){
        if(b.shots <= 0 || t < b.next) return;
        b.shots--; b.next = t + 0.34 / rage;
        var a = aimAt(b), sp = alienBulletSpeed(t) * 1.35;
        for(var s=-1; s<=1; s+=2){
          bossShoot(b.x - Math.sin(a) * s * 12, b.y + Math.cos(a) * s * 12, a, sp, 3.2);
        }
      }
    },

    // ── Borg ──
    // Cutting beams that open wide either side of you and close like shears.
    beams: {
      start: function(b, t, rage){
        b.phaseT = 3.3;
        var offs = b.enraged ? [-0.62, 0, 0.62] : [-0.58, 0.58], aim = aimAt(b);
        b.beams = offs.map(function(o){
          return { off: o, ang: aim + o, t: BEAM_WIND + 1.5, fire: 1.5, total: BEAM_WIND + 1.5 };
        });
      },
      tick: function(){}
    },
    // The tractor beam. It locks for most of a second — the green line is the
    // warning — and then hauls you toward the hull for over two seconds.
    // Thrusting away always wins, but only just.
    tractor: {
      start: function(b, t, rage){
        b.phaseT = 3.6;
        if(Math.hypot(ship.x - b.x, ship.y - b.y) > TRACTOR_R){ b.phaseT = 0.8; return; }
        b.lockT = TRACTOR_LOCK; b.tractorT = TRACTOR_TIME;
        var n = b.enraged ? 12 : 10, off = Math.random() * Math.PI;
        for(var i=0;i<n;i++) bossShoot(b.x, b.y, off + i / n * Math.PI * 2, 1.9, 4);
        teach('tractor', '<span>Tractor lock</span><span>Thrust away from the cube to break free.</span>', 5);
      },
      tick: function(){}
    },

    // ── Tholian ──
    // A cage of webs spun on the points around you. They take a second to
    // set, so the way out is to leave through a gap while they are growing.
    cage: {
      start: function(b, t, rage){
        b.phaseT = 2.6 / Math.sqrt(rage);
        var n = b.enraged ? 4 : 3, a0 = Math.random() * Math.PI * 2;
        for(var i=0;i<n;i++){
          var a = a0 + i / n * Math.PI * 2;
          spawnWeb(ship.x + Math.cos(a) * 195, ship.y + Math.sin(a) * 195, 6, 1.1);
        }
        burst(b.x, b.y, 12, BOSS_TYPES[b.fac].rgb, 0.8);
      },
      tick: function(){}
    },
    // a ring of crystal shards that shatter into three a little way out
    shards: {
      start: function(b, t, rage){ b.phaseT = 2.4 / rage; b.shots = b.enraged ? 3 : 2; b.next = t + 0.25; },
      tick: function(b, dt, t, rage){
        if(b.shots <= 0 || t < b.next) return;
        b.shots--; b.next = t + 0.85 / rage;
        var n = b.enraged ? 7 : 5, off = aimAt(b);
        for(var i=0;i<n;i++) bossShoot(b.x, b.y, off + i / n * Math.PI * 2, 2.4, 4, { split: 0.6, age: 0 });
      }
    }
  };

  function bossNextPhase(t, rage){
    var b = boss, cyc = BOSS_TYPES[b.fac].cycle;
    var at = cyc.indexOf(b.phase);
    b.phase = at < 0 ? cyc[0] : cyc[(at + 1) % cyc.length];
    b.charged = false;
    BOSS_PHASE[b.phase].start(b, t, rage);
  }

  // ── how each flagship moves ──────────────────────────────────────────────
  // Every target point is clamped inside the view, so a fight can never
  // wander off-screen.
  // The camera follows the player down the page, and a flagship steering at
  // a gun-platform's pace simply got left behind: a Cardassian measured 376px
  // above the top of the view, firing its spiral from somewhere the player
  // could neither see nor hit. Out of view, every flagship closes fast.
  function bossOffView(b){
    var top = window.scrollY;
    return b.y < top - 10 || b.y > top + window.innerHeight + 10 ||
           b.x < -10 || b.x > window.innerWidth + 10;
  }
  function bossSteer(b, tx, ty, sf, gain, cap){
    var top = window.scrollY, H = window.innerHeight, W = window.innerWidth;
    if(bossOffView(b)){ gain *= 3; cap = Math.max(cap * 4, 0.25); }
    tx = clampN(tx, b.r + 20, W - b.r - 20);
    ty = clampN(ty, top + b.r + 20, top + H - b.r - 20);
    b.vx += clampN((tx - b.x) * gain, -cap, cap) * sf;
    b.vy += clampN((ty - b.y) * gain, -cap, cap) * sf;
    var d = Math.pow(0.965, sf);
    b.vx *= d; b.vy *= d;
  }
  var BOSS_MOVE = {
    // Klingon: sit above the ship and slide across to stay on it
    hold: function(b, dt, sf, t, rage){
      if(b.phase === 'charge' && b.charged){
        var cd = Math.pow(0.985, sf); b.vx *= cd; b.vy *= cd; return;
      }
      bossSteer(b, ship.x, ship.y - window.innerHeight * 0.26, sf, 0.0024, 0.07 * rage);
    },
    // Cardassian and Romulan: hold a range and circle slowly at it
    range: function(b, dt, sf, t, rage){
      if(b.phase === 'cloak'){ bossSteer(b, b.fx, b.fy, sf, 0.006, 0.22); return; }
      if(b.phase === 'decloak' || b.phase === 'salvo'){
        var hd = Math.pow(0.9, sf); b.vx *= hd; b.vy *= hd; return;
      }
      b.orbitA += 0.18 * dt * rage;
      var a = Math.atan2(b.y - ship.y, b.x - ship.x);
      a += angDiff(b.orbitA, a) * 0.02;
      bossSteer(b, ship.x + Math.cos(a) * 350, ship.y + Math.sin(a) * 350, sf, 0.0022, 0.06);
    },
    // Cardassian: a gun platform. It picks a spot at range and all but parks
    // there — the fight is its barrage, not chasing it round the screen.
    platform: function(b, dt, sf, t, rage){
      b.orbitA += 0.06 * dt * rage;
      var a = Math.atan2(b.y - ship.y, b.x - ship.x);
      a += angDiff(b.orbitA, a) * 0.01;
      bossSteer(b, ship.x + Math.cos(a) * 300, ship.y + Math.sin(a) * 300, sf, 0.0014, 0.035);
    },
    // Borg: straight at you, slowly, and it stops to hold a tractor lock
    grind: function(b, dt, sf, t, rage){
      if(b.tractorT > 0 && b.lockT <= 0){ var gd = Math.pow(0.9, sf); b.vx *= gd; b.vy *= gd; return; }
      var dx = ship.x - b.x, dy = ship.y - b.y, d = Math.hypot(dx, dy) || 1;
      var s = (b.enraged ? 0.78 : 0.58) * (bossOffView(b) ? 5 : 1);
      b.vx += (dx / d * s - b.vx) * 0.05 * sf;
      b.vy += (dy / d * s - b.vy) * 0.05 * sf;
    },
    // Tholian: circles you at a steady range, spinning its cages
    orbit: function(b, dt, sf, t, rage){
      b.orbitA += 0.34 * dt * rage;
      bossSteer(b, ship.x + Math.cos(b.orbitA) * 310, ship.y + Math.sin(b.orbitA) * 310, sf, 0.003, 0.08);
    }
  };

  function updateBossBeams(b, dt, sf){
    for(var i=b.beams.length-1;i>=0;i--){
      var bm = b.beams[i];
      bm.t -= dt;
      if(bm.t <= 0){ b.beams.splice(i,1); continue; }
      // the offset closes to nothing over the beam's life: shears
      var want = aimAt(b) + bm.off * Math.min(1, bm.t / bm.total);
      bm.ang += angDiff(want, bm.ang) * (1 - Math.pow(1 - BEAM_TRACK * dt, sf));
      if(bm.t > bm.fire || ship.invuln > 0 || shieldTime > 0) continue;
      if(rayDist(ship.x, ship.y, b.x, b.y, bm.ang, BEAM_LEN * 1.15) < BEAM_W + SHIP_RADIUS){
        burst(ship.x, ship.y, 14, BOSS_TYPES[b.fac].rgb);
        hitShip('fire');
      }
    }
  }

  function updateTractor(b, dt, sf){
    if(b.tractorT <= 0) return;
    if(b.lockT > 0){ b.lockT -= dt; return; }
    b.tractorT -= dt;
    var dx = b.x - ship.x, dy = b.y - ship.y, d = Math.hypot(dx, dy) || 1;
    if(d < b.r + 14) return;
    var pull = TRACTOR_PULL * (b.enraged ? 1.18 : 1);
    ship.vx += dx / d * pull * sf;
    ship.vy += dy / d * pull * sf;
  }

  function killBoss(){
    var b = boss;
    // The biggest thing that happens in a run, at the biggest volume the
    // grammar has: a full shake, the longest held frame, and two blooms —
    // a white core inside a gold shell — so the flash has depth rather than
    // being one disc of light.
    burst(b.x, b.y, 64, '255,209,102', 1.9);
    burst(b.x, b.y, 38, BOSS_TYPES[b.fac].rgb, 1.5);
    bloom(b.x, b.y, b.r * 5.5, '255,209,102');
    bloom(b.x, b.y, b.r * 2.6, '255,255,255');
    shake(1); freeze(0.11);
    // The payout is the point: beating a capital ship has to be the best
    // thing that can happen in a run, and with cards this scarce it is the
    // way back into the level economy.
    for(var i=0; i<5 + Math.min(5, b.index); i++) dropPickup(b.x, b.y, 'gem');
    // the first kill of a run pays two plates, every later one pays one —
    // the same snowball the hull curve above answers from the other side
    for(var h=0; h<(bossKills ? 1 : BOSS_KILL_HEARTS); h++) dropPickup(b.x, b.y, 'heart');
    dropPickup(b.x, b.y, Math.random() < 0.5 ? 'shield' : 'rapid');
    addCore(CORE_KILL_BOSS);
    scored(bossBounty(b.index, b.fac));
    bossKills++;
    disbandWing(b);
    boss = null;
    nextBossAt = gameTime + bossGapFor(bossCount);
    nextAlienAt = gameTime + alienInterval(gameTime) * 0.6;
    if(bossBarEl) bossBarEl.classList.remove('on');
    // The refit is granted, not dropped. It is the half of the bounty that was
    // promised on the card, and a promised reward must not be something a stray
    // rock can take off you in the two seconds between the kill and the
    // crystals landing. The dilithium on the floor is the bonus on top.
    pendingLevels++;
    openLevelUp('salvage');
  }

  function updateBoss(dt, sf, t){
    var b = boss, BT = BOSS_TYPES[b.fac];
    b.t += dt;
    b.rot += 0.004 * sf;
    if(BT.move !== 'grind'){
      var want = BT.move === 'range' && b.phase === 'cloak' ? Math.atan2(b.vy, b.vx) : aimAt(b);
      b.face += angDiff(want, b.face) * (1 - Math.pow(1 - 0.06, sf));
    }
    if(b.hitT > 0) b.hitT = Math.max(0, b.hitT - dt);
    if(b.shieldT > 0) b.shieldT = Math.max(0, b.shieldT - dt);

    // out of patience: it stops fighting, climbs away and is gone
    if(!b.leaving){
      b.fuse -= dt;
      if(b.fuse <= 0){
        b.leaving = true;
        b.cloak = 0; b.beams = []; b.tractorT = 0;
        b.vy = -5.5; b.vx *= 0.3;
        // A ship that leaves damaged sheds dilithium in proportion to the
        // damage done, so standing was never worth nothing. No card, no hull:
        // those are still what a kill is for.
        var dealt = 1 - Math.max(0, b.hp) / b.max;
        var shed = Math.round(dealt * (5 + Math.min(5, b.index)));
        for(var sg=0; sg<shed; sg++) dropPickup(b.x, b.y, 'gem');
        if(shed) burst(b.x, b.y, 20, '255,209,102', 1.1);
        disbandWing(b);
        if(bossBarEl) bossBarEl.classList.remove('on');
        nextBossAt = t + bossGapFor(bossCount) * 0.55;
      }
    }
    if(b.leaving){
      b.y += b.vy * sf; b.x += b.vx * sf;
      if(b.y < window.scrollY - b.r * 4){ boss = null; nextAlienAt = t + 1.5; }
      return;
    }

    // half hull: faster, wider, and the wing comes back sooner
    if(!b.enraged && b.hp <= b.max * 0.5){
      b.enraged = true;
      burst(b.x, b.y, 34, '255,77,109');
      if(b.phase !== 'cloak' && b.phase !== 'decloak') b.phaseT = Math.min(b.phaseT, 0.15);
      b.wingAt = Math.min(b.wingAt, t + 3);
    }
    var rage = b.enraged ? 1.45 : 1;

    BOSS_MOVE[BT.move](b, dt, sf, t, rage);
    b.x += b.vx * sf; b.y += b.vy * sf;

    b.phaseT -= dt;
    if(b.phaseT <= 0) bossNextPhase(t, rage);
    else BOSS_PHASE[b.phase].tick(b, dt, t, rage);

    updateBossBeams(b, dt, sf);
    updateTractor(b, dt, sf);

    // one wing at a time; a broken wing is replaced after a pause
    if(!b.wing && t >= b.wingAt) b.wing = spawnWing(b);

    if(b.cloak < 0.5 && Math.hypot(ship.x - b.x, ship.y - b.y) < b.r + SHIP_RADIUS){
      // a shield turns the ram into a shove and a broken shield, not a free kill
      if(shieldTime > 0){
        shieldTime = 0;
        burst(ship.x, ship.y, 22, '0,194,255');
        var rdx = ship.x - b.x, rdy = ship.y - b.y, rd = Math.hypot(rdx, rdy) || 1;
        ship.vx += rdx / rd * 7; ship.vy += rdy / rd * 7;
        ship.invuln = Math.max(ship.invuln, 0.8);
      } else hitShip('fire');
    }
  }

  // ── the wings ────────────────────────────────────────────────────────────
  // A flagship's escorts fly as one unit. They are ordinary hulls of the
  // faction — same silhouette, same hull points, same loot when they die —
  // but the wing moves them: each member steers to a slot the wing computes,
  // and the wing, not the member, decides when they fire. That is what lets
  // three Birds-of-Prey dive through the same point on the same frame, or four
  // drones hold a square with beams strung between them.
  var wings = [];
  var WING_HP = 0.85, TETHER_W = 4.5, WING_BONUS = 250;

  function spawnWing(b){
    var BT = BOSS_TYPES[b.fac], kind = BT.hull, AT = ALIEN_TYPES[kind];
    var n = BT.wingN, W = window.innerWidth, top = window.scrollY, H = window.innerHeight;
    var w = { id: ++uid, fac: b.fac, pattern: BT.wing, kind: kind, phase: '', t: 0, dur: 0,
              slots: [], rot: Math.random() * Math.PI * 2, cx: ship.x, cy: ship.y, h: 300,
              tx: 0, ty: 0, dir: 0, side: Math.random() < 0.5 ? 1 : -1,
              lit: false, arming: false, fireAt: 0, done: false, broken: false };
    for(var i=0;i<n;i++){
      // A box drone is the tankiest hull in the game on its own; four of them
      // at full hull made the box unbreakable, so wing hull is set per faction
      // and a corner can actually be shot out.
      var hp = Math.max(1, Math.round(AT.hp * alienHpScale(gameTime) * (BT.wingHp || WING_HP)));
      var fromLeft = (i + (w.side > 0 ? 0 : 1)) % 2 === 0;
      var al = { id: ++uid, kind: kind, r: AT.r,
                 x: fromLeft ? -AT.r * 2 : W + AT.r * 2,
                 y: top + H * (0.2 + 0.6 * Math.random()),
                 vx: 0, vy: 0, t: Math.random() * 6, hp: hp, maxHp: hp, hitT: 0,
                 ttl: 0, fleeing: false, nextShot: Infinity,
                 wing: w, slot: i, cloak: 0, tx: 0, ty: 0, maxV: 4 };
      al.baseY = al.y; al.tx = al.x; al.ty = al.y;
      aliens.push(al);
      w.slots.push(al);
    }
    wings.push(w);
    wingPhase(w, WING_START[w.pattern]);
    teach('wing', '<span>Escort wing</span><span>They attack together. Break the formation.</span>', 4);
    return w;
  }

  var WING_START = { pincer:'form', wall:'form', flank:'cloak', box:'form', strand:'set' };

  function wingAlive(w){
    var n = 0;
    for(var i=0;i<w.slots.length;i++){
      var al = w.slots[i];
      if(al && (al.hp <= 0 || aliens.indexOf(al) === -1)) w.slots[i] = null;
      if(w.slots[i]) n++;
    }
    return n;
  }

  function disbandWing(b){
    if(b && b.wing){ b.wing.done = true; b.wing.lit = false; b.wing = null; }
  }

  function wingFireAt(al, ang, speed, r, rgb, extra){
    var o = { x: al.x, y: al.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
              life: 3.2, r: r || 3, rgb: rgb };
    if(extra) for(var k in extra) o[k] = extra[k];
    alienBullets.push(o);
  }

  function wingPhase(w, phase){
    w.phase = phase; w.t = 0;
    var t = gameTime, rage = boss && boss.enraged ? 1.3 : 1, i, al;
    var AT = ALIEN_TYPES[w.kind];
    if(w.pattern === 'pincer'){
      if(phase === 'form') w.dur = 1.8;
      else if(phase === 'split'){ w.dur = 1.1; w.rot = Math.random() * Math.PI * 2; }
      else if(phase === 'mark'){ w.dur = 0.85 / rage; w.tx = ship.x; w.ty = ship.y; }
      else if(phase === 'run'){
        w.dur = 1.35;
        for(i=0;i<w.slots.length;i++){
          al = w.slots[i]; if(!al) continue;
          var d = Math.hypot(w.tx - al.x, w.ty - al.y) || 1;
          al.vx = (w.tx - al.x) / d * 6.4; al.vy = (w.ty - al.y) / d * 6.4;
          al.commit = true; al.face = Math.atan2(al.vy, al.vx);
          burst(al.x, al.y, 6, AT.rgb, 0.6);
        }
        w.fireAt = t + 0.12;
      }
    } else if(w.pattern === 'wall'){
      if(phase === 'form'){ w.dur = 2.0; w.side = -w.side; }
      else if(phase === 'fire'){ w.dur = 6.0; w.fireAt = t + 0.6; }
    } else if(w.pattern === 'flank'){
      if(phase === 'cloak'){ w.dur = 1.9; w.rot = Math.random() * Math.PI * 2; }
      else if(phase === 'decloak') w.dur = 0.7;
      else if(phase === 'hold'){
        w.dur = 2.8; w.fireAt = t + 1.0;
        // the crossfire: both fire a plasma torpedo on the same frame
        for(i=0;i<w.slots.length;i++){
          al = w.slots[i]; if(!al) continue;
          plasmaFrom(al.x, al.y, Math.atan2(ship.y - al.y, ship.x - al.x), AT.rgb);
        }
      }
    } else if(w.pattern === 'box'){
      if(phase === 'form'){ w.dur = 1.6; w.h = 300; w.cx = ship.x; w.cy = ship.y; w.lit = false; w.arming = false; }
      else if(phase === 'close'){ w.dur = 5.2 / Math.sqrt(rage); w.arming = true; }
      else if(phase === 'open'){ w.dur = 1.2; w.lit = false; w.arming = false; }
    } else if(w.pattern === 'strand'){
      if(phase === 'set'){
        w.dur = 1.5; w.lit = false; w.arming = true;
        w.dir = Math.random() * Math.PI * 2; w.cx = ship.x; w.cy = ship.y;
      } else if(phase === 'sweep'){ w.dur = 4.8 / Math.sqrt(rage); w.lit = true; w.arming = false; }
    }
  }

  var WING_NEXT = {
    pincer: { form:'split', split:'mark', mark:'run', run:'form' },
    wall:   { form:'fire', fire:'form' },
    flank:  { cloak:'decloak', decloak:'hold', hold:'cloak' },
    box:    { form:'close', close:'open', open:'form' },
    strand: { set:'sweep', sweep:'set' }
  };

  function updateWings(dt, t){
    var W = window.innerWidth, top = window.scrollY, H = window.innerHeight;
    for(var wi=wings.length-1; wi>=0; wi--){
      var w = wings[wi];
      var alive = wingAlive(w);
      if(!alive){
        // a broken formation is worth something on its own
        if(!w.done && !w.broken){
          w.broken = true;
          scored(WING_BONUS);
          addCore(CORE_KILL_SHIP);
          if(boss && boss.wing === w){ boss.wing = null; boss.wingAt = t + (boss.enraged ? 9 : 13); }
        }
        wings.splice(wi, 1);
        continue;
      }
      if(w.done){
        // disbanded: members break off (ALIEN_MOVE.wing) and nothing fires
        w.lit = false;
        continue;
      }
      w.t += dt;
      if(w.t >= w.dur) wingPhase(w, WING_NEXT[w.pattern][w.phase]);

      var AT = ALIEN_TYPES[w.kind], n = w.slots.length, i, al, f = Math.min(1, w.t / w.dur);
      var toBoss = boss ? Math.atan2(boss.y - ship.y, boss.x - ship.x) : -Math.PI / 2;

      for(i=0;i<n;i++){
        al = w.slots[i]; if(!al) continue;
        var sx = al.tx, sy = al.ty, v = 4;
        if(w.pattern === 'pincer'){
          if(w.phase === 'form'){
            var ax = ship.x + Math.cos(toBoss) * 340, ay = ship.y + Math.sin(toBoss) * 340;
            var back = toBoss, lat = (i === 0 ? 0 : (i % 2 ? 1 : -1)) * 48, rear = i === 0 ? 0 : 46;
            sx = ax + Math.cos(back) * rear - Math.sin(back) * lat;
            sy = ay + Math.sin(back) * rear + Math.cos(back) * lat;
            v = 3.6;
          } else if(w.phase === 'split' || w.phase === 'mark'){
            var pa = w.rot + i / n * Math.PI * 2;
            sx = (w.phase === 'mark' ? w.tx : ship.x) + Math.cos(pa) * 300;
            sy = (w.phase === 'mark' ? w.ty : ship.y) + Math.sin(pa) * 300;
            v = w.phase === 'split' ? 5.2 : 2;
          }
          if(w.phase !== 'run') al.commit = false;
        } else if(w.pattern === 'wall'){
          var wa = toBoss + w.side * Math.PI / 2;
          var wx = ship.x + Math.cos(wa) * 330, wy = ship.y + Math.sin(wa) * 330;
          var off = (i - (n - 1) / 2) * 96;
          sx = wx - Math.sin(wa) * off; sy = wy + Math.cos(wa) * off;
          v = w.phase === 'form' ? 3.4 : 1.6;
        } else if(w.pattern === 'flank'){
          var fa = w.rot + i * Math.PI * 2 / n;
          sx = ship.x + Math.cos(fa) * 300; sy = ship.y + Math.sin(fa) * 300;
          v = w.phase === 'cloak' ? 5 : 2.2;
          if(w.phase === 'cloak') al.cloak = Math.min(1, al.cloak + dt * 2.4);
          else if(w.phase === 'decloak') al.cloak = Math.max(0, al.cloak - dt / 0.65);
          else al.cloak = 0;
        } else if(w.pattern === 'box'){
          if(w.phase === 'close'){
            w.h = 300 - 145 * f;
            var cd = Math.hypot(ship.x - w.cx, ship.y - w.cy) || 1, cs = Math.min(cd, 0.55 * dt * 60);
            w.cx += (ship.x - w.cx) / cd * cs; w.cy += (ship.y - w.cy) / cd * cs;
            w.lit = w.t > 0.8; w.arming = !w.lit;
          } else if(w.phase === 'open') w.h = 300 + 40 * f;
          w.rot += 0.32 * dt;
          var ba = w.rot + Math.PI / 4 + i * Math.PI / 2;
          sx = w.cx + Math.cos(ba) * w.h * 1.414; sy = w.cy + Math.sin(ba) * w.h * 1.414;
          v = w.phase === 'form' ? 4.5 : 5;
        } else if(w.pattern === 'strand'){
          var ux = Math.cos(w.dir), uy = Math.sin(w.dir);
          var s = w.phase === 'set' ? 1 : 1 - 2 * f;           // +1 → -1 across the sweep
          var lx = w.cx + ux * 380 * s, ly = w.cy + uy * 380 * s;
          var so = (i - (n - 1) / 2) * 118;
          sx = lx - uy * so; sy = ly + ux * so;
          v = 5.2;
        }
        al.tx = clampN(sx, 16, W - 16);
        al.ty = clampN(sy, top - H * 0.2, top + H * 1.2);
        al.maxV = v;
      }

      // synchronized fire, decided by the wing rather than by each hull
      if(w.pattern === 'pincer' && w.phase === 'run' && w.fireAt && t >= w.fireAt){
        w.fireAt = w.t < 0.5 ? t + 0.45 : 0;
        for(i=0;i<n;i++){
          al = w.slots[i]; if(!al) continue;
          var ha = Math.atan2(al.vy, al.vx), hs = alienBulletSpeed(t) * 1.2;
          for(var sd=-1; sd<=1; sd+=2){
            alienBullets.push({ x: al.x - Math.sin(ha) * sd * 6, y: al.y + Math.cos(ha) * sd * 6,
                                vx: Math.cos(ha) * hs, vy: Math.sin(ha) * hs, life: 2.4, r: 3, rgb: AT.rgb });
          }
        }
      } else if(w.pattern === 'wall' && w.phase === 'fire' && t >= w.fireAt){
        // one parallel volley along a single heading: a wall of bolts with
        // gaps in it, rather than three fans converging on the same point
        w.fireAt = t + 1.9 / (boss && boss.enraged ? 1.3 : 1);
        var ca = 0, cn = 0;
        for(i=0;i<n;i++){ al = w.slots[i]; if(!al) continue; ca += Math.atan2(ship.y - al.y, ship.x - al.x); cn++; }
        var head = cn ? ca / cn : 0;
        for(i=0;i<n;i++){
          al = w.slots[i]; if(!al) continue;
          for(var fk=-1; fk<=1; fk++) wingFireAt(al, head + fk * 0.12, alienBulletSpeed(t) * 0.9, 3, AT.rgb);
        }
      } else if(w.pattern === 'flank' && w.phase === 'hold' && t >= w.fireAt){
        w.fireAt = t + 1.1;
        for(i=0;i<n;i++){
          al = w.slots[i]; if(!al) continue;
          wingFireAt(al, Math.atan2(ship.y - al.y, ship.x - al.x), alienBulletSpeed(t), 3, AT.rgb);
        }
      }
    }
  }

  // The live segments of every wing that strings beams between its hulls.
  // Only adjacent, living members are joined, so killing one opens a gap.
  function wingTethers(w){
    var out = [], n = w.slots.length, i, a, b;
    if(w.pattern !== 'box' && w.pattern !== 'strand') return out;
    var ring = w.pattern === 'box';
    for(i=0;i<(ring ? n : n - 1);i++){
      a = w.slots[i]; b = w.slots[(i + 1) % n];
      if(a && b) out.push([a, b]);
    }
    return out;
  }

  function updateTethers(){
    if(ship.invuln > 0 || shieldTime > 0) return;
    for(var wi=0; wi<wings.length; wi++){
      var w = wings[wi];
      if(!w.lit || w.done) continue;
      var segs = wingTethers(w);
      for(var s=0;s<segs.length;s++){
        var a = segs[s][0], b = segs[s][1];
        if(segDist(ship.x, ship.y, a.x, a.y, b.x, b.y) < TETHER_W + SHIP_RADIUS){
          burst(ship.x, ship.y, 14, ALIEN_TYPES[w.kind].rgb);
          hitShip('fire');
          return;
        }
      }
    }
  }

  function collect(p){
    if(p.kind === 'heart'){
      if(lives < MAX_LIVES){ lives++; }
      else bonus += 200;                 // already at full health: bank it
      burst(p.x, p.y, 12, PICKUPS.heart.rgb);
      bloom(p.x, p.y, 34, PICKUPS.heart.rgb);
      syncHud();
    } else if(p.kind === 'shield' || p.kind === 'rapid'){
      // instant, and deliberately not a pause: the run never stops for these
      if(p.kind === 'shield') shieldTime = POWER_TIME;
      else rapidTime = POWER_TIME;
      burst(p.x, p.y, 20, SPECIALS[p.kind].rgb);
      bonus += 50;
      syncHud();
    } else {
      // dilithium is XP, and XP is the only thing that opens a refit card
      burst(p.x, p.y, p.value > 1 ? 10 : 5, '255,209,102');
      dilithium += p.value;
      addXp(p.value);
    }
  }

  function fireShot(){
    // spread fans the barrels around the nose; with no spread this is the one
    // shot it always was.
    //
    // Shots carry the ship's own velocity. A ship at full throttle travels at
    // roughly 7.8px a frame against a muzzle speed of 11, so without this a
    // thrusting player's bullets crawl away from the nose and the gun stops
    // working exactly when the player is moving — which, with the trigger held
    // down permanently, is most of the run.
    ship.muzzle = 1;
    var n = barrels(up.spread), step = fanStep(up.spread);
    var base = ship.angle - step * (n - 1) / 2;
    var sp = bulletSpeed(), lf = bulletLife(), dmg = bulletDamage();
    for(var i=0;i<n;i++){
      var a = base + step * i;
      bullets.push({
        x: ship.x + Math.cos(a)*NOSE_OFFSET, y: ship.y + Math.sin(a)*NOSE_OFFSET,
        vx: Math.cos(a)*sp + ship.vx, vy: Math.sin(a)*sp + ship.vy,
        dmg: dmg, life: lf,
        pierce: up.pierce, hits: null
      });
    }
  }

  // shortest signed angle from b to a, in (-PI, PI]
  function angDiff(a, b){
    var d = (a - b) % (Math.PI*2);
    if(d > Math.PI) d -= Math.PI*2;
    if(d < -Math.PI) d += Math.PI*2;
    return d;
  }

  // A lock is only ever held on something that is still there to be hit. The
  // boss is checked by identity because it is a single slot rather than a list,
  // and `leaving` means she has broken off and is no longer a legal target.
  function torpTargetLive(o){
    if(!o) return false;
    if(o === boss) return bossTargetable() && boss.hp > 0;
    if(o.cloak > 0.5) return false;
    return o.hp > 0 && aliens.indexOf(o) !== -1;
  }

  // Nearest ship, with a penalty for how far off the nose it sits — a target
  // directly behind the launcher costs the torpedo most of its fuel in the
  // turn, so it is scored as if it were further away rather than ruled out.
  // A capital ship is worth going after even from further out, because that is
  // the fight where a torpedo is worth the most.
  function acquireTorpTarget(x, y, ang){
    var best = null, bestScore = Infinity, R = torpSeekRange();
    function consider(o, bias){
      var dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy);
      if(d > R) return;
      var off = Math.abs(angDiff(Math.atan2(dy, dx), ang));
      var score = d * (1 + off * 0.55) * bias;
      if(score < bestScore){ bestScore = score; best = o; }
    }
    for(var i=0;i<aliens.length;i++) if(!(aliens[i].cloak > 0.5)) consider(aliens[i], 1);
    if(bossTargetable()) consider(boss, 0.6);
    return best;
  }

  function fireTorpedo(){
    var a = ship.angle, sp = TORP_SPEED;
    torpedoes.push({
      x: ship.x + Math.cos(a)*NOSE_OFFSET, y: ship.y + Math.sin(a)*NOSE_OFFSET,
      // a torpedo inherits the ship's velocity for the same reason a phaser
      // does — at full impulse the hull outruns a 5.4px shell otherwise
      vx: Math.cos(a)*sp + ship.vx, vy: Math.sin(a)*sp + ship.vy,
      life: TORP_LIFE, r: TORP_R, t: 0,
      // launched on the nose either way; the lock is what it does afterwards
      target: acquireTorpTarget(ship.x, ship.y, a)
    });
  }

  // The detonation is the weapon. One damage pass over everything inside the
  // blast, then a shockwave ring that is pure decoration — the ring expands
  // after the fact and never touches anything, so what the player sees can be
  // generous without the hitbox following it outward.
  // The blast is shared by both things that make one. It takes its radius and
  // its damage as arguments rather than reading the torpedo bay, because a
  // mine is a different weapon on a different card and must be able to be
  // worth more or less than a warhead without the two moving together.
  function detonate(x, y, R, dmg, tint){
    if(!R) R = torpBlast();
    if(!dmg) dmg = torpDamage();
    var R2 = R * R;
    shockwaves.push({ x:x, y:y, r: R * 0.18, max: R, life: 1, tint: tint || null });
    burst(x, y, 28, tint || '255,45,120', 1.3);
    burst(x, y, 12, tint || '255,209,102');
    bloom(x, y, R * 1.2, tint || '255,140,60');
    shake(0.36); freeze(0.04);

    for(var k=asteroids.length-1;k>=0;k--){
      var rk = asteroids[k];
      var dx = rk.x - x, dy = rk.y - y;
      if(dx*dx + dy*dy > R2) continue;
      rk.hp -= dmg; rk.hitT = 0.14;
      if(rk.hp <= 0) killAsteroid(k);
    }
    for(var m=aliens.length-1;m>=0;m--){
      var al = aliens[m];
      var ax = al.x - x, ay = al.y - y;
      if(ax*ax + ay*ay > R2) continue;
      al.hitT = 0.14;
      if(alienHurt(al, dmg)) killAlien(m);
    }
    if(bossTargetable()){
      var bx = boss.x - x, by = boss.y - y;
      if(bx*bx + by*by <= R2) hurtBoss(dmg, 0.14);
    }
    // the blast clears incoming plasma, which is most of why flying into a
    // crowd behind a torpedo is survivable at all
    for(var q=alienBullets.length-1;q>=0;q--){
      var ab = alienBullets[q];
      var qx = ab.x - x, qy = ab.y - y;
      if(qx*qx + qy*qy <= R2) alienBullets.splice(q,1);
    }
  }

  // The trail is a string of overlapping blobs dropped on a fixed interval, so
  // its density is the same at any speed — dropping one per frame would make a
  // fast ship's wall thinner than a slow one's, which is exactly backwards.
  // Each blob damages a given ship at most every WAKE_TICK, tracked on the
  // blob rather than the ship, so flying a long trail across a warbird burns
  // it repeatedly and clipping one corner of it does not.
  function updateWake(dt, t){
    if(up.wake > 0 && ship.thrusting && t >= nextWake){
      nextWake = t + WAKE_GAP;
      wake.push({ x: ship.x - Math.cos(ship.angle) * NOSE_OFFSET * 0.8,
                  y: ship.y - Math.sin(ship.angle) * NOSE_OFFSET * 0.8,
                  life: wakeLife(), max: wakeLife(), hits: {} });
    }
    var dmg = wakeDamage();
    for(var i=wake.length-1;i>=0;i--){
      var w = wake[i];
      w.life -= dt;
      if(w.life <= 0){ wake.splice(i,1); continue; }
      if(!up.wake) continue;
      for(var a=aliens.length-1;a>=0;a--){
        var al = aliens[a];
        if(Math.hypot(al.x-w.x, al.y-w.y) > al.r + WAKE_R) continue;
        if(w.hits[al.id] > t) continue;
        w.hits[al.id] = t + WAKE_TICK;
        al.hitT = 0.12;
        var wakeDied = alienHurt(al, dmg);
        burst(al.x, al.y, 3, '255,140,60');
        if(wakeDied) killAlien(a);
      }
      if(bossTargetable() && Math.hypot(boss.x-w.x, boss.y-w.y) < bossHitR() + WAKE_R &&
         !(w.hits[boss.id] > t)){
        w.hits[boss.id] = t + WAKE_TICK;
        hurtBoss(dmg, 0.12);
      }
    }
  }

  // Damage per second rather than per hit, so it does not care about the frame
  // rate and a rock that clips the field for a tenth of a second takes a tenth
  // of a second's worth. `arcOn` is what the renderer draws, collected here so
  // the burn and the lightning can never disagree about what is being hit.
  var arcOn = [];
  function updateArc(dt){
    arcOn.length = 0;
    if(up.arc <= 0) return;
    var R = arcRange(), hit = arcDps() * dt;
    for(var k=asteroids.length-1;k>=0;k--){
      var rk = asteroids[k];
      if(Math.hypot(rk.x-ship.x, rk.y-ship.y) > R + rk.r) continue;
      rk.hp -= hit; rk.hitT = 0.1;
      arcOn.push(rk);
      if(rk.hp <= 0) killAsteroid(k);
    }
    for(var m=aliens.length-1;m>=0;m--){
      var al = aliens[m];
      if(Math.hypot(al.x-ship.x, al.y-ship.y) > R + al.r) continue;
      al.hitT = 0.1;
      var arcDied = alienHurt(al, hit);
      arcOn.push(al);
      if(arcDied) killAlien(m);
    }
    if(bossTargetable() && Math.hypot(boss.x-ship.x, boss.y-ship.y) < R + bossHitR()){
      arcOn.push(boss);
      hurtBoss(hit, 0.1);
    }
  }

  function updateTorpedoes(dt, sf){
    for(var i=torpedoes.length-1;i>=0;i--){
      var tp = torpedoes[i];

      // A dead target frees the lock and the torpedo goes looking for another
      // rather than sailing on into empty space — a warbird killed by phaser
      // fire mid-flight used to strand its torpedo.
      if(!torpTargetLive(tp.target)) tp.target = acquireTorpTarget(tp.x, tp.y, Math.atan2(tp.vy, tp.vx));

      if(tp.target){
        // Where to aim: the target's own position, pushed forward along
        // whatever it did last frame. The velocity is measured here rather
        // than read off the target because a bobbing warbird's `vy` is zero —
        // its y comes from a sine on baseY — so the field would lie.
        var tx = tp.target.x, ty = tp.target.y;
        if(tp.tid === tp.target && sf > 0.001){
          var tvx = (tx - tp.tpx) / sf, tvy = (ty - tp.tpy) / sf;
          var td = Math.hypot(tx - tp.x, ty - tp.y);
          var lead = Math.min(TORP_LEAD, td / TORP_SPEED);
          tx += tvx * lead; ty += tvy * lead;
        }
        // remembered against the target itself, so a re-lock starts clean
        tp.tid = tp.target; tp.tpx = tp.target.x; tp.tpy = tp.target.y;

        // Steer by turning the velocity, not by re-pointing it: the turn is
        // rate-limited, so the track curves and a target that keeps moving can
        // still get outside the arc. Speed eases back to the bay's own figure
        // at the same time, which sheds whatever the hull lent it at launch.
        var aim = Math.atan2(ty - tp.y, tx - tp.x);
        var cur = Math.atan2(tp.vy, tp.vx);
        var turn = torpTurnRate() * dt, d = angDiff(aim, cur);
        cur += Math.max(-turn, Math.min(turn, d));
        var sp = Math.hypot(tp.vx, tp.vy) || TORP_SPEED;
        sp += (TORP_SPEED - sp) * (1 - Math.pow(0.90, sf));
        tp.vx = Math.cos(cur) * sp; tp.vy = Math.sin(cur) * sp;
      }

      tp.x += tp.vx * sf; tp.y += tp.vy * sf; tp.life -= dt; tp.t += dt;
      if(tp.x < 0 || tp.x > window.innerWidth || tp.y < 0 || tp.y > docH){
        torpedoes.splice(i,1); continue;
      }
      if(tp.life <= 0){ detonate(tp.x, tp.y); torpedoes.splice(i,1); continue; }

      var hit = false, j;
      // Rock only arms the fuse when there is nothing better to hit. This is
      // the line that stops a torpedo being spent on the first pebble between
      // it and the warbird it was launched at; the blast still catches the rock
      // on the way past when it goes off at the target.
      if(!tp.target) for(j=0;j<asteroids.length;j++){
        if(Math.hypot(tp.x-asteroids[j].x, tp.y-asteroids[j].y) < asteroids[j].r + tp.r){ hit = true; break; }
      }
      // the fuse is only generous toward the thing it is actually chasing;
      // everything else still has to be touched
      if(!hit && tp.target && tp.target !== boss &&
         Math.hypot(tp.x-tp.target.x, tp.y-tp.target.y) < tp.target.r + tp.r + TORP_FUSE) hit = true;
      if(!hit) for(j=0;j<aliens.length;j++){
        if(Math.hypot(tp.x-aliens[j].x, tp.y-aliens[j].y) < aliens[j].r + tp.r){ hit = true; break; }
      }
      if(!hit && bossTargetable() &&
         Math.hypot(tp.x-boss.x, tp.y-boss.y) <
           bossHitR() + tp.r + (tp.target === boss ? TORP_FUSE : 0)) hit = true;
      if(hit){ detonate(tp.x, tp.y); torpedoes.splice(i,1); }
    }

    for(var w=shockwaves.length-1;w>=0;w--){
      var sw = shockwaves[w];
      sw.r += (sw.max - sw.r) * (1 - Math.pow(0.82, sf));
      sw.life -= 2.6 * dt;
      if(sw.life <= 0) shockwaves.splice(w,1);
    }
  }

  // Laid off the stern, with a fraction of the hull's velocity, so a mine
  // dropped at full impulse falls behind rather than being left exactly under
  // the tail — and then it bleeds that off and holds station. The rack is a
  // queue: past the cap the oldest mine goes cold and is simply removed, not
  // detonated, because a rack that fired its own tail end every few seconds
  // would be laying the trap behind the player instead of in front of them.
  function layMine(){
    while(mines.length >= mineRack()) mines.shift();
    var a = ship.angle;
    mines.push({
      x: ship.x - Math.cos(a) * NOSE_OFFSET, y: ship.y - Math.sin(a) * NOSE_OFFSET,
      vx: ship.vx * 0.35, vy: ship.vy * 0.35,
      life: MINE_LIFE, arm: MINE_ARM, t: 0, r: MINE_R
    });
  }

  function updateMines(dt, sf){
    if(!mines.length) return;
    var R = mineTrigger(), dmg = mineDamage(), blast = mineBlast();
    for(var i=mines.length-1;i>=0;i--){
      var m = mines[i];
      m.t += dt;
      m.x += m.vx * sf; m.y += m.vy * sf;
      var drag = Math.pow(0.90, sf);
      m.vx *= drag; m.vy *= drag;
      if(m.arm > 0) m.arm -= dt;
      m.life -= dt;
      // A mine that times out goes off rather than vanishing. It is the one
      // thing that tells a player the rack has a shelf life without a readout.
      if(m.life <= 0){ detonate(m.x, m.y, blast, dmg, MINE_RGB); mines.splice(i,1); continue; }
      if(m.arm > 0) continue;

      // Rock counts. Everything else defensive in this deck steps around the
      // 70% of the damage that rock does; this weapon is allowed to answer it.
      var hit = false, j;
      for(j=0;j<asteroids.length;j++){
        if(Math.hypot(m.x-asteroids[j].x, m.y-asteroids[j].y) < asteroids[j].r + R){ hit = true; break; }
      }
      if(!hit) for(j=0;j<aliens.length;j++){
        if(Math.hypot(m.x-aliens[j].x, m.y-aliens[j].y) < aliens[j].r + R){ hit = true; break; }
      }
      if(!hit && bossTargetable() && Math.hypot(m.x-boss.x, m.y-boss.y) < bossHitR() + R) hit = true;
      if(hit){ detonate(m.x, m.y, blast, dmg, MINE_RGB); mines.splice(i,1); }
    }
  }

  function update(dt){
    var t = gameTime;
    var sf = dt * 60; if(sf > MAX_STEP) sf = MAX_STEP;
    speedMult = speedMultAt(t);

    if(shieldTime > 0) shieldTime = Math.max(0, shieldTime - dt);
    if(rapidTime > 0)  rapidTime  = Math.max(0, rapidTime  - dt);
    if(up.armour > 0 && !armourReady && t >= armourAt) armourReady = true;
    if(refitDue && t >= refitDue){
      if(pendingLevels > 0) openLevelUp(); else refitDealt();
    }
    // Auto Aegis: a free shield on a fixed cadence once it has been picked
    if(up.guard > 0 && t >= nextGuard){
      nextGuard = t + guardEvery(up.guard);
      shieldTime = Math.max(shieldTime, GUARD_TIME);
      burst(ship.x, ship.y, 14, '0,194,255');
    }
    syncHud();

    // the field thickens continuously, and kills are topped back up on a short
    // stagger rather than instantly, so a cleared pocket stays cleared a moment
    // red alert is a real risk multiplier, not just a light: the field carries
    // more rock and the warbirds come in closer together. Both are folded in
    // here rather than into the curves themselves, so the underlying
    // escalation stays readable and the alert stays a modifier on top of it.
    var target = rockTargetAt(t) + (redAlert ? RED_ALERT_ROCKS : 0);
    if(target > MAX_ROCKS + RED_ALERT_ROCKS) target = MAX_ROCKS + RED_ALERT_ROCKS;
    // a capital-ship fight thins the rock as well as the traffic
    if(boss) target = Math.round(target * 0.65);
    rockSpawnAcc += dt;
    if(asteroids.length < target && rockSpawnAcc > (boss ? 1.5 : 0.35)){
      rockSpawnAcc = 0;
      spawnWave(target);
    }

    // The helm eases in over about a tenth of a second rather than snapping
    // to full rate, so a tap on an arrow key nudges the nose a few degrees
    // and holding it still comes round at full speed. Without the ease every
    // tap was a fixed, large step and fine aim was not possible.
    var turnWant = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    ship.turn = (ship.turn || 0) + (turnWant - (ship.turn || 0)) * Math.min(1, 14 * dt);
    if(!turnWant && Math.abs(ship.turn) < 0.02) ship.turn = 0;
    ship.angle += rotPower() * ship.turn * sf;

    // joystick: rotate toward the stick direction rather than snapping to it,
    // so the ship still feels like it turns
    if(pad.mag > 0.18){
      var da = pad.angle - ship.angle;
      while(da >  Math.PI) da -= Math.PI * 2;
      while(da < -Math.PI) da += Math.PI * 2;
      var step = rotPower() * 1.7 * sf;
      ship.angle += Math.max(-step, Math.min(step, da));
    }

    // throttle is proportional to how far the stick is pushed
    var thrustAmt = 0;
    if(keys.ArrowUp) thrustAmt = 1;
    else if(pad.mag > 0.3) thrustAmt = Math.min(1, (pad.mag - 0.3) / 0.55);
    ship.thrusting = thrustAmt > 0;
    if(ship.thrusting){
      ship.vx += Math.cos(ship.angle) * thrustPower() * thrustAmt * sf;
      ship.vy += Math.sin(ship.angle) * thrustPower() * thrustAmt * sf;
      if(hullMods().grip) applyGrip(hullMods().grip * thrustAmt, sf);
    }
    // Per-hull, not a constant: this is the number that makes the Sovereign
    // feel like it has mass and the Nova feel like it stops when you stop.
    var drag = Math.pow(hullMods().drag, sf);
    ship.vx *= drag; ship.vy *= drag;

    var nx = ship.x + ship.vx * sf, ny = ship.y + ship.vy * sf;
    if(nx < 0){ nx = 0; ship.vx = -ship.vx*BOUNCE; }
    else if(nx > window.innerWidth){ nx = window.innerWidth; ship.vx = -ship.vx*BOUNCE; }
    if(ny < 0){ ny = 0; ship.vy = -ship.vy*BOUNCE; }
    else if(ny > docH){ ny = docH; ship.vy = -ship.vy*BOUNCE; }
    ship.x = nx; ship.y = ny;
    if(ship.invuln > 0) ship.invuln = Math.max(0, ship.invuln - dt);
    if(ship.muzzle > 0) ship.muzzle = Math.max(0, ship.muzzle - dt * 11);

    // A thin trail of hot plasma off the nacelles, dropped on a clock rather
    // than once a frame so its density does not change with the refresh rate.
    if(ship.thrusting && t >= nextEmber){
      nextEmber = t + 0.038;
      var ca = Math.cos(ship.angle), sa = Math.sin(ship.angle), ba = ship.angle + Math.PI;
      for(var ei=0; ei<2; ei++){
        var side = ei ? 11.2 : -11.2, es = 1.1 + Math.random()*0.9;
        particles.push({ t:'ember',
          x: ship.x + ca*-13 - sa*side, y: ship.y + sa*-13 + ca*side,
          vx: Math.cos(ba)*es + ship.vx*0.35, vy: Math.sin(ba)*es + ship.vy*0.35,
          life:1, decay: 2.8 + Math.random()*1.5, drag:0.93,
          r: 0.85 + Math.random()*1.05, col:'120,215,255' });
      }
    }

    for(var r=asteroids.length-1; r>=0; r--){
      var ax = asteroids[r];
      ax.vx = Math.cos(ax.ang) * ax.sf * speedMult;
      ax.vy = Math.sin(ax.ang) * ax.sf * speedMult;
      ax.x += ax.vx * sf; ax.y += ax.vy * sf; ax.rot += ax.rotSpeed * sf;
      if(ax.hitT > 0) ax.hitT = Math.max(0, ax.hitT - dt);
      if(ax.entering){
        // hold off wrapping until it has actually made it onto the screen
        if(ax.x >= -ax.r && ax.x <= window.innerWidth + ax.r) ax.entering = false;
      } else {
        // The field travels with the camera. Wrapping against docH spread forty
        // rocks down thirteen thousand pixels, which left two or three on screen
        // at a time — survivable, but it starved the XP loop that the whole run
        // now hangs on. Wrapping against a band a little taller than the view
        // makes on-screen density the thing that is actually governed.
        var band = window.innerHeight * BAND_PAD;
        var bTop = window.scrollY - band - ax.r;
        var bBot = window.scrollY + window.innerHeight + band + ax.r;
        if(ax.x < -ax.r) ax.x = window.innerWidth + ax.r;
        else if(ax.x > window.innerWidth + ax.r) ax.x = -ax.r;
        if(ax.y < bTop) ax.y = bBot;
        else if(ax.y > bBot) ax.y = bTop;
      }
      // The deflector shoves rock aside by moving it, not by pushing on its
      // velocity: vx/vy are re-derived from ax.ang at the top of this loop
      // every frame, so any impulse written to them is gone before it is read.
      if(up.deflector > 0){
        var ddx = ax.x - ship.x, ddy = ax.y - ship.y;
        var dd = Math.hypot(ddx, ddy) || 1, dR = deflectRange() + ax.r;
        if(dd < dR){
          var push = DEFLECT_PUSH * (1 - dd / dR) * sf;
          ax.x += ddx / dd * push; ax.y += ddy / dd * push;
        }
      }
      // One distance, three answers: outside everything, inside the graze
      // band, or inside the hull. Computing it once is not only cheaper, it is
      // the only way the three tests can never disagree with each other.
      var rgd = Math.hypot(ship.x-ax.x, ship.y-ax.y);
      if(rgd < ax.r + GRAZE_BAND && rgd >= ax.r + SHIP_RADIUS) graze(ax, CORE_ROCK, ax.x, ax.y);
      if(rgd < ax.r + SHIP_RADIUS){
        if(ramArmed(ax.x, ax.y)){
          ax.hp -= ramDamage(); ax.hitT = 0.14;
          burst(ax.x, ax.y, 14, '111,232,255');
          if(ax.hp <= 0) killAsteroid(r);
          ramBleed();
        } else hitShip('rock');
      }
    }

    // camera follow — keep the ship near the middle; start scrolling well before it reaches an edge
    var margin = window.innerHeight * 0.4;
    var viewY = ship.y - window.scrollY;
    var maxScroll = Math.max(0, docH - window.innerHeight);
    var camTarget = window.scrollY;
    if(viewY < margin) camTarget = ship.y - margin;
    else if(viewY > window.innerHeight - margin) camTarget = ship.y - window.innerHeight + margin;
    camTarget = Math.max(0, Math.min(camTarget, maxScroll));
    if(Math.abs(camTarget - window.scrollY) > 0.5){
      var ease = 1 - Math.pow(1 - 0.22, sf);
      window.scrollTo(window.scrollX, window.scrollY + (camTarget - window.scrollY) * ease);
    }

    // both weapons run themselves — there is no fire input on any device.
    // They are on separate clocks on purpose: the phaser's chatter and the
    // torpedo's slow thump are meant to be heard as two different weapons.
    if(t - ship.lastShot > shotCooldown()){
      ship.lastShot = t;
      fireShot();
    }
    if(up.torp > 0 && t >= nextTorp){
      nextTorp = t + torpCooldown();
      fireTorpedo();
    }
    // The rack is on a clock of its own for the same reason the bay is: three
    // weapons that fired together would be heard as one.
    if(up.mine > 0 && t >= nextMine){
      nextMine = t + mineCooldown();
      layMine();
    }
    updateTorpedoes(dt, sf);
    updateMines(dt, sf);
    updateWake(dt, t);
    updateArc(dt);
    updateSurges(dt);
    updateBeams(dt, sf, t);
    updateWebs(dt);

    for(var i=bullets.length-1;i>=0;i--){
      var b = bullets[i];
      b.x += b.vx * sf; b.y += b.vy * sf; b.life -= dt;
      if(b.life<=0 || b.x<0 || b.x>window.innerWidth || b.y<0 || b.y>docH){
        bullets.splice(i,1); continue;
      }
      if(bossTargetable() && Math.hypot(b.x-boss.x, b.y-boss.y) < bossHitR()){
        // an adapted cube throws the beam back white: nothing is getting in
        sparks(b.x, b.y, 3, boss.shieldT > 0 ? '255,255,255' : '255,209,102', 0.8);
        if(hurtBoss(b.dmg, 0.1)){ bullets.splice(i,1); continue; }
        if(!spendBullet(b, i, boss.id)) continue;
      }

      // Heavy plasma is the one piece of enemy ordnance the guns can destroy,
      // and it is checked before the hulls: a torpedo bearing down on you is a
      // more urgent target than the ship that fired it, and a shot that passed
      // through the plasma to hit the warbird behind would make nonsense of
      // the whole idea.
      var spent = false;
      for(var hb=alienBullets.length-1; hb>=0; hb--){
        var hv = alienBullets[hb];
        if(!hv.hp) continue;
        if(b.hits && b.hits.indexOf(hv.id) !== -1) continue;
        if(Math.hypot(b.x - hv.x, b.y - hv.y) > hv.r + 3) continue;
        hv.hp -= b.dmg;
        sparks(b.x, b.y, 5, hv.rgb, 0.9);
        if(hv.hp <= 0){
          bloom(hv.x, hv.y, 46, hv.rgb);
          burst(hv.x, hv.y, 18, hv.rgb, 1.1);
          shake(0.18);
          alienBullets.splice(hb, 1);
          scored(45);
        }
        spent = !spendBullet(b, i, hv.id);
        break;
      }
      if(spent) continue;

      for(var m=aliens.length-1;m>=0;m--){
        var al2 = aliens[m];
        if(al2.cloak > 0.5) continue;              // cloaked: the beam goes through
        if(b.hits && b.hits.indexOf(al2.id) !== -1) continue;
        if(Math.hypot(b.x-al2.x, b.y-al2.y) < al2.r){
          al2.hitT = 0.12;
          var al2Died = alienHurt(al2, b.dmg);
          sparks(b.x, b.y, 4, al2.adapted ? '255,255,255' : '190,240,255', 0.85);
          if(al2Died) killAlien(m);
          spent = !spendBullet(b, i, al2.id);
          break;
        }
      }
      if(spent) continue;

      for(var k=asteroids.length-1;k>=0;k--){
        var rock = asteroids[k];
        if(b.hits && b.hits.indexOf(rock.id) !== -1) continue;
        if(Math.hypot(b.x-rock.x, b.y-rock.y) < rock.r){
          rock.hp -= b.dmg; rock.hitT = 0.12;
          if(rock.hp <= 0) killAsteroid(k);
          else sparks(b.x, b.y, 4, '214,178,255', 0.8);
          spendBullet(b, i, rock.id);
          break;
        }
      }
      // bullets pass over the page — the game no longer affects content
    }

    // A capital ship is announced before it decloaks, and while one is inbound
    // or alive the ordinary warbird timer holds — it brings its own escorts,
    // and the fight should be legible rather than buried under traffic.
    if(!boss && bossWarn <= 0 && t >= nextBossAt){
      bossWarn = BOSS_WARN;
      contact = pickContact(t);
      // "approaching" for a ship that will hail — she might never arrive, and
      // a warning that announces what can still be refused should not lie.
      // A Romulan does not hail, so for her the warning is the whole notice.
      if(warnEl){
        warnEl.textContent = contact.name + (BOSS_TYPES[contact.fac].ambush ? ' decloaking' : ' approaching');
        warnEl.classList.add('on');
      }
    }
    if(bossWarn > 0){
      bossWarn -= dt;
      if(bossWarn <= 0){
        if(warnEl) warnEl.classList.remove('on');
        // the warning runs its full beat and then hands over to the hail —
        // or, for an ambush, straight to the fight
        if(contact && BOSS_TYPES[contact.fac].ambush) spawnBoss();
        else openHail();
      }
    }
    if(boss) updateBoss(dt, sf, t);
    else if(bossWarn <= 0 && t >= nextAlienAt && aliens.length < alienMax(t)){
      spawnAlien();
      nextAlienAt = t + alienInterval(t) * (redAlert ? RED_ALERT_SPAWN : 1);
    }
    updateWings(dt, t);
    updateTethers();

    for(var ai=aliens.length-1; ai>=0; ai--){
      var al = aliens[ai];
      var AT = ALIEN_TYPES[al.kind];
      al.t += 0.03 * sf;
      if(al.hitT > 0) al.hitT = Math.max(0, al.hitT - dt);

      (ALIEN_MOVE[al.wing ? 'wing' : (al.retreat ? 'retreat' : (AT.move || 'strafe'))])(al, dt, sf, t, AT);

      // Gone, and each hull leaves in its own way. A strafer is done the
      // moment it crosses the far edge; everything that manoeuvres has to be
      // clear of the whole band the camera travels in, or a raptor lining up
      // its next run would be deleted mid-turn.
      var gone;
      if(al.wing || al.retreat) gone = (al.retreat || al.wing.done) && offBand(al);
      else if(AT.move === 'chase' || AT.move === 'standoff') gone = al.fleeing && offBand(al);
      else if(AT.move === 'anchor') gone = al.phase === 'leave' && offBand(al);
      else if(AT.move === 'run' || AT.move === 'grind') gone = offBand(al);
      else gone = al.vx > 0 ? al.x > window.innerWidth + al.r*3 : al.x < -al.r*3;
      if(gone){ aliens.splice(ai,1); continue; }

      // a cloaked hull is not there to graze, ram or be rammed by
      if(al.cloak > 0.5) continue;
      var agd = Math.hypot(ship.x-al.x, ship.y-al.y);
      if(agd < al.r + GRAZE_BAND && agd >= al.r + SHIP_RADIUS) graze(al, CORE_SHIP, al.x, al.y);
      if(agd < al.r + SHIP_RADIUS){
        // A shield used to ram straight through anything for free. It still
        // shrugs off a scout, but the armoured hulls only take a dent and are
        // shoved clear, so a live shield is no longer a licence to fly at
        // everything on the screen.
        if(shieldTime > 0){
          burst(al.x, al.y, 14, '0,194,255');
          al.hitT = 0.12;
          if(alienHurt(al, 4)){ killAlien(ai); continue; }
          var kdx = al.x - ship.x, kdy = al.y - ship.y, kd = Math.hypot(kdx, kdy) || 1;
          al.x += kdx / kd * (al.r + SHIP_RADIUS + 4);
          al.y += kdy / kd * (al.r + SHIP_RADIUS + 4);
          al.baseY = al.y;
          continue;
        }
        if(ship.invuln > 0) continue;
        if(ramArmed(al.x, al.y)){
          al.hitT = 0.14;
          var ramDied = alienHurt(al, ramDamage());
          burst(al.x, al.y, 16, '111,232,255');
          ramBleed();
          if(ramDied){ killAlien(ai); continue; }
          // survived the shunt: shoved clear so it is not still inside you
          var sdx = al.x - ship.x, sdy = al.y - ship.y, sd = Math.hypot(sdx, sdy) || 1;
          al.x += sdx / sd * (al.r + SHIP_RADIUS + 6);
          al.y += sdy / sd * (al.r + SHIP_RADIUS + 6);
          al.baseY = al.y;
          continue;
        }
        burst(al.x, al.y, 14, AT.rgb); aliens.splice(ai,1); hitShip('fire'); continue;
      }

      if(!al.retreat && t > al.nextShot){
        al.nextShot = t + alienCooldown(t) * AT.cd;
        (ALIEN_FIRE[AT.fire || 'fan'])(al, t, AT);
      }
    }
    for(var q=alienBullets.length-1; q>=0; q--){
      var ab = alienBullets[q];
      // Heavy plasma turns toward the ship — slowly enough that it is a thing
      // to be outmanoeuvred or shot down rather than a thing that simply
      // arrives. Ordinary rounds fly straight and always have.
      if(ab.seek){
        var pa = Math.atan2(ab.vy, ab.vx);
        pa += angDiff(Math.atan2(ship.y - ab.y, ship.x - ab.x), pa) *
              (1 - Math.pow(1 - ab.seek * dt, sf));
        var psp = Math.hypot(ab.vx, ab.vy);
        ab.vx = Math.cos(pa) * psp; ab.vy = Math.sin(pa) * psp;
      }
      // Tholian shards shatter into three a little way out, so the ring that
      // looked dodgeable at the hull is three times as dense by the time it
      // reaches you
      if(ab.split){
        ab.age += dt;
        if(ab.age >= ab.split){
          var ha = Math.atan2(ab.vy, ab.vx), hs = Math.hypot(ab.vx, ab.vy) * 1.12;
          for(var sk=-1; sk<=1; sk++){
            alienBullets.push({ x: ab.x, y: ab.y, vx: Math.cos(ha + sk * 0.42) * hs, vy: Math.sin(ha + sk * 0.42) * hs,
                                life: 2.4, r: 2.6, rgb: ab.rgb, shard: true });
          }
          burst(ab.x, ab.y, 4, ab.rgb, 0.5);
          alienBullets.splice(q, 1);
          continue;
        }
      }
      ab.x += ab.vx * sf; ab.y += ab.vy * sf; ab.life -= dt;
      if(ab.life<=0 || ab.x<0 || ab.x>window.innerWidth || ab.y<0 || ab.y>docH){ alienBullets.splice(q,1); continue; }
      var bgd = Math.hypot(ab.x-ship.x, ab.y-ship.y);
      // A round has no id and lives two seconds, so its cooldown is a flag on
      // the round itself: one near miss, one payment, and then it is spent
      // whatever it does afterwards.
      if(!ab.grazed && bgd < SHIP_RADIUS + GRAZE_FIRE_BAND && bgd >= SHIP_RADIUS + (ab.r || 3)){
        ab.grazed = true;
        graze(ab, CORE_FIRE, ab.x, ab.y);
      }
      if(bgd < SHIP_RADIUS + (ab.r || 3)){
        if(shieldTime > 0){ alienBullets.splice(q,1); burst(ab.x, ab.y, 6, '0,194,255'); continue; }
        alienBullets.splice(q,1); hitShip('fire');
      }
    }

    // loot: drifts, gets pulled in once you're close, and expires on its timer
    var mag = magnetRange();
    for(var pi=pickups.length-1; pi>=0; pi--){
      var pk = pickups[pi];
      pk.life -= dt;
      if(pk.life <= 0){ pickups.splice(pi,1); continue; }
      pk.t += 3 * dt;
      var dx = ship.x - pk.x, dy = ship.y - pk.y, dist = Math.hypot(dx, dy) || 1;
      if(dist < mag){
        var pull = 0.55 * (1 - dist / mag) * sf;
        pk.vx += dx / dist * pull * 3;
        pk.vy += dy / dist * pull * 3;
      }
      var pdrag = Math.pow(0.965, sf);
      pk.vx *= pdrag; pk.vy *= pdrag;
      pk.x += pk.vx * sf; pk.y += pk.vy * sf;
      if(dist < PICKUP_R){ collect(pk); pickups.splice(pi,1); }
    }

    for(var j=particles.length-1;j>=0;j--){
      var p = particles[j];
      p.x += p.vx * sf; p.y += p.vy * sf;
      var pd = Math.pow(p.drag || 0.94, sf);
      p.vx *= pd; p.vy *= pd;
      if(p.vr) p.rot += p.vr * sf;
      p.life -= (p.decay || 2.4) * dt;
      if(p.life<=0) particles.splice(j,1);
    }

    for(var bi=blooms.length-1;bi>=0;bi--){
      blooms[bi].life -= dt * 7.5;
      if(blooms[bi].life <= 0) blooms.splice(bi,1);
    }
    if(trauma > 0) trauma = Math.max(0, trauma - TRAUMA_DECAY * dt);
    if(chainT > 0){
      chainT -= dt;
      if(chainT <= 0) chain = 0;
    }
  }

  // A piercing shot survives its hit and remembers what it already went
  // through, so it can never spend two frames chewing the same rock. Returns
  // true if the bullet lives on.
  function spendBullet(b, idx, targetId){
    if(b.pierce > 0){
      b.pierce--;
      (b.hits || (b.hits = [])).push(targetId);
      return true;
    }
    bullets.splice(idx, 1);
    return false;
  }

  // ── loot ─────────────────────────────────────────────────────────────────
  // Two vocabularies, deliberately, because these are two different kinds of
  // thing.
  //
  //   Dilithium is MATTER. It came out of a rock, so it is drawn as a cut
  //   crystal with a couple of chips of the same stone beside it, faceted in
  //   exactly the language the rocks are faceted in — one lit plane, one
  //   turning away, a dark outline to hold it against a bright field.
  //
  //   A power-up is a SYSTEM being offered. Those keep the ring, the four tick
  //   marks and the glyph, because the ring is the ship saying it has SCANNED
  //   the thing — the same sentence the rock reticles say — and that reads
  //   correctly for a capability and wrong for a lump of ore.
  //
  // The crystals are deliberately far quieter than the reference art they come
  // from. That sheet is one crystal at two hundred pixels; this is up to a
  // dozen of them at fourteen, drifting across a field that already carries
  // forty lit rocks, a nebula and a starfield. Everything was pulled down
  // until they read as ore lying in space rather than as lights: no bloom, a
  // glow at a fifth of the alpha, and facets in the twenties rather than the
  // eighties.
  var CRYSTALS = {
    coin: { r: 8.6, chips: 2, glow: '111,232,255',
            dark: 'rgba(16,54,92,.96)',  mid: 'rgba(72,178,224,.72)',
            lit:  'rgba(196,244,255,.92)', edge: 'rgba(190,243,255,.85)' },
    gem:  { r: 11,  chips: 3, glow: '157,123,255',
            dark: 'rgba(40,20,86,.96)',  mid: 'rgba(124,94,224,.72)',
            lit:  'rgba(224,206,255,.94)', edge: 'rgba(222,203,255,.88)' }
  };
  // one cut, used at every size: a hexagonal prism seen side on, taller than
  // it is wide, which is the silhouette that reads as "crystal" and not "gem
  // from a puzzle game"
  var CRYSTAL_PTS = [[0,-1],[0.42,-0.36],[0.34,0.62],[0,1],[-0.34,0.62],[-0.42,-0.36]];

  function crystalPath(cx, cy, r, rot){
    var c = Math.cos(rot), s = Math.sin(rot), p, i;
    ctx.beginPath();
    for(i=0;i<CRYSTAL_PTS.length;i++){
      p = CRYSTAL_PTS[i];
      var px = p[0] * r, py = p[1] * r;
      var x = cx + px * c - py * s, y = cy + px * s + py * c;
      if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // half the crystal, so one side can be lit and the other can turn away —
  // the same two-plane trick the rocks use, which is what makes a flat
  // polygon read as something with volume
  function crystalFace(cx, cy, r, rot, side){
    var c = Math.cos(rot), s = Math.sin(rot), i;
    var idx = side > 0 ? [0,1,2,3] : [0,3,4,5];
    ctx.beginPath();
    for(i=0;i<idx.length;i++){
      var p = CRYSTAL_PTS[idx[i]], px = p[0] * r, py = p[1] * r;
      var x = cx + px * c - py * s, y = cy + px * s + py * c;
      if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawCrystal(C, cx, cy, rot){
    var R = C.r, i;
    // The glow has to have a SOFT edge. It was two flat discs composited
    // additively, on the theory that a gradient per crystal per frame was
    // worth avoiding — but a flat disc under 'lighter' has a hard rim, and at
    // a dozen on screen the field filled up with grey circles that had
    // something faint inside them. A small gradient is nothing; the planet was
    // expensive because it was nine hundred pixels across, not because it was
    // a gradient.
    if(ctx.createRadialGradient){
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9);
      g.addColorStop(0,    'rgba(' + C.glow + ',.26)');
      g.addColorStop(0.45, 'rgba(' + C.glow + ',.10)');
      g.addColorStop(1,    'rgba(' + C.glow + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Chips of the same stone, hugging the main shard rather than orbiting it
    // at a distance — in the reference they are part of one cluster, and at
    // fifteen pixels anything further out than about a radius stops reading as
    // the same object.
    ctx.lineWidth = 1;
    for(i=0;i<C.chips;i++){
      var a = rot * 1.4 + i / C.chips * Math.PI * 2 + 0.7;
      var d = R * (1.05 + (i % 2) * 0.28);
      var ch = R * (0.36 + (i % 2) * 0.1);
      var chx = cx + Math.cos(a) * d, chy = cy + Math.sin(a) * d;
      ctx.fillStyle = C.dark;
      crystalPath(chx, chy, ch, a * 1.7);
      ctx.fill();
      ctx.fillStyle = C.mid;
      crystalFace(chx, chy, ch, a * 1.7, 1);
      ctx.strokeStyle = C.edge;
      crystalPath(chx, chy, ch, a * 1.7);
      ctx.stroke();
    }

    // the shard itself: dark body, one lit face, then a thin edge
    ctx.fillStyle = C.dark;
    crystalPath(cx, cy, R, rot);
    ctx.fill();
    ctx.fillStyle = C.mid;
    crystalFace(cx, cy, R, rot, -1);
    ctx.fillStyle = C.lit;
    crystalFace(cx, cy, R, rot, 1);
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 1;
    crystalPath(cx, cy, R, rot);
    ctx.stroke();
  }

  var PICKUPS = {
    heart:  { r: 12, rgb: '74,231,143',  glyph: 'cross'   },
    shield: { r: 13, rgb: '0,194,255',   glyph: 'shield'  },
    rapid:  { r: 13, rgb: '255,179,71',  glyph: 'burst'   }
  };

  function pickupGlyph(kind, R){
    var i, an, rr;
    if(kind === 'cross'){
      var a = R * 0.26, b = R * 0.62;
      ctx.beginPath();
      ctx.rect(-a, -b, a*2, b*2);
      ctx.rect(-b, -a, b*2, a*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.rect(-a*0.55, -a*0.55, a*1.1, a*1.1); ctx.fill();
    } else if(kind === 'shield'){
      ctx.beginPath();
      ctx.moveTo(0, -R*0.68);
      ctx.lineTo(R*0.5, -R*0.38);
      ctx.lineTo(R*0.5, R*0.1);
      ctx.quadraticCurveTo(R*0.44, R*0.58, 0, R*0.72);
      ctx.quadraticCurveTo(-R*0.44, R*0.58, -R*0.5, R*0.1);
      ctx.lineTo(-R*0.5, -R*0.38);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath();
      ctx.moveTo(0, -R*0.5); ctx.lineTo(R*0.3, -R*0.32);
      ctx.lineTo(0, R*0.42); ctx.closePath(); ctx.fill();
    } else {
      // eight points: long on the axes, short between, which is the shape a
      // flare makes and a plain asterisk does not
      ctx.beginPath();
      for(i=0;i<16;i++){
        an = i / 16 * Math.PI * 2;
        rr = (i % 4 === 0) ? R*0.76 : (i % 2 === 0 ? R*0.34 : R*0.15);
        if(i === 0) ctx.moveTo(Math.cos(an)*rr, Math.sin(an)*rr);
        else ctx.lineTo(Math.cos(an)*rr, Math.sin(an)*rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(0, 0, R*0.16, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawPickup(p, camY){
    // last stretch of the timer is spent blinking, so nothing vanishes unwarned
    var fading = p.life < 1.6;
    if(fading && !reduceMotion && Math.floor(p.life * 9) % 2 === 0) return;
    var y = p.y - camY + Math.sin(p.t) * 2;

    var C = CRYSTALS[p.kind];
    if(C){
      ctx.save();
      if(fading && reduceMotion) ctx.globalAlpha = 0.4;
      // it tumbles, slowly. A crystal pinned to one angle reads as a sprite
      // stuck on the glass; a quarter of the bob rate reads as a rock turning.
      drawCrystal(C, p.x, y, reduceMotion ? 0.4 : p.t * 0.22);
      ctx.restore();
      return;
    }

    var P = PICKUPS[p.kind] || PICKUPS.shield;
    var R = P.r, rgb = P.rgb;
    var pulse = reduceMotion ? 0.7 : 0.62 + 0.38 * Math.sin(gameTime * 4 + p.t);
    ctx.save();
    if(fading && reduceMotion) ctx.globalAlpha = 0.4;   // dim rather than strobe
    ctx.translate(p.x, y);
    if(ctx.createRadialGradient){
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.2);
      g.addColorStop(0, 'rgba(' + rgb + ',' + (0.3 * pulse).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, R * 2.2, 0, Math.PI*2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // a dark disc under the glyph, so a drop still reads when it drifts across
    // a lit rock
    ctx.fillStyle = 'rgba(6,3,12,.82)';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.5 + 0.4 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = 'rgba(' + rgb + ',.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(var k=0;k<4;k++){
      var a = k * Math.PI / 2;
      ctx.moveTo(Math.cos(a)*(R + 3), Math.sin(a)*(R + 3));
      ctx.lineTo(Math.cos(a)*(R + 6.5), Math.sin(a)*(R + 6.5));
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(' + rgb + ',.95)';
    pickupGlyph(P.glyph, R);
    ctx.restore();
  }

  // ── exhaust and cores ────────────────────────────────────────────────────
  // Two pieces of vocabulary every hull in the game now shares, and between
  // them they are most of what separates a ship from an outline: a plume, and
  // a lit core.
  //
  // The plume is drawn in the hull's own rotated space, running back along its
  // axis from a throat — bright and narrow where it leaves the engine, bulging
  // once, then gone. A triangle does not do this; the bulge is the whole tell
  // that it is burning rather than pointing. Length is the caller's business,
  // because on the player it rides the throttle and that is the readout.
  function plumeTrail(x, y, len, w, rgb, alpha){
    if(!ctx.createLinearGradient || len < 2) return;
    var g = ctx.createLinearGradient(x, y, x - len, y);
    g.addColorStop(0,    'rgba(' + rgb + ',' + alpha + ')');
    g.addColorStop(0.28, 'rgba(' + rgb + ',' + (alpha * 0.5).toFixed(3) + ')');
    g.addColorStop(1,    'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - w);
    ctx.lineTo(x - len * 0.22, y - w * 1.45);
    ctx.lineTo(x - len, y);
    ctx.lineTo(x - len * 0.22, y + w * 1.45);
    ctx.lineTo(x, y + w);
    ctx.closePath();
    ctx.fill();
  }

  // The core. A white diamond lying along the hull's axis inside a soft bloom
  // of the ship's own colour — the one warm spot on a vector outline, and the
  // thing that makes a 15px silhouette read as powered rather than as a
  // sticker. It is additive, so two of them overlapping burn out to white
  // rather than averaging to mud.
  function hullCore(x, size, rgb, lit){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // a soft halo: a flat disc under 'lighter' shows a hard rim, and on the
    // painted hulls it read as a bubble sitting on the plating
    if(ctx.createRadialGradient){
      var hg = ctx.createRadialGradient(x, 0, 0, x, 0, size * 1.9);
      hg.addColorStop(0, 'rgba(' + rgb + ',' + (0.3 * lit).toFixed(3) + ')');
      hg.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(x, 0, size * 1.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(' + rgb + ',' + (0.75 * lit).toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(x + size, 0); ctx.lineTo(x, -size * 0.52);
    ctx.lineTo(x - size, 0); ctx.lineTo(x, size * 0.52);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * lit).toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(x + size * 0.5, 0); ctx.lineTo(x, -size * 0.26);
    ctx.lineTo(x - size * 0.5, 0); ctx.lineTo(x, size * 0.26);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // One cone of exhaust, in the ship's own rotated space.
  function plume(x, y, len, w, col){
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - w);
    ctx.lineTo(x - len, y);
    ctx.lineTo(x, y + w);
    ctx.closePath();
    ctx.fill();
  }

  // ── the warbirds ─────────────────────────────────────────────────────────
  // Three hulls, three silhouettes, not three tints: at speed, in a field of
  // forty rocks, shape is the only thing that reads. All three share one
  // grammar — a central fuselage with a lit core, wings hung off it, exhaust
  // behind — and differ only in how the wings are set, because that is the
  // one difference a player can read at fifteen pixels and at a glance.
  //
  //   scout   · wings swept back. Cruise. Strafes past.
  //   lancer  · wings broad with outboard gun pods. A platform.
  //   stalker · wings raked FORWARD. Attack. This is the one that chases, and
  //             the rake is the tell a second before it arrives.
  //
  // `part` matters. Filling and stroking every subpath in one pass put a lit
  // outline down the seam where a wing meets the fuselage, and the ships came
  // out as four detached plates floating in formation. Wings are drawn and lit
  // FIRST, then the fuselage is drawn over their roots — so the joins end up
  // underneath the body, which is where joins go.
  // `only` (1 or -1) draws just that side's wing — the detail pass uses it
  // to light the one wing that faces the light
  function alienShape(al, AT, part, fill, only){
    var R = al.r, s;
    if(part === 'wings'){
      if(al.kind === 'drone') return;              // a cube has no wings
      if(al.kind === 'lancer'){
        // broad planes carrying the pods it fires its fans from
        for(s=-1; s<=1; s+=2){
          if(only && s !== only) continue;
          ctx.beginPath();
          ctx.moveTo(R*0.26, s*R*0.22);
          ctx.lineTo(-R*0.12, s*R*0.92);
          ctx.lineTo(-R*0.72, s*R*0.94);
          ctx.lineTo(-R*0.62, s*R*0.24);
          ctx.closePath();
          if(fill) ctx.fill(); else ctx.stroke();
          // the outboard pod it fires its fans from
          ctx.beginPath();
          ctx.moveTo(-R*0.14, s*R*0.88);
          ctx.lineTo(-R*0.22, s*R*1.14);
          ctx.lineTo(-R*0.64, s*R*1.14);
          ctx.lineTo(-R*0.60, s*R*0.90);
          ctx.closePath();
          if(fill) ctx.fill(); else ctx.stroke();
        }
      } else if(al.kind === 'stalker'){
        // raked forward, into the attack position
        for(s=-1; s<=1; s+=2){
          if(only && s !== only) continue;
          ctx.beginPath();
          ctx.moveTo(R*0.16, s*R*0.18);
          ctx.lineTo(R*0.50, s*R*0.80);
          ctx.lineTo(R*0.20, s*R*1.02);
          ctx.lineTo(-R*0.56, s*R*0.22);
          ctx.closePath();
          if(fill) ctx.fill(); else ctx.stroke();
        }
      } else if(al.kind === 'raptor'){
        // K'Tinga: hard-swept, long and narrow. It is built to go in a
        // straight line very fast, and the wings say so.
        for(s=-1; s<=1; s+=2){
          if(only && s !== only) continue;
          ctx.beginPath();
          ctx.moveTo(R*0.22, s*R*0.15);
          ctx.lineTo(-R*0.34, s*R*0.80);
          ctx.lineTo(-R*0.98, s*R*0.62);
          ctx.lineTo(-R*0.64, s*R*0.15);
          ctx.closePath();
          if(fill) ctx.fill(); else ctx.stroke();
        }
      } else if(al.kind === 'warbird'){
        // Romulan: the big curved bird wing, sweeping out and forward. The
        // widest silhouette on the field, which is the whole point of a hull
        // that never comes close enough for you to get a better look.
        for(s=-1; s<=1; s+=2){
          if(only && s !== only) continue;
          ctx.beginPath();
          ctx.moveTo(R*0.24, s*R*0.18);
          ctx.quadraticCurveTo(R*0.36, s*R*0.74, -R*0.08, s*R*1.14);
          ctx.lineTo(-R*0.52, s*R*1.00);
          ctx.quadraticCurveTo(-R*0.30, s*R*0.58, -R*0.62, s*R*0.20);
          ctx.closePath();
          if(fill) ctx.fill(); else ctx.stroke();
        }
      } else if(al.kind === 'weaver'){
        // Tholian: not wings, spines. A crystal with four barbs.
        for(s=-1; s<=1; s+=2){
          if(only && s !== only) continue;
          ctx.beginPath();
          ctx.moveTo(R*0.10, s*R*0.10);
          ctx.lineTo(R*0.62, s*R*0.96);
          ctx.lineTo(R*0.02, s*R*0.26);
          ctx.closePath();
          if(fill) ctx.fill(); else ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-R*0.12, s*R*0.10);
          ctx.lineTo(-R*0.78, s*R*0.88);
          ctx.lineTo(-R*0.20, s*R*0.26);
          ctx.closePath();
          if(fill) ctx.fill(); else ctx.stroke();
        }
      } else {
        // swept back, level, cruising
        for(s=-1; s<=1; s+=2){
          if(only && s !== only) continue;
          ctx.beginPath();
          ctx.moveTo(R*0.14, s*R*0.15);
          ctx.lineTo(-R*0.30, s*R*0.74);
          ctx.lineTo(-R*0.88, s*R*0.66);
          ctx.lineTo(-R*0.60, s*R*0.17);
          ctx.closePath();
          if(fill) ctx.fill(); else ctx.stroke();
        }
      }
      return;
    }

    // The Borg cube is the one hull with no fuselage, no bow and no taper. It
    // is a box, and being a box among a screenful of swept wings is the whole
    // of its readability — nobody has to be told which one is the Borg.
    if(al.kind === 'drone'){
      var q = R * 0.74;
      ctx.beginPath(); ctx.rect(-q, -q, q*2, q*2);
      if(fill) ctx.fill(); else ctx.stroke();
      if(!fill){
        ctx.beginPath(); ctx.rect(-q*0.55, -q*0.55, q*1.1, q*1.1); ctx.stroke();
      }
      return;
    }

    // the fuselage, drawn over the wing roots
    var nose = al.kind === 'lancer' ? 1.02 : (al.kind === 'weaver' ? 1.2 : 1.12);
    var beam = al.kind === 'lancer' ? 0.24
             : (al.kind === 'weaver' ? 0.14
             : (al.kind === 'warbird' ? 0.22 : (al.kind === 'stalker' ? 0.19 : 0.17)));
    ctx.beginPath();
    ctx.moveTo(R*nose, 0);
    ctx.lineTo(R*0.30, -R*beam);
    ctx.lineTo(-R*0.52, -R*(beam * 1.25));
    ctx.lineTo(-R*0.70, 0);
    ctx.lineTo(-R*0.52,  R*(beam * 1.25));
    ctx.lineTo(R*0.30,  R*beam);
    ctx.closePath();
    if(fill) ctx.fill(); else ctx.stroke();
  }

  // ── painted hulls ────────────────────────────────────────────────────────
  // Since Sep 2026 every ship is PAINTED, not outlined. The old hulls were a
  // neon stroke round a dark fill, and next to James's reference sheet —
  // weathered metal, plating, glass, lit windows, engine glow — they read as
  // badges. A canvas cannot afford that much work per ship per frame, so the
  // work is done once: each hull is painted at full detail into its own
  // offscreen canvas the first time it is needed, and every frame after that
  // is a single rotated drawImage. That is cheaper than the old outlines,
  // which paid for a shadowBlur on every stroke of every ship every frame.
  //
  // What stays live, because it moves: exhaust plumes, wingtip strobes, the
  // hit flash (a white copy of the silhouette, faded), cloaking (alpha),
  // shields, beams, webs, the reactor core that swells on a Klingon charge.
  //
  // The painting has one grammar for every faction: a soft shadow cast on the
  // field below, metal lit from above (the same side the rock facets are lit
  // from), plating in lighter and darker panels, the body's shadow where it
  // meets the wings, bevelled seams, glass and windows, glowing engines, and a
  // thin rim in the faction's colour so every hull still reads against space.
  // Only the materials change: Klingon rust-bronze, Cardassian ochre, Romulan
  // jade, Borg gunmetal with green circuitry, Tholian amber crystal, and the
  // player's Federation grey with a cyan rim — cyan is still the player.
  var HULL_PAINT = {
    klingon:    { hi:'#b08472', mid:'#5a352c', lo:'#170b09', rim:'255,122,99',  glow:'255,120,80',  win:'255,196,150' },
    cardassian: { hi:'#dcbc8a', mid:'#7a5c34', lo:'#241a0c', rim:'240,168,72',  glow:'255,176,80',  win:'255,224,168' },
    romulan:    { hi:'#98c9aa', mid:'#325c48', lo:'#0a1913', rim:'127,214,166', glow:'96,224,150',  win:'205,255,225' },
    borg:       { hi:'#858d8f', mid:'#343a3b', lo:'#0a0d0d', rim:'143,180,201', glow:'126,255,110', win:'126,255,110' },
    tholian:    { hi:'rgba(255,226,170,.95)', mid:'rgba(255,150,70,.62)', lo:'rgba(110,44,140,.55)',
                  rim:'255,159,67', glow:'255,178,90', win:'255,236,200' },
    federation: { hi:'#f2f6fa', mid:'#98a4b3', lo:'#29323d', rim:'0,240,255',   glow:'90,170,255',  win:'255,236,204' }
  };
  var KIND_FAC = { scout:'klingon', raptor:'klingon', stalker:'klingon', lancer:'cardassian',
                   warbird:'romulan', drone:'borg', weaver:'tholian' };
  var RAGE_RIM = '255,77,109';
  // Hulls are drawn this much larger than their collision radius. The old
  // neon outlines carried a wide glow that made every ship read bigger than
  // it was; the painted hulls lost it and looked shrunken ("ships feel
  // smaller"). The hitboxes do not change, only the drawing.
  var HULL_VIS = 1.15;

  // Sprites are cut for the current canvas resolution and dropped whenever it
  // changes. They are painted at exactly that resolution (HULL_SS 1): a finer
  // bake put detail below a pixel, and sub-pixel detail on a rotating sprite
  // does not look detailed, it shimmers — which is what "jittery" was.
  var HULL_SS = 1, spriteCache = {}, spriteDpr = 0, bakeScale = 1;

  function prng(seed){
    var s = (seed * 9301 + 49297) % 233280;
    return function(){ s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  function strSeed(str){
    var h = 7;
    for(var i=0;i<str.length;i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
    return h;
  }

  function bakeSprite(extent, paint){
    var c = document.createElement('canvas');
    if(!c || !c.getContext) return null;
    var d = viewDpr * HULL_SS, size = Math.ceil(extent * 2);
    c.width = Math.max(1, Math.ceil(size * d)); c.height = c.width;
    var g = c.getContext('2d');
    if(!g || !g.setTransform) return null;
    g.setTransform(d, 0, 0, d, c.width / 2, c.height / 2);
    // the painters reuse alienShape and friends, which draw on `ctx`
    var saved = ctx, savedScale = bakeScale;
    ctx = g; bakeScale = d;
    try { paint(g); } finally { ctx = saved; bakeScale = savedScale; }
    return { cv: c, half: size / 2, size: size };
  }
  function hullSprite(key, extent, paint){
    if(spriteDpr !== viewDpr){ spriteCache = {}; spriteDpr = viewDpr; }
    if(!(key in spriteCache)) spriteCache[key] = bakeSprite(extent, paint);
    return spriteCache[key];
  }
  function blit(spr, alpha){
    if(!spr) return false;
    if(alpha !== undefined){
      if(alpha <= 0) return true;
      var a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * alpha;
      ctx.drawImage(spr.cv, -spr.half, -spr.half, spr.size, spr.size);
      ctx.globalAlpha = a0;
    } else ctx.drawImage(spr.cv, -spr.half, -spr.half, spr.size, spr.size);
    return true;
  }

  // alienShape builds each part as its own path and fills it straight away.
  // Painting needs the whole silhouette as ONE path — to clip to, to cast a
  // shadow from, to rim — so it is replayed through a context that ignores
  // beginPath, fill and stroke and just keeps adding to the current path.
  var PATH_ONLY = { beginPath: 1, fill: 1, stroke: 1 };
  function pathOnly(g){
    if(typeof Proxy === 'undefined') return g;
    return new Proxy(g, {
      get: function(t, k){
        if(PATH_ONLY[k]) return function(){};
        var v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
      set: function(t, k, v){ t[k] = v; return true; }
    });
  }
  function silhouette(g, kind, R, part){
    g.beginPath();
    var saved = ctx;
    ctx = pathOnly(g);
    try {
      if(part !== 'body') alienShape({ kind: kind, r: R }, null, 'wings', true);
      if(part !== 'wings') alienShape({ kind: kind, r: R }, null, 'body', true);
    } finally { ctx = saved; }
  }

  // ── painting kit ──
  function metalGrad(g, R, P){
    var gr = g.createLinearGradient(-R * 0.35, -R * 1.15, R * 0.35, R * 1.15);
    gr.addColorStop(0, P.hi); gr.addColorStop(0.46, P.mid); gr.addColorStop(1, P.lo);
    return gr;
  }
  // panels of slightly lighter and darker plate inside whatever is clipped
  function plating(g, R, rand, n, spread, alpha){
    alpha = alpha || 1;
    for(var i=0;i<n;i++){
      var w = R * (0.06 + rand() * 0.2), h = R * (0.04 + rand() * 0.12);
      var x = (rand() * 2 - 1) * R * spread, y = (rand() * 2 - 1) * R * spread;
      g.fillStyle = rand() < 0.45
        ? 'rgba(255,255,255,' + ((0.03 + rand() * 0.08) * alpha).toFixed(3) + ')'
        : 'rgba(0,0,0,' + ((0.06 + rand() * 0.16) * alpha).toFixed(3) + ')';
      g.fillRect(x, y, w, h);
    }
  }
  // Brushed metal: fine hairlines along the hull's length, and a regular
  // grid of bevelled panel joints — the structure the random plating sits in.
  function brushed(g, R, rand, spread){
    g.lineWidth = Math.max(0.3, R * 0.006);
    for(var i=0;i<Math.round(60 * spread);i++){
      var y = (rand() * 2 - 1) * R * spread, x = (rand() * 2 - 1) * R * spread, L = R * (0.2 + rand() * 0.8);
      g.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.09)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y); g.stroke();
    }
  }
  function panelGrid(g, R, step, w, spread){
    for(var x = -R * spread; x < R * spread; x += R * step) bevel(g, x, -R * spread, x - R * step * 0.5, R * spread, w);
    for(var y = -R * spread; y < R * spread; y += R * step * 1.3) bevel(g, -R * spread, y, R * spread, y, w * 0.8);
  }
  // the top-lit sheen: brighter toward the light, over whatever is clipped
  function sheen(g, R, a){
    var gr = g.createLinearGradient(0, -R * 1.2, 0, R * 0.25);
    gr.addColorStop(0, 'rgba(255,255,255,' + (a || 0.2) + ')');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(-R * 1.6, -R * 1.6, R * 3.2, R * 1.9);
  }
  // a seam: a dark groove with a lit lip on the side facing the light
  function bevel(g, x1, y1, x2, y2, w){
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = w;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = w * 0.55;
    g.beginPath(); g.moveTo(x1, y1 - w * 0.8); g.lineTo(x2, y2 - w * 0.8); g.stroke();
  }
  function glowDot(g, x, y, r, rgb, a){
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,' + a + ')');
    gr.addColorStop(0.3, 'rgba(' + rgb + ',' + a + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  function castShadow(g, R, pathFn, fill){
    g.save();
    g.shadowColor = 'rgba(0,0,0,.7)';
    g.shadowBlur = R * 0.3 * bakeScale;
    g.shadowOffsetX = R * 0.08 * bakeScale; g.shadowOffsetY = R * 0.14 * bakeScale;
    pathFn(); g.fillStyle = fill; g.fill();
    g.restore();
  }
  // A thin edge of the faction's colour with a little glow — enough to find
  // the hull against space, never enough to become the thing you see. The
  // first painted pass had it at full neon strength and the metal disappeared
  // behind it.
  function rimGlow(g, R, pathFn, rgb, a){
    g.save();
    // Back to a real neon outline (Sep 2026: "harder to see", "smaller"): the
    // thin rim on dark metal lost the hull against space. Baked, so the glow
    // costs nothing per frame.
    g.shadowColor = 'rgba(' + rgb + ',.95)';
    g.shadowBlur = Math.min(16, Math.max(7, R * 0.4)) * bakeScale;
    g.strokeStyle = 'rgba(' + rgb + ',' + Math.min(1, a * 1.2).toFixed(3) + ')';
    // drawn UNDER the hull and twice as wide: the painting then covers the
    // inner half, so only a clean outer edge shows and no internal seam — a
    // wing root, a nacelle on a hull — gets traced in neon
    // two pixels wide under the hull (one shows), the rest is glow: a halo
    // round the hull, as in the reference, rather than a drawn outline
    g.lineWidth = Math.min(3.2, Math.max(2.2, R * 0.07));
    g.lineJoin = 'round';
    pathFn(); g.stroke();
    g.restore();
  }
  function tint(g, rgb, a){
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(' + rgb + ',' + a + ')';
    g.fillRect(-1e4, -1e4, 2e4, 2e4);
    g.restore();
  }
  // ── volume ──
  // What made the reference ships read as models rather than cut-outs: every
  // plate is lit along the edge facing the light and falls into shadow along
  // the edge turned away from it. This is the classic inner bevel — fill the
  // world OUTSIDE the part, clipped to the part, so only the fill's offset
  // shadow lands inside, hugging the edges. White offset down from the top
  // edge, black offset up from the bottom. It is soft and low-frequency on
  // purpose: blurred light does not shimmer when the hull turns, which is
  // the lesson the last painted pass taught.
  function emboss(g, R, pathFn, hi, lo){
    var big = R * 5;
    g.save();
    pathFn(); g.clip();
    g.fillStyle = '#000';
    g.shadowColor = 'rgba(255,255,255,' + hi + ')';
    g.shadowBlur = R * 0.16 * bakeScale;
    g.shadowOffsetX = R * 0.03 * bakeScale; g.shadowOffsetY = R * 0.08 * bakeScale;
    pathFn(); g.rect(-big, -big, big * 2, big * 2); g.fill('evenodd');
    g.shadowColor = 'rgba(0,0,0,' + lo + ')';
    g.shadowBlur = R * 0.24 * bakeScale;
    g.shadowOffsetX = -R * 0.04 * bakeScale; g.shadowOffsetY = -R * 0.12 * bakeScale;
    pathFn(); g.rect(-big, -big, big * 2, big * 2); g.fill('evenodd');
    g.restore();
  }
  // a soft bright ridge along a line — the spine of a hull catching the light
  function ridge(g, x0, x1, y, w, a){
    var rg = g.createLinearGradient(0, y - w, 0, y + w);
    rg.addColorStop(0, 'rgba(255,255,255,0)');
    rg.addColorStop(0.5, 'rgba(255,255,255,' + a + ')');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath(); g.ellipse((x0 + x1) / 2, y, Math.abs(x1 - x0) / 2, w, 0, 0, Math.PI * 2); g.fill();
  }

  function canopy(g, x, y, rx, ry, rim){
    g.fillStyle = 'rgba(5,12,24,.92)';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(' + rim + ',.6)'; g.lineWidth = Math.max(0.4, ry * 0.25); g.stroke();
    g.fillStyle = 'rgba(225,245,255,.85)';
    g.beginPath(); g.ellipse(x + rx * 0.15, y - ry * 0.35, rx * 0.35, ry * 0.3, 0, 0, Math.PI * 2); g.fill();
  }

  // ── winged hulls: every escort, and the Cardassian and Romulan flagships ──
  function paintWinged(g, kind, R, cap, rim){
    var P = HULL_PAINT[KIND_FAC[kind]], D = HULL_DETAIL[kind] || {};
    var rand = prng(strSeed(kind) + (cap ? 17 : 0)), s, i;
    var beam = D.beam || 0.18, nose = D.nose || 1.1;
    var sw = Math.max(cap ? 0.45 : 0.7, R * (cap ? 0.016 : 0.045));
    castShadow(g, R, function(){ silhouette(g, kind, R, 'all'); }, P.lo);
    rimGlow(g, R, function(){ silhouette(g, kind, R, 'all'); }, rim || P.rim, cap ? 0.7 : 0.85);

    // wings
    silhouette(g, kind, R, 'wings');
    g.fillStyle = metalGrad(g, R, P); g.fill();
    g.save();
    silhouette(g, kind, R, 'wings'); g.clip();
    // Hairline brushing and fine plating only at capital scale. On a 30px
    // escort they sit below a pixel and crawl as the hull turns.
    if(cap) brushed(g, R, rand, 1.25);
    plating(g, R, rand, cap ? 130 : 14, 1.2);
    panelGrid(g, R, cap ? 0.16 : 0.45, Math.max(0.6, R * (cap ? 0.011 : 0.035)), 1.3);
    // the lower half of each plane turns away from the light
    var dk = g.createLinearGradient(0, -R * 0.2, 0, R * 1.2);
    dk.addColorStop(0, 'rgba(0,0,0,0)'); dk.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = dk; g.fillRect(-R * 1.6, -R * 0.2, R * 3.2, R * 1.6);
    // the body throws a shadow across the wing roots
    silhouette(g, kind, R, 'body');
    g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = R * 0.16 * bakeScale;
    g.lineWidth = R * 0.05; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke();
    g.shadowBlur = 0;
    sheen(g, R, 0.18);
    g.restore();
    emboss(g, R, function(){ silhouette(g, kind, R, 'wings'); }, 0.6, 0.85);
    if(D.crystal) crystalFacets(g, R, D);

    // body
    silhouette(g, kind, R, 'body');
    var bg = g.createLinearGradient(0, -R * beam * 1.3, 0, R * beam * 1.3);
    bg.addColorStop(0, P.hi); bg.addColorStop(0.32, P.hi); bg.addColorStop(0.58, P.mid); bg.addColorStop(1, P.lo);
    g.fillStyle = bg; g.fill();
    g.save();
    silhouette(g, kind, R, 'body'); g.clip();
    if(cap) brushed(g, R, rand, 1.0);
    plating(g, R, rand, cap ? 60 : 6, 1.0);
    // a hard specular along the upper flank, and the lower flank in shadow
    g.fillStyle = 'rgba(255,255,255,.38)';
    g.fillRect(-R * 0.62, -R * beam * 0.55, R * (nose + 0.5), R * beam * 0.14);
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.fillRect(-R * 0.8, R * beam * 0.45, R * (nose + 0.8), R * beam * 0.8);
    for(i=0;i<(cap ? 14 : 3);i++){
      var gx = R * (0.55 - i * (cap ? 0.085 : 0.22)), gw = R * (0.04 + rand() * 0.05);
      g.fillStyle = 'rgba(0,0,0,.34)'; g.fillRect(gx, -R * beam * 0.26, gw, R * beam * 0.52);
      g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(gx, -R * beam * 0.26, gw, R * beam * 0.09);
    }
    g.restore();
    emboss(g, R, function(){ silhouette(g, kind, R, 'body'); }, 0.7, 0.9);
    ridge(g, -R * 0.6, R * (nose - 0.1), -R * beam * 0.28, R * beam * 0.22, 0.5);

    // seams and the faction's pattern, bevelled
    for(s=-1; s<=1; s+=2){
      if(D.seam) bevel(g, R * D.seam[0][0], s * R * D.seam[0][1], R * D.seam[1][0], s * R * D.seam[1][1], sw);
      if(D.feathers) for(i=0;i<D.feathers.length;i++){
        var f = D.feathers[i];
        bevel(g, R * f[0][0], s * R * f[0][1], R * f[1][0], s * R * f[1][1], sw);
        if(cap) for(var fo=-1; fo<=1; fo+=2){
          bevel(g, R * (f[0][0] + fo * 0.09), s * R * (f[0][1] + 0.12), R * (f[1][0] + fo * 0.06), s * R * (f[1][1] - 0.14), sw * 0.8);
        }
      }
    }
    if(D.ribs) for(i=0;i<(cap ? 5 : 3);i++){
      var rx = R * (0.62 - i * (cap ? 0.24 : 0.36));
      bevel(g, rx - R * 0.1, -R * beam * 0.95, rx + R * 0.06, 0, sw);
      bevel(g, rx + R * 0.06, 0, rx - R * 0.1, R * beam * 0.95, sw);
    }
    var cross = cap ? [0.46, 0.18, -0.1, -0.36] : [0.2, -0.26];
    for(i=0;i<cross.length;i++) bevel(g, R * cross[i], -R * beam * 0.95, R * cross[i], R * beam * 0.95, sw * 0.8);

    // glass
    canopy(g, R * (nose - 0.42), 0, R * (cap ? 0.09 : 0.12), R * beam * 0.38, P.rim);

    // light: windows, engines, weapon points
    g.save();
    g.globalCompositeOperation = 'lighter';
    var ww = Math.max(0.9, R * (cap ? 0.026 : 0.07));
    g.fillStyle = 'rgba(' + P.win + ',.9)';
    for(s=-1; s<=1; s+=2){
      for(var wx = 0.6; wx > -0.46; wx -= (cap ? 0.085 : 0.42)){
        if((Math.round(wx * 100) + s * 7) % 5 === 0) continue;
        g.fillRect(R * wx - ww / 2, s * R * beam * 0.66 - ww / 2, ww, ww);
      }
    }
    for(s=-1; s<=1; s+=2){
      glowDot(g, -R * 0.68, s * R * beam * 0.55, R * (cap ? 0.12 : 0.17), P.glow, 0.95);
      if(D.gun) glowDot(g, R * D.gun[0], s * R * D.gun[1], R * (cap ? 0.06 : 0.1), P.glow, 0.9);
    }
    if(D.crystal){
      // Tholian: the crystal lights up from inside along every facet
      g.strokeStyle = 'rgba(' + P.glow + ',.55)'; g.lineWidth = Math.max(0.6, R * 0.04);
      g.beginPath();
      for(s=-1; s<=1; s+=2){
        g.moveTo(0, 0); g.lineTo(R * D.tip[0] * 0.9, s * R * D.tip[1] * 0.9);
        g.moveTo(0, 0); g.lineTo(R * D.tip2[0] * 0.9, s * R * D.tip2[1] * 0.9);
      }
      g.stroke();
      glowDot(g, 0, 0, R * 0.35, P.glow, 0.7);
    }
    g.restore();
  }

  // Tholian: every spike is a crystal with a lit face and a dark face, split
  // along its length, so the ship reads as cut glass rather than as a star
  function crystalFacets(g, R, D){
    var tips = [D.tip, D.tip2], s, i;
    for(s=-1; s<=1; s+=2) for(i=0;i<tips.length;i++){
      var t = tips[i];
      if(!t) continue;
      var tx = R * t[0], ty = s * R * t[1], bx = R * (t[0] > 0 ? 0.1 : -0.12), by = s * R * 0.1;
      var mx = (bx + tx) / 2, my = (by + ty) / 2;
      g.fillStyle = 'rgba(255,245,225,.28)';
      g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.lineTo(mx - s * R * 0.05, my + R * 0.04); g.closePath(); g.fill();
      g.fillStyle = 'rgba(40,10,60,.3)';
      g.beginPath(); g.moveTo(bx, by + s * R * 0.14); g.lineTo(tx, ty); g.lineTo(mx - s * R * 0.05, my + R * 0.04); g.closePath(); g.fill();
    }
  }

  // ── the Borg: a cube you can see is a cube ──
  // Seen from a little above and in front: the top face, and the two faces
  // turned toward the viewer, each crammed with machinery and threaded with
  // green light, and a green core burning out of the top. A cube has no bow,
  // so this sprite is never rotated (see drawCapital and alienFacing) and
  // the perspective always holds.
  function cubeCorners(R){
    var s = R * 0.54, d = R * 0.5;
    return { tl:[-s - d / 2, -s - d / 2], tr:[s - d / 2, -s - d / 2], br:[s - d / 2, s - d / 2], bl:[-s - d / 2, s - d / 2],
             BR:[s + d / 2, s + d / 2], TR:[s + d / 2, -s + d / 2], BL:[-s + d / 2, s + d / 2] };
  }
  function cubePath(g, R, face){
    var c = cubeCorners(R);
    g.beginPath();
    function poly(pts){ g.moveTo(pts[0][0], pts[0][1]); for(var i=1;i<pts.length;i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
    if(face === 'top') poly([c.tl, c.tr, c.br, c.bl]);
    else if(face === 'east') poly([c.tr, c.TR, c.BR, c.br]);
    else if(face === 'south') poly([c.bl, c.br, c.BR, c.BL]);
    else poly([c.tl, c.tr, c.TR, c.BR, c.BL, c.bl]);
  }
  function paintCube(g, R, cap, adapted, rim){
    var P = HULL_PAINT.borg, rand = prng(cap ? 991 : 313), i, f;
    var crgb = adapted ? '255,255,255' : P.glow, c = cubeCorners(R);
    castShadow(g, R, function(){ cubePath(g, R, 'all'); }, P.lo);
    rimGlow(g, R, function(){ cubePath(g, R, 'all'); }, rim || '126,255,110', 0.45);
    var faces = [['south', 0.6], ['east', 0.78], ['top', 1]];
    for(f=0; f<faces.length; f++){
      var face = faces[f][0], lit = faces[f][1];
      cubePath(g, R, face);
      var fg = g.createLinearGradient(-R, -R, R, R);
      fg.addColorStop(0, face === 'top' ? P.hi : P.mid); fg.addColorStop(1, P.lo);
      g.fillStyle = fg; g.fill();
      g.save();
      cubePath(g, R, face); g.clip();
      // machinery: blocks of plate, a few big, most small — fewer on a drone
      for(i=0;i<(cap ? 190 : 34);i++){
        var w = R * ((cap ? 0.03 : 0.07) + rand() * 0.13), h = R * ((cap ? 0.03 : 0.07) + rand() * 0.13);
        var x = -R + rand() * R * 2, y = -R + rand() * R * 2;
        g.fillStyle = rand() < 0.55 ? 'rgba(0,0,0,' + (0.25 + rand() * 0.35).toFixed(3) + ')'
                                    : 'rgba(210,220,215,' + ((0.06 + rand() * 0.12) * lit).toFixed(3) + ')';
        g.fillRect(x, y, w, h);
      }
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = Math.max(0.6, R * 0.025);
      g.beginPath();
      for(i=0;i<(cap ? 9 : 4);i++){ var a = -R + rand() * R * 2; if(rand() < 0.5){ g.moveTo(-R, a); g.lineTo(R, a); } else { g.moveTo(a, -R); g.lineTo(a, R); } }
      g.stroke();
      // green light threaded through the machinery
      g.globalCompositeOperation = 'lighter';
      for(i=0;i<(cap ? 18 : 6);i++){
        var hz = rand() < 0.5, x0 = -R + rand() * R * 2, y0 = -R + rand() * R * 2, L = R * (0.15 + rand() * 0.45);
        g.strokeStyle = 'rgba(' + crgb + ',' + ((0.3 + rand() * 0.4) * (0.5 + lit / 2)).toFixed(3) + ')';
        g.lineWidth = Math.max(0.7, R * 0.028);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(hz ? x0 + L : x0, hz ? y0 : y0 + L); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      // the face turned from the light is darker overall
      if(lit < 1){ g.fillStyle = 'rgba(0,0,0,' + (0.62 - lit * 0.6).toFixed(3) + ')'; g.fillRect(-R * 2, -R * 2, R * 4, R * 4); }
      g.restore();
    }
    // the core burning out of the top face, and the lit nodes round it
    var tc = [(c.tl[0] + c.br[0]) / 2, (c.tl[1] + c.br[1]) / 2], q = R * 0.6;
    g.save();
    g.globalCompositeOperation = 'lighter';
    glowDot(g, tc[0], tc[1], R * 0.42, crgb, adapted ? 0.8 : 0.6);
    for(var gx=-1; gx<=1; gx++) for(var gy=-1; gy<=1; gy++){
      if(!gx && !gy) continue;
      glowDot(g, tc[0] + gx * q * 0.55, tc[1] + gy * q * 0.55, R * 0.09, crgb, 0.9);
    }
    g.restore();
    // hard edges: the lit rims of the top face, and the corner seams
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = Math.max(0.8, R * 0.035);
    g.beginPath(); g.moveTo(c.bl[0], c.bl[1]); g.lineTo(c.tl[0], c.tl[1]); g.lineTo(c.tr[0], c.tr[1]); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = Math.max(0.8, R * 0.03);
    g.beginPath(); g.moveTo(c.tr[0], c.tr[1]); g.lineTo(c.br[0], c.br[1]); g.lineTo(c.bl[0], c.bl[1]);
    g.moveTo(c.br[0], c.br[1]); g.lineTo(c.BR[0], c.BR[1]); g.stroke();
  }

  // ── the Klingon flagship's own hull: keel, raked wings, pylons ──
  function klingonCapPath(g, R, part){
    var s;
    g.beginPath();
    if(part !== 'wings'){
      g.moveTo(R, 0); g.lineTo(R*0.42, -R*0.17); g.lineTo(-R*0.52, -R*0.22); g.lineTo(-R*0.78, -R*0.10);
      g.lineTo(-R*0.78, R*0.10); g.lineTo(-R*0.52, R*0.22); g.lineTo(R*0.42, R*0.17); g.closePath();
    }
    if(part !== 'keel') for(s=-1; s<=1; s+=2){
      g.moveTo(R*0.30, s*R*0.20);
      g.quadraticCurveTo(-R*0.10, s*R*0.66, -R*0.62, s*R*0.92);
      g.lineTo(-R*1.02, s*R*0.86);
      g.quadraticCurveTo(-R*0.66, s*R*0.60, -R*0.46, s*R*0.24);
      g.closePath();
      g.moveTo(-R*0.10, s*R*0.21); g.lineTo(-R*0.16, s*R*0.52); g.lineTo(-R*0.54, s*R*0.48); g.lineTo(-R*0.50, s*R*0.20);
      g.closePath();
    }
  }
  function paintKlingonCap(g, R, rim){
    var P = HULL_PAINT.klingon, rand = prng(4711), s, i, x;
    var sw = Math.max(0.5, R * 0.016);
    castShadow(g, R, function(){ klingonCapPath(g, R, 'all'); }, P.lo);
    rimGlow(g, R, function(){ klingonCapPath(g, R, 'all'); }, rim || P.rim, 0.7);
    klingonCapPath(g, R, 'wings'); g.fillStyle = metalGrad(g, R, P); g.fill();
    g.save();
    klingonCapPath(g, R, 'wings'); g.clip();
    brushed(g, R, rand, 1.2);
    plating(g, R, rand, 150, 1.2);
    panelGrid(g, R, 0.16, Math.max(0.35, R * 0.011), 1.2);
    var kd = g.createLinearGradient(0, -R * 0.2, 0, R * 1.1);
    kd.addColorStop(0, 'rgba(0,0,0,0)'); kd.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = kd; g.fillRect(-R * 1.4, -R * 0.2, R * 2.8, R * 1.4);
    g.strokeStyle = 'rgba(0,0,0,.26)'; g.lineWidth = Math.max(0.5, R * 0.011);
    g.beginPath();
    for(x = 0.4; x > -1.1; x -= 0.1){ g.moveTo(R * x, -R * 1.2); g.lineTo(R * (x - 0.12), R * 1.2); }
    g.stroke();
    klingonCapPath(g, R, 'keel');
    g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = R * 0.16 * bakeScale;
    g.lineWidth = R * 0.05; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke();
    g.shadowBlur = 0;
    sheen(g, R, 0.18);
    g.restore();
    emboss(g, R, function(){ klingonCapPath(g, R, 'wings'); }, 0.6, 0.85);
    for(s=-1; s<=1; s+=2){
      bevel(g, -R*0.22, s*R*0.40, -R*0.72, s*R*0.84, sw);
      bevel(g, -R*0.36, s*R*0.32, -R*0.88, s*R*0.80, sw);
      bevel(g, -R*0.08, s*R*0.30, -R*0.50, s*R*0.74, sw);
    }
    klingonCapPath(g, R, 'keel');
    var kg = g.createLinearGradient(0, -R * 0.24, 0, R * 0.24);
    kg.addColorStop(0, P.hi); kg.addColorStop(0.35, P.hi); kg.addColorStop(0.6, P.mid); kg.addColorStop(1, P.lo);
    g.fillStyle = kg; g.fill();
    g.save();
    klingonCapPath(g, R, 'keel'); g.clip();
    plating(g, R, rand, 60, 1);
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-R * 0.75, -R * 0.1, R * 1.6, R * 0.03);
    g.restore();
    emboss(g, R, function(){ klingonCapPath(g, R, 'keel'); }, 0.7, 0.9);
    ridge(g, -R * 0.7, R * 0.9, -R * 0.05, R * 0.06, 0.5);
    for(x = 0.5; x > -0.7; x -= 0.3) bevel(g, R * x, -R * 0.15, R * x, R * 0.15, sw);
    canopy(g, R * 0.68, 0, R * 0.09, R * 0.055, P.rim);
    g.save();
    g.globalCompositeOperation = 'lighter';
    var ww = Math.max(0.7, R * 0.026);
    g.fillStyle = 'rgba(' + P.win + ',.9)';
    for(s=-1; s<=1; s+=2) for(x = 0.64; x > -0.5; x -= 0.085){
      if((Math.round(x * 100) + s * 5) % 6 === 0) continue;
      g.fillRect(R * x - ww / 2, s * R * 0.1 - ww / 2, ww, ww);
    }
    var eng = [[-0.74, 0, 0.2], [-0.64, 0.3, 0.13], [-0.64, -0.3, 0.13], [-0.88, 0.62, 0.1], [-0.88, -0.62, 0.1]];
    for(i=0;i<eng.length;i++) glowDot(g, R * eng[i][0], R * eng[i][1], R * eng[i][2], P.glow, 0.95);
    for(s=-1; s<=1; s+=2) glowDot(g, -R * 0.66, s * R * 0.9, R * 0.07, P.glow, 0.9);
    g.restore();
  }

  // ── the player: three Federation hulls, one per class on the pick card ──
  // Plan views, nose along +x, sized to the same thirty-odd pixels the old
  // Constitution filled so nothing about aiming or collision changes.
  function capsule(g, cx, cy, len, h, ang){
    g.save(); g.translate(cx, cy); g.rotate(ang || 0);
    var a = len / 2 - h / 2;
    g.moveTo(-a, -h / 2); g.lineTo(a, -h / 2);
    g.arc(a, 0, h / 2, -Math.PI / 2, Math.PI / 2);
    g.lineTo(-a, h / 2);
    g.arc(-a, 0, h / 2, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
    g.restore();
  }
  // one half of a hull that is symmetric about its axis, drawn out and back
  function mirrorPath(g, pts){
    var i;
    g.moveTo(pts[0][0], pts[0][1]);
    for(i=1;i<pts.length;i++) g.lineTo(pts[i][0], pts[i][1]);
    for(i=pts.length-2;i>0;i--) g.lineTo(pts[i][0], -pts[i][1]);
    g.closePath();
  }
  // Defiant, top half, prow notch to stern: a forked prow, swept armoured
  // shoulders, a flat flank under each nacelle and a short impulse deck
  var DEFIANT_EDGE = [[13.4, 0], [16.9, -1.2], [16.6, -2.7], [11.8, -4], [7, -5.4], [1, -9.6],
                      [-3, -11], [-12, -9.6], [-12.6, -6.4], [-11, -5], [-14.2, -3.2], [-14.6, 0]];
  var DEFIANT_HUB = [-1, 0, 5];
  var FED = {
    // Defiant, after the pick card's art: a charcoal armoured arrowhead with
    // a forked prow, a raised round deck amidships and the nacelles sunk
    // into its aft flanks, burning blue out of their ends. The first build
    // was a pale wedge no longer than it was wide, and at thirty pixels
    // nothing on it said which end was the front. Now the prow is two amber
    // points and the stern is two blue fires, so the heading reads from
    // either end.
    torp: {
      hull: function(g){ mirrorPath(g, DEFIANT_EDGE); },
      nacelles: [[-10.6, -10.8, 13.4, 4.4, 0], [-10.6, 10.8, 13.4, 4.4, 0]], pylons: [], podsOnTop: true,
      aftBurn: true,
      engines: [[-17, -10.8], [-17, 10.8], [-14.4, 0]], core: [-8.6, 0], coreR: 2,
      bussards: [[16.2, -2], [16.2, 2]], deflector: null,
      windows: [[9, -2.6], [7.4, -3.2], [9, 2.6], [7.4, 3.2], [-6.6, -5.6], [-8.2, -5.6], [-6.6, 5.6], [-8.2, 5.6]],
      saucer: null, detail: defiantDetail,
      // gunmetal rather than the fleet's pale grey: the one warship of the
      // three, and it is what the card art shows
      paint: { hi:'#d6dde6', mid:'#77828f', lo:'#1a2029', rim:'0,240,255', glow:'70,150,255', win:'255,226,180' }
    },
    // Sovereign: the long oval saucer, a slim engineering hull and long
    // nacelles on swept pylons trailing well behind it
    spread: {
      hull: function(g){
        g.ellipse(6, 0, 10.5, 8.2, 0, 0, Math.PI * 2);
        g.moveTo(0, -2.6); g.lineTo(-14.5, -2.2); g.quadraticCurveTo(-16.4, 0, -14.5, 2.2); g.lineTo(0, 2.6); g.closePath();
      },
      nacelles: [[-10, -11, 16, 3.2, 0], [-10, 11, 16, 3.2, 0]],
      pylons: [[-5, -2.2, -8.6, -9.8], [-5, 2.2, -8.6, 9.8]],
      engines: [[-18, -11], [-18, 11], [-15.6, 0]], core: [-8, 0], coreR: 2.3,
      bussards: [[-2.4, -11], [-2.4, 11]], deflector: [-1.2, 0],
      windows: null, saucer: [6, 0, 10.5, 8.2]
    },
    // Nova, in the Intrepid line: a teardrop saucer that flows into the
    // secondary hull, and nacelles canted out on short pylons
    mine: {
      hull: function(g){
        g.moveTo(15.5, 0);
        g.bezierCurveTo(15, -5, 10, -8.6, 4, -8.4);
        g.bezierCurveTo(0, -8.2, -3, -6, -5.5, -3.6);
        g.lineTo(-12, -2.4); g.quadraticCurveTo(-13.8, 0, -12, 2.4); g.lineTo(-5.5, 3.6);
        g.bezierCurveTo(-3, 6, 0, 8.2, 4, 8.4);
        g.bezierCurveTo(10, 8.6, 15, 5, 15.5, 0);
        g.closePath();
      },
      nacelles: [[-9.6, -10.8, 13, 2.8, -0.12], [-9.6, 10.8, 13, 2.8, 0.12]],
      pylons: [[-5.4, -3.4, -8.4, -9.8], [-5.4, 3.4, -8.4, 9.8]],
      engines: [[-15.8, -11.6], [-15.8, 11.6], [-12.8, 0]], core: [-6.5, 0], coreR: 2.2,
      bussards: [[-3.4, -10.1], [-3.4, 10.1]], deflector: [-4.6, 0],
      windows: null, saucer: [4.5, 0, 9.5, 8.2]
    }
  };
  function fedPath(g, F, part){
    g.beginPath();
    var i, n;
    if(part === 'hull' || part === 'all') F.hull(g);
    if(part === 'nacelles' || part === 'all') for(i=0;i<F.nacelles.length;i++){
      n = F.nacelles[i]; capsule(g, n[0], n[1], n[2], n[3], n[4]);
    }
  }
  function paintFed(g, id, rim){
    var F = FED[id] || FED.torp, P = F.paint || HULL_PAINT.federation, rand = prng(strSeed(id)), i, s, n;
    var R = 16;
    castShadow(g, R, function(){ fedPath(g, F, 'all'); }, P.lo);
    rimGlow(g, R, function(){ fedPath(g, F, 'all'); }, rim, 0.75);
    // pylons, under everything
    g.lineCap = 'round';
    for(i=0;i<F.pylons.length;i++){
      var py = F.pylons[i];
      g.strokeStyle = P.lo; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(py[0], py[1]); g.lineTo(py[2], py[3]); g.stroke();
      g.strokeStyle = P.mid; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(py[0], py[1] - 0.3); g.lineTo(py[2], py[3] - 0.3); g.stroke();
    }
    if(!F.podsOnTop) fedPods(g, F, P);
    // the hull
    fedHull(g, F, P, rand, R);
    // the Defiant's pods sit ON the hull, raised, rather than beside it
    if(F.podsOnTop) fedPods(g, F, P);
    // light: windows round the saucer rim, the deflector, the bussards
    fedLights(g, F, P);
  }
  // nacelles: grey pods with the blue field coils, a crisp dark edge so they
  // read as separate bodies, and the glow running down their length
  function fedPods(g, F, P){
    var i, n;
    for(i=0;i<F.nacelles.length;i++){
      n = F.nacelles[i];
      g.beginPath(); capsule(g, n[0], n[1], n[2], n[3], n[4]);
      var ng = g.createLinearGradient(0, n[1] - n[3] / 2, 0, n[1] + n[3] / 2);
      // a burning pod is a gunmetal cylinder with a narrow highlight, so the
      // fire at its end is what you see rather than the pod itself
      if(F.aftBurn){ ng.addColorStop(0, P.mid); ng.addColorStop(0.28, P.hi); ng.addColorStop(0.55, P.mid); }
      else { ng.addColorStop(0, P.hi); ng.addColorStop(0.5, P.mid); }
      ng.addColorStop(1, P.lo);
      g.fillStyle = ng; g.fill();
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.translate(n[0], n[1]); g.rotate(n[4]);
      var cg = g.createLinearGradient(-n[2] / 2, 0, n[2] / 2, 0);
      if(F.aftBurn){
        // The Defiant's nacelles burn out of their aft ends — the first
        // thing the card art shows, and the surest tell of the stern. The
        // coil strip runs hot at the back and cools toward the bow, on the
        // outboard side, so the brightest thing on the hull is its tail.
        var out = n[1] < 0 ? -1 : 1, ax = -n[2] / 2 + n[3] * 0.4;
        cg.addColorStop(0, 'rgba(' + P.glow + ',.9)'); cg.addColorStop(0.6, 'rgba(' + P.glow + ',.35)'); cg.addColorStop(1, 'rgba(' + P.glow + ',.05)');
        g.fillStyle = cg;
        g.fillRect(-n[2] * 0.42, out * n[3] * 0.08 - n[3] * 0.14, n[2] * 0.78, n[3] * 0.28);
        var ag = g.createRadialGradient(ax, 0, 0, ax, 0, n[3] * 1.2);
        ag.addColorStop(0, 'rgba(240,252,255,1)');
        ag.addColorStop(0.3, 'rgba(150,215,255,.95)');
        ag.addColorStop(0.62, 'rgba(' + P.glow + ',.55)');
        ag.addColorStop(1, 'rgba(' + P.glow + ',0)');
        g.fillStyle = ag;
        g.beginPath(); g.ellipse(ax - n[3] * 0.1, 0, n[3] * 1.2, n[3] * 0.72, 0, 0, Math.PI * 2); g.fill();
      } else {
        cg.addColorStop(0, 'rgba(' + P.glow + ',.1)'); cg.addColorStop(0.5, 'rgba(' + P.glow + ',.95)'); cg.addColorStop(1, 'rgba(' + P.glow + ',.25)');
        g.fillStyle = cg;
        g.fillRect(-n[2] * 0.42, -n[3] * 0.18, n[2] * 0.8, n[3] * 0.36);
      }
      g.restore();
      emboss(g, 5, (function(nn){ return function(){ g.beginPath(); capsule(g, nn[0], nn[1], nn[2], nn[3], nn[4]); }; })(n), 0.8, 0.8);
      g.beginPath(); capsule(g, n[0], n[1], n[2], n[3], n[4]);
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.4; g.stroke();
    }
  }
  function fedHull(g, F, P, rand, R){
    var i;
    fedPath(g, F, 'hull');
    var hg = g.createLinearGradient(-6, -12, 6, 12);
    hg.addColorStop(0, P.hi); hg.addColorStop(0.5, P.mid); hg.addColorStop(1, P.lo);
    g.fillStyle = hg; g.fill();
    g.save();
    fedPath(g, F, 'hull'); g.clip();
    plating(g, R, rand, 24, 1.1, 0.7);
    // the lower hull turns away from the light
    var fd = g.createLinearGradient(0, -2, 0, 12);
    fd.addColorStop(0, 'rgba(0,0,0,0)'); fd.addColorStop(1, 'rgba(0,0,0,.42)');
    g.fillStyle = fd; g.fillRect(-20, -2, 40, 16);
    sheen(g, R, 0.34);
    if(F.saucer){
      var sc = F.saucer;
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.45;
      g.beginPath(); g.ellipse(sc[0], sc[1], sc[2] * 0.62, sc[3] * 0.62, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath();
      for(i=0;i<8;i++){
        var ra = i / 8 * Math.PI * 2 + 0.39, c = Math.cos(ra), sn = Math.sin(ra);
        g.moveTo(sc[0] + c * sc[2] * 0.3, sn * sc[3] * 0.3); g.lineTo(sc[0] + c * sc[2] * 0.62, sn * sc[3] * 0.62);
      }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.35;
      g.beginPath(); g.ellipse(sc[0], sc[1] - 0.3, sc[2] * 0.62, sc[3] * 0.62, 0, Math.PI, Math.PI * 2); g.stroke();
      // the bridge dome, at the heart of the saucer
      g.fillStyle = P.hi;
      g.beginPath(); g.ellipse(sc[0] + 0.5, 0, 2.2, 1.9, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.4; g.stroke();
    } else if(F.detail) F.detail(g, P, rand);
    g.restore();
    emboss(g, 14, function(){ fedPath(g, F, 'hull'); }, 0.75, 0.85);
    if(F.detail) F.detail(g, P, rand, true);
    else ridge(g, -12, 14, -0.8, 1.4, 0.35);
  }
  // The Defiant's plating, painted inside the hull's clip; then, `late`,
  // the parts that stand proud of the hull's own bevel — the round deck
  // amidships and a ridge down each prong.
  function defiantDetail(g, P, rand, late){
    var H = DEFIANT_HUB, i, a, c, sn;
    function hub(){ g.beginPath(); g.arc(H[0], H[1], H[2], 0, Math.PI * 2); }
    if(!late){
      // the shoulders sit a step below the spine: darker, with a lit lip
      // where the spine drops to them
      g.fillStyle = 'rgba(0,0,0,.2)';
      g.fillRect(-20, -14, 40, 28);
      // a lighter armour plate on each forward shoulder, the layered
      // plating of the card art at the one size it survives
      g.fillStyle = 'rgba(255,255,255,.13)';
      g.beginPath(); g.moveTo(7.4, -4.4); g.lineTo(1.6, -8.4); g.lineTo(-0.8, -7); g.lineTo(5, -3.4); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.07)';
      g.beginPath(); g.moveTo(7.4, 4.4); g.lineTo(1.6, 8.4); g.lineTo(-0.8, 7); g.lineTo(5, 3.4); g.closePath(); g.fill();
      g.beginPath();
      mirrorPath(g, [[12.6, 0], [12.6, -2.1], [5, -3.1], [-5, -3.3], [-13.4, -2.5], [-13.8, 0]]);
      var sg = g.createLinearGradient(0, -3.3, 0, 3.3);
      sg.addColorStop(0, 'rgba(255,255,255,.3)'); sg.addColorStop(1, 'rgba(255,255,255,.06)');
      g.fillStyle = sg; g.fill();
      bevel(g, 12.6, -2.1, 5, -3.1, 0.45); bevel(g, 5, -3.1, -13.4, -2.5, 0.45);
      bevel(g, 12.6, 2.1, 5, 3.1, 0.45);   bevel(g, 5, 3.1, -13.4, 2.5, 0.45);
      // the armoured lip along each leading edge
      bevel(g, 6.6, -4.3, 0.6, -8.5, 0.4); bevel(g, 0.6, -8.5, -3.2, -9.8, 0.4);
      bevel(g, 6.6, 4.3, 0.6, 8.5, 0.4);   bevel(g, 0.6, 8.5, -3.2, 9.8, 0.4);
      // plate seams running out from the deck, and two across the stern
      for(i=0;i<4;i++){
        a = 0.75 + i * 0.52; c = Math.cos(a); sn = Math.sin(a);
        bevel(g, H[0] + c * H[2], -sn * H[2], H[0] + c * H[2] * 2.1, -sn * H[2] * 2.1, 0.4);
        bevel(g, H[0] + c * H[2], sn * H[2], H[0] + c * H[2] * 2.1, sn * H[2] * 2.1, 0.4);
      }
      bevel(g, -10, -2.4, -10, 2.4, 0.4);
      // the slot between the prongs runs back into the hull
      g.fillStyle = 'rgba(0,0,0,.7)';
      g.beginPath(); g.moveTo(13.6, 0); g.lineTo(10.4, -0.45); g.lineTo(10.4, 0.45); g.closePath(); g.fill();
      return;
    }
    // the deck: its own shadow on the hull, then a raised disc, two rings
    // and a boss
    castShadow(g, 6, hub, P.lo);
    hub();
    var hg = g.createLinearGradient(H[0] - H[2], -H[2], H[0] + H[2] * 0.6, H[2]);
    hg.addColorStop(0, P.hi); hg.addColorStop(0.5, P.mid); hg.addColorStop(1, P.lo);
    g.fillStyle = hg; g.fill();
    emboss(g, 6, hub, 0.9, 0.9);
    g.lineWidth = 0.45;
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.beginPath(); g.arc(H[0], 0, H[2] * 0.66, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.3)';
    g.beginPath(); g.arc(H[0], -0.4, H[2] * 0.66, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.fillStyle = P.lo;
    g.beginPath(); g.arc(H[0], 0, H[2] * 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.4)';
    g.beginPath(); g.arc(H[0] - 0.3, -0.45, H[2] * 0.11, 0, Math.PI * 2); g.fill();
    ridge(g, 10.4, 16.6, -2.05, 0.6, 0.35);
    ridge(g, 10.4, 16.6, 2.05, 0.6, 0.2);
    ridge(g, 4.2, 12.2, -1.1, 1, 0.3);
    ridge(g, -13.4, -6.2, -1.1, 1, 0.25);
  }
  function fedLights(g, F, P){
    var i;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(' + P.win + ',.9)';
    if(F.saucer){
      var S = F.saucer;
      for(i=0;i<18;i++){
        var wa = i / 18 * Math.PI * 2 + 0.17;
        if(Math.abs(Math.cos(wa)) > 0.93) continue;
        g.fillRect(S[0] + Math.cos(wa) * S[2] * 0.82 - 0.35, Math.sin(wa) * S[3] * 0.82 - 0.35, 0.7, 0.7);
      }
    }
    if(F.windows) for(i=0;i<F.windows.length;i++) g.fillRect(F.windows[i][0] - 0.35, F.windows[i][1] - 0.35, 0.7, 0.7);
    if(F.deflector) glowDot(g, F.deflector[0], F.deflector[1], 2.6, '90,170,255', 0.9);
    // Bussards amber, never red: red and pink are spoken for (Klingon, and
    // alert), and the player's own nacelles are the last place to borrow them
    for(i=0;i<F.bussards.length;i++) glowDot(g, F.bussards[i][0], F.bussards[i][1], 2.3, '255,176,110', 0.95);
    for(i=0;i<F.engines.length;i++) glowDot(g, F.engines[i][0], F.engines[i][1], 1.8, P.glow, 0.85);
    g.restore();
  }

  // ── the sprite catalogue ──
  function alienSprite(kind, variant){
    var AT = ALIEN_TYPES[kind];
    return hullSprite('a:' + kind + ':' + (variant || ''), AT.r * 1.4 + 12, function(g){
      if(variant === 'mask'){
        maskPaint(g, function(){ if(kind === 'drone') cubePath(g, AT.r, 'all'); else silhouette(g, kind, AT.r, 'all'); }, AT.r);
        return;
      }
      if(kind === 'drone') paintCube(g, AT.r, false, variant === 'adapted');
      else paintWinged(g, kind, AT.r, false);
    });
  }
  function capitalSprite(b, variant){
    var BT = BOSS_TYPES[b.fac], R = b.r, key = 'c:' + b.fac + ':' + (variant || '');
    return hullSprite(key, R * 1.7 + 16, function(g){
      var rim = variant === 'rage' ? RAGE_RIM : null;
      if(b.fac === 'klingon'){
        if(variant === 'mask'){ maskPaint(g, function(){ klingonCapPath(g, R, 'all'); }, R); return; }
        paintKlingonCap(g, R, rim);
      } else if(BT.hull === 'drone'){
        var FRd = R * 1.25;
        if(variant === 'mask'){ maskPaint(g, function(){ cubePath(g, FRd, 'all'); }, FRd); return; }
        paintCube(g, FRd, true, false, rim);
      } else {
        var FR = R * 1.12;
        if(variant === 'mask'){ maskPaint(g, function(){ silhouette(g, BT.hull, FR, 'all'); }, FR); return; }
        paintWinged(g, BT.hull, FR, true, rim);
      }
      if(variant === 'rage') tint(g, '255,45,120', 0.16);
    });
  }
  function playerSprite(id, amber){
    return hullSprite('p:' + id + ':' + (amber ? 'amber' : ''), 32, function(g){
      paintFed(g, id, amber ? '255,179,71' : HULL_PAINT.federation.rim);
    });
  }
  // white wingtip strobes: live, because a painted light cannot blink
  function strobes(kind, R, seed){
    var D = HULL_DETAIL[kind];
    if(!D || !D.tip) return;
    var on = reduceMotion ? 0.8 : (Math.sin(gameTime * 5.5 + seed) > 0.72 ? 1 : 0.15);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * on).toFixed(3) + ')';
    for(var s=-1; s<=1; s+=2){
      ctx.beginPath();
      ctx.arc(R * D.tip[0], s * R * D.tip[1], Math.max(0.9, R * 0.05) * (0.8 + 0.4 * on), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // the white silhouette the hit flash and the charge telegraph fade in
  function maskPaint(g, pathFn, R){
    g.save();
    g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = R * 0.25 * bakeScale;
    pathFn(); g.fillStyle = '#fff'; g.fill();
    g.restore();
  }
  // Bake everything up front — at the start of a run, behind the ship
  // pick — so the first Borg cube of the run is not also the first frame
  // that has to paint one.
  function prebakeHulls(){
    var k;
    for(k in ALIEN_TYPES){ alienSprite(k); alienSprite(k, 'mask'); }
    alienSprite('drone', 'adapted');
    for(k in BOSS_TYPES){
      var fake = { fac: k, r: BOSS_R };
      capitalSprite(fake); capitalSprite(fake, 'mask'); capitalSprite(fake, 'rage');
    }
    for(k in FED){ playerSprite(k, false); playerSprite(k, true); }
    // Draw every sprite once, at a single pixel and all but invisible, so the
    // browser uploads it now — behind the ship pick — rather than on the
    // frame a new hull first appears, which read as a hitch in the middle
    // of a fight. The next frame clears the canvas anyway.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.004;
    for(k in spriteCache) if(spriteCache[k]) ctx.drawImage(spriteCache[k].cv, 0, 0, 1, 1);
    ctx.restore();
  }

  // ── hull geometry ────────────────────────────────────────────────────────
  // Where things sit on each escort hull, for the painters and the live
  // strobes: the fuselage's nose and beam, the wingtip (where the strobe
  // blinks), the main wing seam, the weapon point, and each faction's own
  // pattern — Klingon feathers, Cardassian rib chevrons, Tholian crystal
  // facets. Coordinates are in units of the hull radius, nose along +x, one
  // wing only (the +y side, mirrored), so the same table paints a 30px scout
  // and a 100px flagship.
  var HULL_DETAIL = {
    //          fuselage nose/beam   one wing (the +y side; mirrored)
    scout:   { nose:1.12, beam:0.17, tip:[-0.88,0.66], seam:[[-0.20,0.22],[-0.60,0.66]], gun:[-0.02,0.34] },
    raptor:  { nose:1.12, beam:0.17, tip:[-0.98,0.62], seam:[[-0.20,0.20],[-0.66,0.68]], gun:[0.04,0.30],
               feathers:[[[-0.34,0.30],[-0.84,0.64]]] },
    stalker: { nose:1.12, beam:0.19, tip:[0.50,0.80],  seam:[[-0.02,0.26],[0.36,0.84]],  gun:[0.36,0.66] },
    lancer:  { nose:1.02, beam:0.24, tip:[-0.64,1.10], seam:[[-0.12,0.32],[-0.44,0.90]], gun:[-0.40,1.02], ribs:true },
    warbird: { nose:1.12, beam:0.22, tip:[-0.08,1.14], seam:[[-0.02,0.34],[-0.14,0.98]], gun:[0.14,0.52],
               feathers:[[[-0.24,0.34],[-0.34,0.96]], [[-0.42,0.30],[-0.48,0.86]]] },
    weaver:  { nose:1.20, beam:0.14, tip:[0.62,0.96],  tip2:[-0.78,0.88], crystal:true, gun:[0.30,0.48] },
    drone:   { box:true }
  };

  // The tractor beam is the one upgrade whose effect was previously invisible
  // — loot simply drifted and you had to take it on trust. Drawing the lock
  // makes the range legible on the field, so the card's px figure stops being
  // the only way to know what you bought. Beams are drawn first, under the
  // whole field, so they never compete with a rock for attention.
  function drawTractor(camY){
    if(up.magnet <= 0 || !pickups.length) return;
    var mag = magnetRange(), pulse = 0.5 + 0.5 * Math.sin(gameTime * 5);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -gameTime * 34;
    for(var i=0;i<pickups.length;i++){
      var pk = pickups[i];
      var d = Math.hypot(ship.x - pk.x, ship.y - pk.y);
      if(d >= mag || d < PICKUP_R) continue;
      // fades in as the lock tightens, so the beam is strongest on the crystal
      // that is actually about to arrive
      var a = (1 - d / mag) * 0.5 * (0.6 + 0.4 * pulse);
      ctx.strokeStyle = 'rgba(111,232,255,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y - camY);
      ctx.lineTo(pk.x, pk.y - camY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the emitter ring itself, so the radius reads even with nothing in range
    ctx.strokeStyle = 'rgba(111,232,255,' + (0.05 + 0.04 * pulse).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(ship.x, ship.y - camY, mag, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // The trail is drawn oldest-first as overlapping soft blobs that shrink and
  // fade together, which is what makes a string of circles read as one cooling
  // ribbon of plasma rather than as a row of dots. Orange, the torpedo's
  // colour: both of them are ordnance, and neither is the pink that means
  // alert or the cyan that means you.
  // One gradient, baked into an offscreen sprite the first time it is needed
  // and then blitted per blob. A maxed vent holds ~90 blobs, and building 90
  // radial gradients every frame is real work on a phone — the sprite turns
  // the whole trail into 90 drawImage calls, which is not.
  // null = not built yet, false = this environment cannot build one. Nothing
  // in here may throw: it runs inside draw(), and an exception there takes the
  // whole frame loop down with it.
  var wakeSprite = null;
  function getWakeSprite(){
    if(wakeSprite !== null) return wakeSprite;
    wakeSprite = false;
    try {
      var S = 64, c = document.createElement('canvas');
      if(!c || !c.getContext) return wakeSprite;
      c.width = c.height = S;
      var g2 = c.getContext('2d');
      if(!g2 || !g2.createRadialGradient) return wakeSprite;
      var grd = g2.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
      grd.addColorStop(0,    'rgba(255,209,168,0.50)');
      grd.addColorStop(0.55, 'rgba(255,140,60,0.32)');
      grd.addColorStop(1,    'rgba(255,80,20,0)');
      g2.fillStyle = grd;
      g2.fillRect(0, 0, S, S);
      wakeSprite = c;
    } catch(e){ /* falls back to flat blobs below */ }
    return wakeSprite;
  }

  function drawWake(camY){
    if(!wake.length) return;
    var spr = getWakeSprite(), vh = window.innerHeight;
    ctx.save();
    for(var i=0;i<wake.length;i++){
      var w = wake[i], y = w.y - camY;
      // the trail runs off behind the camera on a long burn; skipping what is
      // not on screen is most of the cost on a maxed vent
      if(y < -WAKE_R * 2 || y > vh + WAKE_R * 2) continue;
      var f = w.life / w.max;
      var r = WAKE_R * (0.45 + 0.55 * f);
      ctx.globalAlpha = f;
      if(spr){
        ctx.drawImage(spr, w.x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = 'rgba(255,140,60,.28)';
        ctx.beginPath(); ctx.arc(w.x, y, r, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // The deflector has the same problem the tractor beam had: an upgrade whose
  // whole effect is that something did not happen to you is invisible. Drawing
  // the field, and lighting the arc that is actually doing the shoving, makes
  // it legible without a HUD chip. Cyan, because it is the player's own hull.
  function drawDeflector(camY){
    if(up.deflector <= 0) return;
    var R = deflectRange(), y = ship.y - camY;
    var pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(gameTime * 3.2);
    ctx.save();
    ctx.strokeStyle = 'rgba(111,232,255,' + (0.07 + 0.05 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ship.x, y, R, 0, Math.PI*2); ctx.stroke();
    // the arc facing whatever is currently inside the field brightens, so the
    // push reads as a contact rather than as a decorative circle
    for(var i=0;i<asteroids.length;i++){
      var ax = asteroids[i];
      var dx = ax.x - ship.x, dy = ax.y - ship.y, d = Math.hypot(dx, dy);
      var dR = R + ax.r;
      if(d >= dR) continue;
      var a = Math.atan2(dy, dx), w = 0.45;
      ctx.strokeStyle = 'rgba(125,249,255,' + ((1 - d / dR) * 0.55).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ship.x, y, R, a - w, a + w); ctx.stroke();
    }
    ctx.restore();
  }

  // Red alert. Drawn on the canvas rather than in CSS because it has to sit
  // under the HUD but over the field, and because the pulse has to run off the
  // same clock as everything else — a CSS animation would keep flashing while
  // the run is paused on an upgrade card.
  // The vent front: a hard white leading edge, a cyan body behind it, and a
  // fill that falls away fast toward the middle. The fill is what stops a
  // 320px circle reading as a bubble — a ring alone looks like a hoop, and a
  // flat disc looks like a hole.
  function drawSurges(camY){
    if(!surges.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for(var i=0;i<surges.length;i++){
      var v = surges[i], y = v.y - camY;
      var a = 1 - Math.min(1, v.t / (SURGE_TIME * 1.55));
      var R = Math.max(2, v.r);
      if(ctx.createRadialGradient){
        var g = ctx.createRadialGradient(v.x, y, R * 0.5, v.x, y, R);
        g.addColorStop(0,    'rgba(0,240,255,0)');
        g.addColorStop(0.8,  'rgba(0,240,255,' + (a * 0.2).toFixed(3) + ')');
        g.addColorStop(1,    'rgba(255,255,255,' + (a * 0.45).toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(v.x, y, R, 0, Math.PI*2); ctx.fill();
      }
      ctx.lineWidth = 3 * a + 1;
      ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.85).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(v.x, y, R, 0, Math.PI*2); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(125,249,255,' + (a * 0.4).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(v.x, y, R * 0.8, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawRedAlert(){
    var W = window.innerWidth, H = window.innerHeight;
    var pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(gameTime * 4.4);
    var a = 0.16 + pulse * 0.20;
    var g = ctx.createRadialGradient(W/2, H/2, Math.min(W,H) * 0.34,
                                     W/2, H/2, Math.max(W,H) * 0.72);
    g.addColorStop(0, 'rgba(255,45,120,0)');
    g.addColorStop(1, 'rgba(255,45,120,' + a.toFixed(3) + ')');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // a hard hairline right on the bezel, which is what makes it read as an
    // alert condition rather than a wash
    ctx.strokeStyle = 'rgba(255,45,120,' + (0.3 + pulse * 0.45).toFixed(3) + ')';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    ctx.restore();
  }

  // Sky, drawn under everything and inside the shake so the background rides
  // the camera with the field — a background that holds still while the
  // foreground rattles reads as a rendering fault rather than as a blow. Every
  // layer carries SKY_B of bleed on each side for exactly that reason: the
  // shake translates by up to fifteen pixels, and without the bleed that opens
  // a bare strip at one edge on every heavy frame.
  //
  // Two full-screen blits and one narrow one. See the note above bakeSky() for
  // why it is two and not five, and why every destination goes through snap().
  function drawSky(camY){
    var W = window.innerWidth, H = window.innerHeight, B = SKY_B;
    if(skyTile && backdropOn){
      var y0 = snap(-B - (((camY * 0.10) % skyH + skyH) % skyH));
      ctx.drawImage(skyTile, -B, y0,        W + B*2, skyH);
      ctx.drawImage(skyTile, -B, y0 + skyH, W + B*2, skyH);
    }

    // The near layer, live rather than baked for one reason: it has to
    // stretch. st is how close the ship is to the speed where a streak is
    // worth drawing at all, and the trail runs opposite the ship's heading —
    // the stars are standing still and the camera is the thing moving. This is
    // the layer that actually carries the depth, because it is the only one
    // that moves fast enough to be seen moving.
    if(!motes.length || !ship) return;
    var sv = Math.hypot(ship.vx, ship.vy);
    var st = Math.min(1, sv / 6.2);
    var tx = -ship.vx * st * 2.1, ty = -ship.vy * st * 2.1;
    var off = ((camY * 0.62) % moteH + moteH) % moteH;
    var streaked = st > 0.3 && !reduceMotion;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(170,196,240,' + (0.2 + 0.3 * st).toFixed(3) + ')';
    ctx.fillStyle   = 'rgba(190,210,250,.5)';
    ctx.lineCap = 'round';
    for(var i=0;i<motes.length;i++){
      var m = motes[i], my = m.y - off;
      if(my < -B) my += moteH;
      if(my > H + B) continue;
      if(streaked){
        ctx.lineWidth = m.r * 1.5;
        ctx.beginPath();
        ctx.moveTo(m.x, my);
        ctx.lineTo(m.x + tx * m.r, my + ty * m.r);
        ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(m.x, my, m.r, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  // Blooms, composited additively so two flashes in the same place burn out
  // to white the way a real one does rather than averaging to grey. They open
  // as they fade, which is what separates a blast from a light being switched
  // off.
  function drawBlooms(camY){
    if(!blooms.length || !ctx.createRadialGradient) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for(var i=0;i<blooms.length;i++){
      var bl = blooms[i], a = bl.life, y = bl.y - camY;
      var rr = bl.max * (1.25 - 0.75 * a);
      var g = ctx.createRadialGradient(bl.x, y, 0, bl.x, y, rr);
      g.addColorStop(0,    'rgba(255,255,255,' + (a * 0.92).toFixed(3) + ')');
      g.addColorStop(0.3,  'rgba(' + bl.rgb + ',' + (a * 0.6).toFixed(3) + ')');
      g.addColorStop(1,    'rgba(' + bl.rgb + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bl.x, y, rr, 0, Math.PI*2); ctx.fill();
      // Spokes. A blast is light escaping through whatever just came apart,
      // and the spikes are what make it read as an explosion rather than as a
      // lamp being switched on. Lengths come off the spoke index rather than
      // off Math.random(), so they are ragged but they do not crawl.
      if(bl.n){
        ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.5).toFixed(3) + ')';
        ctx.lineWidth = 0.8 + a * 1.6;
        ctx.beginPath();
        for(var k=0;k<bl.n;k++){
          var ang = bl.spin + k / bl.n * Math.PI * 2;
          var i1 = rr * (0.8 + 0.55 * (((k * 37) % 13) / 13));
          ctx.moveTo(bl.x + Math.cos(ang) * rr * 0.22, y + Math.sin(ang) * rr * 0.22);
          ctx.lineTo(bl.x + Math.cos(ang) * i1,        y + Math.sin(ang) * i1);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Debris, in two passes. The opaque pieces go down first so they read as
  // wreckage against the sky, then everything that glows is composited on top
  // in one additive pass — one state change for the whole field rather than
  // one per particle.
  function drawParticles(camY){
    var i, p, y;
    for(i=0;i<particles.length;i++){
      p = particles[i];
      y = p.y - camY;
      if(p.t === 'shard'){
        var c = Math.cos(p.rot) * p.len, s = Math.sin(p.rot) * p.len;
        ctx.strokeStyle = 'rgba(' + (p.col || '184,65,42') + ',' + Math.min(1, p.life * 1.3).toFixed(2) + ')';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(p.x - c*0.5, y - s*0.5);
        ctx.lineTo(p.x + c*0.5, y + s*0.5);
        ctx.stroke();
      } else if(!p.t || p.t === 'dust'){
        ctx.fillStyle = 'rgba(' + (p.col || '184,65,42') + ',' + p.life.toFixed(2) + ')';
        ctx.fillRect(p.x-1.5, y-1.5, 3, 3);
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for(i=0;i<particles.length;i++){
      p = particles[i];
      if(p.t !== 'spark' && p.t !== 'ember') continue;
      y = p.y - camY;
      if(p.t === 'spark'){
        // stretched along its own velocity, and the stretch shortens as it
        // dies — a spark that keeps its full length to the last frame reads
        // as a stick rather than as something burning out
        var k = 1.6 + p.life * 2.6;
        ctx.strokeStyle = 'rgba(' + (p.col || '255,216,150') + ',' + p.life.toFixed(2) + ')';
        ctx.lineWidth = 0.8 + p.life * 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * k, y - p.vy * k);
        ctx.lineTo(p.x, y);
        ctx.stroke();
      } else {
        // a glow without a shadowBlur: a wide dim disc under a small bright
        // one. shadowBlur on every ember is the one thing that would actually
        // cost frames here, and this is indistinguishable at 3px.
        var col = p.col || '255,150,90';
        ctx.fillStyle = 'rgba(' + col + ',' + (p.life * 0.16).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, y, p.r * 3.2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(' + col + ',' + (p.life * 0.9).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, y, p.r * p.life, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  // Scan reticles, and what they are FOR. Every rock inside sensor range used
  // to wear a full one — ring plus four turning ticks — which meant forty of
  // them on screen at once, all saying the same thing at the same strength.
  // A mark that everything carries marks nothing; it was simply a second
  // outline around every rock in the sector, competing with the rocks.
  //
  // So the reticle now says IMPORTANT, and only two things are:
  //
  //   a rare rock  — the drop is the only thing on the field worth crossing
  //                  it for, so it keeps the whole treatment at any range:
  //                  ring, ticks, and the amber that separates a prize from
  //                  a hazard.
  //   a big rock   — the ones that will not break in one pass and cannot be
  //                  flown through. A ring, no ticks, and faint: enough to
  //                  read as scanned, not enough to be looked at.
  //
  // Everything under RETICLE_MIN — the small rock, the mini, the debris —
  // gets nothing. It is already a lit purple outline on a dark field, which
  // was always sufficient to see it by.
  var RETICLE_R = 560;
  var RETICLE_MIN = 22;

  // Where the key light hangs in the sector. One direction, shared by every
  // rock on the field — a field lit from one corner reads as solid, and a
  // field where each rock has its own sun reads as a pile of stickers.
  var ROCK_LIGHT = -2.15;

  // One path, one fill. Every face whose lighting term falls in [lo,hi) is
  // added to the SAME path as a triangle off the rock's centre, and the whole
  // band is filled in one go — canvas fills a path holding nine subpaths
  // exactly as it fills a path holding one. That is the reason a ten-sided
  // rock still costs the three fills the old three-wedge version cost, and it
  // is the only reason this shading was affordable at all: faceting is the
  // most expensive thing the field does.
  function facetBand(pts, np, step, lang, lo, hi){
    var added = false, f, d, a, b;
    ctx.beginPath();
    for(f=0; f<np; f++){
      d = Math.cos((f + 0.5) * step - lang);
      if(d < lo || d >= hi) continue;
      a = pts[f]; b = pts[(f + 1) % np];
      ctx.moveTo(0, 0); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      added = true;
    }
    if(added) ctx.fill();
  }
  function drawReticles(camY){
    var i, ax, dx, dy, d, f, rr, k, a, y;
    ctx.save();
    ctx.lineWidth = 1;
    for(i=0;i<asteroids.length;i++){
      ax = asteroids[i];
      if(!ax.special && ax.r < RETICLE_MIN) continue;
      dx = ax.x - ship.x; dy = ax.y - ship.y;
      d = Math.hypot(dx, dy);
      if(d > RETICLE_R && !ax.special) continue;
      f = ax.special ? 1 : 1 - d / RETICLE_R;
      rr = ax.r + 9; y = ax.y - camY;
      ctx.strokeStyle = ax.special
        ? 'rgba(255,214,140,' + (0.1 + f * 0.3).toFixed(3) + ')'
        : 'rgba(125,249,255,' + (0.02 + f * 0.1).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(ax.x, y, rr, 0, Math.PI*2); ctx.stroke();
      // the ticks are the loud half of the mark, so they belong only to the
      // thing the mark is actually for
      if(!ax.special) continue;
      ctx.beginPath();
      for(k=0;k<4;k++){
        a = ax.pulse + gameTime * 0.45 + k * Math.PI / 2;
        ctx.moveTo(ax.x + Math.cos(a)*(rr + 2.5), y + Math.sin(a)*(rr + 2.5));
        ctx.lineTo(ax.x + Math.cos(a)*(rr + 7),   y + Math.sin(a)*(rr + 7));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw(){
    var camY = window.scrollY;
    var W = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0,0,W,H);
    // Camera shake, wrapped around the whole scene, sky included — a
    // background that holds still while the foreground rattles reads as a
    // rendering fault rather than as a blow landing. Translation only, snapped
    // to the device pixel grid: a fractional or rotated transform turns every
    // blit underneath it into a resample, and the sky is five full-screen
    // blits. See drawSky() for the measurements.
    var sh = reduceMotion ? 0 : trauma * trauma * SHAKE_MAX;
    var shaking = sh > 0.06;
    if(shaking){
      ctx.save();
      ctx.translate(snap((Math.random()*2-1) * sh), snap((Math.random()*2-1) * sh));
    }
    drawSky(camY);
    drawReticles(camY);
    drawTractor(camY);
    drawWake(camY);
    drawDeflector(camY);

    asteroids.forEach(function(ax){
      var sp = ax.special ? SPECIALS[ax.special] : null;
      var pts = ax.pts, np2 = pts.length, i;
      var step2 = Math.PI * 2 / np2, lang = ROCK_LIGHT - ax.rot;
      ctx.save();
      ctx.translate(ax.x, ax.y - camY);
      ctx.rotate(ax.rot);

      // Solid, now that there are stars behind it. An outline-only rock over a
      // starfield reads as a wireframe drawn on the window rather than as a
      // lump of nickel-iron in front of the sky — the whole field went flat
      // the moment the background arrived, and this is what brought it back.
      ctx.beginPath();
      for(i=0;i<np2;i++){ if(i===0) ctx.moveTo(pts[i][0],pts[i][1]); else ctx.lineTo(pts[i][0],pts[i][1]); }
      ctx.closePath();
      ctx.fillStyle = ax.hitT > 0 ? 'rgba(96,70,132,.95)' : 'rgba(24,15,44,.92)';
      ctx.fill();

      // The cut: three planes lit off the shared centre, then the facet lines
      // between them. Together they turn a filled polygon into a lump of
      // something, and they do it without building a gradient per rock per
      // frame. Each of these lays down a path of its own — which is why the
      // outline below has to rebuild the body rather than assuming it is
      // still the current path. It was not, and for one build the outline
      // strokes landed on the facet lines instead: every rock in the field
      // came out as a bright violet asterisk.
      // Faceting is the most expensive thing the field does — it is the
      // difference between 47 and 168 fills a frame, measured — so it is
      // spent where it can be seen. The middle face is square to the light and
      // the two beside it are turning away from it, but a nine-pixel mini
      // cannot resolve three steps: one is enough to say which way the light
      // comes from, and the other two are fills nobody will ever see.
      // What turns a filled polygon into a lump of rock is a TERMINATOR: one
      // side facing a light, one side turned away, and the step between them
      // falling where the surface curves off. The old cut lit three faces
      // starting from an index rolled at birth, which put a bright wedge at an
      // arbitrary point on the rim — that reads as a chip out of the rock
      // rather than as light on it. Worse, the index rolled WITH the rock as
      // it tumbled, so the sun appeared to be bolted to the asteroid.
      //
      // The light is now fixed in world space. `ax.rot` is already on the
      // matrix, so subtracting it here puts the key light back where it
      // belongs and holds it there while the rock turns underneath.
      //
      // The vertices sit at regular angles — only the radius is jittered at
      // birth — so a face's normal IS its index, and the shading term is one
      // cosine per face with no arctangent anywhere.
      if(ax.hitT <= 0 && ax.r >= 11){
        var lrgb = sp ? sp.rgb : '124,92,255';
        step2 = Math.PI * 2 / np2;
        lang = ROCK_LIGHT - ax.rot;
        // turned away: a wash of the same near-black the sky is, which is what
        // gives the rock a dark side rather than a dim one
        ctx.fillStyle = 'rgba(3,1,10,.5)';
        facetBand(pts, np2, step2, lang, -1.01, 0);
        // facing the light
        ctx.fillStyle = 'rgba(' + lrgb + ',.17)';
        facetBand(pts, np2, step2, lang, 0, 0.62);
        // square to it: the highlight that gives the rock a top
        ctx.fillStyle = 'rgba(' + lrgb + ',.42)';
        facetBand(pts, np2, step2, lang, 0.62, 1.01);
        // Cut lines, and only on rocks big enough to carry them. They stop
        // short of the centre because lines that all converge on one point
        // read as a star on anything under twenty pixels, and most of the
        // field is under twenty pixels — the eye closes the gap by itself.
        if(ax.r >= 17){
          ctx.strokeStyle = 'rgba(' + lrgb + ',.13)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for(var f3=0; f3<np2; f3+=2){
            ctx.moveTo(pts[f3][0]*0.38, pts[f3][1]*0.38);
            ctx.lineTo(pts[f3][0]*0.88, pts[f3][1]*0.88);
          }
          ctx.stroke();
        }
      }

      // the outline, on a freshly built body path
      ctx.beginPath();
      for(i=0;i<np2;i++){ if(i===0) ctx.moveTo(pts[i][0],pts[i][1]); else ctx.lineTo(pts[i][0],pts[i][1]); }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(4,2,8,.66)';
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.strokeStyle = ax.hitT > 0 ? '#ffffff' : (sp ? sp.stroke : '#c77dff');
      ctx.shadowColor = sp ? sp.glow : '#7b5cff';
      // rare rocks breathe rather than sit still, so they pick themselves out
      // of a field of forty at a glance. The ordinary halo is sized off the
      // rock: a flat 12 around a 14px pebble is a glow wider than the thing
      // glowing, which is the other half of why the field read as sparkles.
      ctx.shadowBlur = sp ? 14 + Math.sin(gameTime * 5 + ax.pulse) * 9
                          : Math.min(12, 3 + ax.r * 0.32);
      ctx.lineWidth = sp ? 2.4 : 1.7;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Rim light: the one mark that says the light is OUTSIDE the rock. Only
      // the edges actually facing it catch it, so it runs round part of the
      // silhouette and stops — an outline brightened all the way round is just
      // a thicker outline. Drawn after the halo so it sits on top of it.
      // It has to out-shout the halo it is laid on top of. At half alpha over a
      // bloomed violet stroke it was there in the buffer and invisible on the
      // screen — a highlight that does not beat what is under it is not a
      // highlight. Near-white, and confined to the two or three faces actually
      // square to the light, so it stays a catch on one shoulder of the rock
      // rather than a second outline.
      if(ax.hitT <= 0 && ax.r >= 13){
        ctx.strokeStyle = sp ? 'rgba(255,248,232,.92)' : 'rgba(240,232,255,.85)';
        ctx.lineWidth = sp ? 2.2 : 1.7;
        ctx.beginPath();
        for(var rl=0; rl<np2; rl++){
          if(Math.cos((rl + 0.5) * step2 - lang) < 0.55) continue;
          var ra = pts[rl], rb = pts[(rl + 1) % np2];
          ctx.moveTo(ra[0], ra[1]); ctx.lineTo(rb[0], rb[1]);
        }
        ctx.stroke();
      }

      // Fracture lines. One more opens for every point of hull the rock has
      // lost, so how close it is to breaking is legible on the rock itself and
      // not only in the white flash on the frame a shot lands. This is the one
      // piece of pure information the field never carried: which of the forty
      // in front of you is one shot from paying out.
      var gone = (ax.maxHp || 1) - ax.hp;
      if(gone > 0 && ax.cracks){
        ctx.strokeStyle = sp ? sp.stroke : 'rgba(199,125,255,.5)';
        ctx.globalAlpha = sp ? 0.5 : 1;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(var cq=0; cq<gone && cq<ax.cracks.length; cq++){
          var c0 = pts[ax.cracks[cq][0]], c1 = pts[ax.cracks[cq][1]];
          ctx.moveTo(c0[0]*0.84, c0[1]*0.84);
          ctx.lineTo(c1[0]*0.84, c1[1]*0.84);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if(sp){
        // a core ring, counter-rotating with the shell, marks it as cargo
        ctx.shadowColor = sp.glow;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = sp.stroke;
        ctx.rotate(-ax.rot * 2);
        ctx.beginPath();
        ctx.arc(0, 0, ax.r * 0.42, 0, Math.PI*2);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    });

    drawWings(camY);
    if(boss) drawCapital(boss, camY);

    aliens.forEach(function(al){
      var AT = ALIEN_TYPES[al.kind];
      var hot = al.hitT > 0;
      // a cloaked hull is a shimmer, never nothing: faint enough to be
      // untouchable, visible enough that the player can track where it went
      ctx.globalAlpha = 1 - 0.9 * (al.cloak || 0);
      ctx.save();
      ctx.translate(al.x, al.y - camY);
      ctx.rotate(alienFacing(al, AT));
      ctx.scale(HULL_VIS, HULL_VIS);
      // exhaust first, under everything, so the throat is covered by the hull.
      // A cube has no engines and gets none.
      if(AT.plume !== false){
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        plumeTrail(-al.r * 0.62, 0, al.r * 2.2, al.r * 0.16, AT.rgb, 0.42);
        ctx.restore();
      }
      // the painted hull (see paintWinged / paintCube), then what moves on
      // it: the white flash on the frame a shot lands, and the strobes. The
      // cube's sprite has an adapted variant whose nodes burn white — the
      // single most important thing that hull ever tells you.
      blit(alienSprite(al.kind, al.kind === 'drone' && al.adapted ? 'adapted' : ''));
      if(hot) blit(alienSprite(al.kind, 'mask'), Math.min(1, al.hitT / 0.12) * 0.5);
      strobes(al.kind, al.r, al.id);
      ctx.restore();

      // Hull damage, and only once there IS damage. A bar over every ship in
      // the sector is forty bars saying nothing; a bar over the ones already
      // hit answers the only question worth asking mid-fight — which of these
      // is one more beam from coming apart. No label, no frame, no ring: the
      // hull's own colour draining out of a dark track, the same grammar the
      // capital ship's bar uses, three sizes down. It is drawn in screen space
      // after the hull's transform is popped, so it never tumbles with the
      // ship it belongs to.
      if(al.maxHp && al.hp > 0 && al.hp < al.maxHp){
        var bw = Math.max(16, al.r * 2), bx = al.x - bw / 2;
        var by = al.y - camY - al.r * HULL_VIS - 8;
        ctx.fillStyle = 'rgba(4,2,8,.72)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
        ctx.fillStyle = 'rgba(' + AT.rgb + ',.92)';
        ctx.fillRect(bx, by, bw * Math.max(0, al.hp / al.maxHp), 2);
      }

      // A weaver winding up shows its strands reaching for the anchors before
      // the web exists, which is the window in which killing it still helps.
      if(al.kind === 'weaver' && al.phase === 'spin'){
        var f = 1 - Math.max(0, al.spinT) / WEB_SPIN;
        ctx.save();
        ctx.strokeStyle = 'rgba(199,125,255,' + (0.25 + 0.4 * f).toFixed(3) + ')';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -gameTime * 30;
        ctx.beginPath();
        for(var k=0;k<7;k++){
          var a = k / 7 * Math.PI * 2 + al.t * 0.3;
          ctx.moveTo(al.x, al.y - camY);
          ctx.lineTo(al.x + Math.cos(a) * WEB_R * f, al.y - camY + Math.sin(a) * WEB_R * f);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    });

    // Incoming plasma, drawn as a spindle along its own heading rather than as
    // a round pip. The single most useful thing a player can know about a
    // round is which way it is going, and a circle refuses to say. It costs
    // one path: two quadratic curves between the nose and the tail, with a
    // white-hot centre laid over it.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    alienBullets.forEach(function(ab){
      var rgb = ab.rgb || '255,122,99', r = ab.r || 3;
      var L = Math.hypot(ab.vx, ab.vy) || 1;
      var ux = ab.vx / L, uy = ab.vy / L;
      var len = r * 3.4, wid = r * 1.7;
      var x = ab.x, y = ab.y - camY;
      // Tholian shards are cut crystal, not bolts: a shard that is about to
      // split has to look like something that can break
      if(ab.split || ab.shard){
        var sr = r * 1.45;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(Math.atan2(uy, ux));
        ctx.fillStyle = 'rgba(' + rgb + ',.22)';
        ctx.beginPath(); ctx.arc(0, 0, sr * 1.8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(' + rgb + ',.95)';
        ctx.beginPath(); ctx.moveTo(sr * 1.7, 0); ctx.lineTo(0, sr * 0.75); ctx.lineTo(-sr, 0); ctx.lineTo(0, -sr * 0.75);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(235,205,255,.95)';
        ctx.beginPath(); ctx.moveTo(sr * 0.8, 0); ctx.lineTo(0, sr * 0.3); ctx.lineTo(-sr * 0.4, 0); ctx.lineTo(0, -sr * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        return;
      }
      ctx.fillStyle = 'rgba(' + rgb + ',.24)';
      ctx.beginPath(); ctx.ellipse(x, y, len * 0.9, r * 1.5, Math.atan2(uy, ux), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(' + rgb + ',.9)';
      ctx.beginPath();
      ctx.moveTo(x + ux*len, y + uy*len);
      ctx.quadraticCurveTo(x - uy*wid, y + ux*wid, x - ux*len, y - uy*len);
      ctx.quadraticCurveTo(x + uy*wid, y - ux*wid, x + ux*len, y + uy*len);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,246,240,.95)';
      ctx.beginPath();
      ctx.ellipse(x, y, len * 0.42, r * 0.3, Math.atan2(uy, ux), 0, Math.PI*2);
      ctx.fill();
    });
    ctx.restore();

    pickups.forEach(function(p){ drawPickup(p, camY); });

    // invulnerable frames blink the hull; under reduced motion the hull is
    // drawn every frame and the ghosting is carried by alpha instead
    var invBlink = ship.invuln > 0 && !reduceMotion && Math.floor(ship.invuln*13)%2 !== 0;
    if(!invBlink){
      if(reduceMotion && ship.invuln > 0) ctx.globalAlpha = 0.45;
      ctx.save();
      ctx.translate(ship.x, ship.y - camY);
      ctx.rotate(ship.angle);
      ctx.scale(HULL_VIS, HULL_VIS);
      // Impulse wash off both nacelles, and one long plume down the centreline
      // behind them. The long one is what actually reads: the nacelle cones say
      // "the engines are lit" at ten pixels, the centreline plume says how fast
      // you are going at a hundred, and speed was the one thing this ship could
      // never tell you about itself.
      var spd = Math.min(1, Math.hypot(ship.vx, ship.vy) / terminalSpeed());
      // every class burns from its own engines: the last entry is the
      // centreline, the others the nacelles
      var FD = FED[hull] || FED.torp, EN = FD.engines, ce = EN[EN.length - 1];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if(ship.thrusting || spd > 0.12){
        var wash = rapidTime > 0 ? '255,190,110' : '125,249,255';
        plumeTrail(ce[0], ce[1], (ship.thrusting ? 34 : 10) + spd * 78,
                   3.6 + spd * 1.6, wash, ship.thrusting ? 0.55 : 0.3);
      }
      if(ship.thrusting){
        var L = (9 + spd * 12) * (0.76 + Math.random() * 0.38);
        for(var np=0; np<EN.length - 1; np++){
          plume(EN[np][0], EN[np][1], L * 1.45, 3.6, 'rgba(0,150,255,.18)');
          plume(EN[np][0], EN[np][1], L,        2.3, 'rgba(125,249,255,.5)');
          plume(EN[np][0], EN[np][1], L * 0.4,  1.3, 'rgba(255,255,255,.8)');
        }
      }
      ctx.restore();
      // The painted hull of the class picked at the shakedown (paintFed), in
      // amber while the phaser array is overloaded — the only tell the
      // player needs that the drop is still live.
      blit(playerSprite(hull || 'torp', rapidTime > 0));
      // The warp core — the one place a charged core is announced on the
      // ship: it swells, and goes white when the overcharge is ready.
      var chg = overcharged
        ? 1.5 + (reduceMotion ? 0 : 0.22 * Math.sin(gameTime * 7))
        : 1 + 0.4 * (core / CORE_MAX);
      hullCore(FD.core[0], FD.coreR * chg,
               overcharged ? '255,255,255' : (rapidTime > 0 ? '255,190,110' : '111,232,255'),
               overcharged ? 1 : 0.9);
      // Muzzle flare on the emitter, in the beam's own colour. The phaser
      // fires ten times a second and it used to do it silently — the bullet
      // simply existed one frame and did not the frame before. A flash at the
      // nose is what ties the beam on the field to the ship that sent it.
      if(ship.muzzle > 0){
        var mf = ship.muzzle;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = (rapidTime > 0 ? 'rgba(255,201,120,' : 'rgba(125,249,255,') + (mf*0.8).toFixed(2) + ')';
        ctx.beginPath();
        ctx.ellipse(NOSE_OFFSET - 2, 0, 3 + mf*6, 1.4 + mf*3.2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // The bow shield. Drawn around the heading the ship is *travelling*, not
    // the way it is pointing, because that is what ramArmed() tests — a shield
    // painted on the nose while the hull drifts sideways would be a lie.
    var rc = ramCharge();
    if(rc > 0.25){
      var rHead = Math.atan2(ship.vy, ship.vx);
      var full = rc >= 1;
      ctx.save();
      ctx.translate(ship.x, ship.y - camY);
      ctx.rotate(rHead);
      ctx.strokeStyle = full ? 'rgba(125,249,255,.95)'
                             : 'rgba(111,232,255,' + (0.12 + 0.5 * (rc - 0.25) / 0.75).toFixed(3) + ')';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = full ? 12 : 4;
      ctx.lineWidth = full ? 3 : 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, SHIP_RADIUS + 8, -RAM_ARC, RAM_ARC);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // The arc: a ring at the exact radius that burns, plus a jagged bolt to
    // everything currently inside it. The ring has to be honest to the pixel —
    // this is a card whose whole risk is knowing where the edge is — so it is
    // drawn from arcRange() rather than from anything eyeballed. Cyan, because
    // it is the ship's own field.
    if(up.arc > 0){
      var aR = arcRange(), aY = ship.y - camY;
      var aPulse = reduceMotion ? 0.6 : 0.6 + 0.4 * Math.sin(gameTime * 9);
      ctx.save();
      ctx.strokeStyle = 'rgba(0,240,255,' + (0.16 + 0.14 * aPulse).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ship.x, aY, aR, 0, Math.PI*2); ctx.stroke();
      if(arcOn.length){
        ctx.strokeStyle = 'rgba(125,249,255,.9)';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 1.6;
        for(var q=0;q<arcOn.length;q++){
          var o = arcOn[q];
          // arcOn is last frame's burn list, and a frame can pass without the
          // sim running — a refit card, a blurred tab — so re-check the range
          // here rather than drawing a bolt at something that has since moved,
          // died, or was never there. Cheap, and it is the only thing that
          // keeps the lightning honest to the ring it comes out of.
          var bx = o.x - ship.x, by = o.y - ship.y;
          if(Math.hypot(bx, by) > aR + (o.r || 0) + 6) continue;
          var bd = Math.hypot(bx, by) || 1;
          // three kinked segments along the line, jittered off it — a straight
          // line reads as a tractor beam, and that is a different upgrade
          ctx.beginPath();
          ctx.moveTo(ship.x, aY);
          for(var seg=1; seg<=3; seg++){
            var f = seg / 3;
            var jit = seg === 3 ? 0 : (Math.random() - 0.5) * bd * 0.22;
            ctx.lineTo(ship.x + bx * f - by / bd * jit,
                       aY + by * f + bx / bd * jit);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // Ablative armour reads as two plates on the hull rather than a ring,
    // because a ring is what the shield drop already is and the two have to be
    // told apart at a glance: the ring means untouchable, the plates mean one
    // hit in hand. They vanish the moment the plate is spent.
    if(armourReady){
      ctx.save();
      ctx.translate(ship.x, ship.y - camY);
      ctx.rotate(ship.angle);
      ctx.strokeStyle = 'rgba(125,249,255,.7)';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      // On the flanks, not the bow. Ramming Speed draws its own shield across
      // the nose at almost exactly this radius, and a build carrying both put
      // two cyan arcs on top of each other — one overlay that reads as neither.
      var pr = SHIP_RADIUS + 6;
      ctx.beginPath(); ctx.arc(0, 0, pr,  1.05,  2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, pr, -2.2,  -1.05); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    if(shieldTime > 0){
      // the ring thins out as the shield runs down, so it reads without the HUD
      var pulse = (shieldTime < 3.5 && !reduceMotion)
        ? (0.35 + 0.4 * Math.abs(Math.sin(gameTime * 7)))
        : (shieldTime < 3.5 ? 0.5 : 0.75);
      ctx.save();
      ctx.strokeStyle = 'rgba(0,194,255,' + pulse.toFixed(2) + ')';
      ctx.shadowColor = '#00c2ff';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y - camY, SHIP_RADIUS + 10, 0, Math.PI*2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Phasers draw as short beam segments along their own heading rather than
    // as dots. It costs nothing — the velocity is already there — and it is
    // the single clearest signal that this weapon is a beam and the slow
    // orange thing beside it is not.
    //
    // Longer, heavier and brighter since Sep 2026 ("the phasers feel
    // smaller"), and every beam goes into ONE path per pass. They used to be
    // stroked one at a time with a blur on each, so a five-beam cone at full
    // rate paid for fifty blurred strokes a frame; now it pays for one.
    var beamCol = rapidTime > 0 ? '#ffc978' : '#7df9ff';
    ctx.lineCap = 'round';
    if(bullets.length){
      ctx.strokeStyle = beamCol;
      ctx.shadowColor = rapidTime > 0 ? '#ffa726' : '#00f0ff';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      bullets.forEach(function(b){
        var L = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / L, uy = b.vy / L, len = 14;
        ctx.moveTo(b.x - ux*len, b.y - camY - uy*len);
        ctx.lineTo(b.x, b.y - camY);
      });
      ctx.stroke();
      // a white core down the middle of every beam: what makes a phaser look
      // hot rather than merely coloured
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      bullets.forEach(function(b){
        var L = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / L, uy = b.vy / L;
        ctx.moveTo(b.x - ux*9, b.y - camY - uy*9);
        ctx.lineTo(b.x, b.y - camY);
      });
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // Mines. Violet, which is nothing else on this field, and drawn as a ring
    // of spikes rather than a dot so a mine is never read as a pickup. An
    // unarmed one is drawn hollow and dim and its ring is drawn closing in:
    // the fuse is the one thing about this weapon the player has to be able to
    // see, because it is why the mine they just flew over did nothing.
    mines.forEach(function(m){
      var y = m.y - camY;
      var armed = m.arm <= 0;
      var fuse = armed ? 1 : 1 - m.arm / MINE_ARM;
      // the last second of the shelf life blinks, so a rack about to go off on
      // its own is not a surprise
      var dying = m.life < 1.2 && Math.sin(m.life * 26) < 0;
      var pulse = armed && !reduceMotion ? 1 + Math.sin(m.t * 5) * 0.12 : 1;
      ctx.save();
      ctx.globalAlpha = dying ? 0.35 : (armed ? 1 : 0.5);
      ctx.strokeStyle = 'rgba(199,125,255,.9)';
      ctx.lineWidth = 1.6;
      if(armed){ ctx.shadowColor = '#c77dff'; ctx.shadowBlur = 12; }
      var rr = m.r * pulse;
      // six spikes, one path, so the glow is paid for once
      ctx.beginPath();
      for(var k=0;k<6;k++){
        var a = k * Math.PI / 3 + m.t * (reduceMotion ? 0 : 0.5);
        ctx.moveTo(m.x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        ctx.lineTo(m.x + Math.cos(a) * (rr + 4.5), y + Math.sin(a) * (rr + 4.5));
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(m.x, y, rr, 0, Math.PI*2); ctx.stroke();
      if(armed){
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(232,214,255,.95)';
        ctx.beginPath(); ctx.arc(m.x, y, rr * 0.42, 0, Math.PI*2); ctx.fill();
      } else {
        // the arming ring: a hairline that sweeps round as the fuse runs
        ctx.strokeStyle = 'rgba(199,125,255,.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x, y, rr + 7, -Math.PI/2, -Math.PI/2 + Math.PI*2*fuse);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Photon torpedoes: a slow orange core with a tail, so they are never
    // mistaken for a phaser even in a crowded frame.
    torpedoes.forEach(function(tp){
      var y = tp.y - camY;
      var L = Math.hypot(tp.vx, tp.vy) || 1;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,140,60,.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tp.x - tp.vx/L*16, y - tp.vy/L*16);
      ctx.lineTo(tp.x, y);
      ctx.stroke();
      var pulse = 1 + Math.sin(tp.t * 22) * 0.18;
      ctx.shadowColor = '#ff8c3c';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffd9a8';
      ctx.beginPath(); ctx.arc(tp.x, y, tp.r * pulse, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(tp.x, y, tp.r * 0.45, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });

    // The lock. A torpedo that ignores the rock in front of it looks broken
    // unless you can see what it is going for instead, so every held target
    // wears a bracket in the torpedo's own orange. Deduped, because two
    // torpedoes on one warbird should not draw two brackets at double opacity.
    if(torpedoes.length){
      var locked = [];
      for(var li=0;li<torpedoes.length;li++){
        var lt = torpedoes[li].target;
        if(lt && locked.indexOf(lt) === -1) locked.push(lt);
      }
      if(locked.length){
        var spin = reduceMotion ? 0 : gameTime * 1.6;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,140,60,.85)';
        ctx.shadowColor = '#ff8c3c';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        for(var lk=0;lk<locked.length;lk++){
          var o = locked[lk];
          var lr = (o === boss ? bossHitR() : o.r) + 9;
          // one path per corner: arcs sharing a path get joined by a chord
          for(var c=0;c<4;c++){
            var a0 = spin + c * Math.PI/2 - 0.34;
            ctx.beginPath();
            ctx.arc(o.x, o.y - camY, lr, a0, a0 + 0.68);
            ctx.stroke();
          }
        }
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // Detonation shockwaves: two rings, the outer one lagging, which is what
    // sells the blast as a pressure front rather than a circle appearing.
    shockwaves.forEach(function(sw){
      var y = sw.y - camY, a = Math.max(0, sw.life);
      ctx.save();
      ctx.shadowColor = sw.glow || (sw.tint ? '#c77dff' : '#ff2d78');
      ctx.shadowBlur = 16;
      ctx.strokeStyle = 'rgba(' + (sw.tint || '255,45,120') + ',' + (a * 0.85).toFixed(2) + ')';
      ctx.lineWidth = 2.4 * a + 0.6;
      ctx.beginPath(); ctx.arc(sw.x, y, sw.r, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(' + (sw.inner || '255,217,168') + ',' + (a * 0.5).toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sw.x, y, sw.r * 0.72, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    });

    drawWebs(camY);
    drawBeams(camY);
    drawSurges(camY);
    drawParticles(camY);
    drawBlooms(camY);

    // The shake stops here. Red alert is painted on the bezel, and a bezel
    // that slides off its own edge is not a bezel.
    if(shaking) ctx.restore();
    if(redAlert) drawRedAlert();
  }

  function loop(now){
    raf = null;
    if(!active || gameOver) return;   // a late frame must not keep scoring
    if(typeof now !== 'number') now = performance.now();

    var dt = (now - lastFrame) / 1000;
    lastFrame = now;
    // a frame that took longer than a blink means the tab was throttled, the
    // machine slept, or an upgrade card was up — never simulate the gap
    if(!(dt > 0)) dt = 0;
    budget(dt);
    if(dt > 0.05) dt = 0.05;

    // A held frame. It stops the run clock along with the simulation, so the
    // weight it lends a kill is not paid for in score, cooldowns or
    // difficulty. It still paints — which is the entire point, because the
    // frame a dreadnought comes apart on is the one worth looking at.
    if(hitStop > 0){
      hitStop = Math.max(0, hitStop - dt);
      draw();
      raf = requestAnimationFrame(loop);
      return;
    }

    if(!isPaused()){
      gameTime += dt;
      sampleRun();
      update(dt);
    }
    draw();
    if(gameOver) return;              // died this frame: paint it, then stop
    raf = requestAnimationFrame(loop);
  }

  // ── coaching ─────────────────────────────────────────────────────────────
  // The vent was the one system nobody could work out, and the reason was that
  // nothing ever said what had just happened. A gauge labelled CORE filling by
  // five percent when you squeezed past a rock is not an explanation; it is a
  // number moving in the corner while your eyes are somewhere else.
  //
  // So the game says it, once, at the exact moment it first becomes true — and
  // then never again, because a tip that repeats is noise. The ready prompt is
  // the exception: it keeps appearing every time the core fills until the
  // player has actually vented once, on the grounds that a prompt you have
  // never acted on has not yet done its job.
  var taught = {};
  function showTip(html, secs){
    if(!tipEl || !active) return;
    clearTimeout(tipTimer);
    var i = destroyed.indexOf(tipEl);
    if(i !== -1) destroyed.splice(i, 1);
    tipEl.innerHTML = html;
    tipEl.style.transition = 'opacity .2s ease';
    tipEl.style.opacity = '1';
    tipEl.style.pointerEvents = 'none';
    tipTimer = setTimeout(autoHideTip, (secs || 5) * 1000);
  }
  function teach(key, html, secs){
    if(taught[key]) return;
    taught[key] = true;
    showTip(html, secs);
  }

  function autoHideTip(){
    if(!active || destroyed.indexOf(tipEl) !== -1) return;
    destroyed.push(tipEl);
    tipEl.style.transition = 'opacity .6s ease';
    tipEl.style.opacity = '0';
    tipEl.style.pointerEvents = 'none';
  }

  function start(){
    if(active) return;
    active = true;
    destroyed = [];
    gameOver = false;
    levelOpen = false; hailOpen = false;
    if(overEl) overEl.classList.remove('on');
    if(levelEl) levelEl.classList.remove('on');
    if(pauseEl) pauseEl.classList.remove('on');
    if(hailEl) hailEl.classList.remove('on');
    resize();
    // every hull is painted now, while the ship pick is up (see prebakeHulls)
    prebakeHulls();
    resetRun();
    document.body.classList.add('astro-active');
    document.documentElement.style.scrollBehavior = 'auto';
    homeStick();
    openPick();
    if(isCoarse && tipEl) tipEl.innerHTML =
      '<span>drag to steer</span><span>phasers fire automatically</span>' +
      '<span>near misses charge overcharge</span><span>tap release when full</span>';
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', blockClicks, true);
    tipTimer = setTimeout(autoHideTip, 5000);
    lastFrame = performance.now();
    raf = requestAnimationFrame(loop);
    if(document.hidden) autoPause();
  }

  function stop(){
    if(!active) return;
    active = false;
    if(raf) cancelAnimationFrame(raf);
    raf = null;
    clearTimeout(tipTimer);
    levelOpen = false; autoPaused = false; hailOpen = false;
    levelMode = '';
    document.body.classList.remove('astro-active');
    document.body.classList.remove('astro-paused');
    document.body.classList.remove('astro-red-alert');
    document.body.classList.remove('astro-core-ready');
    redAlert = false;
    document.documentElement.style.scrollBehavior = '';
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('click', blockClicks, true);
    keys = {};
    gameOver = false;
    if(overEl) overEl.classList.remove('on');
    if(levelEl) levelEl.classList.remove('on');
    if(pauseEl) pauseEl.classList.remove('on');
    if(hailEl) hailEl.classList.remove('on');
    if(bossBarEl) bossBarEl.classList.remove('on');
    if(warnEl) warnEl.classList.remove('on');
    boss = null; bossWarn = 0; wings = []; contact = null;
    homeStick();
    ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
    destroyed.forEach(function(el){
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
      el.style.pointerEvents = '';
    });
    destroyed = [];
  }

  if(isCoarse) document.documentElement.classList.add('coarse');
  if (avail) avail.addEventListener('click', start);
  exitBtn.addEventListener('click', stop);
  var playLink = document.getElementById('play-game');
  if(playLink) playLink.addEventListener('click', function(e){ e.preventDefault(); start(); });
  var launchBtn = document.getElementById('game-launch');
  if(launchBtn) launchBtn.addEventListener('click', start);

  // B launches, so the game is still reachable with the keyboard alone — the
  // launcher is hidden below 600px and while the game is running. Upgrades no
  // longer have a key of their own: they come to you when the XP rail fills.
  window.addEventListener('keydown', function(e){
    if(active) return;
    if(e.key !== 'b' && e.key !== 'B') return;
    if(e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target.tagName;
    if(t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return;
    e.preventDefault();
    start();
  });
})();
