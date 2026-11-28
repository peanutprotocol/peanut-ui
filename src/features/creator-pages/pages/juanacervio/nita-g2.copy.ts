// Copy for Nita's page, variant G2, in every landing-page locale. es-AR is the approved wording;
// each es-AR line carries its English meaning. Copy rules: mono engineering/ui/creator-pages.md.
import type { Locale } from '@/i18n/types'

const ES_AR = {
    // "Frame from Nita's Reel" (alt text of the background image)
    reelAlt: 'Captura del Reel de Nita',
    // "Invitation from @juanacervio" (her Instagram handle: this page is built on her Reel)
    eyebrow: 'Invitación de @juanacervio',
    // "Nita uses Peanut."
    headline: 'Nita usa Peanut.',
    // "Download it." (the highlighted second line of the headline)
    headlineAccent: 'Bajala.',
    // "Get paid from the US and Europe."
    benefit: 'Cobrá desde EE. UU. y Europa.',
    cta: {
        // "Open in the App Store"
        ios: 'Abrir en el App Store',
        // "Open in Google Play"
        android: 'Abrir en Google Play',
        // "Download Peanut"
        other: 'Bajar Peanut',
    },
    // "With Nita's invitation" (not "saved", and no tick: no device check backs that claim)
    invite: 'Con la invitación de Nita',
    // "Peanut is not a bank." The non-breaking space keeps "banco." off a line of its own under large text.
    legal: 'Peanut no es un\u00a0banco.',
}

export type NitaG2Copy = typeof ES_AR

export const NITA_G2_COPY: Record<Locale, NitaG2Copy> = {
    'es-ar': ES_AR,
    'es-419': {
        reelAlt: 'Captura del Reel de Nita',
        eyebrow: 'Invitación de @juanacervio',
        headline: 'Nita usa Peanut.',
        headlineAccent: 'Descárgala.',
        benefit: 'Cobra desde EE. UU. y Europa.',
        cta: { ios: 'Abrir en la App Store', android: 'Abrir en Google Play', other: 'Descargar Peanut' },
        invite: 'Con la invitación de Nita',
        legal: 'Peanut no es un\u00a0banco.',
    },
    en: {
        reelAlt: 'Still from Nita’s Reel',
        eyebrow: 'Invite from @juanacervio',
        headline: 'Nita uses Peanut.',
        headlineAccent: 'Get it.',
        benefit: 'Get paid from the US and Europe.',
        cta: { ios: 'Open in the App Store', android: 'Open in Google Play', other: 'Download Peanut' },
        invite: 'With Nita’s invite',
        legal: 'Peanut is not a\u00a0bank.',
    },
    'pt-br': {
        reelAlt: 'Cena do Reel da Nita',
        eyebrow: 'Convite de @juanacervio',
        headline: 'Nita usa o Peanut.',
        headlineAccent: 'Baixe agora.',
        benefit: 'Receba dos EUA e da Europa.',
        cta: { ios: 'Abrir na App Store', android: 'Abrir no Google Play', other: 'Baixar Peanut' },
        invite: 'Com o convite da Nita',
        legal: 'O Peanut não é um\u00a0banco.',
    },
}
