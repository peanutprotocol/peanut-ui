import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { loadMessages } from '../messages'
import en from '../messages/en.json'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import ptBR from '../messages/pt-BR.json'

const catalogs = { en, 'es-419': es419, 'es-AR': esAR, 'pt-BR': ptBR }

it('resolves incomplete Manteca actions to their own reason key', () => {
    expect(reasonCodeKey('manteca_action_incomplete')).toBe('reasons.manteca_action_incomplete')
})

it.each([
    [
        'en',
        "Your bank setup isn't finished. Complete the short verification to add and withdraw pesos by bank transfer.",
    ],
    [
        'es-419',
        'Tu cuenta bancaria todavía no está lista. Completa la breve verificación para depositar y retirar pesos por transferencia.',
    ],
    [
        'es-AR',
        'Tu cuenta bancaria todavía no está lista. Completá la breve verificación para depositar y retirar pesos por transferencia.',
    ],
    [
        'pt-BR',
        'Sua conta bancária ainda não está pronta. Conclua a verificação rápida para depositar e sacar pesos por transferência.',
    ],
] as const)('resolves the approved incomplete-action reason for %s', async (locale, copy) => {
    const messages = await loadMessages(locale)
    expect((messages.identity.reasons as Record<string, string>).manteca_action_incomplete).toBe(copy)
    expect((catalogs[locale].identity.reasons as Record<string, string>).manteca_action_incomplete).toBe(copy)
})
