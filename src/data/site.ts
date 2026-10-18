/**
 * Single source of truth for everything personal on the site.
 * Values marked TODO get filled in from the interview / claude-data.
 */
export const site = {
  name: 'Elias',            // TODO: full display name
  role: 'TODO: your role',
  tagline: 'TODO: one-line hook',
  email: 'eliaswassit18@gmail.com',
  location: 'TODO',
  lang: 'en',               // TODO: 'en' | 'es'
  url: 'https://elias.pages.dev',
  socials: {
    github: '',             // TODO
    linkedin: '',           // TODO
    x: '',                  // TODO
  },
};

export const nav = [
  { href: '/',         label: 'home'     },
  { href: '/about',    label: 'about'    },
  { href: '/projects', label: 'projects' },
  { href: '/contact',  label: 'contact'  },
];
