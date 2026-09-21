// The footer renders on every receipt: sent, received, pending and failed.
// Its copy must not claim a direction ("Sent from Peanut" did).
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'

describe('receipt footer copy', () => {
    it.each([
        ['en', en],
        ['es-419', es419],
        ['pt-BR', ptBR],
    ])('%s names Peanut without a direction', (_locale, messages) => {
        const footer = messages.transaction.officialReceipt.footer
        expect(footer).toContain('Peanut')
        expect(footer).not.toMatch(/\b(sent|received|enviado|recibido|recebido)\b/i)
    })
})
