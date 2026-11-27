import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'

// TASK-25079: the Bridge account and verification waits promised "usually a
// few minutes" and nothing else, but some Bridge reviews take hours to days
describe('Bridge review wait copy', () => {
    it.each(APP_LOCALES)('says the wait can take longer in %s', async (locale) => {
        const messages = await loadMessages(locale)
        for (const text of [messages.depositAccounts.gate.reviewBody, messages.identity.reasons.bridge_processing]) {
            expect(text).toMatch(/few minutes|unos minutos|alguns minutos/i)
            expect(text).toMatch(/can take longer|puede tardar más|pode demorar mais/)
        }
    })
})
