/** @jest-environment jsdom */
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { ApiError } from '@/services/api-error'
import type { CapabilityRoute, NextAction } from '@/types/capabilities'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' } }, fetchUser: mockFetchUser }),
}))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
let mockNextActions: NextAction[] = []
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ nextActions: mockNextActions }) }))
// the acceptance the tap records (POST /users/kyc/accept-terms)
const mockAcceptRouteTerms = jest.fn()
jest.mock('@/services/consent', () => ({
    consentApi: { acceptRouteTerms: (key: string) => mockAcceptRouteTerms(key) },
}))
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
const TERMS_URL = 'https://app.avenia.io/Avenia-TC.pdf'
const TERMS = { key: 'accept-tos:avenia', url: TERMS_URL }

describe('PixSetup', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockNextActions = []
    })

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

    // TASK-25073: Avenia's terms, accepted once at Pix setup, before the account opens
    describe("Avenia's terms", () => {
        it("names and links Avenia's terms, the document the route gives, before the tap that accepts them", () => {
            renderSetup(route({ action: 'activate', terms: TERMS }))
            expect(screen.getByText(en.pix.setup.title)).toBeInTheDocument()
            expect(screen.getByText(en.pix.setup.body)).toBeInTheDocument()
            const link = screen.getByRole('link', { name: 'Avenia terms and conditions' })
            expect(link).toHaveAttribute('href', TERMS_URL)
            expect(link).toHaveAttribute('target', '_blank')
            // design.md consent screens: the document before the control that records the consent
            const agree = screen.getByRole('button', { name: en.pix.setup.acceptCta })
            expect(link.compareDocumentPosition(agree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
            expect(screen.queryByRole('button', { name: en.common.continue })).toBeNull()
            expect(screen.queryByText('account opening')).toBeNull()
        })

        it('records the acceptance, reads the capabilities again, then opens the account with no tap', async () => {
            mockAcceptRouteTerms.mockResolvedValue(undefined)
            const view = renderSetup(route({ action: 'activate', terms: TERMS }))
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: en.pix.setup.acceptCta }))
            })
            expect(mockAcceptRouteTerms).toHaveBeenCalledWith('accept-tos:avenia')
            expect(mockFetchUser).toHaveBeenCalled()

            // the read the acceptance asked for: no terms left, the account the first use opens
            view.rerender(<PixSetup title="Add money" onBack={jest.fn()} route={route({ action: 'activate' })} />)
            expect(screen.getByText('account opening')).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: en.pix.setup.acceptCta })).toBeNull()
        })

        it('says the acceptance was not saved, and keeps Continue to try again', async () => {
            mockAcceptRouteTerms.mockRejectedValue(new ApiError('not saved', { status: 500 }))
            renderSetup(route({ action: 'activate', terms: TERMS }))
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: en.pix.setup.acceptCta }))
            })
            expect(screen.getByRole('alert')).toHaveTextContent(en.pix.setup.termsNotSaved)
            expect(screen.getByRole('button', { name: en.pix.setup.acceptCta })).toBeEnabled()
        })

        // an Avenia account opened before the terms step accepts them at its next Pix use
        it('shows the terms on a ready route that still names them', () => {
            renderSetup(route({ state: 'ready', terms: TERMS }))
            expect(screen.getByRole('link', { name: 'Avenia terms and conditions' })).toHaveAttribute('href', TERMS_URL)
        })

        it("reads the step from the route's accept-tos next action the same way", async () => {
            mockNextActions = [
                { key: 'accept-tos:avenia', kind: 'accept-tos', purpose: 'unlock-avenia', tosUrl: TERMS_URL },
            ]
            mockAcceptRouteTerms.mockResolvedValue(undefined)
            renderSetup(route({ action: 'accept-tos:avenia', reason: { code: 'terms_required', userMessage: '' } }))
            expect(screen.getByRole('link', { name: 'Avenia terms and conditions' })).toHaveAttribute('href', TERMS_URL)
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: en.pix.setup.acceptCta }))
            })
            expect(mockAcceptRouteTerms).toHaveBeenCalledWith('accept-tos:avenia')
        })

        it('sends terms whose provider this build has no record of to support, never an unnamed consent', () => {
            renderSetup(route({ provider: 'newpix' as CapabilityRoute['provider'], terms: TERMS }))
            expect(screen.queryByRole('link')).toBeNull()
            expect(screen.getByText(en.pix.setup.notAvailable)).toBeInTheDocument()
        })
    })

    // a terms key with no accept-tos next action, or any step this build does not know, is support's to finish
    it.each(['accept-tos:avenia', 'avenia-hosted'])('sends the step %s to support', (action) => {
        renderSetup(route({ action, reason: { code: 'terms_required', userMessage: '' } }))
        expect(screen.getByText(en.pix.setup.notAvailable)).toBeInTheDocument()
    })
})
