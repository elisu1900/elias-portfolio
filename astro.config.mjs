// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Change this to your real domain once Cloudflare Pages is wired up.
  site: 'https://elias.pages.dev',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  devToolbar: { enabled: false },
});
