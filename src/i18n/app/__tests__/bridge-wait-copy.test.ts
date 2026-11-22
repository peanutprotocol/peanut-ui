import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'

// TASK-25079: the Bridge account and verification waits said "usually a few
// minutes", but Bridge reviews take hours to days
describe('Bridge review wait copy', () => {
    it.each(APP_LOCALES)('promises no minutes in %s', async (locale) => {
        const messages = await loadMessages(locale)
        for (const text of [messages.depositAccounts.gate.reviewBody, messages.identity.reasons.bridge_processing]) {
            expect(text).not.toMatch(/few minutes|unos minutos|alguns minutos/i)
            expect(text).toMatch(/hours|horas/)
        }
    })
})
