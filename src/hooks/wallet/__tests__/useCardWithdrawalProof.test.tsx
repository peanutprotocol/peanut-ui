/** A signed lock/cancel withdrawal is reusable only by the same user, wallet and card, and only until it expires. */
import { renderHook } from '@testing-library/react'
import { ApiError } from '@/services/api-error'
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

/**
 * After a failed lock or cancel the proof is sent again only when that failure
 * says nothing about it. A proof the backend used, or can never verify, has to
 * go: until it expires (5 minutes) every retry would resend it and fail the
 * same way.
 */
describe('useCardWithdrawalProof.dropIfSpent', () => {
    const afterFailure = (error: unknown) => {
        const { result } = renderHook(() => useCardWithdrawalProof('card-1', WALLET))
        result.current.save(proof())
        result.current.dropIfSpent(error)
        return result.current.get()
    }
    const refused = (status: number, code?: string) => new ApiError('refused', { status, code })

    it.each([
        ['the signature expired (410)', refused(410, 'WITHDRAWAL_SIGNATURE_EXPIRED')],
        ['the signed amount or recipient was refused (400)', refused(400)],
        ['the preparation is unknown (404)', refused(404)],
        ['the return already ran: "Intent already completed" (409, no code)', refused(409)],
        ['part of the balance moved with it (409 CARD_BALANCE_REMAINS)', refused(409, 'CARD_BALANCE_REMAINS')],
        ['the provider changed its controller (409 RAIN_CONTROLLER_CHANGED)', refused(409, 'RAIN_CONTROLLER_CHANGED')],
    ])('drops the proof when %s', (_why, error) => {
        expect(afterFailure(error)).toBeUndefined()
    })

    it.each([
        ['another card action is running (409 card_action_in_progress)', refused(409, 'card_action_in_progress')],
        ['an earlier card action is unresolved (409 card_action_incomplete)', refused(409, 'card_action_incomplete')],
        ['the card approval is stale (409 STALE_CARD_APPROVAL)', refused(409, 'STALE_CARD_APPROVAL')],
        ['the return is still confirming (409)', refused(409, 'WITHDRAWAL_PENDING_CONFIRMATION')],
        ['the balance could not be read (502 CARD_BALANCE_UNREADABLE)', refused(502, 'CARD_BALANCE_UNREADABLE')],
        ['the funding stop was not written (503 funding_stop_failed)', refused(503, 'funding_stop_failed')],
        ['the card update failed after the return (500)', refused(500)],
        ['the request never got an answer', new Error('Failed to fetch')],
        ['the passkey prompt was dismissed', Object.assign(new Error('cancelled'), { name: 'NotAllowedError' })],
        ['a third-party error carries its own status field', Object.assign(new Error('rpc'), { status: 409 })],
    ])('keeps the proof when %s', (_why, error) => {
        expect(afterFailure(error)).toEqual(proof())
    })
})
