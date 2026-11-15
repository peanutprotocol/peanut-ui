import { pixPaidPerk } from '../paidReward'

const perk = {
    eligible: true as const,
    discountPercentage: 0,
    claimed: false as const,
    sponsoredUsd: 1,
    reason: 'Pix cashback',
    usageId: 'usage-1',
    payoutStatus: 'pending' as const,
}

describe('pixPaidPerk: the QR reward of a payment on the Pix pay routes, in the success view’s shape', () => {
    it('names the sponsored amount as Manteca’s completion does', () => {
        expect(pixPaidPerk({ state: 'paid', perk })).toEqual({
            eligible: true,
            discountPercentage: 0,
            claimed: false,
            amountSponsored: 1,
            txHash: undefined,
            usageId: 'usage-1',
            payoutStatus: 'pending',
        })
    })

    it.each(['refunding', 'refunded', 'cancelled', 'processing'] as const)(
        'shows nothing for a %s payment, whatever the read carries',
        (state) => {
            expect(pixPaidPerk({ state, perk })).toBeNull()
        }
    )

    it('shows nothing while the reward is not issued', () => {
        expect(pixPaidPerk({ state: 'paid', perk: null })).toBeNull()
        expect(pixPaidPerk(undefined)).toBeNull()
    })
})
