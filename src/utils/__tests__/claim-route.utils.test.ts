import { findClaimRoute, resolveClaimQuoteRecipient } from '@/utils/claim-route.utils'
import type { ClaimXChainPreview } from '@/components/Claim/Claim.consts'

const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'
const SENDER = '0x9999999999999999999999999999999999999999'
const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const

describe('resolveClaimQuoteRecipient', () => {
    it('prices for the external EVM address the claimer typed', () => {
        expect(resolveClaimQuoteRecipient({ recipientAddress: A, walletAddress: B, senderAddress: SENDER })).toBe(A)
    })

    it('falls back to the Peanut wallet, then the link sender, for a bank claim (IBAN is not an address)', () => {
        expect(
            resolveClaimQuoteRecipient({
                recipientAddress: 'DE89370400440532013000',
                walletAddress: B,
                senderAddress: SENDER,
            })
        ).toBe(B)
        expect(resolveClaimQuoteRecipient({ recipientAddress: 'DE89370400440532013000', senderAddress: SENDER })).toBe(
            SENDER
        )
    })
})

describe('findClaimRoute — a quote is only reusable for the recipient it was priced for', () => {
    const routeForA: ClaimXChainPreview = {
        chainId: '8453',
        tokenAddress: USDC,
        receiveAmount: '10',
        feeUsd: 0,
        quotedFor: A,
    }

    it('reuses the cached route for the same chain, token and recipient', () => {
        expect(findClaimRoute([routeForA], { chainId: '8453', tokenAddress: USDC.toLowerCase(), quotedFor: A })).toBe(
            routeForA
        )
    })

    it('does not reuse it after the recipient switches to another address', () => {
        expect(findClaimRoute([routeForA], { chainId: '8453', tokenAddress: USDC, quotedFor: B })).toBeUndefined()
    })

    it('does not reuse it for another chain or token', () => {
        expect(findClaimRoute([routeForA], { chainId: '1', tokenAddress: USDC, quotedFor: A })).toBeUndefined()
    })
})
