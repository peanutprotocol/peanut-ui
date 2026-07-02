/**
 * Countries where Peanut has a first-party local payment rail that's cheaper
 * than spending on the Rain card. Add a country here to light up the
 * LocalRailNudge for it — mirrors MANTECA_GEO_RAIL_MAP in peanut-api-ts.
 *
 * `rail` is the printable, user-facing rail name (reads as "pay with {rail}").
 * `currency` drives the shared `useCardMarkupRate` lookup so the nudge stays
 * in sync with the QR-pay confirm/success surfaces.
 *
 * Shared data (not a component internal): LocalRailNudge renders the nudge for
 * these countries, and CardForeignCurrencyNotice reads membership to suppress
 * itself where the nudge already fires — one nudge per receipt.
 */
export const LOCAL_RAIL_BY_COUNTRY: Record<string, { countryName: string; rail: string; currency: string }> = {
    AR: { countryName: 'Argentina', rail: 'QR', currency: 'ARS' },
    BR: { countryName: 'Brazil', rail: 'Pix', currency: 'BRL' },
}
