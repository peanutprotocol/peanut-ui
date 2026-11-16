/** @jest-environment jsdom */
/**
 * 08 Payment plan, contract P3 § 4.6 (review R2-03): when both the intents read and the restriction lists read fail,
 * the screen settles with the universal options instead of staying on "Loading…". The real hooks run here; only
 * `apiFetch` is faked, so a 500, a network error and a slow failure all go through the same code as in the app.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import { __resetSignupSavesForTests } from '@/features/setup/saveSignupAnswers'
import { PLAN_SETS_GRACE_MS } from '@/features/setup/usePlanOptionsSettled'
import { __resetResidenceRestrictionSetsForTests } from '@/hooks/useResidenceRestrictionSets'
import { PaymentPlanScreen } from '../PaymentPlanScreen'
import { copy, footer, openDialog, renderRedesign, setupState, textRx } from '../../Accounts/__tests__/redesignHarness'

jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: jest.fn(), isLoading: false }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), setPersonProperties: jest.fn(), register: jest.fn() },
}))
jest.mock('framer-motion', () => require('../../Accounts/__tests__/framerMock').framerMotionForShell())
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: {
        loadAnimation: () => ({
            totalFrames: 20,
            frameRate: 30,
            addEventListener: jest.fn(),
            destroy: jest.fn(),
            goToAndStop: jest.fn(),
        }),
    },
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn(() => new Promise(() => undefined)) }))

type Fault = '500' | 'network' | 'slow-500'
let mockFault: Fault = '500'
const mockApiFetch = jest.fn((path: string) => {
    void path
    if (mockFault === 'network') return Promise.reject(new TypeError('Failed to fetch'))
    const answer = () => ({ ok: false, status: 500, json: async () => ({}) })
    if (mockFault === 'slow-500') return new Promise((resolve) => setTimeout(() => resolve(answer()), 8_000))
    return Promise.resolve(answer())
})
jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (path: string) => mockApiFetch(path),
}))

const K = 'setupRedesign.plan'
const plain = (s: string | null | undefined) =>
    (s ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
const title = (kind: 'funding' | 'payment') => copy(`${K}.${kind === 'funding' ? 'sheetFunding' : 'sheetPayment'}`)
const pill = (kind: 'funding' | 'payment') =>
    screen.getByRole('button', { name: new RegExp(`^${title(kind)}:`), hidden: true })
const continueButton = (container: HTMLElement) =>
    within(footer(container)!).getAllByRole('button', { hidden: true })[0]

function render() {
    const client = new QueryClient()
    return renderRedesign(
        <QueryClientProvider client={client}>
            <PaymentPlanScreen />
        </QueryClientProvider>,
        { screenId: 'payment-plan', seed: { residenceCountry: 'US' }, locale: 'en' }
    )
}

const advance = (ms: number) => act(async () => void (await jest.advanceTimersByTimeAsync(ms)))

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    __resetSignupSavesForTests()
    __resetResidenceRestrictionSetsForTests()
})
afterEach(() => {
    jest.useRealTimers()
})

describe('08 Payment plan: both option reads fail (P3 § 4.6, R2-03)', () => {
    it.each<[Fault, number]>([
        // the intents read retries once (useKycIntents retry: 1, about 1 s apart)
        ['500', 1_500],
        ['network', 1_500],
        // each try answers after 8 s
        ['slow-500', 2 * 8_000 + 1_500],
    ])(
        '%s: settles with the universal options, spending pre-filled, Continue on after a funding pick',
        async (fault, failedAfter) => {
            mockFault = fault
            const view = render()
            expect(setupState(view.container)).toBe('loading')

            await advance(failedAfter)
            expect(mockApiFetch.mock.calls.map(([path]) => path)).toEqual(
                expect.arrayContaining(['/config/residence-restrictions', '/config/kyc-intents?residence=US'])
            )
            // the intents read has failed; the lists get their grace period, still loading
            expect(setupState(view.container)).toBe('loading')

            await advance(PLAN_SETS_GRACE_MS)
            expect(setupState(view.container)).toBe('prefilled')
            expect(view.flow().paymentChannel).toBe('peanut')
            expect(pill('funding')).toBeEnabled()

            await act(async () => pill('funding').click())
            const rows = within(openDialog()!)
                .getAllByRole('button', { hidden: true })
                .map((b) => plain(b.getAttribute('aria-label') || b.textContent))
                .filter(Boolean)
            expect(rows).toEqual([plain(copy(`${K}.fundCrypto`)), plain(copy(`${K}.fundPeanut`))])
            await act(async () =>
                within(openDialog()!)
                    .getByRole('button', { name: textRx(copy(`${K}.fundCrypto`)), hidden: true })
                    .click()
            )
            await advance(1_000)
            expect(view.flow().fundingChannel).toBe('crypto')
            expect(continueButton(view.container)).toBeEnabled()
        }
    )
})
