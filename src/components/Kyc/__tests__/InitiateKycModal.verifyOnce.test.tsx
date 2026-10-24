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
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => '/add-money' }))
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

const plan = (flow: string) => ({
    available: true,
    routes: [],
    flow,
    features: { qr: true, bank: false, local: false, card: false },
})
const renderModal = () =>
    render(
        <IntlWrapper>
            <InitiateKycModal
                visible
                presentation="page"
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

    expect(screen.queryByRole('button', { name: 'Verify identity' })).not.toBeInTheDocument()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/verify'))
    expect(screen.queryByRole('button', { name: 'Verify identity' })).not.toBeInTheDocument()

    // a user the plan keeps on today's flow gets the offer
    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan('document-first') as never)
    mockPush.mockClear()
    renderModal()
    expect(await screen.findByRole('button', { name: 'Verify identity' })).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()

    // the region ending outranks the redirect
    mockRegionRestricted = true
    jest.mocked(findKycDocumentPlan).mockClear()
    renderModal()
    expect(screen.getAllByText('region-restricted').length).toBeGreaterThan(0)
    expect(findKycDocumentPlan).not.toHaveBeenCalled()
})
