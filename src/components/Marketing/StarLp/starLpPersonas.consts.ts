import type { StarLpEarner, StarLpPersona } from './starLp.types'

/**
 * The example people on the star LPs: Spanish placeholder names (the "John
 * Doe" of Spanish, also used in Portuguese). One persona per role, the same on
 * every page. All three usernames were unregistered on prod on 20 Oct 2026;
 * anyone could still claim one later, so re-check before launch.
 */
export const STAR_LP_PERSONA = {
    /** The Peanut user: receives, requests and sends. */
    main: { name: 'Fulano de Tal', short: 'Fulano', initials: 'FT', username: 'fulano' },
    /** The other side: payer, client or send recipient. */
    payer: { name: 'Mengano Gómez', short: 'Mengano', initials: 'MG', username: 'mengano' },
    /** A second friend in a group chat. Never shown with a link. */
    friend: { name: 'Zutano', short: 'Zutano', initials: 'Z', username: 'zutano' },
} as const satisfies Record<string, StarLpPersona>

/**
 * The earners of the income pages' persona fold (PersonaFold), the same four
 * people on /us-europe-accounts and /request-links; each page adds their line
 * and tag. Composites of the core ICP in product/icps.md ("Freelancers, remote
 * workers, and people who earn from a US or European bank account"), nameless
 * and in the first person: no real people, no testimonials. Their cities are
 * places a verified user can hold USD and EUR accounts (product/countries.md:
 * residents anywhere but the UK, New York and restricted countries; a
 * Portuguese resident really can receive a USD ACH deposit). The avatars are
 * the app's basic stickers (public/avatars/basic).
 */
export const STAR_LP_EARNERS = {
    designer: { avatar: 'basic.flower', who: 'Designer, Buenos Aires' },
    developer: { avatar: 'basic.planet', who: 'Developer, Bogotá' },
    writer: { avatar: 'basic.moon', who: 'Freelance writer, Lisbon' },
    editor: { avatar: 'basic.sun', who: 'Video editor, São Paulo' },
} as const satisfies Record<string, StarLpEarner>

/** Request-link text in the real getRequestLink shape, e.g. "peanut.me/fulano/…". */
export const STAR_LP_REQUEST_LINK_TEXT = `peanut.me/${STAR_LP_PERSONA.main.username}/…`
