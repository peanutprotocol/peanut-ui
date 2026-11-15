// Copy for Nita's page, variant E1 (es-AR). Each line carries its English meaning.
// Copy rules: mono engineering/ui/creator-pages.md.

import type { E1LetteringText } from './e1/lettering-outlines'

/** One run of the quoted post. `mark` is a highlighter stroke, `link` is the colour X gives a handle. */
export type NitaE1PostRun = { text: string; style?: 'mark' | 'link' }

export const NITA_E1_COPY = {
    // "Nita × Peanut · for getting paid from abroad" (not first person: only the quoted post is in her voice)
    chip: 'Nita × Peanut · para cobrar de afuera',
    // "Get paid from / abroad in / USD and EUR" (three poster lines; the second is purple).
    // The page draws these lines from outlines: after a change here, run e1/outline-lettering.mjs.
    headline: ['Cobrá de', 'afuera en', 'USD y EUR'] satisfies E1LetteringText[],
    // "Portrait of Nita" (alt text of the cut-out portrait)
    portraitAlt: 'Retrato de Nita',
    post: {
        // Her display name and handle on X, as she writes them
        name: 'Nita • Juana Cervio',
        // "@eudtoxic · Nov 2026"
        meta: '@eudtoxic · nov. 2026',
        // Her real post, quoted exactly; "[…]" marks the cut. "What I'm using now that works for
        // EVERYTHING is @joinpeanut because in the same one I have USD and EUR accounts to charge
        // clients abroad […] and I can also use the balance to pay through MercadoPago"
        runs: [
            { text: 'Lo que yo estoy usando ahora que me sirve para ' },
            { text: 'TODO', style: 'mark' },
            { text: ' es ' },
            { text: '@joinpeanut', style: 'link' },
            { text: ' porque en la misma tengo ' },
            { text: 'cuentas en USD y EUR', style: 'link' },
            { text: ' para cobrarle a clientes de afuera […] y tamb puedo usar el saldo para ' },
            { text: 'pagar por MercadoPago', style: 'mark' },
        ] satisfies NitaE1PostRun[],
    },
    // "Peanut" (alt text of the logo label; the mascot sticker is decoration and has none)
    peanutAlt: 'Peanut',
    cta: {
        // "Open in the App Store"
        ios: 'Abrir en el App Store',
        // "Open in Google Play"
        android: 'Abrir en Google Play',
        // "Download Peanut"
        other: 'Bajar Peanut',
    },
    // "With Nita's invitation" (not "saved" or "already loaded": no device check backs that claim)
    invite: 'Con la invitación de Nita',
    // "Nita uses Peanut. Page made by Peanut." (the same line on all three of her pages; "recommends" would be
    // a claim her post does not make)
    disclosure: 'Nita usa Peanut. Página hecha por Peanut.',
    // "Peanut is not a bank."
    notABank: 'Peanut no es un banco.',
    how: {
        // "How it works"
        label: 'Cómo funciona',
        // "You get paid from abroad, / you spend here." (the second line is purple)
        headline: ['Cobrás de afuera,', 'gastás acá.'],
        steps: [
            {
                // "You download the app"
                title: 'Bajás la app',
                // "You create your username with Nita's invitation."
                body: 'Creás tu usuario con la invitación de Nita.',
            },
            {
                // "You verify your identity"
                title: 'Verificás tu identidad',
                // "With that you can open your USD and EUR accounts and see the bank details."
                // (verifying lets you open the accounts; it does not hand the details over)
                body: 'Con eso podés abrir tus cuentas en USD y EUR y ver los datos bancarios.',
            },
            {
                // "You give the details to your client"
                title: 'Le pasás los datos a tu cliente',
                // "You get paid from the US and Europe. Who can pay you depends on the currency: the app
                // shows you on each account." (not every payer can pay every account)
                body: 'Cobrás desde EE. UU. y Europa. Quién puede pagarte depende de la moneda: la app te lo muestra en cada cuenta.',
            },
            {
                // "You spend in Argentina"
                title: 'Gastás en Argentina',
                // "You pay a Mercado Pago QR from your balance."
                body: 'Pagás un QR de Mercado Pago desde el saldo.',
            },
        ],
    },
    ticket: {
        // "This link"
        label: 'Este link',
        // "Nita's invitation"
        title: 'Invitación de Nita',
        // "Download Peanut from here and you join with her invitation."
        body: 'Bajá Peanut desde acá y entrás con su invitación.',
    },
    // "Nita · Juana Cervio" (alt text of her wordmark)
    wordmarkAlt: 'Nita · Juana Cervio',
    // "To pay by QR you have to verify your identity."
    fine: 'Para pagar con QR tenés que verificar tu identidad.',
}
