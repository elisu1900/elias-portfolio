import { ui, type UIKey } from './ui';
import { defaultLocale, locales, type Locale } from '../data/site';

/** Reads the locale out of a pathname: /es/about -> 'es', /about -> 'en'. */
export function getLocale(url: URL): Locale {
  const seg = url.pathname.split('/').filter(Boolean)[0];
  return (locales as readonly string[]).includes(seg) ? (seg as Locale) : defaultLocale;
}

/** Translator bound to one locale, falling back to English for missing keys. */
export function useT(locale: Locale) {
  return function t(key: UIKey): string {
    return ui[locale][key] ?? ui[defaultLocale][key] ?? key;
  };
}

/**
 * Builds a locale-aware href. English is unprefixed, Spanish lives under /es.
 * localize('/about', 'es') -> '/es/about'
 */
export function localize(path: string, locale: Locale): string {
  const clean = '/' + path.replace(/^\/+|\/+$/g, '');
  if (locale === defaultLocale) return clean === '/' ? '/' : clean;
  return clean === '/' ? '/es' : `/es${clean}`;
}

/** Same page in the other language — for the nav switcher. */
export function alternatePath(url: URL, target: Locale): string {
  const parts = url.pathname.split('/').filter(Boolean);
  if ((locales as readonly string[]).includes(parts[0])) parts.shift();
  return localize('/' + parts.join('/'), target);
}
