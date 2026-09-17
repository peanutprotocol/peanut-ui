import React from 'react'
import { render } from '@testing-library/react'
import posthog from 'posthog-js'
import type { TransactionDetails } from '../transactionTransformer'
import { useReceiptReferralAction } from '../useReceiptReferralAction'
import type { ShareActionOptions } from '@/components/Global/ShareButton/useShareAction'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))

const mockUser = { user: { username: 'kush' } }
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))

let mockIsActivated = true
jest.mock('@/hooks/useActivationStatus', () => ({ useActivationStatus: () => ({ isActivated: mockIsActivated }) }))

// capture the share options so outcome analytics can be asserted without a
// real share sheet; the share behavior itself is covered by ShareButton
let lastShareOptions: ShareActionOptions | null = null
const mockShare = jest.fn()
jest.mock('@/components/Global/ShareButton/useShareAction', () => ({
    useShareAction: (options: ShareActionOptions) => {
        lastShareOptions = options
        return mockShare
    },
}))

const mockCapture = posthog.capture as jest.Mock

const tx = (overrides: Partial<Record<string, unknown>> = {}) =>
    ({
        id: 'tx-1',
        status: 'completed',
        direction: 'qr_payment',
        userName: 'Cafe Martinez',
        extraDataForDrawer: { kind: 'QR_PAY' },
        ...overrides,
    }) as unknown as TransactionDetails

function Probe({
    transaction,
    isPublic = false,
    drawerOpen = false,
    onResult,
}: {
    transaction: TransactionDetails
    isPublic?: boolean
    drawerOpen?: boolean
    onResult: (action: ReturnType<typeof useReceiptReferralAction>) => void
}) {
    onResult(useReceiptReferralAction(transaction, { isPublic, drawerOpen }))
    return null
}

const run = (transaction: TransactionDetails, opts: { isPublic?: boolean; drawerOpen?: boolean } = {}) => {
    let action: ReturnType<typeof useReceiptReferralAction> = null
    const view = render(<Probe transaction={transaction} {...opts} onResult={(a) => (action = a)} />)
    return {
        view,
        get action() {
            return action
        },
    }
}

describe('useReceiptReferralAction', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsActivated = true
        lastShareOptions = null
    })

    test('eligible completed private outbound payment returns the drawer row', () => {
        const { action } = run(tx())
        expect(action).toMatchObject({ icon: 'invite-heart', title: 'actions.inviteFriends' })
        expect(lastShareOptions?.url).toContain('kush')
    })

    test('never on the public receipt', () => {
        expect(run(tx(), { isPublic: true }).action).toBeNull()
    })

    test('never on failed/refunded or inbound entries', () => {
        expect(run(tx({ status: 'failed' })).action).toBeNull()
        expect(run(tx({ status: 'refunded' })).action).toBeNull()
        expect(run(tx({ direction: 'receive' })).action).toBeNull()
    })

    test('never without activation', () => {
        mockIsActivated = false
        expect(run(tx()).action).toBeNull()
    })

    test('impression fires once per transaction, only while the drawer is open', () => {
        const { view } = run(tx(), { drawerOpen: false })
        expect(mockCapture).not.toHaveBeenCalled()

        view.rerender(<Probe transaction={tx()} drawerOpen onResult={() => {}} />)
        expect(mockCapture).toHaveBeenCalledTimes(1)
        expect(mockCapture).toHaveBeenCalledWith(
            'referral_cta_shown',
            expect.objectContaining({ variant: 'drawer_row' })
        )

        // reopen: close then open again — no double event for the same tx
        view.rerender(<Probe transaction={tx()} drawerOpen={false} onResult={() => {}} />)
        view.rerender(<Probe transaction={tx()} drawerOpen onResult={() => {}} />)
        expect(mockCapture).toHaveBeenCalledTimes(1)

        // a different transaction in the same mounted drawer fires again
        view.rerender(<Probe transaction={tx({ id: 'tx-2' })} drawerOpen onResult={() => {}} />)
        expect(mockCapture).toHaveBeenCalledTimes(2)

        // bouncing back to an already-seen transaction never re-fires —
        // the dedup is a set, not a last-id ref
        view.rerender(<Probe transaction={tx()} drawerOpen onResult={() => {}} />)
        view.rerender(<Probe transaction={tx({ id: 'tx-2' })} drawerOpen onResult={() => {}} />)
        expect(mockCapture).toHaveBeenCalledTimes(2)
    })

    test('outcome events fire only from the share onSuccess', () => {
        const result = run(tx())
        result.action?.onSelect()
        expect(mockShare).toHaveBeenCalledTimes(1)
        expect(mockCapture).not.toHaveBeenCalled()

        lastShareOptions?.onSuccess?.()
        expect(mockCapture).toHaveBeenCalledWith(
            'referral_cta_clicked',
            expect.objectContaining({ variant: 'drawer_row' })
        )
        expect(mockCapture).toHaveBeenCalledWith(
            'invite_link_shared',
            expect.objectContaining({ variant: 'drawer_row' })
        )
    })
})
