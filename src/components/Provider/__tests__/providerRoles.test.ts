import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'

/**
 * The provider sheet says what the statement's provider page says (TASK-24947 M5, Chip's review
 * threads on api#2149). Pinned from the API's `src/i18n/messages/*.json` at f36ebcf31: Avenia's line
 * whole, and Manteca's as the app's two entities split it (Argentina's money, then Brazil's Pix). The
 * English Avenia line was shortened here first (review 2, the sheet's word budget); the API follows.
 */
const API = {
    en: {
        avenia: 'Pix deposits for Brazil residents, and Pix withdrawals, transfers and QR payments for users anywhere',
        manteca: 'Deposits, withdrawals and QR payments in Argentina, and Pix for accounts that do not use Avenia yet',
        join: ', and ',
        messages: en,
    },
    'es-419': {
        avenia: 'Depósitos por Pix para residentes de Brasil, y retiros, transferencias y pagos con QR por Pix para usuarios de cualquier país',
        manteca: 'Depósitos, retiros y pagos con QR en Argentina, y Pix para cuentas que todavía no usan Avenia',
        join: ', y ',
        messages: es419,
    },
    'pt-BR': {
        avenia: 'Depósitos por Pix para residentes no Brasil, e saques, transferências e pagamentos por QR via Pix para usuários de qualquer país',
        manteca: 'Depósitos, saques e pagamentos por QR na Argentina, e Pix para contas que ainda não usam a Avenia',
        join: ', e ',
        messages: ptBR,
    },
}

describe.each(Object.entries(API))('the provider roles in %s', (_locale, { avenia, manteca, join, messages }) => {
    const role = messages.provider.role

    it('name Avenia as the statement does', () => {
        expect(role.aveniaBr).toBe(avenia)
    })

    it("name Manteca's two entities as the statement's one line", () => {
        expect(`${role.mantecaAr}${join}${role.mantecaBr}`).toBe(manteca)
    })
})
