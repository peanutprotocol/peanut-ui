jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
import { setAuthToken } from '@/utils/auth-token'
import { act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import type { PaperworkVerificationQuestions } from '@/app/actions/types/kyc-paperwork-verification.types'
import { getKycQuestions } from '@/app/actions/kyc-paperwork-verification'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { PaperworkVerificationFlow } from '../PaperworkVerificationFlow'
import { AddFeatureFlow } from '../AddFeatureFlow'
import { serverFetch } from '@/utils/api-fetch'
import { clearAuthToken } from '@/utils/auth-token'
import {
    prefetchPaperworkVerification,
    PAPERWORK_VERIFICATION_PLAN_QUERY_KEY,
    PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY,
    PAPERWORK_VERIFICATION_STATUS_QUERY_KEY,
} from '../usePaperworkVerificationStart'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { recordVerificationOpened } from '../useVerificationOpening'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn(), apiFetch: jest.fn() }))

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockExit = jest.fn()
jest.mock('@/utils/confetti', () => ({ confettiPresets: { success: jest.fn() } }))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('@/features/paperwork-verification/components/IdCardScanAnimation', () => ({
    IdCardScanAnimation: () => null,
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/app/actions/kyc-paperwork-verification', () => ({
    getKycQuestions: jest.fn(),
    saveKycAnswers: jest.fn(),
    savePaperworkVerificationFeatures: jest.fn(),
    startPaperworkVerificationIdentity: jest.fn(),
    skipProofOfAddress: jest.fn(async () => true),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({
    refreshKycIdentityStatus: jest.fn(async () => undefined),
    findKycDocumentPlan: jest.fn(),
    getKycDocumentStatus: jest.fn(),
    getKycDocumentPlan: jest.fn(),
}))
let mockIdentityReason: string | undefined
let mockContext: Entry = {
    authenticated: false,
    userId: null,
    verificationId: null,
    residenceCountry: null,
    screen: 'other',
}
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => ({
        user: mockContext.authenticated
            ? {
                  user: { userId: mockContext.userId },
                  residence: { declared: { country: mockContext.residenceCountry } },
              }
            : null,
    }),
    useAuth: () => ({
        user: mockContext.authenticated
            ? {
                  user: { userId: mockContext.userId, username: 'tester' },
                  residence: { declared: { country: mockContext.residenceCountry } },
                  identityVerification: { id: mockContext.verificationId, reason: { code: mockIdentityReason } },
              }
            : null,
        fetchUser: jest.fn(),
    }),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => mockExit }))
jest.mock('@/hooks/useSumsubKycFlow', () => ({ useSumsubKycFlow: jest.fn() }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/components/Kyc/SumsubNativeSdk', () => ({ SumsubNativeSdk: () => <div>native SDK</div> }))
jest.mock('@/components/Kyc/SumsubWebSdkModal', () => ({ SumsubWebSdkModal: () => <div>web SDK</div> }))
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

const mockQuestions = getKycQuestions as jest.MockedFunction<typeof getKycQuestions>
const mockPlan = findKycDocumentPlan as jest.MockedFunction<typeof findKycDocumentPlan>
const mockStatus = getKycDocumentStatus as jest.MockedFunction<typeof getKycDocumentStatus>

const plan = {
    available: true,
    activeAttemptId: null,
    policyVersion: 'v1',
    flow: 'verify-once' as const,
    proofOfAddress: null,
    features: { qr: true, bank: true, local: false, card: true },
    routes: [
        {
            id: 'base',
            documents: [
                {
                    key: 'identity',
                    code: 'IDENTITY' as const,
                    requiredBy: ['SUMSUB' as const],
                    types: ['PASSPORT'] as never[],
                    countries: ['US'],
                },
            ],
        },
    ],
}

const build = (
    answered: Record<string, boolean> = {},
    firstUnanswered: string | null = 'money'
): PaperworkVerificationQuestions => ({
    available: true,
    attemptId: 'attempt-1',
    residence: 'US',
    steps: [
        {
            id: 'purpose',
            features: ['card'],
            answered: answered.purpose ?? true,
            fields: [
                {
                    key: 'cardPurpose',
                    kind: 'choice',
                    required: true,
                    options: ['travel', 'bills'],
                    value: 'travel',
                },
            ],
        },
        {
            id: 'money',
            features: ['card'],
            answered: answered.money ?? false,
            fields: [
                {
                    key: 'annualSalary',
                    kind: 'choice',
                    required: true,
                    options: ['under_25k', '25k_50k'],
                    value: '25k_50k',
                },
            ],
        },
        {
            id: 'tax',
            features: ['base'],
            answered: answered.tax ?? false,
            fields: [{ key: 'taxId', kind: 'taxId', required: true, format: 'ssn', value: null }],
        },
    ],
    firstUnanswered: firstUnanswered as PaperworkVerificationQuestions['firstUnanswered'],
    progress: { done: 2, total: 5 },
    ...(mockContext.entryScope ? { entryScope: mockContext.entryScope } : {}),
})

type Entry = {
    authenticated: boolean
    userId: string | null
    verificationId: string | null
    residenceCountry: string | null
    screen: 'verification-entry' | 'overview' | 'other' | 'legacy-sdk' | 'sdk' | 'feature-questions'
    entryScope?: string
    feature?: 'bank' | 'card' | 'local'
}
type Request = {
    method: string
    url: string
    body: unknown
    accountId: string
    headers: Record<string, string>
    signal: AbortSignal
}

export function createVerificationOpeningHarness({
    request,
}: {
    request: (request: Request) => Promise<{ status: number }>
}) {
    let view: ReturnType<typeof renderWithIntl> | undefined
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => {
        errors.push(event.error)
        event.preventDefault()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
        errors.push(event.reason)
        event.preventDefault()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    const originalFetch = global.fetch
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), 'https://example.test')
        const headers = new Headers(init?.headers)
        const token = headers.get('Authorization')?.replace(/^Bearer /, '')
        const accountId = token ? JSON.parse(atob(token.split('.')[1])).userId : ''
        const result = await request({
            method: init?.method ?? 'GET',
            url: url.pathname,
            body: init?.body ? JSON.parse(String(init.body)) : undefined,
            accountId,
            headers: Object.fromEntries(headers.entries()),
            signal: init?.signal as AbortSignal,
        })
        return {
            status: result.status,
            ok: result.status >= 200 && result.status < 300,
            json: async () => ({}),
        } as Response
    }) as typeof fetch
    ;(useSumsubKycFlow as jest.Mock).mockReturnValue({
        isLoading: false,
        error: null,
        showWrapper: false,
        accessToken: null,
        handleStartAction: jest.fn(),
        handleClose: jest.fn(),
        handleSdkComplete: jest.fn(),
        refreshToken: jest.fn(),
    })
    const paperwork = jest.requireActual<typeof import('@/app/actions/kyc-paperwork-verification')>(
        '@/app/actions/kyc-paperwork-verification'
    )
    const workflow = jest.requireActual<typeof import('@/app/actions/kyc-workflow')>('@/app/actions/kyc-workflow')
    mockPlan.mockImplementation(workflow.findKycDocumentPlan)
    mockStatus.mockImplementation(workflow.getKycDocumentStatus)
    mockQuestions.mockImplementation(paperwork.getKycQuestions)
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let hydrating = false
    jest.mocked(serverFetch).mockImplementation(async (path, options) => {
        const headers = Object.fromEntries(new Headers(options?.headers).entries())
        const method = options?.method ?? 'GET'
        const response =
            method === 'GET' && hydrating
                ? { status: 200 }
                : await request({
                      method,
                      url: String(path).split('?')[0],
                      body: options?.body ? JSON.parse(String(options.body)) : undefined,
                      accountId: mockContext.userId ?? '',
                      headers,
                      signal: options?.signal as AbortSignal,
                  })
        const body = String(path).includes('/questions')
            ? build()
            : String(path).includes('/plan')
              ? plan
              : { identity: { canonicalStatus: 'NOT_STARTED' } }
        return {
            status: response.status,
            ok: response.status >= 200 && response.status < 300,
            json: async () => body,
        } as Response
    })
    const content = (context: Entry) => (
        <QueryClientProvider client={query}>
            <NuqsTestingAdapter>
                {context.screen === 'verification-entry' ? (
                    <PaperworkVerificationFlow key={`${context.userId}:${context.entryScope}`} />
                ) : context.screen === 'feature-questions' ? (
                    <AddFeatureFlow feature={context.feature ?? 'card'} onExit={() => {}} />
                ) : context.screen === 'sdk' || context.screen === 'legacy-sdk' ? (
                    <SumsubKycWrapper
                        visible
                        accessToken="test-token"
                        onClose={() => {}}
                        onComplete={() => {}}
                        onRefreshToken={async () => 'test-token'}
                    />
                ) : (
                    <div>other</div>
                )}
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    const update = async (context: Entry) => {
        const previous = mockContext
        mockContext = context
        // `show` supplies a freshly displayed response. Hydrate the real query
        // cache before remounting that visit, just as a completed prefetch does.
        if (view && context.screen === 'verification-entry' && context.userId &&
            previous.userId === context.userId && previous.entryScope !== context.entryScope) {
            query.setQueryData([...PAPERWORK_VERIFICATION_QUESTIONS_QUERY_KEY, context.userId], build())
            query.setQueryData([...PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, context.userId], plan)
            query.setQueryData([...PAPERWORK_VERIFICATION_STATUS_QUERY_KEY, context.userId], 'NOT_STARTED')
        }
        hydrating = true
        if (context.authenticated && context.userId)
            setAuthToken(`x.${btoa(JSON.stringify({ userId: context.userId }))}.y`)
        else await clearAuthToken()
        await act(async () => {
            if (view) view.rerender(content(context))
            else view = renderWithIntl(content(context))
            await Promise.resolve()
            await Promise.resolve()
        })
        hydrating = false
    }
    return {
        show: update,
        rerender: update,
        backgroundRead: async (source: 'questions' | 'plan' | 'prefetch' | 'background-probe', context: Entry) => {
            mockContext = context
            const paperwork = jest.requireActual<typeof import('@/app/actions/kyc-paperwork-verification')>(
                '@/app/actions/kyc-paperwork-verification'
            )
            const workflow =
                jest.requireActual<typeof import('@/app/actions/kyc-workflow')>('@/app/actions/kyc-workflow')
            if (source === 'questions') await paperwork.getKycQuestions()
            else if (source === 'plan') await workflow.findKycDocumentPlan('home')
            else if (source === 'background-probe') await workflow.getKycDocumentStatus()
            else {
                mockQuestions.mockImplementation(paperwork.getKycQuestions)
                mockStatus.mockImplementation(workflow.getKycDocumentStatus)
                prefetchPaperworkVerification(query, context.userId ?? undefined)
                await Promise.resolve()
                await Promise.resolve()
            }
        },
        navigateAway: async () => {
            await act(async () => {
                view?.unmount()
            })
            view = undefined
        },
        dispose: async () => {
            view?.unmount()
            global.fetch = originalFetch
            window.removeEventListener('error', onError)
            window.removeEventListener('unhandledrejection', onRejection)
            query.clear()
        },
        flush: async () => {
            await act(async () => {
                await Promise.resolve()
                await Promise.resolve()
            })
        },
        verificationUsable: () => !!view?.container.querySelector('[data-testid="verify-steps-continue"]'),
        unhandledErrors: () => errors,
    }
}

export function createVerificationOpeningRequestHarness({
    request,
    userId,
    entryScope,
}: {
    request: (request: Request) => Promise<{ status: number }>
    userId: string
    entryScope: string
}) {
    const harness = createVerificationOpeningHarness({ request })
    mockContext = {
        authenticated: true,
        userId,
        entryScope,
        verificationId: null,
        residenceCountry: null,
        screen: 'other',
    }
    setAuthToken(`x.${btoa(JSON.stringify({ userId }))}.y`)
    return {
        postOpeningRequest: (feature?: 'bank' | 'card' | 'local') =>
            recordVerificationOpened(userId, entryScope, new AbortController().signal, feature),
        dispose: harness.dispose,
    }
}
