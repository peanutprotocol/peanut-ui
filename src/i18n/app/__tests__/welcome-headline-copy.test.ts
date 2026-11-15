import en from '../messages/en.json'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import ptBR from '../messages/pt-BR.json'
import { loadMessages } from '../messages'

const expected = {
    en: {
        every_border: {
            title: 'One account. Every border.',
            description: 'Receive, send and spend internationally, without paying for the distance.',
        },
        whole_world: {
            title: 'The whole world in one account.',
            description: 'Get paid in other currencies, pay anyone abroad, spend locally. No transfer fees.',
        },
        travels_free: {
            title: 'Money that travels free.',
            description: 'One account that sends, receives and spends across borders at no cost.',
        },
    },
    'es-419': {
        every_border: {
            title: 'Una cuenta. Todas las fronteras.',
            description: 'Recibe, envía y gasta a nivel internacional, sin pagar por la distancia.',
        },
        whole_world: {
            title: 'El mundo entero en una cuenta.',
            description:
                'Cobra en otras monedas, paga a quien quieras en el exterior y gasta en tu país. Sin comisiones por transferencia.',
        },
        travels_free: {
            title: 'Dinero que viaja gratis.',
            description: 'Una cuenta que envía, recibe y gasta entre países sin costo.',
        },
    },
    'pt-BR': {
        every_border: {
            title: 'Uma conta. Todas as fronteiras.',
            description: 'Receba, envie e gaste internacionalmente, sem pagar pela distância.',
        },
        whole_world: {
            title: 'O mundo inteiro em uma conta.',
            description:
                'Receba em outras moedas, pague quem quiser no exterior e gaste no seu país. Sem taxas de transferência.',
        },
        travels_free: {
            title: 'Dinheiro que viaja de graça.',
            description: 'Uma conta que envia, recebe e gasta entre países sem custo.',
        },
    },
}

const overlay = {
    every_border: { description: 'Recibí, enviá y gastá a nivel internacional, sin pagar por la distancia.' },
    whole_world: {
        description:
            'Cobrá en otras monedas, pagale a quien quieras en el exterior y gastá en tu país. Sin comisiones por transferencia.',
    },
    travels_free: { title: 'Plata que viaja gratis.' },
}

it.each([
    ['en', en],
    ['es-419', es419],
    ['pt-BR', ptBR],
] as const)('%s contains every supplied welcome experiment string without fallback', (locale, catalog) => {
    expect(catalog.setup.steps.landing).toHaveProperty('variants', expected[locale])
})

it('stores only the three Argentine differences and resolves all six leaves', async () => {
    expect(esAR.setup.steps.landing).toHaveProperty('variants', overlay)
    const resolved = await loadMessages('es-AR')
    expect(resolved.setup.steps.landing).toHaveProperty('variants', {
        every_border: { ...expected['es-419'].every_border, ...overlay.every_border },
        whole_world: { ...expected['es-419'].whole_world, ...overlay.whole_world },
        travels_free: { ...expected['es-419'].travels_free, ...overlay.travels_free },
    })
})

it('preserves the existing control copy in all four locales', () => {
    expect([en, es419, esAR, ptBR].map((catalog) => catalog.setup.steps.landing.title)).toEqual([
        'Earn anywhere. Spend worldwide.',
        'Cobra desde cualquier lugar. Gasta en todo el mundo.',
        'Cobrá desde cualquier lugar. Gastá en todo el mundo.',
        'Receba de qualquer lugar. Gaste no mundo todo.',
    ])
    expect([en, es419, esAR, ptBR].map((catalog) => catalog.setup.steps.landing.description)).toEqual([
        'Get paid in USD or EUR with bank details. Spend it by card or QR, wherever you are.',
        'Recibe pagos en USD o EUR con datos bancarios. Gástalos con tarjeta o QR, estés donde estés.',
        'Recibí pagos en USD o EUR con datos bancarios. Gastalos con tarjeta o QR, estés donde estés.',
        'Receba em USD ou EUR com dados bancários. Gaste com cartão ou QR, onde você estiver.',
    ])
})
