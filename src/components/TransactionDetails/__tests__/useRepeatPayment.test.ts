jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn().mockReturnValue(false),
    isIOSNative: jest.fn().mockReturnValue(false),
    isAndroidNative: jest.fn().mockReturnValue(false),
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
let mockAccounts: unknown[] = []
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' }, accounts: mockAccounts } }),
}))
let mockPixKeySend = { via: 'pay', block: null as string | null }
jest.mock('@/features/pix/usePixKeySend', () => ({ usePixKeySend: () => mockPixKeySend }))

import { act, renderHook } from '@testing-library/react'
import posthog from 'posthog-js'
import { clearRepeatDraft, peekRepeatDraft } from '@/features/payments/shared/repeat-draft'
import { forgetPixWithdrawDraft, readPixWithdrawDraft } from '@/features/pix/pixWithdrawDraft'
import type { TransactionDetails } from '../transactionTransformer'
import { useRepeatPayment } from '../useRepeatPayment'

const account = (type: string, identifier: string, countryName: string, extra: Record<string, unknown> = {}) => ({
    id: `acc-${identifier}`,
    type,
    identifier,
    details: { countryName, bankName: null },
    ...extra,
})

/** A completed payout, as the transformer shapes it for the owner. */
const payout = (identifier: string, overrides: Record<string, unknown> = {}) =>
    ({
        id: 'entry-1',
        amount: 150,
        direction: 'bank_withdraw',
        status: 'completed',
        bankAccountDetails: { identifier, type: 'BANK_IBAN' },
        extraDataForDrawer: { kind: 'OFFRAMP' },
        ...overrides,
    }) as unknown as TransactionDetails

const tap = (transaction: TransactionDetails) => {
    const { result } = renderHook(() => useRepeatPayment(transaction, { isPublic: false }))
    act(() => result.current!.onSelect())
    return result.current!
}

describe('useRepeatPayment on payouts (TASK-25462)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        clearRepeatDraft()
        forgetPixWithdrawDraft('u1')
        mockAccounts = []
        mockPixKeySend = { via: 'pay', block: null }
    })

    test('a Bridge payout opens the amount step with its saved account picked', () => {
        const iban = account('iban', 'DE89370400440532013000', 'germany')
        mockAccounts = [iban]

        // the receipt may print the IBAN in groups
        const repeat = tap(payout('DE89 3704 0044 0532 0130 00'))

        expect(repeat.title).toBe('actions.withdrawAgain')
        expect(peekRepeatDraft('bank')).toEqual({
            to: 'bank',
            account: iban,
            method: { type: 'bridge', countryPath: 'germany', title: 'To Bank' },
        })
        expect(mockPush).toHaveBeenCalledWith('/withdraw?step=amount&amount=150')
        expect(posthog.capture).toHaveBeenCalledWith('receipt_action_tapped', {
            action: 'withdraw_again',
            placement: 'more_actions',
            kind: 'OFFRAMP',
        })
    })

    test('an Argentine payout opens the Manteca flow on the saved account with the USD amount', () => {
        mockAccounts = [account('manteca', '0000003100010000000001', 'argentina')]

        tap(payout('0000003100010000000001', { amount: 20.456 }))

        expect(mockPush).toHaveBeenCalledWith(
            '/withdraw/manteca?country=argentina&destination=0000003100010000000001&isSavedAccount=true&amount=20.46'
        )
        expect(peekRepeatDraft('bank')).toBeNull()
    })

    test("a Pix withdrawal to the user's own key fills the Pix form's draft, not the URL", () => {
        mockAccounts = [account('manteca', 'ana@example.com', 'brazil')]

        tap(payout('ana@example.com'))

        expect(mockPush).toHaveBeenCalledWith('/withdraw/pix')
        expect(readPixWithdrawDraft('u1', 'withdraw')).toMatchObject({
            destination: 'ana@example.com',
            amountUsd: '150',
        })
    })

    test("a Pix payout to someone else's saved key is a send, on the send draft", () => {
        mockPixKeySend = { via: 'withdraw', block: null }
        mockAccounts = [account('manteca', '+5511999990000', 'brazil', { isPixRecipient: true })]

        const repeat = tap(payout('+5511999990000', { direction: 'send' }))

        expect(repeat.title).toBe('actions.sendAgain')
        expect(mockPush).toHaveBeenCalledWith('/withdraw/pix?sendMethod=bank')
        expect(readPixWithdrawDraft('u1', 'send')).toMatchObject({ destination: '+5511999990000', amountUsd: '150' })
    })

    test.each([
        ['no saved account matches', [], payout('DE89370400440532013000')],
        [
            'the matching account was removed for good',
            [account('iban', 'DE89370400440532013000', 'germany', { deactivationReason: 'removed_by_support' })],
            payout('DE89370400440532013000'),
        ],
        [
            "someone else's key is never a withdrawal",
            [account('manteca', '+5511999990000', 'brazil', { isPixRecipient: true })],
            payout('+5511999990000'),
        ],
        ['a pending payout', [account('iban', 'DE89', 'germany')], payout('DE89', { status: 'pending' })],
        [
            'a bank send-link claim',
            [account('iban', 'DE89', 'germany')],
            payout('DE89', { extraDataForDrawer: { kind: 'OFFRAMP', bridgeFlow: 'BANK_SEND_LINK_CLAIM' } }),
        ],
    ])('no button when %s', (_, accounts, transaction) => {
        mockAccounts = accounts
        const { result } = renderHook(() => useRepeatPayment(transaction, { isPublic: false }))
        expect(result.current).toBeNull()
    })
})
