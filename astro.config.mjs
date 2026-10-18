// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Change this to the real domain once Cloudflare Pages is wired up.
  site: 'https://elias.pages.dev',
  output: 'static',
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    routing: {
      // English stays unprefixed at /, Spanish lives under /es.
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en-GB', es: 'es-ES' },
      },
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  devToolbar: { enabled: false },
});
