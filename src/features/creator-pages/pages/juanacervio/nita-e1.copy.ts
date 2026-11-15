// Copy for Nita's page, variant E1 (es-AR). Each line carries its English meaning.
// Copy rules: mono inbox/go-links/creator-pages-spec.md § Pages.

/** One run of the quoted post. `mark` is a highlighter stroke, `link` is the colour X gives a handle. */
export type NitaE1PostRun = { text: string; style?: 'mark' | 'link' }

export const NITA_E1_COPY = {
    // "Nita × Peanut · what I get paid with"
    chip: 'Nita × Peanut · con qué cobro',
    // "Get paid from / abroad in / USD and EUR" (three poster lines; the second is purple)
    headline: ['Cobrá de', 'afuera en', 'USD y EUR'],
    // "Nita" (alt text of the cut-out portrait)
    portraitAlt: 'Nita',
    post: {
        // Her display name and handle on X, as she writes them
        name: 'Nita • Juana Cervio',
        // "Verified account"
        verified: 'Cuenta verificada',
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
    // "Peanut" (alt text of the mascot sticker and of the logo label)
    peanutAlt: 'Peanut',
    cta: {
        // "Open in the App Store"
        ios: 'Abrir en App Store',
        // "Open in Google Play"
        android: 'Abrir en Google Play',
        // "Download Peanut"
        other: 'Bajar Peanut',
    },
    // "With Nita's invitation" (not "saved" or "already loaded": no device check backs that claim)
    invite: 'Con la invitación de Nita',
    // "Nita uses Peanut and recommends it in collaboration with Peanut."
    disclosure: 'Nita usa Peanut y lo recomienda en colaboración con Peanut.',
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
                // "With that you have bank details in USD and EUR."
                body: 'Con eso tenés datos bancarios en USD y EUR.',
            },
            {
                // "You give the details to your client"
                title: 'Le pasás los datos a tu cliente',
                // "You get paid from the US and Europe."
                body: 'Cobrás desde EE. UU. y Europa.',
            },
            {
                // "You spend in Argentina"
                title: 'Gastás en Argentina',
                // "You pay a Mercado Pago QR from your balance, or with a card."
                body: 'Pagás un QR de Mercado Pago desde el saldo, o con tarjeta.',
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
    // "To spend you have to verify your identity. The card is subject to approval."
    fine: 'Para gastar tenés que verificar tu identidad. La tarjeta está sujeta a aprobación.',
}
