import { type Locale } from './types'

/**
 * Display metadata for the marketing locale switchers (footer + article nav).
 * Labels stay in their own language — that's the convention for language
 * pickers, so they read correctly whatever locale the page is in.
 */
// shortLabel drops the region for the footer dropdown. Both label forms stay in
// their own language: someone who can't read the current locale still has to be
// able to find theirs in the list.
export const LOCALE_META: Record<Locale, { flag: string; label: string; shortLabel: string }> = {
    en: { flag: '/flags/us.svg', label: 'English', shortLabel: 'English' },
    'es-419': { flag: '/flags/mx.svg', label: 'Español (Latam)', shortLabel: 'Español' },
    'pt-br': { flag: '/flags/br.svg', label: 'Português (Brasil)', shortLabel: 'Português' },
}

/** Display order in the switchers — default locale first. */
export const LOCALE_ORDER: Locale[] = ['en', 'es-419', 'pt-br']
