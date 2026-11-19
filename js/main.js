/* ═══════════════════════════════════════════════════════════
   Studio North — interactions
   Lenis smooth scroll + GSAP/ScrollTrigger
   ═══════════════════════════════════════════════════════════ */

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// pendulum state for the service cards, shared so the arrival
// animation can nudge a card as it lands on the rail
let hangBobs = [];

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ── Smooth scroll ──────────────────────────────────────── */
let lenis = null;

function initSmoothScroll() {
  if (REDUCED) return;

  lenis = new Lenis({
    duration: 1.1,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.6
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollTo(target) {
  if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.2 });
  else target.scrollIntoView({ behavior: 'smooth' });
}

// A shared link like /#work: the loader locks the page and Lenis owns
// the scroll position, so the browser's own jump never lands. Do it
// ourselves once the page is unlocked and the pins are measured.
// It has to run after the LAST ScrollTrigger.refresh() (the one on
// window load): a refresh re-lays the pins and knocks the scroll off.
function jumpToHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (!target || id === 'main') return;

  // measure against the real window scroll: handing Lenis the element
  // makes it add its own (possibly stale) scroll value and overshoot
  const land = () => {
    const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 70);
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  };
  const go = () => {
    ScrollTrigger.refresh();
    requestAnimationFrame(land);
    // pins, fonts and late refreshes can still move or reset the page for
    // a moment after load — re-check a few times and land again if knocked off
    [300, 800, 1500].forEach(ms => setTimeout(() => {
      if (Math.abs(target.getBoundingClientRect().top - 70) > 4) land();
    }, ms));
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

/* ── Text splitting ─────────────────────────────────────── */
// Wraps each character so it can be animated independently.
// Every char sits inside an overflow-hidden mask, which is what
// makes the "letters rise out of nowhere" reveal work.
function splitChars(el) {
  if (el.dataset.split === 'done') return [];
  const chars = [];

  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        [...child.textContent].forEach(c => {
          if (c === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
          const wrap = document.createElement('span');
          wrap.className = 'ch-wrap';
          const inner = document.createElement('span');
          inner.className = 'ch';
          inner.textContent = c;
          wrap.appendChild(inner);
          frag.appendChild(wrap);
          chars.push(inner);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };

  walk(el);
  el.dataset.split = 'done';
  return chars;
}

/* ── Nav: per-character flip on hover ───────────────────── */
function initNavFlip() {
  $$('[data-split]').forEach(link => {
    const text = link.textContent.trim();
    link.textContent = '';
    // each letter is drawn twice for the flip, so screen readers
    // would hear "W W O O R R K K" — give them the word instead
    if (!link.hasAttribute('aria-label')) link.setAttribute('aria-label', text);

    [...text].forEach((c, i) => {
      if (c === ' ') { link.appendChild(document.createTextNode(' ')); return; }

      const wrap  = document.createElement('span');
      wrap.className = 'ch-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      const stack = document.createElement('span');
      stack.className = 'ch-stack';
      stack.style.display = 'block';

      const top = document.createElement('span');
      top.className = 'ch'; top.textContent = c; top.style.display = 'block';
      const bottom = top.cloneNode(true);

      stack.append(top, bottom);
      wrap.appendChild(stack);
      link.appendChild(wrap);

      if (REDUCED) return;

      gsap.set(stack, { y: 0 });
      link.addEventListener('mouseenter', () => {
        gsap.to(stack, { y: '-1em', duration: .42, ease: 'power3.out', delay: i * 0.022 });
      });
      link.addEventListener('mouseleave', () => {
        gsap.to(stack, { y: 0, duration: .42, ease: 'power3.out', delay: i * 0.022 });
      });
    });
  });
}

/* ── Loader ─────────────────────────────────────────────── */
function runLoader() {
  const loader  = $('#loader');
  const numEl   = $('#loaderNum');
  const fill    = $('.loader__fill');
  const curtain = $('.loader__curtain');

  document.body.classList.add('is-loading');

  const finish = () => {
    document.body.classList.remove('is-loading');
    loader.remove();
    ScrollTrigger.refresh();
    animateHero();
    jumpToHash();
  };

  if (REDUCED) { finish(); return; }

  const counter = { v: 0 };
  const tl = gsap.timeline();

  tl.to(counter, {
      v: 100, duration: 1.5, ease: 'power2.inOut',
      onUpdate: () => { numEl.textContent = Math.round(counter.v); }
    })
    .to(fill, { width: '100%', duration: 1.5, ease: 'power2.inOut' }, '<')
    .to('.loader__word, .loader__count, .loader__bar', {
      y: -24, opacity: 0, duration: .5, ease: 'power2.in', stagger: .05
    })
    .to(curtain, { y: '0%', duration: .7, ease: 'power4.inOut' }, '-=.2')
    .to(curtain, { y: '-100%', duration: .8, ease: 'power4.inOut' }, '+=.05')
    .add(finish, '-=.45');
}

/* ── Hero entrance ──────────────────────────────────────── */
function animateHero() {
  const heyChars = $$('.hero__hey [data-chars]').flatMap(splitChars);

  if (REDUCED) {
    gsap.set([heyChars, '.hero__box', '.hero__lede', '.hero__art', '.gold'], { opacity: 1, y: 0 });
    return;
  }

  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.hero__box', { opacity: 0, duration: .5 })
    .from(heyChars,     { yPercent: 118, duration: 1, stagger: .05 }, '-=.2')
    .from('.hero__rule',{ scaleX: 0, transformOrigin: 'left', duration: .7 }, '-=.5')
    .from('.hero__lede',{ y: 20, opacity: 0, duration: .8 }, '-=.45')
    .from('.hero__art', { x: 60, opacity: 0, duration: 1 }, '-=.9')
    .from('.gold',      { y: 24, opacity: 0, duration: .6 }, '-=.5');

  // parallax out
  gsap.to('.hero__stage', {
    y: -70, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });
}

/* ── Neural graphic ─────────────────────────────────────── */
// Layered node graph drawn from data, so it stays crisp at any size
// and can be re-tuned by changing the layer counts alone.
function buildNeuralGraphic() {
  const svg = $('.net');
  if (!svg) return;

  const linkG = $('.net__links', svg);
  const nodeG = $('.net__nodes', svg);
  const layers = [4, 6, 6, 3];
  const x0 = 60, x1 = 400, yMid = 250, spread = 190;

  const pts = layers.map((count, li) => {
    const x = x0 + (x1 - x0) * (li / (layers.length - 1));
    return Array.from({ length: count }, (_, ni) => ({
      x,
      y: yMid + (count === 1 ? 0 : (ni / (count - 1) - .5) * spread * (1 + li * .12))
    }));
  });

  // links first so nodes paint on top
  pts.forEach((layer, li) => {
    if (li === pts.length - 1) return;
    layer.forEach(a => pts[li + 1].forEach(b => {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', a.x); l.setAttribute('y1', a.y);
      l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
      linkG.appendChild(l);
    }));
  });

  pts.flat().forEach((p, i) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    c.setAttribute('r', 9);
    c.dataset.i = i;
    nodeG.appendChild(c);
  });

  if (REDUCED) return;

  // nodes breathe; links draw themselves in
  const lines = $$('line', linkG);
  lines.forEach(l => {
    const len = l.getTotalLength();
    gsap.set(l, { strokeDasharray: len, strokeDashoffset: len });
  });

  gsap.to(lines, {
    strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', stagger: .006,
    scrollTrigger: { trigger: svg, start: 'top 92%' }
  });

  gsap.to($$('circle', nodeG), {
    scale: 1.35, transformOrigin: 'center', duration: 1.1, ease: 'sine.inOut',
    repeat: -1, yoyo: true, stagger: { each: .09, from: 'random' }
  });
}

/* ── Generic scroll reveals ─────────────────────────────── */
function initReveals() {
  if (REDUCED) return;

  // section titles: character stagger as they enter
  $$('.sec-title[data-chars], .contact__title [data-chars]').forEach(el => {
    const chars = splitChars(el);
    gsap.from(chars, {
      yPercent: 115, duration: .9, ease: 'power3.out', stagger: .022,
      scrollTrigger: { trigger: el, start: 'top 88%' }
    });
  });

  // everything tagged data-reveal
  $$('[data-reveal]').forEach(el => {
    gsap.from(el, {
      y: 26, opacity: 0, duration: .85, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%' }
    });
  });

  // work slides fade up in sequence
  gsap.from('.slide', {
    y: 60, opacity: 0, duration: .9, ease: 'power3.out', stagger: .09,
    scrollTrigger: { trigger: '.carousel', start: 'top 78%' }
  });

  // contact rows
  gsap.from('.crow', {
    y: 30, opacity: 0, duration: .8, ease: 'power3.out', stagger: .1,
    scrollTrigger: { trigger: '.contact__rows', start: 'top 85%' }
  });
}

/* ── Marquee tickers ────────────────────────────────────── */
function initMarquees() {
  $$('[data-marquee]').forEach(track => {
    const dir = Number(track.dataset.dir || 1);

    if (REDUCED) return;

    // the markup duplicates its content, so travelling 50% loops seamlessly
    const tween = gsap.to(track, {
      xPercent: -50 * dir,
      duration: 26,
      ease: 'none',
      repeat: -1
    });
    if (dir < 0) gsap.set(track, { xPercent: -50 });

    // scroll direction nudges playback speed — the classic velocity marquee
    ScrollTrigger.create({
      trigger: track,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: self => {
        const v = gsap.utils.clamp(-3, 3, self.getVelocity() / 400);
        gsap.to(tween, { timeScale: 1 + Math.abs(v), duration: .3, overwrite: true });
        gsap.to(tween, { timeScale: 1, duration: .8, delay: .3, overwrite: false });
      }
    });
  });
}

/* ── Work carousel ──────────────────────────────────────── */
function initCarousel() {
  const track = $('#track');
  const slides = $$('.slide', track);
  if (!track || !slides.length) return;

  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');
  const curEl   = $('#cur');
  const progEl  = $('#prog');

  $('#tot').textContent = slides.length;

  let index = 0;

  const perView = () => {
    const vw = $('.carousel__viewport').clientWidth;
    const sw = slides[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    return Math.max(1, Math.round(vw / (sw + gap)));
  };

  const maxIndex = () => Math.max(0, slides.length - perView());

  function go(i, animate = true) {
    index = gsap.utils.clamp(0, maxIndex(), i);

    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    const step = slides[0].getBoundingClientRect().width + gap;
    const x = -index * step;

    gsap.to(track, {
      x, duration: animate && !REDUCED ? .85 : 0, ease: 'power3.inOut'
    });

    curEl.textContent = index + 1;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === maxIndex();

    const pct = ((index + perView()) / slides.length) * 100;
    progEl.style.width = `${Math.min(100, pct)}%`;
  }

  prevBtn.addEventListener('click', () => go(index - 1));
  nextBtn.addEventListener('click', () => go(index + 1));

  // keyboard
  $('#carousel').addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  });

  // pointer drag
  let startX = 0, dragging = false;
  track.addEventListener('pointerdown', e => {
    dragging = true; startX = e.clientX; track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1));
  });

  window.addEventListener('resize', () => go(index, false));
  go(0, false);
}

/* ── Services: pinned horizontal scroll ─────────────────── */
function initServicesScroller() {
  const track = $('#svcTrack');
  const section = $('.services');
  if (!track || !section) return;

  // below 820px the track is a native horizontal scroller instead
  const mm = gsap.matchMedia();

  // Pinning the viewport to move the row a few dozen pixels reads as a
  // stutter, not a scroll. On a wide screen the row nearly fits already,
  // so below this much overhang we skip the pin and let it scroll normally.
  const MIN_TRAVEL = 260;

  mm.add('(min-width: 821px)', () => {
    // NB: don't read --gutter here — a custom property computes to an
    // unresolved token stream (clamp(...)), so parseFloat gives NaN.
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    let tween = null;

    const build = () => {
      if (tween) {
        if (tween.scrollTrigger) tween.scrollTrigger.kill();
        tween.kill();
        tween = null;
      }
      gsap.set(track, { x: 0 });

      const d = distance();
      const tooShort = d < MIN_TRAVEL;
      section.classList.toggle('is-static', tooShort);
      if (tooShort) return;                 // row already fits — nothing to scrub

      tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => '+=' + distance(),
          pin: '.services__pin',
          scrub: REDUCED ? true : 1,
          anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });
    };

    build();

    // width changes flip us between pinned and static
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(build, 180); };
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
      if (tween) {
        if (tween.scrollTrigger) tween.scrollTrigger.kill();
        tween.kill();
      }
      section.classList.remove('is-static');
    };
  });
}

/* ── Header behaviour ───────────────────────────────────── */
function initHeader() {
  const header = $('#header');
  let last = 0;

  ScrollTrigger.create({
    start: 'top -10',
    onUpdate: self => {
      const y = self.scroll();
      header.classList.toggle('is-stuck', y > 10);
      // hide on scroll down, reveal on scroll up
      header.classList.toggle('is-hidden', y > last && y > 320);
      last = y;
    }
  });

  // anchor links → smooth scroll
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      closeMobileNav();
      scrollTo(target);
      if (id !== '#main') history.replaceState(null, '', id);
    });
  });

  $('#toTop').addEventListener('click', () => {
    lenis ? lenis.scrollTo(0, { duration: 1.4 }) : window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ── Mobile nav ─────────────────────────────────────────── */
function closeMobileNav() {
  const nav = $('#mobileNav'), burger = $('#burger');
  nav.classList.remove('is-open');
  nav.setAttribute('inert', '');
  burger.setAttribute('aria-expanded', 'false');
}

function initMobileNav() {
  const nav = $('#mobileNav'), burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    if (open) { closeMobileNav(); return; }
    nav.classList.add('is-open');
    nav.removeAttribute('inert');
    burger.setAttribute('aria-expanded', 'true');
  });
}

/* ── Light / dark toggle ────────────────────────────────── */
function initModeToggle() {
  const btn = $('#modeBtn');
  // blue is the default ground; the switch releases the gold one.
  // applyMode also drives the butterfly + dust (see GOLD MODE below).
  applyMode(localStorage.getItem('pp-mode') || 'default');

  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.mode === 'gold' ? 'default' : 'gold';
    applyMode(next);
    localStorage.setItem('pp-mode', next);
  });
}

/* ── Custom cursor ──────────────────────────────────────── */
function initCursor() {
  const cursor = $('#cursor');
  if (!cursor || REDUCED || window.matchMedia('(pointer: coarse)').matches) return;

  const dot  = $('.cursor__dot');
  const ring = $('.cursor__ring');

  const xTo  = gsap.quickTo(dot,  'x', { duration: .12, ease: 'power3' });
  const yTo  = gsap.quickTo(dot,  'y', { duration: .12, ease: 'power3' });
  const xTo2 = gsap.quickTo(ring, 'x', { duration: .45, ease: 'power3' });
  const yTo2 = gsap.quickTo(ring, 'y', { duration: .45, ease: 'power3' });

  window.addEventListener('pointermove', e => {
    xTo(e.clientX); yTo(e.clientY); xTo2(e.clientX); yTo2(e.clientY);
  });

  // a[href] not a: the three media panels with no destination are divs
  // now, and an element you cannot click must not arm the hot cursor
  $$('a[href], button, .card').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('is-hot'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('is-hot'));
  });
}

/* ═══════════════════════════════════════════════════════════
   3D LAYER
   ═══════════════════════════════════════════════════════════ */

/* ── Pointer tilt ───────────────────────────────────────── */
// Cards and tiles rotate toward the cursor. Rotation is derived from
// the pointer's position within the element's own box, so it reads as
// one solid object turning rather than a flat image being skewed.
function initTilt() {
  if (REDUCED || window.matchMedia('(pointer: coarse)').matches) return;

  const targets = [
    { els: $$('.card'),         max: 11, lift: -10, scale: 1.03 },
    { els: $$('.slide__media'), max: 8,  lift: -6,  scale: 1.02 }
  ];

  targets.forEach(({ els, max, lift, scale }) => {
    els.forEach(el => {
      // continuous tracking → quickTo (built for per-frame updates)
      const rX = gsap.quickTo(el, 'rotationX', { duration: .5, ease: 'power3' });
      const rY = gsap.quickTo(el, 'rotationY', { duration: .5, ease: 'power3' });

      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;   // 0 → 1
        const py = (e.clientY - r.top) / r.height;

        rY(gsap.utils.mapRange(0, 1, -max, max, px));
        rX(gsap.utils.mapRange(0, 1, max, -max, py));

        // move the sheen with the pointer
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
      });

      // discrete state change → a plain tween
      el.addEventListener('pointerenter', () => {
        gsap.to(el, { y: lift, scale, duration: .5, ease: 'power3', overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', () => {
        rX(0); rY(0);
        gsap.to(el, { y: 0, scale: 1, duration: .5, ease: 'power3', overwrite: 'auto' });
      });
    });
  });
}

/* ── Depth carousel ─────────────────────────────────────── */
// Each slide's rotation and Z-offset come from how far its centre sits
// from the viewport centre, so the row reads as a shallow arc.
function initDepthCarousel() {
  const viewport = $('.carousel__viewport');
  const slides = $$('.slide');
  if (!viewport || !slides.length || REDUCED) return;

  const setters = slides.map(s => ({
    el: s,
    rotY: gsap.quickSetter(s, 'rotationY', 'deg'),
    z:    gsap.quickSetter(s, 'z', 'px'),
    op:   gsap.quickSetter(s, 'opacity')
  }));

  function update() {
    const mid = window.innerWidth / 2;

    setters.forEach(({ el, rotY, z, op }) => {
      const r = el.getBoundingClientRect();
      const centre = r.left + r.width / 2;
      const d = gsap.utils.clamp(-1, 1, (centre - mid) / mid); // -1 → 1

      rotY(-d * 16);
      z(-Math.abs(d) * 190);
      op(1 - Math.abs(d) * 0.35);
    });
  }

  gsap.ticker.add(update);
  ScrollTrigger.addEventListener('refresh', update);
  update();
}

/* ── Scroll-velocity skew ───────────────────────────────── */
// Fast scrolling bends the work row slightly; it settles back to flat.
function initScrollSkew() {
  if (REDUCED) return;

  const track = $('#track');
  if (!track) return;

  const skewTo = gsap.quickTo(track, 'skewY', { duration: .5, ease: 'power3' });
  let resetId;

  ScrollTrigger.create({
    onUpdate: self => {
      const skew = gsap.utils.clamp(-6, 6, self.getVelocity() / -320);
      skewTo(skew);
      clearTimeout(resetId);
      resetId = setTimeout(() => skewTo(0), 90);
    }
  });
}

/* ── Hero depth parallax ────────────────────────────────── */
// The colour blocks sit on their own Z plane and drift at a different
// rate from the type, which is what sells the depth.
function initHeroDepth() {
  const grid = $('.hero__sky');
  if (!grid || REDUCED) return;

  gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }
  })
  .to(grid, { yPercent: 22, z: -240, ease: 'none' }, 0);

  // gentle pointer drift, independent of scroll
  const xTo = gsap.quickTo(grid, 'xPercent', { duration: 1.4, ease: 'power3' });
  window.addEventListener('pointermove', e => {
    xTo(gsap.utils.mapRange(0, window.innerWidth, -2.5, 2.5, e.clientX));
  });
}

/* ── Scoreboard flip ────────────────────────────────────── */
function initBoardFlip() {
  const digits = $$('.board__score b');
  if (!digits.length || REDUCED) return;

  gsap.from(digits, {
    rotationX: -92,
    y: 40,
    opacity: 0,
    duration: 1,
    ease: 'back.out(1.6)',
    stagger: .14,
    scrollTrigger: { trigger: '.board', start: 'top 82%' }
  });
}

/* ── Card entrance in 3D ────────────────────────────────── */
function initCardEntrance() {
  if (REDUCED) return;

  const cards = $$('.card');
  if (!cards.length) return;

  // Cards arrive one at a time as you scroll, each dropping onto its
  // hook. Scrubbed rather than fired once, so scrolling back lifts them
  // off again. Only y / opacity / scale are touched here — rotation
  // belongs to initHangingCards and the two must not both write it.
  const drop = gsap.timeline({
    scrollTrigger: {
      trigger: '.services',
      // the full run from the section entering view to it reaching the
      // top — a whole viewport of scroll instead of ~500px, and it ends
      // exactly where the horizontal pin takes over
      start: 'top bottom',
      end: 'top top',
      scrub: 1.2                         // extra lag so it trails the wheel
    }
  });

  const STEP = 0.9;                      // less overlap = one lands before
                                         // the next starts falling

  cards.forEach((card, i) => {
    drop.fromTo(card,
      { y: -170, opacity: 0, scale: .94 },
      { y: 0, opacity: 1, scale: 1, duration: 1, ease: 'power2.out' },
      i * STEP
    );
  });

  // as each one lands, shove its pendulum so it settles with a swing
  cards.forEach((card, i) => {
    ScrollTrigger.create({
      trigger: card,
      start: 'top 72%',
      onEnter:     () => { if (hangBobs[i]) hangBobs[i].vel += 1.15; },
      onEnterBack: () => { if (hangBobs[i]) hangBobs[i].vel -= 0.8; }
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   GOLD MODE → BUTTERFLY + DUST
   The GOLD switch is the trigger. Turning it on releases the
   butterfly, which wanders the viewport trailing gold dust.
   Turning it off recalls it and lets the dust settle.
   No scroll involvement — the switch owns this entirely.
   ═══════════════════════════════════════════════════════════ */

let goldFX = null;

/* single entry point for a mode change, shared by the switch
   and by the restore-from-localStorage path */
function applyMode(mode) {
  const btn = $('#modeBtn');
  document.documentElement.dataset.mode = mode;
  if (btn) {
    btn.setAttribute('aria-pressed', String(mode === 'gold'));
    btn.setAttribute('aria-label', mode === 'gold' ? 'Switch to default mode' : 'Switch to gold mode');
  }
  if (goldFX) mode === 'gold' ? goldFX.release() : goldFX.recall();
}

function initGoldButterfly() {
  const bf = $('#butterfly');
  if (!bf || REDUCED) return;

  /* ── gold dust canvas ─────────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'goldDust';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let dust = [], emitting = false, raf = null;

  function size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = innerWidth  * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width  = innerWidth  + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener('resize', size);

  function spawn(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 18;
      dust.push({
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        vx: (Math.random() - .5) * .55,
        vy: Math.random() * .55 + .12,      // settles downward
        r:  Math.random() * 1.9 + .5,
        life: 1,
        decay: Math.random() * .011 + .004,
        tw: Math.random() * Math.PI * 2     // twinkle phase
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    if (emitting) {
      const b = bf.getBoundingClientRect();
      spawn(b.left + b.width / 2, b.top + b.height / 2, 3);
    }

    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += .006;                          // gentle gravity
      p.tw += .17;
      p.life -= p.decay;
      if (p.life <= 0) { dust.splice(i, 1); continue; }

      const a = p.life * (.5 + .5 * Math.sin(p.tw));
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,226,140,' + a.toFixed(3) + ')';
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }

    // keep running while emitting, or until the last speck dies
    if (emitting || dust.length) raf = requestAnimationFrame(frame);
    else { raf = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  const runFrames = () => { if (!raf) raf = requestAnimationFrame(frame); };

  /* ── wing flap — always running, it costs nothing while hidden ── */
  gsap.to('.bf__side--l', { scaleX: .18, duration: .17, repeat: -1, yoyo: true,
                            ease: 'sine.inOut', transformOrigin: '100% 50%' });
  gsap.to('.bf__side--r', { scaleX: .18, duration: .17, repeat: -1, yoyo: true,
                            ease: 'sine.inOut', transformOrigin: '0% 50%' });

  /* ── wandering flight ─────────────────────────────────── */
  let flight = null;

  const waypoints = () => {
    const w = innerWidth, h = innerHeight;
    return [
      [w * .26, h * .30], [w * .48, h * .52], [w * .70, h * .26],
      [w * .54, h * .46], [w * .32, h * .58], [w * .42, h * .28]
    ];
  };

  function startFlight() {
    if (flight) flight.kill();
    const pts = waypoints();
    const last = pts[pts.length - 1];
    gsap.set(bf, { x: last[0], y: last[1] });

    flight = gsap.timeline({ repeat: -1, defaults: { ease: 'sine.inOut' } });
    pts.forEach(([x, y]) => {
      flight.to(bf, {
        x, y,
        rotation: gsap.utils.random(-13, 13),
        duration: gsap.utils.random(2.1, 3.4)
      });
    });
  }

  goldFX = {
    release() {
      startFlight();
      emitting = true;
      runFrames();
      gsap.to(bf, { opacity: 1, scale: 1, duration: .55, ease: 'back.out(1.7)' });
      bf.style.setProperty('--bloom', '1');
    },
    recall() {
      emitting = false;                      // stop adding; let the rest fall
      gsap.to(bf, {
        opacity: 0, scale: .6, duration: .45, ease: 'power2.in',
        onComplete: () => { if (flight) flight.kill(); }
      });
      bf.style.setProperty('--bloom', '0');
    }
  };

  gsap.set(bf, { opacity: 0, scale: .6, transformOrigin: '50% 50%' });

  // a gold choice restored from localStorage ran before goldFX existed
  if (document.documentElement.dataset.mode === 'gold') goldFX.release();
}
/* ── Boot ───────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initNavFlip();
  initHeader();
  initMobileNav();
  initModeToggle();
  initCursor();
  initArtifact();
  initWorkGallery();
  initHangingCards();
  initAboutTimeline();
  initAboutMotion();
  initServicesScroller();
  initMarquees();
  initReveals();

  // 3D layer
  initTilt();
  initHeroDepth();
  initBoardFlip();
  initCardEntrance();
  initGoldButterfly();

  runLoader();

  window.addEventListener('load', () => ScrollTrigger.refresh());
});


/* ═══════════════════════════════════════════════════════════
   WORK GALLERY
   The section pins and the row travels sideways with scroll.
   The arrows don't move the row directly — they animate the
   PAGE to the scroll position that shows the target slide, so
   a click and a scroll produce the same motion and can never
   disagree about where the row is.
   ═══════════════════════════════════════════════════════════ */
function initWorkGallery() {
  const section  = $('.work');
  const viewport = $('.carousel__viewport');
  const track    = $('#track');
  const slides   = $$('.slide', track || document);
  if (!section || !track || !slides.length) return;

  const cur  = $('#cur');
  const tot  = $('#tot');
  const prog = $('#prog');
  const prev = $('#prevBtn');
  const next = $('#nextBtn');
  if (tot) tot.textContent = slides.length;

  let index = 0;                                   // 0-based active slide

  const report = p => {
    index = Math.min(slides.length - 1, Math.floor(p * slides.length));
    if (prog) prog.style.width = (p * 100).toFixed(1) + '%';
    if (cur)  cur.textContent  = index + 1;
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === slides.length - 1;
  };

  const mm = gsap.matchMedia();

  /* desktop — pinned horizontal scrub */
  mm.add('(min-width: 821px)', () => {
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 96);

    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + distance(),
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: self => report(self.progress)
      }
    });

    const st = tween.scrollTrigger;

    // land mid-slide so the counter reads the one you asked for
    const goTo = i => {
      const target = gsap.utils.clamp(0, slides.length - 1, i);
      // the ends go all the way, or the last card stays half off-screen
      const p = target === 0 ? 0
              : target === slides.length - 1 ? 1
              : (target + 0.5) / slides.length;
      const y = st.start + p * (st.end - st.start);
      if (lenis) lenis.scrollTo(y, { duration: 1.15 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    };

    const onPrev = () => goTo(index - 1);
    const onNext = () => goTo(index + 1);
    if (prev) prev.addEventListener('click', onPrev);
    if (next) next.addEventListener('click', onNext);

    const onKey = e => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); onPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); onNext(); }
    };
    section.addEventListener('keydown', onKey);

    report(0);
    return () => {
      if (prev) prev.removeEventListener('click', onPrev);
      if (next) next.removeEventListener('click', onNext);
      section.removeEventListener('keydown', onKey);
      if (st) st.kill();
      gsap.set(track, { x: 0 });
    };
  });

  /* mobile — native snap scroller, arrows nudge it one card */
  mm.add('(max-width: 820px)', () => {
    const onScroll = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      report(max > 0 ? viewport.scrollLeft / max : 0);
    };
    const step = dir => {
      const w = slides[0].getBoundingClientRect().width +
                (parseFloat(getComputedStyle(track).gap) || 0);
      viewport.scrollBy({ left: dir * w, behavior: 'smooth' });
    };
    const onPrev = () => step(-1);
    const onNext = () => step(1);

    viewport.addEventListener('scroll', onScroll, { passive: true });
    if (prev) prev.addEventListener('click', onPrev);
    if (next) next.addEventListener('click', onNext);
    onScroll();

    return () => {
      viewport.removeEventListener('scroll', onScroll);
      if (prev) prev.removeEventListener('click', onPrev);
      if (next) next.removeEventListener('click', onNext);
    };
  });
}

/* ═══════════════════════════════════════════════════════════
   HANGING SERVICE CARDS
   Each card is a damped pendulum on the wire. The rail is fixed
   and the cards slide along it, so what swings them is the
   ACCELERATION of the row, not its position — start moving and
   they lag behind, stop and they overshoot before settling.
   Slightly different stiffness per card keeps them out of sync,
   the way real hangers never swing together.
   ═══════════════════════════════════════════════════════════ */
function initHangingCards() {
  const track = $('#svcTrack');
  if (!track || REDUCED) return;

  const cards = $$('.card', track);
  if (!cards.length) return;

  // give every card a hanger, and put the rail exactly on the pivot line.
  // measuring beats a hard-coded % — the previous wire sat behind the black
  // card tops, so nothing looked attached to anything.
  cards.forEach(c => {
    if (!c.querySelector('.card__hook')) {
      const hook = document.createElement('span');
      hook.className = 'card__hook';
      hook.setAttribute('aria-hidden', 'true');
      c.appendChild(hook);
    }
  });

  const wire = $('.services__wire');
  const pin  = $('.services__pin');
  const placeWire = () => {
    if (!wire || !pin) return;
    const c = cards[0].getBoundingClientRect();
    const p = pin.getBoundingClientRect();
    const th = wire.offsetHeight || 3;
    // the arrival animation parks the cards ~170px above their resting
    // place, so the raw rect is wrong at init — subtract the transform to
    // get where the card will actually hang
    const dy = Number(gsap.getProperty(cards[0], 'y')) || 0;
    wire.style.top = Math.round(c.top - p.top - dy - 20 - th / 2) + 'px';
  };
  placeWire();
  window.addEventListener('resize', placeWire);
  ScrollTrigger.addEventListener('refresh', placeWire);
  window.addEventListener('load', placeWire);

  const MAX     = 13;      // degrees, keeps text readable at full swing
  const COUPLE  = 0.34;    // how hard rail acceleration kicks the card
  const REST    = 0.0015;  // below this it is parked, not animated

  const G = 0.6180339887;                              // golden ratio, used to
                                                       // spread every constant
  const bobs = hangBobs = cards.map((el, i) => ({
    set:   gsap.quickSetter(el, 'rotation', 'deg'),   // through GSAP so it
    angle: 0,                                          // composes with the
    vel:   0,                                          // hover tilt + entrance
    // golden-ratio spread: every card gets its own period with no
    // repeats, so six hangers never pair up the way i%4 did
    k:     0.048 + ((i * G) % 1) * 0.016,
    d:     0.034,                                      // light enough to
                                                       // overshoot vertical
    // ambient air: each card drifts on its own clock so they are never
    // in step, the way washing on a line never swings together
    phase: (i * 2.399) % 6.2832,
    w:     0.52 + ((i * G * 3) % 1) * 0.34,            // rad/s — ~8-12s cycle
    amp:   2.6  + ((i * G * 7) % 1) * 2.4              // degrees of drift
  }));

  // desktop: GSAP moves the track. mobile: the track scrolls natively.
  const railX = () => {
    const x = gsap.getProperty(track, 'x');
    return (typeof x === 'number' && x !== 0) ? x : -track.scrollLeft;
  };

  let lastX = railX(), lastV = 0;

  gsap.ticker.add(() => {
    const x = railX();
    const v = x - lastX;          // rail velocity, px/frame
    const a = v - lastV;          // rail acceleration
    lastX = x; lastV = v;

    // a slow shared gust on top of each card's own drift, so they
    // sometimes lean together and sometimes fight each other
    const now  = performance.now() / 1000;
    const gust = Math.sin(now * 0.21) * 2.1 + Math.sin(now * 0.37 + 1.3) * 1.05;

    for (const b of bobs) {
      // spring back to vertical, damp, and get kicked by the rail
      b.vel  += (-b.k * b.angle) - (b.d * b.vel) - (a * COUPLE);
      b.angle = gsap.utils.clamp(-MAX, MAX, b.angle + b.vel);

      if (Math.abs(b.angle) < REST && Math.abs(b.vel) < REST) {
        b.angle = 0; b.vel = 0;   // physics settled — ambient drift continues
      }

      // rendered angle = reaction to the rail + constant air movement
      const breeze = Math.sin(now * b.w + b.phase) * b.amp + gust * 0.6;
      b.set(b.angle + breeze);
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   ABOUT TIMELINE
   The rail fills as you scroll past it, and each milestone
   arrives as its dot is reached — so the line reads as a
   progress bar through the story rather than decoration.
   ═══════════════════════════════════════════════════════════ */
function initAboutTimeline() {
  const tl = $('#timeline');
  if (!tl) return;

  const fill  = $('.tl__fill', tl);
  const items = $$('.mile', tl);

  if (REDUCED) { gsap.set(fill, { scaleY: 1 }); return; }

  // rail draws in step with scroll position
  gsap.fromTo(fill, { scaleY: 0 }, {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: tl, start: 'top 78%', end: 'bottom 70%', scrub: .6 }
  });

  items.forEach((item, i) => {
    const st = { trigger: item, start: 'top 86%' };

    // the panel wipes open from the rail side rather than just fading
    gsap.fromTo(item,
      { clipPath: 'inset(0 100% 0 0)', x: -26, opacity: 0 },
      { clipPath: 'inset(0 0% 0 0)', x: 0, opacity: 1,
        duration: .85, ease: 'power3.out', scrollTrigger: st });

    // the code letters rise out of the dark strip once it is open
    const code = $('.mile__code', item);
    if (code) gsap.from(code, {
      yPercent: 110, duration: .6, ease: 'power3.out', delay: .18, scrollTrigger: st
    });

    // tags pop in after, staggered
    gsap.from($$('.mile__tags li', item), {
      y: 10, opacity: 0, scale: .9, duration: .4, ease: 'back.out(2)',
      stagger: .06, delay: .3, scrollTrigger: st
    });

    gsap.from($('.tl__dot', item), {
      scale: 0, duration: .55, ease: 'back.out(2.6)', scrollTrigger: st
    });
  });

  // toolkit chips arrive as a wave
  // fade + scale only: the idle drift below owns the vertical motion, and
  // two tweens on `y` left chips stuck at 92% and 20px out of line
  gsap.from($$('.roster li'), {
    opacity: 0, scale: .92, duration: .45, ease: 'back.out(1.8)',
    stagger: { each: .035, from: 'start' },
    scrollTrigger: { trigger: '.roster', start: 'top 88%', once: true }
  });
}

/* ═══════════════════════════════════════════════════════════
   HERO ARTIFACT
   A real wireframe solid — icosahedron subdivided once (42
   vertices, 120 edges) — projected by hand and rotated. Depth
   drives line weight, node size and brightness, so it reads as
   a solid turning in space rather than a flat drawing. Scroll
   spins it and pushes the shell outward; the core counter-rotates.
   ═══════════════════════════════════════════════════════════ */
function initArtifact() {
  const cv = $('#artifact');
  if (!cv) return;
  const ctx = cv.getContext('2d');

  /* ── geometry ──────────────────────────────────────────── */
  const T = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1,T,0],[1,T,0],[-1,-T,0],[1,-T,0], [0,-1,T],[0,1,T],[0,-1,-T],[0,1,-T],
    [T,0,-1],[T,0,1],[-T,0,-1],[-T,0,1]
  ];
  let faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11], [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],     [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
  ];

  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0]/l, v[1]/l, v[2]/l]; };
  verts = verts.map(norm);

  // subdivide once: each face becomes 4, midpoints pushed back onto the sphere
  (() => {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (cache.has(key)) return cache.get(key);
      const m = norm([
        (verts[a][0] + verts[b][0]) / 2,
        (verts[a][1] + verts[b][1]) / 2,
        (verts[a][2] + verts[b][2]) / 2
      ]);
      verts.push(m);
      cache.set(key, verts.length - 1);
      return verts.length - 1;
    };
    const out = [];
    faces.forEach(f => {
      const ab = mid(f[0], f[1]), bc = mid(f[1], f[2]), ca = mid(f[2], f[0]);
      out.push([f[0], ab, ca], [f[1], bc, ab], [f[2], ca, bc], [ab, bc, ca]);
    });
    faces = out;
  })();

  const edges = (() => {
    const seen = new Set(), out = [];
    faces.forEach(f => [[f[0],f[1]],[f[1],f[2]],[f[2],f[0]]].forEach(pair => {
      const a = pair[0], b = pair[1];
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (!seen.has(key)) { seen.add(key); out.push([a, b]); }
    }));
    return out;
  })();

  // inner core: a cube, turning the other way
  const core = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(norm);
  const coreEdges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];

  // vertices that carry a HUD readout
  const tags = [
    { v: 0,  lines: ['DATA STREAM [OK]', 'MODEL: GEMINI', 'LAYER: 3/5'] },
    { v: 14, lines: ['STATUS: OPTIMIZED', 'TOKENS: 4.2K'] },
    { v: 27, lines: ['AGENT: ACTIVE', 'RAG: ONLINE'] }
  ];

  /* ── state ─────────────────────────────────────────────── */
  let W = 0, H = 0, R = 160, rx = -0.35, ry = 0.6, scrollSpin = 0, burst = 0;
  const pointer = { x: 0, y: 0, on: false };

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(r.width); H = Math.round(r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.30;
  }

  // rotate around Y then X, then divide for perspective
  function project(v, ax, ay, radius) {
    const cy = Math.cos(ay), sy = Math.sin(ay);
    const x1 =  v[0] * cy + v[2] * sy;
    const z1 = -v[0] * sy + v[2] * cy;
    const cx = Math.cos(ax), sx = Math.sin(ax);
    const y1 = v[1] * cx - z1 * sx;
    const z2 = v[1] * sx + z1 * cx;
    const k  = 2.6 / (2.6 + z2);
    return { x: W / 2 + x1 * radius * k, y: H / 2 + y1 * radius * k, z: z2 };
  }

  function frame() {
    if (!W) { resize(); if (!W) return; }

    const css  = getComputedStyle(document.documentElement);
    const ink  = css.getPropertyValue('--ink').trim()   || '#0a0a0a';
    const glow = css.getPropertyValue('--paper').trim() || '#ffffff';

    ctx.clearRect(0, 0, W, H);

    const ay = ry + scrollSpin + (pointer.on ? pointer.x * 0.25 : 0);
    const ax = rx + (pointer.on ? pointer.y * 0.18 : 0);
    const shell = R * (1 + burst * 0.28);

    // shell edges — far ones thinner and fainter
    const P = verts.map(v => project(v, ax, ay, shell));
    edges.forEach(e => {
      const p = P[e[0]], q = P[e[1]];
      const near = 1 - ((p.z + q.z) / 2 + 1) / 2;      // 1 near, 0 far
      ctx.globalAlpha = 0.12 + near * 0.5;
      ctx.lineWidth   = 0.4 + near * 1.1;
      ctx.strokeStyle = ink;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    });

    // core, counter-rotating
    const C = core.map(v => project(v, ax * -0.7, -ay * 1.5, R * 0.34));
    ctx.globalAlpha = 0.85; ctx.lineWidth = 1.6; ctx.strokeStyle = ink;
    coreEdges.forEach(e => {
      ctx.beginPath(); ctx.moveTo(C[e[0]].x, C[e[0]].y); ctx.lineTo(C[e[1]].x, C[e[1]].y); ctx.stroke();
    });

    // nodes, painted back to front
    const now = performance.now() / 1000;
    const order = P.map((p, i) => ({ p: p, i: i })).sort((m, n) => n.p.z - m.p.z);
    order.forEach(o => {
      const p = o.p, i = o.i;
      const near = 1 - (p.z + 1) / 2;
      const lit = i % 7 === 0;
      const pulse = 0.5 + 0.5 * Math.sin(now * 1.6 + i);
      const r = (1.6 + near * 3.4) * (lit ? 1 + pulse * 0.5 : 1);

      if (lit) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
        g.addColorStop(0, glow);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = (0.25 + near * 0.5) * (0.5 + pulse * 0.5);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 5, 0, 6.2832); ctx.fill();
      }

      ctx.globalAlpha = 0.35 + near * 0.65;
      ctx.fillStyle = lit ? glow : ink;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
      if (lit) { ctx.globalAlpha = 0.9; ctx.lineWidth = 1; ctx.strokeStyle = ink; ctx.stroke(); }
    });

    // HUD readouts, only while their vertex faces us
    ctx.font = '500 9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    tags.forEach(tag => {
      const p = P[tag.v];
      if (!p || p.z > 0.15) return;
      const fade = Math.max(0, Math.min(1, (0.15 - p.z) * 2));
      const dir = p.x > W / 2 ? 1 : -1;
      const lx = p.x + dir * 26, ly = p.y - 14;

      ctx.globalAlpha = fade * 0.75;
      ctx.strokeStyle = ink; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y); ctx.lineTo(lx, ly); ctx.lineTo(lx + dir * 52, ly);
      ctx.stroke();

      ctx.globalAlpha = fade;
      ctx.fillStyle = ink;
      ctx.textAlign = dir > 0 ? 'left' : 'right';
      tag.lines.forEach((line, li) => ctx.fillText(line, lx + dir * 6, ly + 12 + li * 11));
    });

    ctx.globalAlpha = 1;
    if (!REDUCED) ry += 0.0022;                        // idle drift
  }

  /* ── wiring ────────────────────────────────────────────── */
  resize();
  window.addEventListener('resize', resize);

  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    pointer.x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    pointer.y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    pointer.on = true;
  }, { passive: true });
  cv.addEventListener('pointerleave', () => { pointer.on = false; });

  if (REDUCED) { frame(); return; }

  gsap.ticker.add(frame);

  // scroll spins it and pushes the shell outward
  ScrollTrigger.create({
    trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1,
    onUpdate: self => { scrollSpin = self.progress * Math.PI * 1.1; burst = self.progress; }
  });
}

/* ═══════════════════════════════════════════════════════════
   ABOUT MOTION
   The entrance animations fire once and then the section is
   dead. These three run continuously off scroll position:
   the two columns drift at different rates, the milestone you
   are level with lights up, and the bio text brightens word by
   word as it passes the reading line.
   ═══════════════════════════════════════════════════════════ */
function initAboutMotion() {
  const about = $('.about');
  if (!about || REDUCED) return;

  /* ── 1. columns drift apart as the section passes ───────── */
  const drift = { trigger: about, start: 'top bottom', end: 'bottom top', scrub: 1 };
  gsap.fromTo('.about__bio',       { y: 60 },  { y: -60, ease: 'none', scrollTrigger: drift });
  gsap.fromTo('.about__col .sec-title', { y: -20 }, { y: 45, ease: 'none', scrollTrigger: drift });

  /* ── 2. the milestone level with you lights up ──────────── */
  $$('.mile', about).forEach(mile => {
    ScrollTrigger.create({
      trigger: mile,
      start: 'top 62%',
      end: 'bottom 42%',
      onToggle: self => mile.classList.toggle('is-active', self.isActive)
    });
  });

  /* ── 3. bio brightens word by word as you read past it ──── */
  $$('.about__bio p').forEach(para => {
    if (para.dataset.words === 'done') return;

    const words = para.textContent.trim().split(/\s+/);
    para.textContent = '';
    const spans = words.map((w, i) => {
      const el = document.createElement('span');
      el.className = 'w';
      el.textContent = w;
      para.appendChild(el);
      if (i < words.length - 1) para.appendChild(document.createTextNode(' '));
      return el;
    });
    para.dataset.words = 'done';

    gsap.fromTo(spans,
      { opacity: .16 },
      { opacity: 1, ease: 'none', stagger: .08,
        scrollTrigger: { trigger: para, start: 'top 82%', end: 'bottom 52%', scrub: .6 } });
  });

  /* ── 4. toolkit chips drift on a slow wave ──────────────── */
  const chips = $$('.roster li');
  chips.forEach((chip, i) => {
    gsap.to(chip, {
      yPercent: -18,                     // its own channel, separate from `y`
      duration: 1.6 + (i % 5) * 0.22,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      delay: (i % 7) * 0.14
    });
  });
}
