import type { CardOverviewFixture } from './adapter-contract'
export const USER = 'user-a'
export const GENERATION = 'generation-a'
export const SCOPE = 'a'.repeat(64)
export function issuedCardOverview(): CardOverviewFixture {
    return {
        status: { hasApplication: true, railStatus: 'ENABLED' },
        balance: null,
        balanceUnavailable: false,
        cards: [
            {
                id: 'card-a',
                rainCardId: 'rain-a',
                last4: '1234',
                expiryMonth: 12,
                expiryYear: 2030,
                status: 'ACTIVE',
                network: 'VISA',
                issuedAt: '2026-01-01T00:00:00Z',
                hasWithdrawApproval: false,
                hasStoredWithdrawApproval: false,
            },
        ],
        pendingVerification: { kind: 'card_addon', generation: GENERATION, entryScope: SCOPE },
    }
}
