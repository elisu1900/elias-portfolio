# elias-portfolio

Personal site for **Elías Wassit Calzado** — AI engineer and full-stack developer, Málaga.

The portfolio presents itself as a **relational database**. The landing screen is a pannable black board showing an ER diagram of his career, and the visitor queries it with real SQL. Anyone who would rather not write SQL is handed the answers by **mini-wassit**, a small bot that opens a drawer of ready-made queries, or can jump to a plain readable version of the whole site.

Bilingual (English + Spanish), dark only, static, deployed to Cloudflare Pages.

## Commands

```bash
npm install
npm run dev      # dev server, http://localhost:4321
npm run build    # static build into dist/
npm run preview  # serve the built output
```

No environment variables, no API keys, no backend.

## The landing screen

| | |
| --- | --- |
| **Board** | Drag to pan, `ctrl`/`⌘`+wheel to zoom at the pointer, pinch on touch. `+` `−` `fit` controls bottom-left. Arrow keys pan, `+`/`-` zoom, `0` refits. The page itself never scrolls. |
| **Console** | Full-width input pinned to the bottom. One result panel rises above it and is **replaced** by each new query — it is not a scrolling log. Close it with the `×` or `Escape`. |
| **mini-wassit** | Drifts around the board. Click it for a drawer of eight ready-made queries: copy one, or drop it at the prompt and run it yourself. It also fires the occasional blaster bolt, which is purely decorative. |

### The query engine

`src/lib/sql.ts` is hand-written with no dependencies:

- `SELECT` with column lists, `AS` aliases and `COUNT(*)`
- `INNER JOIN` and `LEFT JOIN`, chained, with table aliases and qualified columns — an ambiguous unqualified column raises a real error
- `WHERE` with `=` `!=` `>` `<` `>=` `<=` `LIKE` `IS NULL`, combined with `AND` / `OR`
- `ORDER BY`, `LIMIT`
- psql-style meta commands: `\dt`, `\d <table>`, `\?`, `clear`
- psql-flavoured errors, and locale-aware matching so Spanish prose compares against Spanish

Try:

```sql
SELECT p.name, s.name AS skill
FROM projects p
INNER JOIN project_skills ps ON p.id = ps.project_id
INNER JOIN skills s ON s.id = ps.skill_id;
```

## Layout

```
src/
├─ data/
│  ├─ site.ts            name, email, socials, employer, stack
│  └─ db.ts              the 15-table dataset behind the schema and the console
├─ lib/
│  ├─ sql.ts             the query engine
│  ├─ board.ts           pan / zoom engine for the canvas
│  └─ diagram.ts         ER-diagram layout, computed at build time
├─ i18n/
│  ├─ ui.ts              every user-visible string, in English and Spanish
│  └─ utils.ts           getLocale / useT / localize / alternatePath
├─ layouts/Base.astro    head, SEO, hreflang, nav, footer
├─ components/
│  ├─ db/                schema diagram, command bar, mini-wassit
│  └─ sections/          the readable pages' sections
├─ content/work/         case studies, en/ and es/
└─ pages/                / (EN) and /es (ES)
```

### Routes

| English | Spanish | |
| --- | --- | --- |
| `/` | `/es` | the database screen |
| `/overview` | `/es/overview` | the readable version, for non-technical visitors |
| `/work`, `/work/<slug>` | `/es/work/…` | case studies |
| `/about` | `/es/about` | background, education, languages |
| `/contact` | `/es/contact` | one button that opens your email client |

## Editing

**Text** — all of it lives in `src/i18n/ui.ts`, keyed, with an `en` and an `es` entry for every key. Change it there, never in a component.

**Your details** — `src/data/site.ts`.

**The database** — `src/data/db.ts`. It is normalised to third normal form on purpose: the lookup tables (`companies`, `skill_categories`, `institutions`) and junction tables (`project_skills`, `service_skills`) are what make the JOIN queries meaningful. Add a table there and it appears in the diagram, in `\dt`, and in the console automatically.

**A case study** — add `src/content/work/en/<slug>.md` and `src/content/work/es/<slug>.md` with matching frontmatter (`title`, `summary`, `role`, `stack`, `year`, `locale`, optional `url` / `productUrl`, `featured`, `order`).

**Your photo** — drop a square image at `public/images/elias.jpg`. Until it exists, the about page shows a deliberate framed placeholder rather than a broken image.

**Your CV** — `public/cv/elias-wassit-calzado.pdf`, served by the `documents` table.

## Deploying to Cloudflare Pages

1. Push to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → connect the repo.
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy. Every push to `main` ships automatically.

Then update `site` in `astro.config.mjs` and the `Sitemap:` line in `public/robots.txt` to the real domain, so canonical URLs, hreflang tags and the sitemap point at the right place.

`public/_headers` sets security headers and long-lived caching for hashed assets; Cloudflare applies it automatically.

**Analytics**: Cloudflare Web Analytics is free and needs no cookie banner — add the site in the dashboard, nothing to change in the code.

## Conventions worth keeping

- **The email address never appears in the HTML.** It is stored split across two attributes and assembled in JavaScript at click time, so scrapers get nothing. `grep -rl 'eliaswassit18@gmail.com' dist/` must return zero files.
- **Technical terms carry `translate="no"`** — table names, types, SQL and tech names. Without it, browser auto-translation turns *Docker* into *Estibador*.
- **Everything animated respects `prefers-reduced-motion: reduce`**, including the laser, which does not even schedule itself.
- **Dark only.** There is no light theme and no toggle, by design.
- `claude-data/` is git-ignored — private working material, never committed.
