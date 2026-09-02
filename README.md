# John McAleenan — Portfolio

Static multi-page site. No build step — open `index.html` or serve the folder:

```bash
python3 -m http.server 8000
```

## Structure

```
index.html                 Homepage: hero, featured work, selected projects, about, footer
work/*.html                 Case study pages (placeholder content for now)
assets/css/styles.css       All styles (incl. @font-face for PP Neue Montreal)
assets/js/main.js           Nav scroll-fill + GSAP ScrollTrigger reveal animations
assets/fonts/               PP Neue Montreal (Regular / 400) — the only weight in use
assets/images/              Page images (PNG, extracted from the original inline base64)
resume/                     Drop John-McAleenan-Resume.pdf here (see resume/README.md)
```

GSAP + ScrollTrigger load from cdnjs in each page's `<head>`.

## Migration notes

Restructured from a single ~14 MB `index.html` that inlined every image and the
font as base64. Images decoded to real PNGs, font extracted to an `.otf`, CSS/JS
split into `assets/`. No visual, copy, or layout changes.
