# elias-portfolio

Bilingual (EN/ES) Matrix-themed portfolio for Elías Wassit Calzado. Static Astro 5, deployed to Cloudflare Pages.

## Commands

```bash
npm run dev      # dev server at http://localhost:4321
npm run build    # static build into dist/
npm run preview  # serve the built output locally
```

## Layout

```
src/
├─ data/site.ts          name, email, socials, employer, stack — edit this first
├─ i18n/
│  ├─ ui.ts              every string on the site, in English and Spanish
│  └─ utils.ts           getLocale / useT / localize / alternatePath
├─ layouts/Base.astro    <head>, SEO, hreflang, nav, footer, rain, terminal
├─ components/
│  ├─ Nav.astro          nav + language switcher + terminal trigger
│  ├─ Footer.astro
│  ├─ MatrixRain.astro   canvas code rain
│  ├─ Terminal.astro     the typeable terminal overlay
│  ├─ sections/          page sections (hero, services, skills, …)
│  └─ fx/                visual effects
├─ content/work/
│  ├─ en/*.md            case studies in English
│  └─ es/*.md            case studies in Spanish
├─ content.config.ts     typed schema for the work collection
├─ pages/                / (EN) and /es (ES)
└─ styles/global.css     design tokens + shared utilities
```

Dark theme only — there is no light mode and no toggle, by design.

## Editing content

**Text**: all user-visible copy lives in `src/i18n/ui.ts`, keyed, with an `en` and an `es` entry for every key. Change it there, never in a component.

**Personal details**: `src/data/site.ts`.

**A new case study**: add `src/content/work/en/<slug>.md` and `src/content/work/es/<slug>.md` with matching frontmatter (`title`, `summary`, `role`, `stack`, `year`, `locale`, optional `url` / `productUrl`, `featured`, `order`). The route and the work index pick it up automatically.

**Your photo**: drop a square-ish image at `public/images/elias.jpg`. Until it exists the about page shows a styled placeholder.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → connect the repo.
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy. Every push to `main` ships automatically.

Then update `site` in `astro.config.mjs` and the `Sitemap:` line in `public/robots.txt` to the real domain so canonical URLs, hreflang tags and the sitemap point at the right place.

`public/_headers` sets security headers and long-lived caching for hashed assets; Cloudflare applies it automatically.

## Analytics

Cloudflare Web Analytics is free and needs no cookie banner: Cloudflare dashboard → Web Analytics → add the site. It injects itself at the edge, so there is nothing to add to the code.
