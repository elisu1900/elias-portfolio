/** Single source of truth for everything personal on the site. */
export const site = {
  /** Full legal name — used in the hero and structured data. */
  fullName: 'Elías Wassit Calzado',
  /** Shorter form for nav, titles and prose. */
  name: 'Elías Wassit',
  email: 'eliaswassit18@gmail.com',
  /** Deliberately no phone number: published mobiles attract spam. */
  location: { en: 'Málaga, Spain', es: 'Málaga, España' },
  url: 'https://elias.pages.dev',
  socials: {
    github: 'https://github.com/elisu1900',
    linkedin: 'https://www.linkedin.com/in/elias-wassit-calzado/',
  },
  employer: {
    name: 'Vision Harbor Technologies',
    url: 'https://visionharbor.ai',
    product: { name: 'VisionOne', url: 'https://visionone.visionharbor.ai' },
    since: '2026-03',
  },
  /** Shown as the skills strip. Order matters — strongest first. */
  stack: ['C# / .NET', 'React', 'TypeScript', 'Claude Code', 'Docker', 'Linux', 'CI/CD', 'SQL'],
} as const;

export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
