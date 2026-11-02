/** A signed lock/cancel withdrawal is reusable only by the same user, wallet and card, and only until it expires. */
import { renderHook } from '@testing-library/react'
import type { SignedRainWithdrawal } from '../useSignSpendBundle'
import { useCardWithdrawalProof } from '../useCardWithdrawalProof'

let mockUserId = 'user-a'
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: mockUserId } } }) }))

const WALLET = '0xafbea1a6a6036d7d827e08072cd4315248b77352'
const proof = (expiresAt = 4_102_444_800) => ({ preparationId: 'prep-1', expiresAt }) as unknown as SignedRainWithdrawal

beforeEach(() => {
    mockUserId = 'user-a'
})

describe('useCardWithdrawalProof', () => {
    it('returns the saved proof to the same user, wallet and card, and nothing once cleared', () => {
        const { result } = renderHook(() => useCardWithdrawalProof('card-1', WALLET))
        result.current.save(proof())
        expect(result.current.get()).toEqual(proof())
        result.current.clear()
        expect(result.current.get()).toBeUndefined()
    })

    it.each([
        ['another card', { cardId: 'card-2', wallet: WALLET, user: 'user-a' }],
        ['another wallet', { cardId: 'card-1', wallet: '0x1111111111111111111111111111111111111111', user: 'user-a' }],
        ['another account', { cardId: 'card-1', wallet: WALLET, user: 'user-b' }],
    ])('never hands it to %s', (_what, next) => {
        const { result, rerender } = renderHook(
            (p: { cardId: string; wallet: string }) => useCardWithdrawalProof(p.cardId, p.wallet),
            { initialProps: { cardId: 'card-1', wallet: WALLET } }
        )
        result.current.save(proof())

        mockUserId = next.user
        rerender({ cardId: next.cardId, wallet: next.wallet })
        expect(result.current.get()).toBeUndefined()
    })

    it('an expired proof is not reused', () => {
        const { result } = renderHook(() => useCardWithdrawalProof('card-1', WALLET))
        result.current.save(proof(Math.floor(Date.now() / 1000) - 1))
        expect(result.current.get()).toBeUndefined()
    })
})
