import React, { useSyncExternalStore } from 'react'
import { act, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { serverFetch } from '@/utils/api-fetch'
import { isInSubmissionWindow, __resetSubmissionWindowForTests } from '@/hooks/useSubmissionWindow'
import { useUserAutoRefresh } from '@/hooks/useUserAutoRefresh'
import type { IUserProfile } from '@/interfaces/interfaces'
import type { NextAction, RailCapability } from '@/types/capabilities'
import { CardPage } from '../CardPage'

const mockSetSupportOpen = jest.fn()
const mockHostedStart = jest.fn()
const mockFetchUserResult = jest.fn<Promise<IUserProfile>, []>()
const mockSumsubInstances = new Map<string, Record<string, unknown>>()
const mockAuthListeners = new Set<() => void>()
let mockAuthUser: IUserProfile

async function mockFetchUser(): Promise<IUserProfile> {
    const nextUser = await mockFetchUserResult()
    mockAuthUser = nextUser
    mockAuthListeners.forEach((listener) => listener())
    return nextUser
}

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
    useAuth: () => ({
        user: useSyncExternalStore(
            (listener) => {
                mockAuthListeners.add(listener)
                return () => mockAuthListeners.delete(listener)
            },
            () => mockAuthUser,
            () => mockAuthUser
        ),
        fetchUser: mockFetchUser,
        isFetchingUser: false,
    }),
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
        return props.visible ? <div data-testid="sumsub-sdk" data-session-key={id} /> : null
    },
}))

const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

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

function cardRail(actions: NextAction[]): RailCapability {
    return {
        id: 'rain.card',
        provider: 'rain',
        method: 'CARD',
        channel: 'card',
        country: 'GLOBAL',
        currency: 'USD',
        status: 'requires-info',
        blockingActions: actions.map((action) => action.key),
        reason: { code: 'rain_requires_information', userMessage: 'Rain needs a few more details.' },
    }
}

function userWith(actions: NextAction[]): IUserProfile {
    return {
        user: { userId: 'user-1' },
        accounts: [],
        capabilities: {
            rails: [cardRail(actions)],
            nextActions: actions,
            restrictions: [],
        },
    } as unknown as IUserProfile
}

function respond(body: unknown): Response {
    return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function actionButtons(): HTMLElement[] {
    return screen
        .queryAllByRole('button')
        .filter(
            (button) =>
                button.getAttribute('data-testid') !== 'nav-back' &&
                !/contact support|upload proof of address|upload identity documents/i.test(button.textContent ?? '')
        )
}

function AutoRefreshHarness() {
    useUserAutoRefresh({ user: mockAuthUser, fetchUser: mockFetchUser })
    return null
}

function render() {
    return rtlRender(
        <>
            <AutoRefreshHarness />
            <CardPage />
        </>,
        { wrapper: IntlWrapper }
    )
}

function completeVisibleInformationSession(): void {
    const sdk = screen.getByTestId('sumsub-sdk')
    const sessionKey = sdk.getAttribute('data-session-key') ?? ''
    const props = mockSumsubInstances.get(sessionKey)
    expect(sessionKey).not.toBe('default')
    expect(props?.onComplete).toEqual(expect.any(Function))
    ;(props?.onComplete as () => void)()
}

async function flushPromises(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
}

describe('CardPage post-submission capability refresh', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        mockFetchUserResult.mockReset()
        __resetSubmissionWindowForTests()
        mockAuthListeners.clear()
        mockSumsubInstances.clear()
        mockAuthUser = userWith([taxId, birthDate])
        mockFetch.mockImplementation(async (_url, init) => {
            const { key } = JSON.parse(String(init?.body))
            return respond({
                sumsubAccessToken: key === taxId.key ? 'tok_tax_id' : 'tok_birth_date',
                levelName: 'rain-level',
                externalActionId: 'ext',
            })
        })
    })

    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
        __resetSubmissionWindowForTests()
        mockAuthListeners.clear()
    })

    it.each([
        ['tax ID', taxId, birthDate],
        ['date of birth', birthDate, taxId],
    ])(
        'keeps the %s action after a stale first refresh, then offers the next one on a timer refresh',
        async (_label, completed, remaining) => {
            mockAuthUser = userWith([completed, remaining])
            const staleUser = userWith([completed, remaining])
            const freshUser = userWith([remaining])
            mockFetchUserResult.mockResolvedValueOnce(staleUser).mockResolvedValueOnce(freshUser)
            render()

            const [offered] = actionButtons()
            expect(actionButtons()).toHaveLength(1)
            const completedLabel = offered.textContent ?? ''

            fireEvent.click(offered)
            await waitFor(() => expect(screen.getByTestId('sumsub-sdk')).toBeInTheDocument())

            await act(async () => {
                completeVisibleInformationSession()
                await flushPromises()
            })

            expect(mockFetchUserResult).toHaveBeenCalledTimes(1)
            expect(screen.getByRole('button', { name: completedLabel })).toBeEnabled()

            await act(async () => {
                jest.advanceTimersByTime(4000)
                await flushPromises()
            })

            await waitFor(() => expect(screen.queryByRole('button', { name: completedLabel })).not.toBeInTheDocument())
            expect(actionButtons()).toHaveLength(1)
            expect(actionButtons()[0]).toBeEnabled()
            expect(mockFetchUserResult).toHaveBeenCalledTimes(2)
            expect(mockAuthUser.capabilities?.nextActions).toEqual([remaining])
            expect(mockAuthUser.capabilities?.nextActions).not.toContainEqual(completed)
            expect(mockAuthUser.capabilities?.rails).toEqual([
                expect.objectContaining({
                    id: 'rain.card',
                    status: 'requires-info',
                    blockingActions: [remaining.key],
                }),
            ])
        }
    )

    it('arms the submission window before starting an unresolved initial profile refresh', async () => {
        let resolveInitialFetch: (user: IUserProfile) => void = () => undefined
        const windowStateAtFetch: boolean[] = []
        mockFetchUserResult.mockImplementationOnce(
            () =>
                new Promise<IUserProfile>((resolve) => {
                    windowStateAtFetch.push(isInSubmissionWindow())
                    resolveInitialFetch = resolve
                })
        )
        render()

        fireEvent.click(actionButtons()[0])
        await waitFor(() => expect(screen.getByTestId('sumsub-sdk')).toBeInTheDocument())
        act(() => {
            completeVisibleInformationSession()
        })

        expect(mockFetchUserResult).toHaveBeenCalledTimes(1)
        expect(windowStateAtFetch).toEqual([true])
        expect(isInSubmissionWindow()).toBe(true)

        await act(async () => {
            resolveInitialFetch(userWith([taxId, birthDate]))
            await flushPromises()
        })
    })

    it('does not poll requires-info capabilities before an action completes', async () => {
        mockFetchUserResult.mockResolvedValue(userWith([taxId, birthDate]))
        render()

        await act(async () => {
            jest.advanceTimersByTime(8000)
            await flushPromises()
        })

        expect(isInSubmissionWindow()).toBe(false)
        expect(mockFetchUserResult).not.toHaveBeenCalled()
    })
})
