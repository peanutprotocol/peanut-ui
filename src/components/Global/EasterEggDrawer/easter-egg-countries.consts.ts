export interface EasterEggCountryConfig {
    image: string
}

/**
 * Easter egg countries — these places have no banking infrastructure,
 * so we show a fun modal instead of the normal flow. Data only, so the
 * design-system Assets page can list the art without importing the drawer.
 */
export const EASTER_EGG_COUNTRIES: Record<string, EasterEggCountryConfig> = {
    AQ: { image: '/easter-eggs/antarctica.webp' },
    BV: { image: '/easter-eggs/bouvet.webp' },
    CX: { image: '/easter-eggs/christmas.webp' },
    CC: { image: '/easter-eggs/cocos.webp' },
    GS: { image: '/easter-eggs/southgeorgia.webp' },
    HM: { image: '/easter-eggs/heard.webp' },
    PN: { image: '/easter-eggs/pitcairn.webp' },
    TK: { image: '/easter-eggs/tokelau.webp' },
}
