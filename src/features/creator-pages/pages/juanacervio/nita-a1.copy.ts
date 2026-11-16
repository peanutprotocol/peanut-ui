// Copy for Nita's page, variant A1 (es-AR). Each line carries its English meaning.
// Copy rules: mono engineering/ui/creator-pages.md.
// Product facts: mono product/networks.md (who can pay into an account), product/kyc.md (QR needs verification).

import type { A1Highlight, A1PostSegment } from './a1/a1-post.types'

// Nita's real X post (@eudtoxic, November 2026), word for word, cut once at "[…]". Never edit the words.
// The month is from the creator-page brief; nobody has checked the day against the live post.
// "What I'm using now that works for EVERYTHING is @joinpeanut, because in the same one I have accounts in
// USD and EUR to charge clients abroad […] and I can also use the balance to pay through MercadoPago"
const POST: A1PostSegment[] = [
    { text: 'Lo que yo estoy usando ahora que me sirve para TODO es ' },
    { text: '@joinpeanut', kind: 'mention' },
    { text: ' porque en la misma tengo ' },
    { text: 'cuentas en USD y EUR', highlight: 'yellow', marker: 1 },
    { text: ' para ' },
    { text: 'cobrarle a clientes de afuera', highlight: 'pink', marker: 2 },
    { text: ' ' },
    { text: '[…]', kind: 'cut' },
    { text: ' y tamb puedo usar el saldo para ' },
    { text: 'pagar por MercadoPago', highlight: 'lilac', marker: 3 },
]

export const NITA_A1_COPY = {
    // "Peanut" (alt text of the logo)
    logoAlt: 'Peanut',
    // "Nita's invitation"
    chip: 'Invitación de Nita',
    // "Nita's post, now with a button."
    headline: 'El post de Nita, ahora con botón.',
    // "Get paid from the US and Europe. Spend in Argentina with the balance." (the two proof-card titles below)
    benefit: 'Cobrá desde EE. UU. y Europa. Gastá en Argentina con el saldo.',
    post: {
        // Her display name and handle on X, as they are.
        name: 'Nita • Juana Cervio',
        handle: '@eudtoxic',
        segments: POST,
        // "Posted on X · Nov 2026"
        meta: 'Posteado en X · nov. 2026',
        // "Colours and numbers: Peanut." Under the post, so nobody reads the highlights as hers.
        added: 'Colores y números: Peanut.',
    },
    cta: {
        // "Open in the App Store" ("App Store" takes the article, "Google Play" takes none)
        ios: 'Abrir en el App Store',
        // "Open in Google Play"
        android: 'Abrir en Google Play',
        // "Download Peanut"
        other: 'Bajar Peanut',
    },
    // "With Nita's invitation" (not "saved": no device check backs that claim, so no tick either).
    // Rendered as inviteLead + bold inviteName, with no full stop, as on the other variants.
    inviteLead: 'Con la ',
    inviteName: 'invitación de Nita',
    // "↓ What she said, point by point"
    more: '↓ Lo que dijo, punto por punto',
    // "Peanut is not a bank." The non-breaking space keeps "banco." off a line of its own.
    notABank: 'Peanut no es un\u00a0banco.',
    proof: {
        // "The same post, one phrase at a time"
        kicker: 'El mismo post, de a una frase',
        // "What Nita said and what you can do in the app." (the sample rows are drawings, not app screens)
        title: 'Lo que dijo Nita y lo que podés hacer en la app.',
        // "Nita, on X" (label over each quoted phrase)
        source: 'Nita, en X',
        items: [
            {
                // "…I have [accounts in USD and EUR]" (from her post)
                before: '…tengo ',
                phrase: 'cuentas en USD y EUR',
                highlight: 'yellow',
                // "Bank details in USD and EUR"
                title: 'Datos bancarios en USD y EUR',
                // "In dollars and in euros, to give to your client."
                body: 'En dólares y en euros, para pasarle a tu\u00a0cliente.',
            },
            {
                // "…to [charge clients abroad]" (from her post)
                before: '…para ',
                phrase: 'cobrarle a clientes de afuera',
                highlight: 'pink',
                // "Get paid from the US and Europe."
                title: 'Cobrá desde EE. UU. y Europa.',
                // "The client makes an ordinary bank transfer. You see it in your Peanut balance.
                //  Who can pay you depends on the currency: the app shows you on each account."
                body: 'El cliente hace una transferencia bancaria común. Vos lo ves en tu saldo de Peanut. Quién puede pagarte depende de la moneda: la app te lo muestra en cada\u00a0cuenta.',
            },
            {
                // "…I can use the balance to [pay through MercadoPago]" (from her post)
                before: '…puedo usar el saldo para ',
                phrase: 'pagar por MercadoPago',
                highlight: 'lilac',
                // "Spend in Argentina with the balance."
                title: 'Gastá en Argentina con el\u00a0saldo.',
                // "Scan a Mercado Pago QR and pay from Peanut."
                body: 'Escaneá un QR de Mercado Pago y pagá desde Peanut.',
            },
        ] satisfies { before: string; phrase: string; highlight: A1Highlight; title: string; body: string }[],
    },
    // Sample app rows inside the proof cards. They are illustrations, marked "ejemplo" where an amount shows.
    sample: {
        // The currency codes, never a bare "$": in Argentina "$" means pesos (glossary.es-ar.md).
        usdCode: 'USD',
        // "Dollars"
        usd: 'Dólares',
        usdNumber: '•••• •••• 4821',
        eurCode: 'EUR',
        // "Euros"
        eur: 'Euros',
        eurNumber: 'IBAN •••• •••• 0907',
        // "Payment received"
        received: 'Pago recibido',
        // "Example"
        receivedNote: 'Ejemplo',
        receivedAmount: '+ USD 800',
        // "Mercado Pago QR"
        qr: 'QR de Mercado Pago',
        // "Paid with the balance"
        qrNote: 'Pagado con el saldo',
    },
    steps: {
        // "After the button"
        title: 'Después del botón',
        items: [
            // "You download the app from your phone's store."
            { lead: 'Bajás la app', rest: ' desde la tienda de tu\u00a0celu.' },
            // "You create your username with Nita's invitation."
            { lead: 'Creás tu usuario', rest: ' con la invitación de\u00a0Nita.' },
            // "You verify your identity when you want to use the bank details or pay with QR."
            { lead: 'Verificás tu identidad', rest: ' cuando quieras usar los datos bancarios o pagar con QR.' },
        ],
    },
    close: {
        // "…works for EVERYTHING" (from her post)
        quote: '“…me sirve para\u00a0TODO”',
        by: 'Nita • @eudtoxic',
        // "The quote is word for word, from a post by Nita on X (Nov 2026). Where it says […] or … it is cut.
        //  Peanut added the colours and the numbers."
        legal: 'La cita es textual, de un post de Nita en X (nov. 2026). Donde dice […] o … está recortada. Los colores y los números los agregó Peanut.',
    },
}
