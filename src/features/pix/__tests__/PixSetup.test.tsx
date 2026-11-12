/** @jest-environment jsdom */
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
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
// our own identity check: done, or not yet (TASK-24841: the provider checks first)
let mockVerified = true
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isVerified: mockVerified }) }))
// the hand-off to the provider's page: which link it opens, and the tap that opens it
const mockHostedStart = jest.fn()
const HOSTED_IDLE = {
    start: mockHostedStart,
    isStarting: false,
    error: null as string | null,
    isSettling: false,
    stillPendingAfterReturn: false,
    opened: false,
}
const mockHostedHook = jest.fn((_key: string, _options: { url?: string }) => ({ ...HOSTED_IDLE }))
const resetHosted = () => {
    mockHostedHook.mockReset()
    mockHostedHook.mockImplementation(() => ({ ...HOSTED_IDLE }))
}
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

    // TASK-24841: before our own check, the terms screen says the provider checks the identity itself
    it('tells a user we have not verified that the provider checks them and other accounts may ask again', () => {
        mockVerified = false
        try {
            renderSetup(route({ action: 'accept-tos:avenia', reason: { code: 'terms_required', userMessage: '' } }))
            expect(
                screen.getByText(en.pix.setup.bodyBeforeVerification.replace('{brand}', 'Avenia'))
            ).toBeInTheDocument()
            expect(screen.queryByText(en.pix.setup.body)).toBeNull()
            expect(screen.getByRole('link')).toHaveAttribute('href', TERMS_URL)
        } finally {
            mockVerified = true
        }
    })

    it('keeps the short line for a user we have verified', () => {
        renderSetup(route({ action: 'accept-tos:avenia', reason: { code: 'terms_required', userMessage: '' } }))
        expect(screen.getByText(en.pix.setup.body)).toBeInTheDocument()
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
            kind: 'hosted-identity',
            purpose: 'unlock-avenia',
            url: LINK,
            expiresAt,
        })
        const SOON = () => new Date(Date.now() + 10 * 60_000).toISOString()
        // the route names the hosted action by its key, as it names the terms
        const hostedStep = () =>
            route({
                action: 'avenia-hosted',
                reason: {
                    code: 'identity_hosted_pending',
                    userMessage: 'Verify your identity with our payments partner to continue.',
                },
            })

        it("after the terms, opens the check on the provider's page, never the Peanut one", () => {
            mockNextActions = [hosted(SOON())]
            renderSetup(hostedStep())

            expect(screen.getByText(en.pix.setup.hosted.body.replace('{brand}', 'Avenia'))).toBeInTheDocument()
            expect(mockHostedHook).toHaveBeenLastCalledWith('hosted-identity', { url: LINK })
            fireEvent.click(screen.getByRole('button', { name: en.pix.setup.verifyCta }))
            expect(mockHostedStart).toHaveBeenCalledTimes(1)
            expect(mockPush).not.toHaveBeenCalled()
        })

        it('names our payment partner where the route names no provider this build knows', () => {
            mockNextActions = [hosted(SOON())]
            renderSetup({ ...hostedStep(), provider: null })
            expect(screen.getByText(en.pix.setup.hosted.bodyPartner)).toBeInTheDocument()
            expect(screen.queryByText('Verify with .')).toBeNull()
        })

        // Aleks, 2026-11-12: no Done link. Once the page was opened from here, the screen says it
        // waits for the provider's answer, only reopens the page, and reads the capabilities on its own.
        it("after the page was opened, waits for the provider's answer in the open and only reopens the page", () => {
            mockNextActions = [hosted(SOON())]
            mockHostedHook.mockReturnValue({ ...HOSTED_IDLE, opened: true })
            try {
                renderSetup(hostedStep())
                expect(screen.getByText(en.pix.setup.hosted.back.replace('{brand}', 'Avenia'))).toBeInTheDocument()
                expect(screen.queryByRole('button', { name: en.pix.setup.verifyCta })).toBeNull()
                expect(screen.queryByRole('button', { name: en.common.done })).toBeNull()
                fireEvent.click(
                    screen.getByRole('button', { name: en.pix.setup.hosted.openAgain.replace('{brand}', 'Avenia') })
                )
                expect(mockHostedStart).toHaveBeenCalledTimes(1)
            } finally {
                resetHosted()
            }
        })

        it('names our payment partner in the waiting line and button where the route names no provider', () => {
            mockNextActions = [hosted(SOON())]
            mockHostedHook.mockReturnValue({ ...HOSTED_IDLE, opened: true })
            try {
                renderSetup({ ...hostedStep(), provider: null })
                expect(screen.getByText(en.pix.setup.hosted.backPartner)).toBeInTheDocument()
                expect(screen.getByRole('button', { name: en.pix.setup.hosted.openAgainPartner })).toBeInTheDocument()
            } finally {
                resetHosted()
            }
        })

        it('reads the capabilities again on focus, on return to the tab, and every 10 s once the page was opened', async () => {
            jest.useFakeTimers()
            mockHostedHook.mockReturnValue({ ...HOSTED_IDLE, opened: true })
            try {
                mockNextActions = [hosted(SOON())]
                const view = renderSetup(hostedStep())
                expect(mockFetchUser).not.toHaveBeenCalled()

                await act(async () => {
                    window.dispatchEvent(new Event('focus'))
                })
                expect(mockFetchUser).toHaveBeenCalledTimes(1)
                await act(async () => {
                    document.dispatchEvent(new Event('visibilitychange'))
                })
                expect(mockFetchUser).toHaveBeenCalledTimes(2)
                // one read at a time: each tick's read settles before the next tick
                await act(async () => {
                    jest.advanceTimersByTime(10_000)
                })
                expect(mockFetchUser).toHaveBeenCalledTimes(3)
                await act(async () => {
                    jest.advanceTimersByTime(10_000)
                })
                expect(mockFetchUser).toHaveBeenCalledTimes(4)

                // unmounted, it stops
                view.unmount()
                await act(async () => {
                    jest.advanceTimersByTime(30_000)
                })
                expect(mockFetchUser).toHaveBeenCalledTimes(4)
            } finally {
                resetHosted()
                jest.useRealTimers()
            }
        })

        it('reads nothing before the page was opened, nor once the link has expired', async () => {
            jest.useFakeTimers()
            try {
                mockNextActions = [hosted(SOON())]
                const before = renderSetup(hostedStep())
                await act(async () => {
                    window.dispatchEvent(new Event('focus'))
                    jest.advanceTimersByTime(30_000)
                })
                expect(mockFetchUser).not.toHaveBeenCalled()
                before.unmount()

                mockNextActions = [hosted(new Date(Date.now() - 1_000).toISOString())]
                mockHostedHook.mockReturnValue({ ...HOSTED_IDLE, opened: true })
                renderSetup(hostedStep())
                await act(async () => {
                    jest.advanceTimersByTime(30_000)
                })
                expect(mockFetchUser).not.toHaveBeenCalled()
            } finally {
                resetHosted()
                jest.useRealTimers()
            }
        })

        // after the submit the route waits on the provider's decision, with no action
        it('moves to the waiting screen once the route waits on the decision', () => {
            mockNextActions = [hosted(SOON())]
            const view = renderSetup(hostedStep())
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
            renderSetup(hostedStep())

            expect(screen.getByText(en.pix.setup.hosted.expired)).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: en.pix.setup.verifyCta })).toBeNull()
            expect(mockHostedHook).toHaveBeenLastCalledWith('hosted-identity', { url: undefined })
            fireEvent.click(screen.getByRole('button', { name: en.pix.setup.hosted.newLink }))
            expect(mockFetchUser).toHaveBeenCalledTimes(1)
        })

        // the browser or the native bridge could not open the page: the line says so, and Verify tries again
        it('says the page did not open and keeps Verify to try again', () => {
            mockNextActions = [hosted(SOON())]
            mockHostedHook.mockReturnValue({
                ...HOSTED_IDLE,
                error: "We couldn't open the verification. Please try again in a moment.",
            })
            try {
                renderSetup(hostedStep())
                expect(screen.getByRole('alert')).toHaveTextContent(en.pix.setup.hosted.failed)
                const verify = screen.getByRole('button', { name: en.pix.setup.verifyCta })
                expect(verify).toBeEnabled()
                fireEvent.click(verify)
                expect(mockHostedStart).toHaveBeenCalledTimes(1)
            } finally {
                resetHosted()
            }
        })

        it('says the read for a new link failed and keeps Get a new link to try again', async () => {
            mockNextActions = [hosted(new Date(Date.now() - 1_000).toISOString())]
            mockFetchUser.mockRejectedValueOnce(new Error('offline'))
            renderSetup(hostedStep())

            fireEvent.click(screen.getByRole('button', { name: en.pix.setup.hosted.newLink }))
            expect(await screen.findByRole('alert')).toHaveTextContent(en.pix.setup.hosted.failed)
            expect(mockFetchUser).toHaveBeenCalledWith({ throwOnError: true })
            const again = screen.getByRole('button', { name: en.pix.setup.hosted.newLink })
            expect(again).toBeEnabled()
            fireEvent.click(again)
            await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
        })

        it('turns to a new link when the link runs out on screen', () => {
            jest.useFakeTimers()
            try {
                mockNextActions = [hosted(new Date(Date.now() + 5_000).toISOString())]
                renderSetup(hostedStep())
                expect(screen.getByRole('button', { name: en.pix.setup.verifyCta })).toBeInTheDocument()
                act(() => {
                    jest.advanceTimersByTime(5_001)
                })
                expect(screen.getByRole('button', { name: en.pix.setup.hosted.newLink })).toBeInTheDocument()
            } finally {
                jest.useRealTimers()
            }
        })

        // `verify` keeps meaning the Peanut identity check, whatever else the user still has to do
        it('keeps a verify step on the Peanut verification, even while a hosted check is offered', () => {
            mockNextActions = [hosted(SOON())]
            renderSetup(route({ action: 'verify' }))
            fireEvent.click(screen.getByRole('button', { name: en.pix.setup.verifyCta }))
            expect(mockPush).toHaveBeenCalledWith('/verify')
            expect(screen.queryByText(en.pix.setup.hosted.body.replace('{brand}', 'Avenia'))).toBeNull()
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
