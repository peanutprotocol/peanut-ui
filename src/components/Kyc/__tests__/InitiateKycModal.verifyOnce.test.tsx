/**
 * A verify-once user goes straight to /verify from every entry point, and the
 * unlock offer never paints for them. Everyone else, and the outage and region
 * endings, keep the modal.
 */
/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { InitiateKycModal } from '../InitiateKycModal'

const mockPush = jest.fn()
const mockReplace = jest.fn()
// Remind me later's profile write is useRemindLater's own suite
jest.mock('@/components/Setup/redesign/VerifyStart/useRemindLater', () => ({ useRemindLater: () => jest.fn() }))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
    usePathname: () => '/add-money',
}))
jest.mock('@/app/actions/kyc-workflow', () => ({ findKycDocumentPlan: jest.fn(), getKycDocumentStatus: jest.fn() }))
jest.mock('@/hooks/useResidenceRestrictions', () => ({ useResidenceRestrictions: () => ({ banking: false }) }))
let mockRegionRestricted = false
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: mockRegionRestricted }),
}))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('@/components/Kyc/modals/KycRegionRestrictedModal', () => ({
    KycRegionRestrictedModal: () => <div>region-restricted</div>,
}))

const plan = (flow: string | null) => ({
    available: flow !== null,
    routes: [],
    flow,
    features: { qr: true, bank: false, local: false, card: false },
})
const renderModal = (presentation: 'page' | 'modal' = 'page') =>
    render(
        <IntlWrapper>
            <InitiateKycModal
                visible
                presentation={presentation}
                navTitle="Add money"
                onClose={jest.fn()}
                onVerify={jest.fn()}
                verifyEntry={{ corridor: 'SEPA_EU' }}
            />
        </IntlWrapper>
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockRegionRestricted = false
    jest.mocked(getKycDocumentStatus).mockResolvedValue('NOT_STARTED')
})

it('sends a verify-once user to /verify without painting the unlock offer', async () => {
    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan('verify-once') as never)
    renderModal()

    expect(screen.queryByTestId('kyc-initiate-cta')).not.toBeInTheDocument()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/verify'))
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.queryByTestId('kyc-initiate-cta')).not.toBeInTheDocument()

    // a user the plan keeps on today's flow gets the offer
    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan(null) as never)
    mockReplace.mockClear()
    renderModal()
    expect(await screen.findByTestId('kyc-initiate-cta')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()

    // the region ending outranks the redirect
    mockRegionRestricted = true
    jest.mocked(findKycDocumentPlan).mockClear()
    renderModal()
    expect(screen.getAllByText('region-restricted').length).toBeGreaterThan(0)
    expect(findKycDocumentPlan).not.toHaveBeenCalled()
})

// a page gate replaces itself with /verify, or back lands on the gate and it
// redirects again (TASK-25011). a modal the user opened keeps its screen in history.
it('keeps the opener in history when the unlock is a modal', async () => {
    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan('verify-once') as never)
    renderModal('modal')

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/verify'))
    expect(mockReplace).not.toHaveBeenCalled()
})
