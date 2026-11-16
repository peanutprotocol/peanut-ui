import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'

/**
 * The provider sheet says what the statement's provider page says (TASK-24947 M5, Chip's review
 * threads on api#2149). Pinned from the API's `src/i18n/messages/*.json`: Avenia's line whole, and
 * Manteca's as the app's two entities split it (Argentina's money, then Brazil's Pix). The English
 * Avenia line was shortened here first (review 2, the sheet's word budget). Manteca's Brazilian
 * line went back to "users who do not live in Brazil" (Aleks, 2026-11-16, TASK-25033) here first;
 * the API follows in the same change.
 */
const API = {
    en: {
        avenia: 'Pix deposits for Brazil residents, and Pix withdrawals, transfers and QR payments for users anywhere',
        manteca:
            'Deposits, withdrawals and QR payments in Argentina, and Pix payments and transfers for users who do not live in Brazil',
        join: ', and ',
        messages: en,
    },
    'es-419': {
        avenia: 'Depósitos por Pix para residentes de Brasil, y retiros, transferencias y pagos con QR por Pix para usuarios de cualquier país',
        manteca:
            'Depósitos, retiros y pagos con QR en Argentina, y pagos y transferencias por Pix para quienes no viven en Brasil',
        join: ', y ',
        messages: es419,
    },
    'pt-BR': {
        avenia: 'Depósitos por Pix para residentes no Brasil, e saques, transferências e pagamentos por QR via Pix para usuários de qualquer país',
        manteca:
            'Depósitos, saques e pagamentos por QR na Argentina, e pagamentos e transferências por Pix para quem não mora no Brasil',
        join: ', e ',
        messages: ptBR,
    },
}

// Mid-sentence, the Brazilian line's first word drops its capital, unless it is a name (Pix)
const midSentence = (line: string) => (line.startsWith('Pix') ? line : line[0].toLowerCase() + line.slice(1))

describe.each(Object.entries(API))('the provider roles in %s', (_locale, { avenia, manteca, join, messages }) => {
    const role = messages.provider.role

    it('name Avenia as the statement does', () => {
        expect(role.aveniaBr).toBe(avenia)
    })

    it("name Manteca's two entities as the statement's one line", () => {
        expect(`${role.mantecaAr}${join}${midSentence(role.mantecaBr)}`).toBe(manteca)
    })
})
