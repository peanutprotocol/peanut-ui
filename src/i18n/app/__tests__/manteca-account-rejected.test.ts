import { loadMessages } from '../messages'

it.each([
    [
        'en',
        'Deposits and withdrawals in this country aren’t available for your account. You can still pay with QR. Contact support for help.',
    ],
    [
        'es-419',
        'Los depósitos y retiros en este país no están disponibles para tu cuenta. Los pagos con QR siguen funcionando. El equipo de soporte puede ayudarte.',
    ],
    [
        'es-AR',
        'Los depósitos y retiros en este país no están disponibles para tu cuenta. Los pagos con QR siguen funcionando. El equipo de soporte puede ayudarte.',
    ],
    [
        'pt-BR',
        'Depósitos e saques neste país não estão disponíveis para sua conta. Você pode continuar pagando com QR. O suporte pode ajudar.',
    ],
] as const)('resolves complete Manteca rejection guidance for %s', async (locale, copy) => {
    expect((await loadMessages(locale)).errors.mantecaAccountRejected).toBe(copy)
})
