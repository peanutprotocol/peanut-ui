/** @jest-environment jsdom */
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CapabilityRoute, NextAction } from '@/types/capabilities'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' } }, fetchUser: mockFetchUser }),
}))
// the hand-off to the provider's page: which link it opens, and the tap that opens it
const mockHostedStart = jest.fn()
const mockHostedHook = jest.fn((_key: string, _options: { url?: string }) => ({
    start: mockHostedStart,
    isStarting: false,
    error: null as string | null,
    isSettling: false,
    stillPendingAfterReturn: false,
}))
jest.mock('@/hooks/useHostedVerification', () => ({
    useHostedVerification: (key: string, options: { url?: string }) => mockHostedHook(key, options),
}))
const mockOpenSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: mockOpenSupport }),
    useModalsContextOptional: () => null,
}))
let mockNextActions: NextAction[] = []
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ nextActions: mockNextActions }) }))
const mockAccept = jest.fn()
const mockTermsHook = jest.fn((key: string | undefined) => ({
    accept: mockAccept,
    isAccepting: false,
    error: null,
    key,
}))
jest.mock('@/hooks/useRouteTermsAcceptance', () => ({
    useRouteTermsAcceptance: (key: string | undefined) => mockTermsHook(key),
}))
const mockGate = jest.fn()
jest.mock('@/features/paperwork-verification/KycFeatureActivationGate', () => ({
    KycFeatureActivationGate: (props: { feature: string; scope: unknown }) => {
        mockGate(props.feature, props.scope)
        return <div>activation gate</div>
    },
}))

import { PixSetup } from '../components/PixSetup'

const TERMS_URL = 'https://app.avenia.io/Avenia-TC.pdf'
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
    beforeEach(() => {
        jest.clearAllMocks()
        mockNextActions = [
            { key: 'accept-tos:avenia', kind: 'accept-tos', purpose: 'unlock-avenia', tosUrl: TERMS_URL },
        ]
    })

    it("names and links Avenia's terms, the document the API versions, before the tap that accepts them", () => {
        renderSetup(route({ action: 'accept-tos:avenia', reason: { code: 'terms_required', userMessage: '' } }))

        expect(screen.getByRole('link')).toHaveAttribute('href', TERMS_URL)
        expect(mockTermsHook).toHaveBeenCalledWith('accept-tos:avenia')
        fireEvent.click(screen.getByRole('button', { name: en.common.continue }))
        expect(mockAccept).toHaveBeenCalled()
    })

    it.each([
        ['provider_reviewing', en.pix.setup.reviewing],
        ['identity_import_unavailable', en.pix.setup.importUnavailable],
    ])('waits with the reason as user text (%s)', (code, text) => {
        renderSetup(route({ state: 'pending', reason: { code, userMessage: '' } }))
        expect(screen.getByText(text)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.continue })).toBeNull()
    })

    it('sends a missing CPF to support', () => {
        renderSetup(route({ state: 'pending', reason: { code: 'tax_id_missing', userMessage: '' } }))
        expect(screen.getByText(en.pix.setup.cpfRequired)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
        expect(mockOpenSupport).toHaveBeenCalled()
    })

    it('sends a user whose identity is not verified to the identity check first', () => {
        renderSetup(route({ action: 'verify' }))
        fireEvent.click(screen.getByRole('button', { name: en.pix.setup.verifyCta }))
        expect(mockPush).toHaveBeenCalledWith('/verify')
        expect(mockTermsHook).toHaveBeenCalledWith(undefined)
    })

    // the first use opens the provider's account (route action `activate`): the activation gate opens it,
    // and the route turns ready once it is open
    it('opens the account the first use needs through the activation gate', () => {
        renderSetup(route({ provider: 'manteca', action: 'activate' }))
        expect(screen.getByText('activation gate')).toBeInTheDocument()
        expect(mockGate).toHaveBeenCalledWith('local', { channel: 'bank', country: 'BR' })
        expect(mockTermsHook).toHaveBeenCalledWith(undefined)
    })

    describe("Avenia's own identity check, where it takes no shared verification", () => {
        const LINK = 'https://avenia.example/identity/u1'
        const hosted = (expiresAt: string): NextAction => ({
            key: 'avenia-hosted',
            kind: 'avenia-hosted',
            purpose: 'avenia-identity',
            url: LINK,
            expiresAt,
        })
        const SOON = () => new Date(Date.now() + 10 * 60_000).toISOString()
        const verifyStep = () =>
            route({ action: 'verify', reason: { code: 'provider_identity_required', userMessage: '' } })

        it("after the terms, opens the check on the provider's page, never the Peanut one", () => {
            mockNextActions = [hosted(SOON())]
            renderSetup(verifyStep())

            expect(screen.getByText(en.pix.setup.hosted.body)).toBeInTheDocument()
            expect(mockHostedHook).toHaveBeenLastCalledWith('avenia-hosted', { url: LINK })
            fireEvent.click(screen.getByRole('button', { name: en.pix.setup.verifyCta }))
            expect(mockHostedStart).toHaveBeenCalledTimes(1)
            expect(mockPush).not.toHaveBeenCalled()
        })

        it('also when the route names the hosted step by its key', () => {
            mockNextActions = [hosted(SOON())]
            renderSetup(route({ action: 'avenia-hosted' }))
            expect(screen.getByRole('button', { name: en.pix.setup.verifyCta })).toBeInTheDocument()
        })

        it("reads the capabilities again on I'm done", () => {
            mockNextActions = [hosted(SOON())]
            renderSetup(verifyStep())
            fireEvent.click(screen.getByRole('button', { name: en.common.done }))
            expect(mockFetchUser).toHaveBeenCalledTimes(1)
        })

        // the read after the user comes back: the route waits on the provider's decision
        it('moves to the waiting screen once the route waits on the decision', () => {
            mockNextActions = [hosted(SOON())]
            const view = renderSetup(verifyStep())
            view.rerender(
                <PixSetup
                    title="Add money"
                    onBack={jest.fn()}
                    route={route({ state: 'pending', reason: { code: 'provider_reviewing', userMessage: '' } })}
                />
            )
            expect(screen.getByText(en.pix.setup.reviewing)).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: en.pix.setup.verifyCta })).toBeNull()
        })

        it('offers a new link once the link has expired, and a capabilities read mints it', () => {
            mockNextActions = [hosted(new Date(Date.now() - 1_000).toISOString())]
            renderSetup(verifyStep())

            expect(screen.getByText(en.pix.setup.hosted.expired)).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: en.pix.setup.verifyCta })).toBeNull()
            expect(mockHostedHook).toHaveBeenLastCalledWith('avenia-hosted', { url: undefined })
            fireEvent.click(screen.getByRole('button', { name: en.pix.setup.hosted.newLink }))
            expect(mockFetchUser).toHaveBeenCalledTimes(1)
        })

        it('turns to a new link when the link runs out on screen', () => {
            jest.useFakeTimers()
            try {
                mockNextActions = [hosted(new Date(Date.now() + 5_000).toISOString())]
                renderSetup(verifyStep())
                expect(screen.getByRole('button', { name: en.pix.setup.verifyCta })).toBeInTheDocument()
                act(() => {
                    jest.advanceTimersByTime(5_001)
                })
                expect(screen.getByRole('button', { name: en.pix.setup.hosted.newLink })).toBeInTheDocument()
            } finally {
                jest.useRealTimers()
            }
        })

        // the share-token path: the API shares the verification, so the terms lead straight to the wait
        it('keeps the identity check of a user with no hosted step on the Peanut verification', () => {
            mockNextActions = []
            renderSetup(route({ action: 'verify' }))
            expect(screen.getByRole('button', { name: en.pix.setup.verifyCta })).toBeInTheDocument()
            expect(screen.queryByText(en.pix.setup.hosted.body)).toBeNull()
        })

        it('says why when the provider did not pass the identity, and offers support', () => {
            mockNextActions = [{ key: 'contact-support:avenia', kind: 'contact-support', purpose: 'avenia-support' }]
            renderSetup(
                route({
                    action: 'contact-support:avenia',
                    reason: { code: 'IDENTITY_REJECTED', userMessage: 'Avenia could not verify the identity.' },
                })
            )
            expect(screen.getByText(en.pix.rejected)).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
            expect(mockOpenSupport.mock.calls[0][0]).toContain('purpose: avenia-support')
        })
    })

    it('sends a terms step whose provider this build has no record of to support, never an unnamed consent', () => {
        renderSetup(
            route({
                // a code no registry entry answers for
                provider: 'newpix' as CapabilityRoute['provider'],
                action: 'accept-tos:avenia',
                reason: { code: 'terms_required', userMessage: '' },
            })
        )
        expect(screen.queryByRole('link')).toBeNull()
        expect(screen.getByText(en.pix.setup.notAvailable)).toBeInTheDocument()
    })
})
