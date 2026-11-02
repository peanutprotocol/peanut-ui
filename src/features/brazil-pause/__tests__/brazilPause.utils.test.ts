import type { RailCapabilityStatus, RailId, RailOperation } from '@/types/capabilities'
import { isBrazilServicesUser } from '../brazilPause.utils'

/** an operationStatus over a fixed table: `{ 'manteca.pix_br': { deposit: 'enabled' } }` */
const statuses =
    (table: Record<string, Partial<Record<RailOperation, RailCapabilityStatus>>>) =>
    (railId: RailId, op: RailOperation) =>
        table[railId]?.[op]

describe('isBrazilServicesUser', () => {
    it('covers a Brazil resident with no Brazil rail', () => {
        expect(isBrazilServicesUser(['BR'], statuses({}))).toBe(true)
    })

    it('covers a second residence in Brazil', () => {
        expect(isBrazilServicesUser(['AR', 'BR'], statuses({}))).toBe(true)
    })

    it('covers anyone who can deposit or withdraw BRL through their own Pix account', () => {
        expect(isBrazilServicesUser([], statuses({ 'manteca.pix_br': { deposit: 'enabled' } }))).toBe(true)
        expect(isBrazilServicesUser(['AR'], statuses({ 'manteca.pix_br': { withdraw: 'enabled' } }))).toBe(true)
    })

    it('covers the older Brazil bank rail', () => {
        expect(isBrazilServicesUser(['AR'], statuses({ 'manteca.bank_transfer_br': { deposit: 'enabled' } }))).toBe(
            true
        )
    })

    it('leaves a Pix payer who lives elsewhere alone', () => {
        const payOnly = statuses({
            'manteca.pix_br': { pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' },
        })
        expect(isBrazilServicesUser(['AR'], payOnly)).toBe(false)
        expect(isBrazilServicesUser([], payOnly)).toBe(false)
    })

    it('does not count a Brazil rail that cannot move money yet', () => {
        expect(isBrazilServicesUser([], statuses({ 'manteca.bank_transfer_br': { deposit: 'pending' } }))).toBe(false)
    })
})
