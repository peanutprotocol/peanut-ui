import type { StarLpPersona } from './starLp.types'

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

/** Request-link text in the real getRequestLink shape, e.g. "peanut.me/fulano/…". */
export const STAR_LP_REQUEST_LINK_TEXT = `peanut.me/${STAR_LP_PERSONA.main.username}/…`
