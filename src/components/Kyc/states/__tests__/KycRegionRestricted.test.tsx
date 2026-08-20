import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { type ReactNode } from 'react'
import { KycRegionRestricted } from '../KycRegionRestricted'
import { KycRegionRestrictedModal } from '../../modals/KycRegionRestrictedModal'
import { InitiateKycModal } from '../../InitiateKycModal'

let mockRegionRestricted = false
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: mockRegionRestricted }),
}))

const push = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: (...args: unknown[]) => push(...args) }),
}))

jest.mock('../../KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: () => <div data-testid="kyc-status-drawer-item" />,
}))

jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: ({ label, value }: { label: string; value: string }) => (
        <div>
            {label}: {value}
        </div>
    ),
}))

jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/useLongPress', () => ({
    useLongPress: () => ({ isLongPressed: false, pressProgress: 0, handlers: {} }),
}))

beforeEach(() => {
    push.mockClear()
    mockRegionRestricted = false
})

// The surfaces differ (drawer card vs modal) but the promises they make must
// not, so the contract assertions run against both.
const surfaces: Array<[string, () => void]> = [
    ['drawer state', () => renderWithIntl(<KycRegionRestricted reviewedAt="2026-08-01T10:00:00.000Z" />)],
    ['modal', () => renderWithIntl(<KycRegionRestrictedModal visible onClose={jest.fn()} />)],
]

describe.each(surfaces)('region-restricted %s', (_name, renderSurface) => {
    it('explains the block without naming a country', () => {
        renderSurface()

        expect(screen.getByText(/doesn't accept documents issued in your country/i)).toBeInTheDocument()
        // The Sumsub list must be changeable without touching this copy.
        expect(document.body.textContent).not.toMatch(/russia|china|hong kong/i)
    })

    it('tells the user what they can still do', () => {
        renderSurface()
        expect(screen.getByText(/funds are safe/i)).toBeInTheDocument()
        expect(screen.getByText(/send and receive money/i)).toBeInTheDocument()
    })

    // Asserted on CONTROLS, not on prose: the body copy legitimately contains
    // "Re-uploading won't change the result", and a text-level ban would forbid
    // the sentence that does the explaining.
    it('offers exactly one action, and it is not a retry or a support punt', () => {
        renderSurface()

        // The modal also renders an unlabelled X for dismissal — chrome, not an
        // action. Count only the buttons that make an offer to the user.
        const actions = screen.getAllByRole('button').filter((b) => b.textContent?.trim())
        expect(actions).toHaveLength(1)
        expect(actions[0]).toHaveTextContent('Send or request money')
    })

    it('never labels a control with a retry or support action', () => {
        renderSurface()

        for (const pattern of [/try again/i, /retry/i, /re-?submit/i, /upload/i, /support/i]) {
            expect(screen.queryByRole('button', { name: pattern })).not.toBeInTheDocument()
            expect(screen.queryByRole('link', { name: pattern })).not.toBeInTheDocument()
        }
    })

    it('sends the user to the part of the app that still works', () => {
        renderSurface()
        fireEvent.click(screen.getByText('Send or request money'))
        expect(push).toHaveBeenCalledWith('/send')
    })
})

describe('region-restricted drawer state', () => {
    it('shows when the decision landed', () => {
        renderWithIntl(<KycRegionRestricted reviewedAt="2026-08-01T10:00:00.000Z" />)
        expect(screen.getByText(/Rejected on: August 1, 2026/)).toBeInTheDocument()
    })

    it('degrades to N/A rather than crashing on a missing or unparseable date', () => {
        const { unmount } = renderWithIntl(<KycRegionRestricted />)
        expect(screen.getByText(/Rejected on: N\/A/)).toBeInTheDocument()
        unmount()

        renderWithIntl(<KycRegionRestricted reviewedAt="not-a-date" />)
        expect(screen.getByText(/Rejected on: N\/A/)).toBeInTheDocument()
    })

    it('runs the caller hook before navigating, so the drawer closes behind it', () => {
        const onNavigate = jest.fn()
        renderWithIntl(<KycRegionRestricted onNavigate={onNavigate} />)

        fireEvent.click(screen.getByText('Send or request money'))

        expect(onNavigate).toHaveBeenCalledTimes(1)
        expect(push).toHaveBeenCalledWith('/send')
    })
})

describe('InitiateKycModal — region-restricted short-circuit', () => {
    // The six bank/withdraw gates compute their variant from a rail gate that
    // cannot see WHY identity failed. Whatever they ask for, a region-restricted
    // user must never be offered verification or support.
    const variants = ['default', 'blocked', 'provider_rejection', 'restart_identity', 'cross_region'] as const

    it.each(variants)('overrides the %s variant with the region screen', (variant) => {
        mockRegionRestricted = true
        renderWithIntl(<InitiateKycModal visible onClose={jest.fn()} onVerify={jest.fn()} variant={variant} />)

        expect(screen.getByText(/doesn't accept documents issued in your country/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /unlock/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /support/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument()
    })

    it('never starts a Sumsub flow — the CTA navigates instead of verifying', () => {
        mockRegionRestricted = true
        const onVerify = jest.fn()
        renderWithIntl(<InitiateKycModal visible onClose={jest.fn()} onVerify={onVerify} variant="default" />)

        fireEvent.click(screen.getByText('Send or request money'))

        expect(onVerify).not.toHaveBeenCalled()
        expect(push).toHaveBeenCalledWith('/send')
    })

    it('leaves every other user on the normal unlock flow', () => {
        mockRegionRestricted = false
        const onVerify = jest.fn()
        renderWithIntl(<InitiateKycModal visible onClose={jest.fn()} onVerify={onVerify} variant="default" />)

        expect(screen.getByText('Unlock your account')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Unlock now'))
        expect(onVerify).toHaveBeenCalledTimes(1)
    })
})
