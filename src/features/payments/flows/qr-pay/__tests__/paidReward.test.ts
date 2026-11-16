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

    // review 2, finding 7: the read's `claimed` is always false; a paid-out reward was claimed
    it('reads a reward already paid out as claimed, so a reload does not offer the hold again', () => {
        const paidOut = { ...perk, payoutStatus: 'completed' as const, txHash: '0xabc' }
        expect(pixPaidPerk({ state: 'paid', perk: paidOut })).toMatchObject({ claimed: true, txHash: '0xabc' })
        expect(pixPaidPerk({ state: 'paid', perk })).toMatchObject({ claimed: false })
    })

    // the API's selfPay (a1c2b82d9); a read without the field is an older API: not self-pay
    it('shows nothing for a payment to the user’s own account', () => {
        expect(pixPaidPerk({ state: 'paid', perk, selfPay: true })).toBeNull()
        expect(pixPaidPerk({ state: 'paid', perk, selfPay: false })).toMatchObject({ eligible: true })
        expect(pixPaidPerk({ state: 'paid', perk })).toMatchObject({ eligible: true })
    })

    it('shows nothing while the reward is not issued', () => {
        expect(pixPaidPerk({ state: 'paid', perk: null })).toBeNull()
        expect(pixPaidPerk(undefined)).toBeNull()
    })
})
