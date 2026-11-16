/** Three stickers per country, in the order they are slapped on. */
export type ResidenceStickerSet = readonly [string, string, string]

/** Where the sticker files live under public/. Fetched by URL when shown, never bundled. */
export const RESIDENCE_STICKER_DIR = '/residence-stickers'

/**
 * The sign-up Residence screen's easter egg: a resident of one of these 20
 * countries gets three local stickers slapped around the mascot. Data only, so
 * the design-system Assets page can list the art without importing the hero.
 * Art approved by Konrad, 2026-11-15 (TASK-24899); generated, never drawn in code.
 */
export const RESIDENCE_STICKERS: Readonly<Record<string, ResidenceStickerSet>> = {
    AR: ['ar-mate.webp', 'ar-sol.webp', 'ar-alfajor.webp'],
    BR: ['br-brigadeiro.webp', 'br-tucano.webp', 'br-coxinha.webp'],
    US: ['us-hotdog.webp', 'us-baseball.webp', 'us-liberty.webp'],
    ES: ['es-churros.webp', 'es-botijo.webp', 'es-tortilla.webp'],
    PY: ['py-chipa.webp', 'py-terere.webp', 'py-lapacho.webp'],
    MX: ['mx-taco.webp', 'mx-ajolote.webp', 'mx-pinata.webp'],
    PT: ['pt-sardinha.webp', 'pt-andorinha.webp', 'pt-nata.webp'],
    DE: ['de-brezel.webp', 'de-gartenzwerg.webp', 'de-schultuete.webp'],
    CO: ['co-arepa.webp', 'co-tinto.webp', 'co-mariposa.webp'],
    PH: ['ph-jeepney.webp', 'ph-videoke.webp', 'ph-halohalo.webp'],
    FR: ['fr-croissant.webp', 'fr-baguette.webp', 'fr-fromage.webp'],
    NG: ['ng-jollof.webp', 'ng-agama.webp', 'ng-suya.webp'],
    PE: ['pe-alpaca.webp', 'pe-papa.webp', 'pe-ceviche.webp'],
    ID: ['id-kucing.webp', 'id-bakso.webp', 'id-kok.webp'],
    IT: ['it-pizza.webp', 'it-gelato.webp', 'it-moka.webp'],
    AO: ['ao-jindungo.webp', 'ao-basquete.webp', 'ao-palanca.webp'],
    UY: ['uy-tero.webp', 'uy-termo.webp', 'uy-chivito.webp'],
    CL: ['cl-quiltro.webp', 'cl-copihue.webp', 'cl-empanada.webp'],
    BO: ['bo-llama.webp', 'bo-saltena.webp', 'bo-flamenco.webp'],
    VE: ['ve-guacamaya.webp', 've-tequeno.webp', 've-arepa.webp'],
}

export function residenceStickerSrc(file: string): string {
    return `${RESIDENCE_STICKER_DIR}/${file}`
}
