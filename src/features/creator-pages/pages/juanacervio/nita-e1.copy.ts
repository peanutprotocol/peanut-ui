// Copy for Nita's page, variant E1, in every landing-page locale. es-AR is the approved wording;
// each es-AR line carries its English meaning. Copy rules: mono engineering/ui/creator-pages.md.

import type { Locale } from '@/i18n/types'
import type { E1LetteringText } from './e1/lettering-outlines'

/** One run of the quoted post. `mark` is a highlighter stroke, `link` is the colour X gives a handle. */
export type NitaE1PostRun = { text: string; style?: 'mark' | 'link' }

/**
 * "Get paid from / abroad in / USD and EUR": the poster headline, three lines (the second is
 * purple), drawn from outlines. It is art and stays Spanish in every locale; each locale's
 * `headline` is the readable heading behind it. After a change here, redraw the lines with the
 * script in mono: engineering/ui/creator-pages/e1-lettering/README.md.
 */
export const NITA_E1_LETTERING = ['Cobrá de', 'afuera en', 'USD y EUR'] satisfies E1LetteringText[]

// Her real post, quoted exactly; "[…]" marks the cut. Her words stay in Spanish in every locale: a
// quote is not translated. The page marks them lang="es-AR". "What I'm using now that works for
// EVERYTHING is @joinpeanut because in the same one I have USD and EUR accounts to charge clients
// abroad […] and I can also use the balance to pay through MercadoPago"
const POST_RUNS: NitaE1PostRun[] = [
    { text: 'Lo que yo estoy usando ahora que me sirve para ' },
    { text: 'TODO', style: 'mark' },
    { text: ' es ' },
    { text: '@joinpeanut', style: 'link' },
    { text: ' porque en la misma tengo ' },
    { text: 'cuentas en USD y EUR', style: 'link' },
    { text: ' para cobrarle a clientes de afuera […] y tamb puedo usar el saldo para ' },
    { text: 'pagar por MercadoPago', style: 'mark' },
]

/** Her display name as she writes it: the name over her post, and the alt text of her wordmark. */
const NAME = 'Nita • Juana Cervio'

const ES_AR = {
    // "Nita × Peanut · for getting paid from abroad" (not first person: only the quoted post is in her voice)
    chip: 'Nita × Peanut · para cobrar de afuera',
    // "Get paid from abroad in USD and EUR": the readable heading of the drawn headline
    headline: 'Cobrá de afuera en USD y EUR',
    // "Portrait of Nita" (alt text of the cut-out portrait)
    portraitAlt: 'Retrato de Nita',
    post: {
        name: NAME,
        // "@eudtoxic · Nov 2026"
        meta: '@eudtoxic · nov. 2026',
        runs: POST_RUNS,
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
    // "Peanut is not a bank." (the no-break space keeps "banco." off a line of its own)
    notABank: 'Peanut no es un\u00a0banco.',
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
                // "After that you can request your USD and EUR accounts and see the bank details."
                // (verifying comes first; the accounts do not open at approval, you ask for them)
                body: 'Después podés pedir tus cuentas en USD y EUR y ver los datos bancarios.',
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
                // "You pay a Mercado Pago QR with the balance." ("con el saldo", as on her other pages)
                body: 'Pagás un QR de Mercado Pago con el\u00a0saldo.',
            },
        ],
    },
    ticket: {
        // "This link"
        label: 'Este link',
        // "Nita's invitation"
        title: 'Invitación de Nita',
        // "Download Peanut from here and the app already knows Nita invited you." (sign-up is open to
        // everyone: the invitation is attribution, not a way in)
        body: 'Bajá Peanut desde acá: este link lleva la invitación de\u00a0Nita.',
    },
    wordmarkAlt: NAME,
    // "To pay by QR you have to verify your identity."
    fine: 'Para pagar con QR tenés que verificar tu identidad.',
    // "The quote is word for word, from a post by Nita on X (Nov 2026). Where it says […] it is cut.
    // Peanut added the highlights."
    quoteNote:
        'La cita es textual, de un post de Nita en X (nov. 2026). Donde dice […] está recortada. Los resaltados los agregó Peanut.',
}

export type NitaE1Copy = typeof ES_AR

export const NITA_E1_COPY: Record<Locale, NitaE1Copy> = {
    'es-ar': ES_AR,
    'es-419': {
        chip: 'Nita × Peanut · para cobrar de afuera',
        headline: 'Cobra del exterior en USD y EUR',
        portraitAlt: 'Retrato de Nita',
        post: { name: NAME, meta: '@eudtoxic · nov. 2026', runs: POST_RUNS },
        peanutAlt: 'Peanut',
        cta: { ios: 'Abrir en la App Store', android: 'Abrir en Google Play', other: 'Descargar Peanut' },
        invite: 'Con la invitación de Nita',
        notABank: 'Peanut no es un\u00a0banco.',
        how: {
            label: 'Cómo funciona',
            headline: ['Cobras de afuera,', 'gastas aquí.'],
            steps: [
                { title: 'Descargas la app', body: 'Creas tu nombre de usuario con la invitación de Nita.' },
                {
                    title: 'Verificas tu identidad',
                    body: 'Después puedes pedir tus cuentas en USD y EUR y ver los datos bancarios.',
                },
                {
                    title: 'Le pasas los datos a tu cliente',
                    body: 'Cobras desde EE. UU. y Europa. Quién puede pagarte depende de la moneda: la app te lo muestra en cada cuenta.',
                },
                { title: 'Gastas en Argentina', body: 'Pagas un QR de Mercado Pago con tu\u00a0saldo.' },
            ],
        },
        ticket: {
            label: 'Este link',
            title: 'Invitación de Nita',
            body: 'Descarga Peanut desde aquí: este link lleva la invitación de\u00a0Nita.',
        },
        wordmarkAlt: NAME,
        fine: 'Para pagar con QR tienes que verificar tu identidad.',
        quoteNote:
            'La cita es textual, de un post de Nita en X (nov. 2026). Donde dice […] está recortada. Los resaltados los agregó Peanut.',
    },
    en: {
        chip: 'Nita × Peanut · paid from abroad',
        headline: 'Get paid from abroad in USD and EUR',
        portraitAlt: 'Portrait of Nita',
        post: { name: NAME, meta: '@eudtoxic · Nov 2026', runs: POST_RUNS },
        peanutAlt: 'Peanut',
        cta: { ios: 'Open in the App Store', android: 'Open in Google Play', other: 'Download Peanut' },
        invite: 'With Nita’s invite',
        notABank: 'Peanut is not a\u00a0bank.',
        how: {
            label: 'How it works',
            headline: ['Earn globally,', 'spend locally.'],
            steps: [
                { title: 'Download the app', body: 'Create your username with Nita’s invite.' },
                {
                    title: 'Verify your identity',
                    body: 'Then you can request your USD and EUR accounts and see the bank details.',
                },
                {
                    title: 'Give your client the details',
                    body: 'Get paid from the US and Europe. Who can pay you depends on the currency: the app shows it on each account.',
                },
                { title: 'Spend in Argentina', body: 'Pay a Mercado Pago QR with your\u00a0balance.' },
            ],
        },
        ticket: {
            label: 'This link',
            title: 'Nita’s invite',
            body: 'Download Peanut from here: this link carries Nita’s\u00a0invite.',
        },
        wordmarkAlt: NAME,
        fine: 'To pay by QR, you need to verify your identity.',
        quoteNote:
            'Quoted word for word, in Spanish, from Nita’s post on X (Nov 2026). […] marks a cut. Peanut added the highlights.',
    },
    'pt-br': {
        chip: 'Nita × Peanut · para receber de fora',
        headline: 'Receba do exterior em USD e EUR',
        portraitAlt: 'Retrato da Nita',
        post: { name: NAME, meta: '@eudtoxic · nov. 2026', runs: POST_RUNS },
        peanutAlt: 'Peanut',
        cta: { ios: 'Abrir na App Store', android: 'Abrir no Google Play', other: 'Baixar Peanut' },
        invite: 'Com o convite da Nita',
        notABank: 'O Peanut não é um\u00a0banco.',
        how: {
            label: 'Como funciona',
            headline: ['Receba de fora,', 'gaste aqui.'],
            steps: [
                { title: 'Baixe o app', body: 'Crie seu nome de usuário com o convite da Nita.' },
                {
                    title: 'Verifique sua identidade',
                    body: 'Depois, você pode pedir suas contas em USD e EUR e ver os dados bancários.',
                },
                {
                    title: 'Passe os dados ao seu cliente',
                    body: 'Receba dos EUA e da Europa. Quem pode pagar depende da moeda: o app mostra em cada conta.',
                },
                { title: 'Gaste na Argentina', body: 'Pague um QR do Mercado Pago com o\u00a0saldo.' },
            ],
        },
        ticket: {
            label: 'Este link',
            title: 'Convite da Nita',
            body: 'Baixe o Peanut por aqui: este link leva o convite da\u00a0Nita.',
        },
        wordmarkAlt: NAME,
        fine: 'Para pagar com QR, você precisa verificar sua identidade.',
        quoteNote:
            'A citação é literal, em espanhol, de um post da Nita no X (nov. 2026). Onde aparece […], o texto foi cortado. O Peanut adicionou os destaques.',
    },
}
