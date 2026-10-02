import type { PrepareRainWithdrawalInput, PrepareRainWithdrawalResponse, RainCardOverview } from '@/services/rain'

/** Shared by the card balance return tests (pure state machine and React hook). */
export const WALLET = '0x1111111111111111111111111111111111111111'
export const SIG = `0x${'cd'.repeat(65)}` as const
export const HEX32 = `0x${'ab'.repeat(32)}`
export const EXPIRES_AT = 1_800_000_600

/** A card overview with one active card; a null balance means "no balance figure". */
export const cardOverview = (
    spendingPower: number | null,
    { grant = true, unavailable = false, pendingCharges = 0 } = {}
): RainCardOverview => ({
    status: { hasApplication: true },
    balance:
        spendingPower === null
            ? null
            : { creditLimit: 0, spendingPower, pendingCharges, postedCharges: 0, balanceDue: 0 },
    ...(unavailable ? { balanceUnavailable: true } : {}),
    cards: [
        {
            id: 'card-1',
            rainCardId: 'rain-1',
            last4: '0420',
            expiryMonth: 6,
            expiryYear: 2069,
            status: 'ACTIVE',
            network: 'visa',
            issuedAt: '2026-01-01T00:00:00Z',
            hasWithdrawApproval: grant,
        },
    ],
})

let preparations = 0
/** Restart the `prep-N` ids; call from beforeEach. */
export const resetPreparations = () => {
    preparations = 0
}

/** The provider's prepared withdrawal for `input` (cents in, USDC units out). */
export const preparedWithdrawal = (
    input: PrepareRainWithdrawalInput,
    over: Partial<PrepareRainWithdrawalResponse> = {}
): PrepareRainWithdrawalResponse => ({
    preparationId: `prep-${++preparations}`,
    coordinatorAddress: '0x3333333333333333333333333333333333333333',
    collateralProxy: '0x4444444444444444444444444444444444444444',
    adminAddress: WALLET,
    chainId: '137',
    tokenAddress: '0x5555555555555555555555555555555555555555',
    amount: (BigInt(input.amount) * 10_000n).toString(),
    recipientAddress: input.recipientAddress,
    directTransfer: input.directTransfer,
    adminSalt: HEX32,
    adminNonce: '0',
    executorSignature: SIG,
    executorSalt: HEX32,
    expiresAt: EXPIRES_AT,
    ...over,
})
