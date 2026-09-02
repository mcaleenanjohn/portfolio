  const nav = document.getElementById('nav');
  const docEl = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Nav: solid-fill on scroll + rule doubles as a scroll-progress bar */
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 20);
    const max = docEl.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    nav.style.setProperty('--scroll', (pct * 100).toFixed(2) + '%');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

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

      /* About photo counter-drifts against the reading column (yPercent composes with .reveal's y) */
      const photo = document.querySelector('.about-photo');
      if (photo) gsap.fromTo(photo, { yPercent: -10 }, { yPercent: 10, ease: 'none', scrollTrigger: through('.about') });

      /* signature drifts gently behind the About copy */
      const signature = document.querySelector('.about-signature');
      if (signature) gsap.fromTo(signature, { yPercent: -14 }, { yPercent: 16, ease: 'none', scrollTrigger: through('.about') });

      /* hero headline lifts away as the hero scrolls out */
      const headline = document.querySelector('.hero .headline');
      if (headline) gsap.to(headline, {
        yPercent: -26, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
    }
  } else {
    document.querySelectorAll('.reveal').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  }
