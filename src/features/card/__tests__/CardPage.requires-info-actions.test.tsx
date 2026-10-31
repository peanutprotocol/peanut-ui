/**
 * Card status screen, "needs more information" state: Rain tax-ID and
 * date-of-birth actions (TASK-23561).
 *
 * Rendered through CardPage with the real capability read-model and the real
 * start-action server action; only the network edge (serverFetch) and the
 * Sumsub SDK driver are faked. The screen offers one action at a time. The
 * new buttons are located structurally (every actionable control that is not
 * a known one) so the tests do not depend on copy.
 */
import React from 'react'
import { act, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { serverFetch } from '@/utils/api-fetch'
import { initiateSelfHealResubmission } from '@/app/actions/sumsub'
import type { NextAction, RailCapability } from '@/types/capabilities'
import { CardPage } from '../CardPage'

const mockSetSupportOpen = jest.fn()
const mockHostedStart = jest.fn()
let mockUser: Record<string, unknown>
const mockSumsubInstances = new Map<string, Record<string, unknown>>()

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    initiateSelfHealResubmission: jest.fn(),
}))
jest.mock('next/navigation', () => ({
    notFound: jest.fn(),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/card',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: undefined, isLoading: false, error: null, refetch: jest.fn() }),
    useQueryClient: () => ({ invalidateQueries: jest.fn(), isFetching: () => 0 }),
    useIsFetching: () => 0,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
jest.mock('@/services/card', () => ({ cardApi: { getInfo: jest.fn() } }))
jest.mock('@/services/rain', () => ({
    rainApi: { applyForCard: jest.fn(), getCardApplyReadiness: jest.fn() },
}))
jest.mock('@/services/consent', () => ({ cardConsentDocuments: jest.fn(() => []) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, fetchUser: jest.fn(), isFetchingUser: false }),
    useOptionalAuth: () => ({ user: mockUser }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
    useRainCardOverview: () => ({
        overview: { status: { hasApplication: true, railStatus: 'REQUIRES_INFORMATION' }, cards: [] },
        isLoading: false,
        error: null,
    }),
}))
jest.mock('@/components/Card/cardState.utils', () => ({
    computeCardState: () => 'requires-info',
    findActiveCard: () => undefined,
}))
jest.mock('@/components/Card/cardApply.utils', () => ({ pollUntilApplyAdvances: jest.fn(), pollUntilReady: jest.fn() }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ hasSufficientSpendableBalance: () => true }) }))
jest.mock('@/hooks/wallet/useRainFunding', () => ({ useRainFunding: () => ({ grant: jest.fn() }) }))
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({ useGrantSessionKey: () => ({ serializeGrant: jest.fn() }) }))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ address: '0xA' }) }))
jest.mock('@/hooks/useHostedVerification', () => ({
    useHostedVerification: () => ({ start: mockHostedStart, error: null, isStarting: false }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockSetSupportOpen }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useSumsubReloadResume', () => ({ useSumsubReloadResume: jest.fn() }))
jest.mock('@/hooks/useNotifications', () => ({ offerPushPrompt: jest.fn() }))
jest.mock('@/components/Card/YourCardScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/CardTermsScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/CardCountryConfirmScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('../components/CardAcquisitionScreen', () => ({
    CardAcquisitionScreen: () => null,
    CardMilestoneScreen: () => null,
}))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="loading" /> }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? '')} />,
}))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: function MockSumsubKycWrapper(props: Record<string, unknown>) {
        const id = String((props.sessionKey as string | undefined) ?? 'default')
        mockSumsubInstances.set(id, props)
        return props.visible ? <div data-testid="sumsub-sdk" data-token={String(props.accessToken ?? '')} /> : null
    },
}))

const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const mockSelfHeal = initiateSelfHealResubmission as jest.MockedFunction<typeof initiateSelfHealResubmission>

const START_ACTION = '/users/kyc/start-action'
const taxId: NextAction = {
    key: 'sumsub:tax_identification_number',
    kind: 'sumsub',
    purpose: 'rain-card',
    levelKey: 'tax_identification_number',
}
const birthDate: NextAction = {
    key: 'sumsub:birth_details',
    kind: 'sumsub',
    purpose: 'rain-card',
    levelKey: 'birth_details',
}
const proofOfAddress: NextAction = {
    key: 'sumsub:proof_of_address',
    kind: 'sumsub',
    purpose: 'rain-card',
    levelKey: 'proof_of_address',
}
const identityDocument: NextAction = { key: 'rain:hosted_identity', kind: 'rain-hosted', purpose: 'rain-card' }
const identityVerification: NextAction = {
    key: 'sumsub:rain_identity_verification',
    kind: 'sumsub',
    purpose: 'rain-card',
    levelKey: 'rain_identity_verification',
}

const tokenFor: Record<string, string> = {
    [taxId.key]: 'tok_tax_id',
    [birthDate.key]: 'tok_birth_date',
}

function cardRail(blockingActions: string[]): RailCapability {
    return {
        id: 'rain.card',
        provider: 'rain',
        method: 'CARD',
        channel: 'card',
        country: 'GLOBAL',
        currency: 'USD',
        status: 'requires-info',
        blockingActions,
        reason: { code: 'rain_requires_information', userMessage: 'Rain needs a few more details.' },
    }
}

function otherRail(blockingActions: string[]): RailCapability {
    return {
        id: 'bridge.sepa',
        provider: 'bridge',
        method: 'SEPA',
        channel: 'bank',
        country: 'EU',
        currency: 'EUR',
        status: 'requires-info',
        blockingActions,
    }
}

function setCapabilities({
    cardActions = [],
    knownActions = cardActions,
    otherRailActions = [],
}: {
    cardActions?: NextAction[]
    knownActions?: NextAction[]
    otherRailActions?: NextAction[]
}): void {
    mockUser = {
        user: { userId: 'user-1' },
        accounts: [],
        capabilities: {
            rails: [cardRail(cardActions.map((a) => a.key)), otherRail(otherRailActions.map((a) => a.key))],
            nextActions: [...knownActions, ...otherRailActions],
            restrictions: [],
        },
    }
}

function respond(status: number, body: unknown): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

function mockStartActionSuccess(): void {
    mockFetch.mockImplementation(async (_url, init) => {
        const { key } = JSON.parse(String(init?.body))
        return respond(200, {
            sumsubAccessToken: tokenFor[key] ?? 'tok_unknown',
            levelName: 'rain-level',
            externalActionId: 'ext',
        })
    })
}

const startActionKeys = (): string[] =>
    mockFetch.mock.calls
        .filter(([url]) => url === START_ACTION)
        .map(([, init]) => JSON.parse(String(init?.body)).key as string)

const KNOWN_CONTROL = /contact support|upload proof of address|upload identity documents/i

function newActionButtons(): HTMLElement[] {
    return screen
        .queryAllByRole('button')
        .filter(
            (button) =>
                button.getAttribute('data-testid') !== 'nav-back' && !KNOWN_CONTROL.test(button.textContent ?? '')
        )
}

function openSdkTokens(): string[] {
    return screen.queryAllByTestId('sumsub-sdk').map((node) => node.getAttribute('data-token') ?? '')
}

function visibleTexts(): string[] {
    return Array.from(document.body.querySelectorAll('*'))
        .filter((el) => el.children.length === 0)
        .map((el) => (el.textContent ?? '').trim())
        .filter(Boolean)
}

const render = () => rtlRender(<CardPage />, { wrapper: IntlWrapper })

async function settle(): Promise<void> {
    await act(async () => {
        for (let tick = 0; tick < 6; tick++) await Promise.resolve()
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
    mockSelfHeal.mockReset()
    mockSumsubInstances.clear()
    setCapabilities({})
})

describe('Rain tax-ID and date-of-birth actions on the requires-information card screen', () => {
    it.each([
        ['tax ID', taxId],
        ['date of birth', birthDate],
    ])('shows one button for the %s action that starts it and opens Sumsub with its token', async (_label, action) => {
        setCapabilities({ cardActions: [action] })
        mockStartActionSuccess()
        render()
        const buttons = newActionButtons()
        expect(buttons).toHaveLength(1)
        expect(buttons[0]).toBeEnabled()
        expect((buttons[0].textContent ?? '').trim()).not.toMatch(/^[a-z]+(\.[A-Za-z]+)+$/)

        fireEvent.click(buttons[0])
        await waitFor(() => expect(openSdkTokens()).toEqual([tokenFor[action.key]]))
        expect(startActionKeys()).toEqual([action.key])
    })

    it.each([
        ['tax ID first', [taxId, birthDate]],
        ['date of birth first', [birthDate, taxId]],
    ])('offers only the first action the API returns (%s)', async (_label, actions) => {
        setCapabilities({ cardActions: actions })
        mockStartActionSuccess()
        render()
        const buttons = newActionButtons()
        expect(buttons).toHaveLength(1)

        fireEvent.click(buttons[0])
        await waitFor(() => expect(openSdkTokens()).toEqual([tokenFor[actions[0].key]]))
        expect(startActionKeys()).toEqual([actions[0].key])
    })

    it('offers the next action once the first is no longer open', async () => {
        setCapabilities({ cardActions: [taxId, birthDate] })
        mockStartActionSuccess()
        const { rerender } = render()
        const firstLabel = newActionButtons()[0].textContent

        setCapabilities({ cardActions: [birthDate] })
        rerender(<CardPage />)
        const [next] = newActionButtons()
        expect(next.textContent).not.toBe(firstLabel)
        fireEvent.click(next)
        await waitFor(() => expect(openSdkTokens()).toEqual([tokenFor[birthDate.key]]))
        expect(startActionKeys()).toEqual([birthDate.key])
    })

    it('offers only the proof-of-address upload when the rail carries every kind of action', async () => {
        setCapabilities({ cardActions: [proofOfAddress, identityDocument, taxId, birthDate] })
        mockSelfHeal.mockResolvedValue({ data: { token: 'tok_poa' } } as never)
        render()
        expect(newActionButtons()).toHaveLength(0)
        expect(screen.queryByText('Upload identity documents')).not.toBeInTheDocument()
        expect(screen.getByText('Contact support')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Upload proof of address'))
        await waitFor(() => expect(mockSelfHeal).toHaveBeenCalledWith('RAIN'))
        await waitFor(() => expect(openSdkTokens()).toEqual(['tok_poa']))
        expect(mockHostedStart).not.toHaveBeenCalled()
        expect(startActionKeys()).toEqual([])
    })

    it('opens our Sumsub flow for the selfie and ID Rain asks for on needsVerification', async () => {
        setCapabilities({ cardActions: [identityVerification] })
        mockSelfHeal.mockResolvedValue({ data: { token: 'tok_identity' } } as never)
        render()

        fireEvent.click(screen.getByText('Upload identity documents'))
        await waitFor(() => expect(mockSelfHeal).toHaveBeenCalledWith('RAIN'))
        await waitFor(() => expect(openSdkTokens()).toEqual(['tok_identity']))
        expect(mockHostedStart).not.toHaveBeenCalled()
        expect(startActionKeys()).toEqual([])
    })

    it('offers the identity upload ahead of the tax-ID and date-of-birth actions', () => {
        setCapabilities({ cardActions: [identityDocument, taxId, birthDate] })
        render()
        expect(newActionButtons()).toHaveLength(0)

        fireEvent.click(screen.getByText('Upload identity documents'))
        expect(mockHostedStart).toHaveBeenCalledTimes(1)
        expect(startActionKeys()).toEqual([])
    })

    it('hides the Sumsub flow again when the user closes it, leaving the button usable', async () => {
        setCapabilities({ cardActions: [taxId] })
        mockStartActionSuccess()
        render()
        fireEvent.click(newActionButtons()[0])
        await waitFor(() => expect(openSdkTokens()).toEqual([tokenFor[taxId.key]]))

        act(() => {
            mockSumsubInstances.forEach((props) => (props.onClose as (() => void) | undefined)?.())
        })

        await waitFor(() => expect(openSdkTokens()).toEqual([]))
        expect(newActionButtons()[0]).toBeEnabled()
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    })
})

describe('starting a tax-ID or date-of-birth action fails', () => {
    const failures: [string, () => void][] = [
        [
            'a network error',
            () =>
                mockFetch.mockImplementation(async () => {
                    throw new Error('fetch failed')
                }),
        ],
        [
            'a 4xx response',
            () =>
                mockFetch.mockImplementation(async () =>
                    respond(400, { error: 'action_not_available', userMessage: 'This request is no longer open.' })
                ),
        ],
        ['a 4xx response without a body', () => mockFetch.mockImplementation(async () => respond(404, {}))],
    ]

    it.each(failures)(
        'shows a visible error, no stuck loader and a usable button after %s, and a retry works',
        async (_label, failNext) => {
            setCapabilities({ cardActions: [taxId] })
            failNext()
            render()
            const before = visibleTexts()

            fireEvent.click(newActionButtons()[0])
            await settle()

            expect(visibleTexts().filter((text) => !before.includes(text)).length).toBeGreaterThan(0)
            expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
            expect(openSdkTokens()).toEqual([])
            const button = newActionButtons()[0]
            expect(button).toBeEnabled()
            expect(button).not.toHaveAttribute('aria-busy', 'true')

            mockStartActionSuccess()
            fireEvent.click(button)
            await waitFor(() => expect(openSdkTokens()).toEqual([tokenFor[taxId.key]]))
            expect(startActionKeys()).toEqual([taxId.key, taxId.key])
        }
    )

    it('starts the action only once when the button is tapped twice before the first request settles', async () => {
        setCapabilities({ cardActions: [taxId] })
        let release: (response: Response) => void = () => {}
        mockFetch.mockImplementation(
            () =>
                new Promise<Response>((resolve) => {
                    release = resolve
                })
        )
        render()
        const button = newActionButtons()[0]
        fireEvent.click(button)
        fireEvent.click(button)
        fireEvent.click(newActionButtons()[0])
        expect(startActionKeys()).toEqual([taxId.key])

        await act(async () => {
            release(respond(200, { sumsubAccessToken: 'tok_tax_id', levelName: 'rain-level', externalActionId: 'ext' }))
        })

        await waitFor(() => expect(openSdkTokens()).toEqual(['tok_tax_id']))
        expect(startActionKeys()).toEqual([taxId.key])
    })

    it('does not start the queued action when the offered one is tapped twice', async () => {
        setCapabilities({ cardActions: [taxId, birthDate] })
        mockFetch.mockImplementation(() => new Promise<Response>(() => {}))
        render()
        const [offered] = newActionButtons()
        fireEvent.click(offered)
        fireEvent.click(offered)
        expect(startActionKeys()).toEqual([taxId.key])
    })
})

describe('no tax-ID or date-of-birth action is available', () => {
    it.each([
        ['the rail carries no actions', { cardActions: [] }],
        ['the actions only belong to another rail', { cardActions: [], otherRailActions: [taxId, birthDate] }],
        [
            'the rail references actions the API no longer returns (expired)',
            { cardActions: [taxId, birthDate], knownActions: [] },
        ],
    ])('shows no button and keeps Contact support when %s', (_label, capabilities) => {
        setCapabilities(capabilities)
        render()
        expect(newActionButtons()).toHaveLength(0)
        fireEvent.click(screen.getByText('Contact support'))
        expect(mockSetSupportOpen).toHaveBeenCalledWith(true)
        expect(startActionKeys()).toEqual([])
    })

    it('shows only the button for the action that is still open when the other has expired', () => {
        setCapabilities({ cardActions: [taxId, birthDate], knownActions: [birthDate] })
        render()
        expect(newActionButtons()).toHaveLength(1)
    })
})
