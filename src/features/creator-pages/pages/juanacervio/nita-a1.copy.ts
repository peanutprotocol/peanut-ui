// Copy for Nita's page, variant A1, in every landing-page locale. es-AR is the approved wording;
// each es-AR line carries its English meaning. Copy rules: mono engineering/ui/creator-pages.md.
// Product facts: mono product/networks.md (who can pay into an account), product/kyc.md (QR needs verification).

import type { Locale } from '@/i18n/types'
import type { A1Highlight, A1PostSegment } from './a1/a1-post.types'

// Nita's real X post (@eudtoxic, November 2026), word for word, cut once at "[…]". Never edit the words.
// Her words stay in Spanish in every locale: a quote is not translated. The page marks them lang="es-AR".
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

/** The three phrases of her post that the proof cards explain, in her words. */
const PROOF_QUOTES = [
    // "…I have [accounts in USD and EUR]"
    { before: '…tengo ', phrase: 'cuentas en USD y EUR', highlight: 'yellow' },
    // "…to [charge clients abroad]"
    { before: '…para ', phrase: 'cobrarle a clientes de afuera', highlight: 'pink' },
    // "…I can use the balance to [pay through MercadoPago]"
    { before: '…puedo usar el saldo para ', phrase: 'pagar por MercadoPago', highlight: 'lilac' },
] satisfies { before: string; phrase: string; highlight: A1Highlight }[]

/** Her display name and handle on X, as they are. */
const NAME = 'Nita • Juana Cervio'
const HANDLE = '@eudtoxic'

/** The same in every locale: codes, masked numbers and amounts of the sample app rows. */
const SAMPLE_FIGURES = {
    // The currency codes, never a bare "$": in Argentina "$" means pesos (glossary.es-ar.md).
    usdCode: 'USD',
    usdNumber: '•••• •••• 4821',
    eurCode: 'EUR',
    eurNumber: 'IBAN •••• •••• 0907',
    receivedAmount: '+ USD 800',
}

/** "…works for EVERYTHING" (from her post), under her name and handle. */
const CLOSE_QUOTE = { quote: '“…me sirve para\u00a0TODO”', by: `Nita • ${HANDLE}` }

/** Builds a locale's copy: Peanut's own words for that locale around Nita's words. */
function a1Copy(text: {
    logoAlt: string
    chip: string
    headline: string
    benefit: string
    postMeta: string
    postAdded: string
    cta: { ios: string; android: string; other: string }
    inviteLead: string
    inviteName: string
    more: string
    notABank: string
    proof: { kicker: string; title: string; source: string; items: { title: string; body: string }[] }
    sample: { usd: string; eur: string; received: string; receivedNote: string; qr: string; qrNote: string }
    steps: { title: string; items: { lead: string; rest: string }[] }
    closeLegal: string
}) {
    return {
        logoAlt: text.logoAlt,
        chip: text.chip,
        headline: text.headline,
        benefit: text.benefit,
        post: { name: NAME, handle: HANDLE, segments: POST, meta: text.postMeta, added: text.postAdded },
        cta: text.cta,
        inviteLead: text.inviteLead,
        inviteName: text.inviteName,
        more: text.more,
        notABank: text.notABank,
        proof: {
            kicker: text.proof.kicker,
            title: text.proof.title,
            source: text.proof.source,
            items: PROOF_QUOTES.map((quote, index) => ({ ...quote, ...text.proof.items[index] })),
        },
        sample: { ...SAMPLE_FIGURES, ...text.sample },
        steps: text.steps,
        close: { ...CLOSE_QUOTE, legal: text.closeLegal },
    }
}

export type NitaA1Copy = ReturnType<typeof a1Copy>

export const NITA_A1_COPY: Record<Locale, NitaA1Copy> = {
    'es-ar': a1Copy({
        // "Peanut" (alt text of the logo)
        logoAlt: 'Peanut',
        // "Nita's invitation"
        chip: 'Invitación de Nita',
        // "Nita's post, now with a button."
        headline: 'El post de Nita, ahora con botón.',
        // "Get paid from the US and Europe. Spend in Argentina with the balance." (the two proof-card titles below)
        benefit: 'Cobrá desde EE. UU. y Europa. Gastá en Argentina con el saldo.',
        // "Posted on X · Nov 2026"
        postMeta: 'Posteado en X · nov. 2026',
        // "Colours and numbers: Peanut." Under the post, so nobody reads the highlights as hers.
        postAdded: 'Colores y números: Peanut.',
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
                    // "Bank details in USD and EUR"
                    title: 'Datos bancarios en USD y EUR',
                    // "In dollars and in euros, to give to your client."
                    body: 'En dólares y en euros, para pasarle a tu\u00a0cliente.',
                },
                {
                    // "Get paid from the US and Europe."
                    title: 'Cobrá desde EE. UU. y Europa.',
                    // "The client makes an ordinary bank transfer. You see it in your Peanut balance.
                    //  Who can pay you depends on the currency: the app shows you on each account."
                    body: 'El cliente hace una transferencia bancaria común. Vos lo ves en tu saldo de Peanut. Quién puede pagarte depende de la moneda: la app te lo muestra en cada\u00a0cuenta.',
                },
                {
                    // "Spend in Argentina with the balance."
                    title: 'Gastá en Argentina con el\u00a0saldo.',
                    // "Scan a Mercado Pago QR and pay from Peanut."
                    body: 'Escaneá un QR de Mercado Pago y pagá desde Peanut.',
                },
            ],
        },
        // Sample app rows inside the proof cards. They are illustrations, marked "ejemplo" where an amount shows.
        sample: {
            // "Dollars"
            usd: 'Dólares',
            // "Euros"
            eur: 'Euros',
            // "Payment received"
            received: 'Pago recibido',
            // "Example"
            receivedNote: 'Ejemplo',
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
        // "The quote is word for word, from a post by Nita on X (Nov 2026). Where it says […] or … it is cut.
        //  Peanut added the colours and the numbers."
        closeLegal:
            'La cita es textual, de un post de Nita en X (nov. 2026). Donde dice […] o … está recortada. Los colores y los números los agregó Peanut.',
    }),
    'es-419': a1Copy({
        logoAlt: 'Peanut',
        chip: 'Invitación de Nita',
        headline: 'El post de Nita, ahora con botón.',
        benefit: 'Cobra desde EE. UU. y Europa. Gasta en Argentina con tu saldo.',
        postMeta: 'Publicado en X · nov. 2026',
        postAdded: 'Colores y números: Peanut.',
        cta: { ios: 'Abrir en la App Store', android: 'Abrir en Google Play', other: 'Descargar Peanut' },
        inviteLead: 'Con la ',
        inviteName: 'invitación de Nita',
        more: '↓ Lo que dijo, punto por punto',
        notABank: 'Peanut no es un\u00a0banco.',
        proof: {
            kicker: 'El mismo post, frase por frase',
            title: 'Lo que dijo Nita y lo que puedes hacer en la app.',
            source: 'Nita, en X',
            items: [
                {
                    title: 'Datos bancarios en USD y EUR',
                    body: 'En dólares y en euros, para compartir con tu\u00a0cliente.',
                },
                {
                    title: 'Cobra desde EE. UU. y Europa.',
                    body: 'Tu cliente hace una transferencia bancaria normal. Tú la ves en tu saldo de Peanut. Quién puede pagarte depende de la moneda: la app te lo muestra en cada\u00a0cuenta.',
                },
                {
                    title: 'Gasta en Argentina con tu\u00a0saldo.',
                    body: 'Escanea un QR de Mercado Pago y paga desde Peanut.',
                },
            ],
        },
        sample: {
            usd: 'Dólares',
            eur: 'Euros',
            received: 'Pago recibido',
            receivedNote: 'Ejemplo',
            qr: 'QR de Mercado Pago',
            qrNote: 'Pagado con tu saldo',
        },
        steps: {
            title: 'Después del botón',
            items: [
                { lead: 'Descargas la app', rest: ' desde la tienda de tu\u00a0celular.' },
                { lead: 'Creas tu nombre de usuario', rest: ' con la invitación de\u00a0Nita.' },
                { lead: 'Verificas tu identidad', rest: ' cuando quieras usar los datos bancarios o pagar con QR.' },
            ],
        },
        closeLegal:
            'La cita es textual, de un post de Nita en X (nov. 2026). Donde dice […] o … está recortada. Los colores y los números los agregó Peanut.',
    }),
    en: a1Copy({
        logoAlt: 'Peanut',
        chip: 'Nita’s invite',
        headline: 'Nita’s post, now with a button.',
        benefit: 'Get paid from the US and Europe. Spend it in Argentina.',
        postMeta: 'Posted on X · Nov 2026',
        postAdded: 'Colors and numbers: Peanut.',
        cta: { ios: 'Open in the App Store', android: 'Open in Google Play', other: 'Download Peanut' },
        inviteLead: 'With ',
        inviteName: 'Nita’s invite',
        more: '↓ What she said, point by point',
        notABank: 'Peanut is not a\u00a0bank.',
        proof: {
            kicker: 'The same post, one phrase at a time',
            title: 'What Nita said, and what you can do in the app.',
            source: 'Nita, on X',
            items: [
                {
                    title: 'Bank details in USD and EUR',
                    body: 'In dollars and in euros, to share with your\u00a0client.',
                },
                {
                    title: 'Get paid from the US and Europe.',
                    body: 'Your client sends a regular bank transfer. You see it in your Peanut balance. Who can pay you depends on the currency: the app shows it on each\u00a0account.',
                },
                {
                    title: 'Spend in Argentina with your\u00a0balance.',
                    body: 'Scan a Mercado Pago QR and pay from Peanut.',
                },
            ],
        },
        sample: {
            usd: 'Dollars',
            eur: 'Euros',
            received: 'Received',
            receivedNote: 'Example',
            qr: 'Mercado Pago QR',
            qrNote: 'Paid from your balance',
        },
        steps: {
            title: 'After the button',
            items: [
                { lead: 'Download the app', rest: ' from your phone’s app\u00a0store.' },
                { lead: 'Create your username', rest: ' with Nita’s\u00a0invite.' },
                { lead: 'Verify your identity', rest: ' when you want to use the bank details or pay by QR.' },
            ],
        },
        closeLegal:
            'Quoted word for word, in Spanish, from Nita’s post on X (Nov 2026). […] or … marks a cut. Peanut added the colors and numbers.',
    }),
    'pt-br': a1Copy({
        logoAlt: 'Peanut',
        chip: 'Convite da Nita',
        headline: 'O post da Nita, agora com botão.',
        benefit: 'Receba dos EUA e da Europa. Gaste na Argentina com o saldo.',
        postMeta: 'Publicado no X · nov. 2026',
        postAdded: 'Cores e números: Peanut.',
        cta: { ios: 'Abrir na App Store', android: 'Abrir no Google Play', other: 'Baixar Peanut' },
        inviteLead: 'Com o ',
        inviteName: 'convite da Nita',
        more: '↓ O que ela disse, ponto por ponto',
        notABank: 'O Peanut não é um\u00a0banco.',
        proof: {
            kicker: 'O mesmo post, frase por frase',
            title: 'O que a Nita disse e o que você pode fazer no app.',
            source: 'Nita, no X',
            items: [
                {
                    title: 'Dados bancários em USD e EUR',
                    body: 'Em dólares e em euros, para passar ao seu\u00a0cliente.',
                },
                {
                    title: 'Receba dos EUA e da Europa.',
                    body: 'Seu cliente faz uma transferência bancária comum. Você vê o valor no seu saldo do Peanut. Quem pode pagar depende da moeda: o app mostra em cada\u00a0conta.',
                },
                {
                    title: 'Gaste na Argentina com o\u00a0saldo.',
                    body: 'Escaneie um QR do Mercado Pago e pague pelo Peanut.',
                },
            ],
        },
        sample: {
            usd: 'Dólares',
            eur: 'Euros',
            received: 'Recebido',
            receivedNote: 'Exemplo',
            qr: 'QR do Mercado Pago',
            qrNote: 'Pago com o saldo',
        },
        steps: {
            title: 'Depois do botão',
            items: [
                { lead: 'Baixe o app', rest: ' na loja do seu\u00a0celular.' },
                { lead: 'Crie seu nome de usuário', rest: ' com o convite da\u00a0Nita.' },
                { lead: 'Verifique sua identidade', rest: ' quando quiser usar os dados bancários ou pagar com QR.' },
            ],
        },
        closeLegal:
            'A citação é literal, em espanhol, de um post da Nita no X (nov. 2026). Onde aparece […] ou …, o texto foi cortado. O Peanut adicionou as cores e os números.',
    }),
}
