// Copy for Nita's page, variant A1 (es-AR). Each line carries its English meaning.
// Copy rules: mono engineering/ui/creator-pages.md.
// Product facts: mono product/networks.md (who can pay into an account), product/kyc.md (QR needs verification).

export type A1Highlight = 'yellow' | 'pink' | 'lilac'

/** One run of Nita's post. `highlight` and `marker` are Peanut's annotations; the words are hers. */
export type A1PostSegment = {
    text: string
    highlight?: A1Highlight
    /** The numbered dot after a highlighted phrase; it points at the matching proof card. */
    marker?: number
    kind?: 'mention' | 'cut'
}

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
        // "Nita's profile photo" (alt text)
        avatarAlt: 'Foto de perfil de Nita',
        // Her display name and handle on X, as they are.
        name: 'Nita • Juana Cervio',
        handle: '@eudtoxic',
        segments: POST,
        // "Posted on X · Nov 2026"
        meta: 'Posteado en X · nov. 2026',
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
    // "Nita uses Peanut. Page made by Peanut." The same line on every variant; it claims no more than her post does.
    madeBy: 'Nita usa Peanut. Página hecha por Peanut.',
    // "Peanut is not a bank."
    notABank: 'Peanut no es un banco.',
    proof: {
        // "The same post, one phrase at a time"
        kicker: 'El mismo post, de a una frase',
        // "What Nita said and what you will see in the app."
        title: 'Lo que dijo Nita y lo que vas a ver en la app.',
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
                // "In dollars and in euros, to give to whoever pays you."
                body: 'En dólares y en euros, para pasarle a quien te paga.',
            },
            {
                // "…to [charge clients abroad]" (from her post)
                before: '…para ',
                phrase: 'cobrarle a clientes de afuera',
                highlight: 'pink',
                // "Get paid from the US and Europe."
                title: 'Cobrá desde EE. UU. y Europa.',
                // "The client makes an ordinary bank transfer. You see the money in Peanut.
                //  Who can pay you depends on the currency: the app shows you on each account."
                body: 'El cliente hace una transferencia bancaria común. Vos ves la plata en Peanut. Quién puede pagarte depende de la moneda: la app te lo muestra en cada cuenta.',
            },
            {
                // "…I can use the balance to [pay through MercadoPago]" (from her post)
                before: '…puedo usar el saldo para ',
                phrase: 'pagar por MercadoPago',
                highlight: 'lilac',
                // "Spend in Argentina with the balance."
                title: 'Gastá en Argentina con el saldo.',
                // "Scan a Mercado Pago QR and pay from Peanut."
                body: 'Escaneá un QR de Mercado Pago y pagá desde Peanut.',
            },
        ] satisfies { before: string; phrase: string; highlight: A1Highlight; title: string; body: string }[],
    },
    // Sample app rows inside the proof cards. They are illustrations, marked "ejemplo" where an amount shows.
    sample: {
        // "Dollars · USD"
        usdSign: '$',
        usd: 'Dólares · USD',
        usdNumber: '•••• •••• 4821',
        // "Euros · EUR"
        eurSign: '€',
        eur: 'Euros · EUR',
        eurNumber: 'IBAN •••• •••• 0907',
        // "Copy"
        copy: 'Copiar',
        // "Payment received"
        received: 'Pago recibido',
        // "Transfer · example"
        receivedNote: 'Transferencia · ejemplo',
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
            { lead: 'Bajás la app', rest: ' desde la tienda de tu celu.' },
            // "You create your username. With Nita's invitation."
            { lead: 'Creás tu usuario.', rest: ' Con la invitación de Nita.' },
            // "You verify your identity when you want to use the bank details or pay with QR."
            { lead: 'Verificás tu identidad', rest: ' cuando quieras usar los datos bancarios o pagar con QR.' },
        ],
    },
    close: {
        // "…works for EVERYTHING" (from her post)
        quote: '“…me sirve para TODO”',
        by: 'Nita • @eudtoxic',
        // "The quote is word for word, from a post by Nita on X (Nov 2026). Where it says […] or … it is cut.
        //  Peanut added the colours and the numbers."
        legal: 'La cita es textual, de un post de Nita en X (nov. 2026). Donde dice […] o … está recortada. Los colores y los números los agregó Peanut.',
    },
}
