import { hasRouteScopedLocaleSwitcher, localeHref } from '../LocaleSwitcher'

describe('localeHref', () => {
    it('swaps the locale segment and keeps the rest of the path', () => {
        expect(localeHref('/es-419/help', 'pt-br')).toBe('/pt-br/help')
        expect(localeHref('/en/help/passkeys', 'es-419')).toBe('/es-419/help/passkeys')
        expect(localeHref('/pt-br/send-money-from/spain/to/brazil', 'en')).toBe('/en/send-money-from/spain/to/brazil')
    })

    it('sends English marketing routes to the /en prefix, not to bare /', () => {
        // Only the landing lives at '/', every other marketing route is prefixed.
        expect(localeHref('/es-419/pricing', 'en')).toBe('/en/pricing')
    })

    it('maps the landing between locales, keeping English at /', () => {
        expect(localeHref('/', 'es-419')).toBe('/es-419')
        expect(localeHref('/', 'pt-br')).toBe('/pt-br')
        expect(localeHref('/es-419', 'en')).toBe('/')
        expect(localeHref('/pt-br', 'es-419')).toBe('/es-419')
    })

    it('is idempotent for the current locale', () => {
        expect(localeHref('/es-419/help', 'es-419')).toBe('/es-419/help')
        expect(localeHref('/', 'en')).toBe('/')
    })

    it('falls back to the landing for paths with no localized twin', () => {
        // /lp, /exchange, /quests are English-only — never invent /es-419/lp.
        for (const path of ['/lp', '/exchange', '/quests', '/careers']) {
            expect(localeHref(path, 'es-419')).toBe('/es-419')
            expect(localeHref(path, 'en')).toBe('/')
        }
    })

    it('does not treat a username as a locale', () => {
        // peanut.me/{username} is the recipient catch-all, not a marketing route.
        expect(localeHref('/kushagrasarathe', 'pt-br')).toBe('/pt-br')
        expect(localeHref('/es-es/help', 'es-419')).toBe('/es-419')
    })

    it('treats restored es-ar as a real locale segment', () => {
        expect(localeHref('/es-ar/help', 'es-419')).toBe('/es-419/help')
        expect(localeHref('/es-419/help', 'es-ar')).toBe('/es-ar/help')
        expect(localeHref('/', 'es-ar')).toBe('/es-ar')
    })

    it('tolerates trailing slashes and double slashes', () => {
        expect(localeHref('/es-419/help/', 'en')).toBe('/en/help')
        expect(localeHref('//es-419//help', 'en')).toBe('/en/help')
    })

    it('defers to the exact-locale switcher on Split guide routes', () => {
        expect(hasRouteScopedLocaleSwitcher('/en/split/guides/group-trip')).toBe(true)
        expect(hasRouteScopedLocaleSwitcher('/pt-br/split/guides/group-trip')).toBe(true)
        expect(hasRouteScopedLocaleSwitcher('/en/split')).toBe(false)
        expect(hasRouteScopedLocaleSwitcher('/split/guides/group-trip')).toBe(false)
        expect(hasRouteScopedLocaleSwitcher('/en/blog/group-trip')).toBe(false)
    })
})
