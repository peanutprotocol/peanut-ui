/**
 * QR pay's own unlock offer: a verify-once user goes straight to /verify and
 * never sees it; a user on today's flow keeps it.
 */
/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { QrKycState } from '@/constants/kyc.consts'
import { QrPayKycGateView } from '../QrPayKycGateView'

const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockScannedCountry: string
let mockRefusal: string | null
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
    usePathname: () => '/qr-pay',
}))
jest.mock('@/app/actions/kyc-workflow', () => ({ findKycDocumentPlan: jest.fn(), getKycDocumentStatus: jest.fn() }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/modals/KycRegionRestrictedModal', () => ({ KycRegionRestrictedModal: () => null }))
jest.mock('../../QrPayFlowContext', () => ({
    useQrPayFlow: () => ({
        gate: {
            kycGateState: QrKycState.REQUIRES_IDENTITY_VERIFICATION,
            sumsubFlow: { errorCooldown: null, isQrUnlockRefused: !!mockRefusal, error: mockRefusal },
            startVerification: jest.fn(),
        },
        methodIcon: undefined,
        targetMantecaCountry: mockScannedCountry,
        onBack: jest.fn(),
    }),
}))

const plan = (flow: string | null) => ({
    available: flow !== null,
    routes: [],
    flow,
    features: { qr: true, bank: false, local: false, card: false },
})
const renderView = () =>
    render(
        <IntlWrapper>
            <QrPayKycGateView />
        </IntlWrapper>
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockScannedCountry = 'AR'
    mockRefusal = null
    jest.mocked(getKycDocumentStatus).mockResolvedValue('NOT_STARTED')
})

it('keeps the stored refusal visible with a way back', () => {
    mockRefusal = 'QR payments are unavailable for this account.'
    renderView()
    expect(screen.getByText(mockRefusal)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify identity' })).not.toBeInTheDocument()
    expect(findKycDocumentPlan).not.toHaveBeenCalled()
})

it('sends a verify-once user to /verify instead of the unlock offer; today’s flow keeps the offer', async () => {
    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan('verify-once') as never)
    const { unmount } = renderView()
    // the gate is the whole page: back from /verify must not land on it again (TASK-25011)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/verify'))
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.queryByText('Unlock QR payments')).not.toBeInTheDocument()
    unmount()

    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan(null) as never)
    mockReplace.mockClear()
    renderView()
    expect(await screen.findByText('Unlock QR payments')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
})

it.each(['AR', 'BR'])('keeps the %s QR unlock independent of the local-account plan', async (country) => {
    mockScannedCountry = country
    jest.mocked(findKycDocumentPlan).mockImplementation(async (_source, _signal, feature) => {
        return (
            feature === 'local'
                ? {
                      ...plan(null),
                      entry: {
                          kind: 'reverify_for_feature',
                          feature: 'local',
                          targetProvider: 'MANTECA',
                          attemptId: null,
                      },
                  }
                : plan(null)
        ) as never
    })

    renderView()
    await waitFor(() => expect(findKycDocumentPlan).toHaveBeenCalled())
    expect(await screen.findByText('Unlock QR payments')).toBeInTheDocument()
    expect(jest.mocked(findKycDocumentPlan).mock.calls.every(([, , feature]) => feature === 'qr')).toBe(true)
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
})
