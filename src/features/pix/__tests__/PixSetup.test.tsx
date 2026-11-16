/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CapabilityRoute } from '@/types/capabilities'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
const mockOpenSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: mockOpenSupport }),
    useModalsContextOptional: () => null,
}))
const mockGate = jest.fn()
jest.mock('@/features/paperwork-verification/KycFeatureActivationGate', () => ({
    KycFeatureActivationGate: (props: { feature: string; scope: unknown }) => {
        mockGate(props.feature, props.scope)
        return <div>activation gate</div>
    },
}))
jest.mock('@/features/pix/components/PixAccountOpening', () => ({
    PixAccountOpening: () => <div>account opening</div>,
}))

import { PixSetup } from '../components/PixSetup'

const route = (overrides: Partial<CapabilityRoute>): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'action_required',
    candidates: [],
    ...overrides,
})
const renderSetup = (r: CapabilityRoute) => renderWithIntl(<PixSetup title="Add money" onBack={jest.fn()} route={r} />)

describe('PixSetup', () => {
    beforeEach(() => jest.clearAllMocks())

    it('sends a user whose identity is not verified to the identity check first', () => {
        renderSetup(route({ action: 'verify' }))
        fireEvent.click(screen.getByRole('button', { name: en.pix.setup.verifyCta }))
        expect(mockPush).toHaveBeenCalledWith('/verify')
    })

    // TASK-24947: Avenia relies on our verification, so its account opens with no tap and no terms
    it("opens Avenia's account with no tap", () => {
        renderSetup(route({ action: 'activate' }))
        expect(screen.getByText('account opening')).toBeInTheDocument()
        expect(mockGate).not.toHaveBeenCalled()
        expect(screen.queryByRole('link')).toBeNull()
        expect(screen.queryByRole('button', { name: en.common.continue })).toBeNull()
    })

    // Manteca keeps its first-use consent: the activation gate asks for the tap
    it("keeps Manteca's first use behind the activation gate", () => {
        renderSetup(route({ provider: 'manteca', action: 'activate' }))
        expect(screen.getByText('activation gate')).toBeInTheDocument()
        expect(mockGate).toHaveBeenCalledWith('local', { channel: 'bank', country: 'BR' })
    })

    it('waits while the provider opens the account', () => {
        renderSetup(route({ state: 'pending', reason: { code: 'provider_reviewing', userMessage: '' } }))
        expect(screen.getByText(en.pix.setup.reviewing)).toBeInTheDocument()
        expect(screen.queryByRole('button')).toBeNull()
    })

    // a terms step this build no longer shows, or any step it does not know, is support's to finish
    it.each(['accept-tos:avenia', 'avenia-hosted'])('sends the step %s to support', (action) => {
        renderSetup(route({ action, reason: { code: 'terms_required', userMessage: '' } }))
        expect(screen.getByText(en.pix.setup.notAvailable)).toBeInTheDocument()
    })
})
