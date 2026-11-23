import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'

// TASK-24969: Bridge refuses one account type per region; the line names that
// account only, never all bank transfers
describe('bridge_region_unavailable copy', () => {
    it('maps the code to its catalog line', () => {
        expect(reasonCodeKey('bridge_region_unavailable')).toBe('reasons.bridge_region_unavailable')
    })

    it.each(APP_LOCALES)('has both lines in %s, one naming the currency', async (locale) => {
        const messages = await loadMessages(locale)
        const general = messages.identity.reasons.bridge_region_unavailable
        const named = messages.depositAccounts.list.regionUnavailableBody
        expect(general).toBeTruthy()
        expect(general).not.toContain('{currency}')
        expect(named).toContain('{currency}')
        for (const line of [general, named]) expect(line).not.toMatch(/bank transfers|transferencias|transferências/i)
    })
})
