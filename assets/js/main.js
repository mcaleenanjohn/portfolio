  const nav = document.getElementById('nav');
  const docEl = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Nav: solid-fill on scroll + rule doubles as a scroll-progress bar.
     Case-study pages (per the Figma template) ship without the fixed nav. */
  if (nav) {
    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle('scrolled', y > 20);
      const max = docEl.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      nav.style.setProperty('--scroll', (pct * 100).toFixed(2) + '%');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* ---------- Mobile nav (hamburger) ----------
     Built from the existing .navlinks rather than duplicated per page. Runs
     before the resume modal below so its [data-resume] query also catches
     the cloned link. */
  (function mobileNav() {
    if (!nav) return;
    const wrap = nav.querySelector('.wrap');
    const navlinks = nav.querySelector('.navlinks');
    if (!wrap || !navlinks) return;

    const burger = document.createElement('button');
    burger.type = 'button';
    burger.className = 'nav-burger';
    burger.setAttribute('aria-label', 'Open menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', 'mobile-nav');
    burger.innerHTML =
      '<svg class="nav-burger__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<line class="nav-burger__line nav-burger__line--top" x1="4" x2="20" y1="6" y2="6"/>' +
        '<line class="nav-burger__line nav-burger__line--mid" x1="4" x2="20" y1="12" y2="12"/>' +
        '<line class="nav-burger__line nav-burger__line--bot" x1="4" x2="20" y1="18" y2="18"/>' +
      '</svg>';
    wrap.appendChild(burger);

    const panel = document.createElement('div');
    panel.className = 'mobile-nav';
    panel.id = 'mobile-nav';
    panel.hidden = true;
    panel.innerHTML = '<div class="mobile-nav__panel"></div>';
    const linksClone = navlinks.cloneNode(true);
    linksClone.className = 'navlinks mobile-nav__links';
    panel.querySelector('.mobile-nav__panel').appendChild(linksClone);
    document.body.appendChild(panel);

    let closeTimer = null;
    let lastFocused = null;

    function open() {
      clearTimeout(closeTimer);
      lastFocused = document.activeElement;
      panel.hidden = false;
      void panel.offsetWidth; // force reflow so the transition runs from the hidden state
      panel.classList.add('is-open');
      burger.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Close menu');
      document.body.classList.add('mobile-nav-open');
      document.addEventListener('keydown', onKeydown);
    }
    function close() {
      panel.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('mobile-nav-open');
      document.removeEventListener('keydown', onKeydown);
      closeTimer = setTimeout(() => { panel.hidden = true; }, 320);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
    function onKeydown(e) {
      if (e.key === 'Escape') close();
    }

    burger.addEventListener('click', () => {
      if (burger.classList.contains('is-open')) close(); else open();
    });
    panel.addEventListener('click', (e) => {
      if (e.target.closest('a')) close();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 760 && burger.classList.contains('is-open')) close();
    });
  })();

  /* Custom "View" cursor over work thumbnails (fine pointers only) */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const cursor = document.createElement('div');
    cursor.className = 'view-cursor';
    cursor.innerHTML = '<div class="view-cursor__inner">View</div>';
    document.body.appendChild(cursor);
    docEl.classList.add('has-view-cursor');

    let tx = window.innerWidth / 2, ty = window.innerHeight / 2, cx = tx, cy = ty;
    const place = () => { cursor.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; };
    window.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      if (reduceMotion) { cx = tx; cy = ty; place(); }
    }, { passive: true });
    if (!reduceMotion) {
      const tick = () => {
        cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
        place();
        requestAnimationFrame(tick);
      };
      tick();
    } else {
      place();
    }

    document.querySelectorAll('.project-tile, .featured .case').forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-active'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
    });
  }

  /* Hero dot-grid: a canvas copy of the CSS texture that the cursor drags through.
     Progressive enhancement — without it the ::before grid stays as the texture. */
  (function heroDots() {
    const hero = document.querySelector('.hero, .cs-hero');
    if (!hero || reduceMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hero-dots';
    canvas.setAttribute('aria-hidden', 'true');
    hero.prepend(canvas);
    hero.classList.add('dots-live');
    const ctx = canvas.getContext('2d');

    const GAP = 20;      // grid spacing (matches the CSS texture)
    const RADIUS = 95;   // cursor influence radius
    const PUSH = 13;     // max repel distance
    const DRAG = 0.22;   // how much of the pointer's motion the dots carry
    const EASE = 0.12;   // spring-back per frame

    let cw = 0, ch = 0, dots = [], raf = null, idle = 0;
    const ptr = { x: -999, y: -999, px: -999, py: -999, vx: 0, vy: 0, on: false };

    function build() {
      const r = hero.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      if (!vw || !r.height) return;
      cw = vw; ch = r.height;   // grid spans the full viewport, not the capped hero
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = GAP; y < ch; y += GAP) {
        for (let x = GAP; x < cw; x += GAP) dots.push({ hx: x, hy: y, x: x, y: y, e: 0 });
      }
      render();
    }

    function render() {
      ctx.clearRect(0, 0, cw, ch);
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (d.e > 0.01) {
          const s = (1.6 + d.e * 1.5) / 2;
          ctx.fillStyle = 'rgba(20,20,20,' + (0.08 + d.e * 0.1).toFixed(3) + ')';
          ctx.fillRect(d.x - s, d.y - s, s * 2, s * 2);
        } else {
          ctx.fillStyle = 'rgba(20,20,20,0.08)';
          ctx.fillRect(d.x - 0.8, d.y - 0.8, 1.6, 1.6);
        }
      }
    }

    function tick() {
      ptr.vx = Math.max(-40, Math.min(40, ptr.x - ptr.px));
      ptr.vy = Math.max(-40, Math.min(40, ptr.y - ptr.py));
      ptr.px = ptr.x; ptr.py = ptr.y;

      let awake = false;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        let tx = d.hx, ty = d.hy, energy = 0;
        if (ptr.on) {
          const dx = d.hx - ptr.x, dy = d.hy - ptr.y;
          const dist = Math.hypot(dx, dy);
          if (dist < RADIUS) {
            const f = (1 - dist / RADIUS);
            const w = f * f;
            const inv = dist || 1;
            tx += (dx / inv) * PUSH * w + ptr.vx * DRAG * w;
            ty += (dy / inv) * PUSH * w + ptr.vy * DRAG * w;
            energy = w;
          }
        }
        d.x += (tx - d.x) * EASE;
        d.y += (ty - d.y) * EASE;
        d.e += (energy - d.e) * EASE;
        if (Math.abs(d.x - d.hx) > 0.06 || Math.abs(d.y - d.hy) > 0.06 || d.e > 0.01) awake = true;
      }
      render();

      if (awake || ptr.on) { idle = 0; raf = requestAnimationFrame(tick); }
      else if (idle++ < 12) { raf = requestAnimationFrame(tick); }
      else { raf = null; }
    }

    window.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) {
        if (ptr.on) { ptr.on = false; if (!raf) raf = requestAnimationFrame(tick); }
        return;
      }
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
      if (!ptr.on) { ptr.px = ptr.x; ptr.py = ptr.y; }
      ptr.on = true;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    window.addEventListener('blur', () => { ptr.on = false; });

    if (window.ResizeObserver) new ResizeObserver(build).observe(hero);
    window.addEventListener('resize', build);
    window.addEventListener('load', build);
    build();
  })();

  /* Scroll-reveal + parallax */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('.reveal').forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: 24 },
        {
          opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%' }
        }
      );
    });

    if (!reduceMotion) {
      const through = (trigger) => ({ trigger: trigger, start: 'top bottom', end: 'bottom top', scrub: true });

      /* Page entrance: the nav settles in first, then the hero intro, the headline
         word by word, and the meta row — each blur-sliding into place on load */
      const navLogo = document.querySelector('nav .logo');
      const navRule = document.querySelector('nav .nav-rule');
      const navLinksWrap = document.querySelector('nav .navlinks');
      const navLinks = document.querySelectorAll('nav .navlinks a');
      const heroIntro = document.querySelector('.hero-intro');
      const heroHead = document.querySelector('.hero .headline');
      const metaRow = document.querySelector('.meta-row');
      const heroMeta = document.querySelectorAll('.meta-row > *');

      const loadTl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.2 });

      if (navLogo) loadTl.fromTo(navLogo,
        { autoAlpha: 0, y: -8, filter: 'blur(6px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9 }, 0);
      if (navRule) loadTl.fromTo(navRule,
        { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.1 }, 0.1);
      if (navLinks.length) {
        gsap.set(navLinksWrap, { autoAlpha: 1 });
        loadTl.fromTo(navLinks,
          { autoAlpha: 0, y: -8, filter: 'blur(6px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.09 }, 0.12);
      }

      if (heroIntro) loadTl.fromTo(heroIntro,
        { autoAlpha: 0, y: 14, filter: 'blur(10px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.15 }, 0.4);

      if (heroHead) {
        const hw = heroHead.textContent.trim().split(/\s+/);
        heroHead.textContent = '';
        hw.forEach((w, i) => {
          const span = document.createElement('span');
          span.className = 'hl-word';
          span.textContent = w;
          heroHead.appendChild(span);
          if (i < hw.length - 1) heroHead.appendChild(document.createTextNode(' '));
        });
        gsap.set(heroHead, { autoAlpha: 1 });
        loadTl.fromTo(heroHead.querySelectorAll('.hl-word'),
          { autoAlpha: 0, y: 18, filter: 'blur(10px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.85, stagger: 0.05 }, 0.75);
      }

      if (heroMeta.length) {
        gsap.set(metaRow, { autoAlpha: 1 });
        loadTl.fromTo(heroMeta,
          { autoAlpha: 0, y: 12, filter: 'blur(8px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.08 }, '>-0.45');
      }

      /* About process list: each row's hairline draws in, then the number
         drifts in from the margin and the copy rises — one small build per row */
      document.querySelectorAll('.process-list .process-step').forEach((step) => {
        const rule = step.previousElementSibling;
        const num = step.querySelector('.process-step__num');
        const body = step.querySelector('.process-step__body');
        const tl = gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 84%' } });
        if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: 'power2.inOut' });
        tl.fromTo(num, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power2.out' }, 0.1);
        tl.fromTo(body, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.16);
      });
      const rules = document.querySelectorAll('.process-rule');
      if (rules.length) gsap.fromTo(rules[rules.length - 1], { scaleX: 0 }, {
        scaleX: 1, duration: 0.55, ease: 'power2.inOut',
        scrollTrigger: { trigger: rules[rules.length - 1], start: 'top 92%' }
      });

      /* About photo counter-drifts against the reading column (yPercent composes with .reveal's y) */
      const photo = document.querySelector('.about-photo');
      if (photo) gsap.fromTo(photo, { yPercent: -10 }, { yPercent: 10, ease: 'none', scrollTrigger: through('.about') });

      /* signature drifts gently behind the About copy */
      const signature = document.querySelector('.about-signature');
      if (signature) gsap.fromTo(signature, { yPercent: -14 }, { yPercent: 16, ease: 'none', scrollTrigger: through('.about') });

      /* Design philosophy: the quote warms up word by word as it scrolls in */
      const phQuote = document.querySelector('.philosophy-quote');
      if (phQuote) {
        const words = phQuote.textContent.trim().split(/\s+/);
        phQuote.textContent = '';
        words.forEach((w, i) => {
          const span = document.createElement('span');
          span.className = 'ph-word';
          span.textContent = w;
          phQuote.appendChild(span);
          if (i < words.length - 1) phQuote.appendChild(document.createTextNode(' '));
        });
        gsap.fromTo(phQuote.querySelectorAll('.ph-word'),
          { opacity: 0.15, filter: 'blur(6px)' },
          {
            opacity: 1, filter: 'blur(0px)', ease: 'power2.out',
            duration: 1, stagger: { each: 0.35 },
            scrollTrigger: { trigger: '.philosophy', start: 'top 88%', end: 'top 22%', scrub: 1.2 }
          }
        );
      }

      /* hero headline lifts away as the hero scrolls out */
      const headline = document.querySelector('.hero .headline');
      if (headline) gsap.to(headline, {
        yPercent: -26, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
    }
  } else {
    document.querySelectorAll('.reveal, .hero-load, .nav-load').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  }

  /* ---------- Resume modal ---------- */
  (function resumeModal() {
    const triggers = document.querySelectorAll('[data-resume]');
    if (!triggers.length) return;

    // resolve the PDF path (and asset prefix) from a nav link so it works from /work/ too
    const pdfHref = triggers[0].getAttribute('href') || 'resume/JohnMcAleenan_Resume2026.pdf';
    const prefix = pdfHref.startsWith('../') ? '../' : '';
    const iconDownload = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>';
    const iconX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    const hbLogo = '<svg viewBox="0 0 15.6 15.6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9.79627 0L11.4024 2.75227L12.9801 0H15.6L12.644 5.08508V7.46961H10.2234V5.08508L7.23899 0.0861887V7.46961H4.78993V4.76906H2.45476V7.46961H0.00569238V0H2.45476V2.70055H4.78993V0H9.80197H9.79627ZM0 8.06718H4.50515C6.33341 8.06718 7.12508 8.60729 7.12508 10.0552C7.12508 10.8194 6.67513 11.4457 5.96889 11.7043C6.72639 11.9341 7.15356 12.5547 7.15356 13.4683C7.15356 14.8875 6.36757 15.6 4.53362 15.6H0V8.07293V8.06718ZM4.8127 10.423C4.8127 9.9116 4.58489 9.65879 4.07799 9.65879H2.33516V11.2217H4.10646C4.58488 11.2217 4.8127 10.9631 4.8127 10.4287V10.423ZM2.33516 12.3823V13.9739H4.16342C4.64184 13.9739 4.86966 13.7211 4.86966 13.1523C4.86966 12.6409 4.64184 12.3881 4.13494 12.3881H2.33516V12.3823ZM7.76867 8.06718H10.2462V11.3883L12.6953 8.06718H15.4804L12.775 11.5319L15.5601 15.5943H12.5757L10.2405 11.9571V15.5943H7.76298V8.06718H7.76867Z" fill="#142127"/></svg>';

    const modal = document.createElement('div');
    modal.className = 'resume-modal';
    modal.id = 'resume-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="resume-modal__scrim" data-close></div>' +
      '<div class="resume-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="resume-modal-title">' +
        '<span class="resume-modal__handle" aria-hidden="true"></span>' +
        '<header class="resume-modal__bar">' +
          '<span class="resume-modal__eyebrow" id="resume-modal-title">Resume</span>' +
          '<div class="resume-modal__actions">' +
            '<a class="resume-modal__download" href="' + pdfHref + '" download>' + iconDownload + 'Download PDF</a>' +
            '<button type="button" class="resume-modal__close" data-close aria-label="Close resume">' + iconX + '</button>' +
          '</div>' +
        '</header>' +
        '<div class="resume-modal__body" tabindex="0">' +
          '<div class="rz-block">' +
            '<div class="rz-block" style="gap:8px">' +
              '<p class="rz-name">John McAleenan</p>' +
              '<p class="rz-role">Senior Product Designer <span class="rz-star">✹</span> Brooklyn, NY</p>' +
            '</div>' +
            '<div class="rz-divider"></div>' +
            '<p class="rz-summary">Senior Product Designer with 10+ years of experience building 0→1 and growth products across AI, SaaS, and complex workflows. I specialize in turning ambiguous problems into simple, scalable experiences and driving alignment across product, engineering, marketing, and research.</p>' +
            '<div class="rz-links">' +
              '<a href="https://www.figma.com/deck/bVEYKmLAo93Wo1Is31jivS" target="_blank" rel="noopener">Portfolio (selected works) ↗</a>' +
              '<a href="https://www.linkedin.com/in/john-mcaleenan-b119338a/" target="_blank" rel="noopener">LinkedIn ↗</a>' +
              '<a class="rz-email" href="mailto:mcaleenandesign@gmail.com">Email: mcaleenandesign@gmail.com</a>' +
            '</div>' +
          '</div>' +

          '<div class="rz-block" style="gap:24px">' +
            '<div class="rz-block"><div class="rz-divider"></div><p class="rz-eyebrow">Experience</p></div>' +

            '<div class="rz-job">' +
              '<div class="rz-job__head"><span class="rz-chip rz-chip--honeybook">' + hbLogo + '</span><p class="rz-job__co">HoneyBook</p></div>' +
              '<div class="rz-job__meta"><p class="rz-job__role">Product Designer → Senior Product Designer</p><p class="rz-job__dates">Nov 2022 – Aug 2026</p></div>' +
              '<ul class="rz-bullets">' +
                '<li><b>Led end-to-end product design across acquisition, onboarding, referrals, templates, AI, and financial products</b>, partnering with Product, Engineering, Marketing, Research, and Data from strategy through launch.</li>' +
                '<li><b>Designed and shipped 0→1 experiences</b> including Template Gallery, Floor Planning, AI onboarding, and integrations with Prismm, Pic-Time, and The Knot.</li>' +
                '<li><b>Led HoneyBook’s marketing site experience</b>, designing 40+ high-conversion landing pages and partnering with growth marketing to establish a scalable system for campaigns and acquisition.</li>' +
                '<li><b>Drove the evolution of HoneyBook’s design system</b>, improving consistency and design velocity across the product while introducing reusable patterns and components.</li>' +
                '<li><b>Led product discovery and design direction for ambiguous, cross-functional problems</b>, facilitating critiques, challenging assumptions, and aligning stakeholders around customer and business needs.</li>' +
                '<li><b>Mentored designers and raised the quality bar for product design</b> through critiques, collaboration, and design leadership across the organization.</li>' +
              '</ul>' +
            '</div>' +

            '<div class="rz-divider"></div>' +

            '<div class="rz-job">' +
              '<div class="rz-job__head"><span class="rz-chip rz-chip--endeavor"><img src="' + prefix + 'assets/images/endeavor-logo.png" alt=""></span><p class="rz-job__co">Endeavor</p></div>' +
              '<div class="rz-job__meta"><p class="rz-job__role">Senior Graphic Designer → Creative Lead → Product Designer</p><p class="rz-job__dates">Aug 2015 – Nov 2022</p></div>' +
              '<ul class="rz-bullets">' +
                '<li>Transitioned from graphic design into product design, leading digital experiences across marketing, product, and brand.</li>' +
                '<li>Joined a new 0→1 product team, helping establish product strategy, design foundations, and reusable systems from the ground up.</li>' +
                '<li>Designed customer-facing products, internal tools, and digital platforms while partnering with executives, product managers, and engineers to shape product direction.</li>' +
              '</ul>' +
            '</div>' +

            '<div class="rz-divider"></div>' +
            '<p class="rz-earlier">↶ Earlier career: 6+ years of experience in graphic design, branding, and digital marketing.</p>' +
          '</div>' +

          '<div class="rz-block">' +
            '<div class="rz-block"><div class="rz-divider"></div><p class="rz-eyebrow">Core expertise</p></div>' +
            '<ul class="rz-list">' +
              '<li>Product Strategy</li><li>0→1 Product Development</li><li>AI Product Design</li><li>Product Discovery</li>' +
              '<li>Growth &amp; Activation</li><li>Design Systems</li><li>Cross-functional Leadership</li><li>Executive Storytelling</li>' +
            '</ul>' +
          '</div>' +

          '<div class="rz-block">' +
            '<div class="rz-block"><div class="rz-divider"></div><p class="rz-eyebrow">AI &amp; Emerging Technologies</p></div>' +
            '<ul class="rz-list">' +
              '<li>AI-native product design</li><li>AI interaction &amp; workflow design</li><li>Rapid AI-assisted prototyping</li><li>Design-to-code workflows</li>' +
              '<li>Prompt engineering</li><li>Working directly in codebases</li><li>Claude Code / Claude Design</li><li>Cursor / ChatGPT / Anthropic tools</li>' +
            '</ul>' +
          '</div>' +

          '<div class="rz-block">' +
            '<div class="rz-block"><div class="rz-divider"></div><p class="rz-eyebrow">Tools</p></div>' +
            '<p class="rz-summary">Figma · FigJam · Claude · Cursor · GitHub · Adobe CC · Webflow</p>' +
          '</div>' +

          '<div class="rz-block">' +
            '<div class="rz-block"><div class="rz-divider"></div><p class="rz-eyebrow">Education</p></div>' +
            '<p class="rz-edu"><strong>Savannah College of Art and Design</strong>BFA, Graphic Design</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    const dialog = modal.querySelector('.resume-modal__dialog');
    const closeBtn = modal.querySelector('.resume-modal__close');
    let lastFocused = null;
    let closeTimer = null;

    const focusables = () => modal.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    function open(e) {
      if (e) e.preventDefault();
      if (modal.classList.contains('is-open')) return;
      clearTimeout(closeTimer);
      lastFocused = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('resume-open');
      // force reflow so the transition runs from the hidden state
      void modal.offsetWidth;
      modal.classList.add('is-open');
      closeBtn.focus();
      document.addEventListener('keydown', onKeydown);
    }

    function close() {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      document.body.classList.remove('resume-open');
      document.removeEventListener('keydown', onKeydown);
      closeTimer = setTimeout(() => { modal.hidden = true; }, 400);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function onKeydown(ev) {
      if (ev.key === 'Escape') { close(); return; }
      if (ev.key === 'Tab') {
        const items = Array.prototype.slice.call(focusables());
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        else if (!modal.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
      }
    }

    triggers.forEach((t) => t.addEventListener('click', open));
    modal.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-close]')) close();
    });
  })();

  /* ---------- Copy-to-clipboard (footer email) ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (e) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (e2) { ok = false; }
      }
      if (!ok) return;
      btn.classList.add('is-copied');
      btn.setAttribute('aria-label', 'Email address copied');
      clearTimeout(btn._copyTimer);
      btn._copyTimer = setTimeout(() => {
        btn.classList.remove('is-copied');
        btn.setAttribute('aria-label', 'Copy email address');
      }, 1800);
    });
  });
