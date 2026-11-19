import React from 'react'
import { randomUUID } from 'node:crypto'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VerifyRoute from '@/app/(mobile-ui)/verify/page'
import type { FeatureReverificationEntry as Entry } from '@/app/actions/types/kyc-reverification.types'
import { KycFeatureActivationGate } from '../KycFeatureActivationGate'
import { clearAuthToken, getAuthToken, setAuthToken } from '@/utils/auth-token'

type Fixture = {
    feature: Entry['feature']
    destination: string
    canonicalStatus: 'APPROVED'
    invitation: Entry | { status: 409; code: 'feature_reverification_required' }
    startResponse?: Entry
}

type Request = { path: string; body: Record<string, unknown> }
type Pending = { resolve: (response: Response) => void; reject: (error: Error) => void }
let mockUserId: string
let mockOneShot: boolean
let mockCanonicalStatus: Fixture['canonicalStatus']
let mockNavigate: (path: string) => void
let mockFetch: (path: string, options?: RequestInit & { beforeDispatch?: () => boolean }) => Promise<Response>

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: mockUserId },
            identityVerification: {
                status: mockCanonicalStatus === 'APPROVED' ? 'verified' : 'pending',
                oneShot: mockOneShot,
            },
        },
        fetchUser: async () => {},
    }),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockNavigate, replace: mockNavigate }),
    useSearchParams: () => new URLSearchParams(window.location.search),
    usePathname: () => window.location.pathname,
}))
jest.mock('next/link', () => {
    const { forwardRef } = jest.requireActual<typeof import('react')>('react')
    return forwardRef<HTMLAnchorElement, React.ComponentProps<'a'>>(function RouterLink(
        { href, onClick, ...props },
        ref
    ) {
        return (
            <a
                {...props}
                href={href}
                ref={ref}
                onClick={(event) => {
                    onClick?.(event)
                    if (!event.defaultPrevented && href) {
                        event.preventDefault()
                        mockNavigate(href)
                    }
                }}
            />
        )
    })
})
jest.mock('@/utils/api-fetch', () => ({
    serverFetch: (path: string, options: RequestInit) => mockFetch(path, options),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => () => mockNavigate('/home') }))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
jest.mock('../PaperworkVerificationFlow', () => ({
    PaperworkVerificationFlow: ({ candidate, returnTo }: { candidate: Entry; returnTo?: string }) => (
        <div
            data-testid="feature-reverification-candidate"
            data-feature={candidate.feature}
            data-target-provider={candidate.targetProvider}
            data-attempt-id={candidate.attemptId}
            data-return-to={returnTo}
        />
    ),
}))
jest.mock('../IdentityRestartFlow', () => ({ IdentityRestartFlow: () => null }))
jest.mock('../AddFeatureFlow', () => ({ AddFeatureFlow: () => null }))
jest.mock('../FeatureAction', () => ({ FeatureAction: () => null }))
jest.mock('../ReplacementDocumentAction', () => ({ ReplacementDocumentAction: () => null }))
jest.mock('@/features/add-money/CurrencyRefusalScreen', () => ({ CurrencyRefusalScreen: () => null }))
jest.mock('../components/StatusScreens', () => ({ FeatureReadyScreen: () => null }))
jest.mock('../components/LoadScreens', () => ({
    LoadFailed: () => null,
    VerifyLoading: () => null,
    VerificationOutage: () => null,
}))
jest.mock('../components/VerifyLayout', () => ({
    VerifyHeroLayout: ({ children, footer }: { children?: React.ReactNode; footer: React.ReactNode }) => (
        <section>
            {children}
            {footer}
        </section>
    ),
    VerifyFooter: ({ actions, secondary }: { actions: React.ReactNode; secondary?: React.ReactNode }) => (
        <footer>
            {actions}
            {secondary}
        </footer>
    ),
}))

function response(status: number, body: unknown) {
    return { status, ok: status >= 200 && status < 300, json: async () => body } as Response
}

export async function mountFeatureGate(fixture: Fixture) {
    // The app runs in a secure context. jsdom 20 does not expose browser randomUUID.
    const originalUuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')
    const originalToken = getAuthToken()
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID })
    const originalPath = window.location.pathname + window.location.search + window.location.hash
    const requests: Request[] = []
    const conflict = 'status' in fixture.invitation ? fixture.invitation : null
    const invitation: Entry =
        'kind' in fixture.invitation
            ? fixture.invitation
            : { kind: 'reverify_for_feature', feature: fixture.feature, targetProvider: 'RAIN', attemptId: null }
    let activeEntry: Entry | null = null
    let pending: Pending | null = null
    let invitationPath: string | null = null
    let routeVersion = 0
    mockUserId = 'contract-user-a'
    const setMockToken = () => setAuthToken(`x.${btoa(JSON.stringify({ userId: mockUserId }))}.y`)
    setMockToken()
    mockCanonicalStatus = fixture.canonicalStatus
    mockOneShot = Boolean(conflict)
    window.history.replaceState(null, '', fixture.destination)
    mockFetch = async (path, options) => {
        if (options?.beforeDispatch && !options.beforeDispatch()) throw new Error('Request obsolete')
        if (path.startsWith('/users/kyc/plan')) {
            const entry = mockUserId !== 'contract-user-a' ? undefined : (activeEntry ?? invitation)
            return response(200, { available: Boolean(entry), routes: [], entry })
        }
        if (path === '/users/kyc/features/' + fixture.feature + '/activate' && conflict) {
            return response(conflict.status, {
                code: conflict.code,
                entry: invitation,
                userMessage: 'Verification required',
                message: 'Verification required',
                error: 'Verification required',
            })
        }
        if (path !== '/users/kyc/reverification') throw new Error('Unexpected request: ' + path)
        requests.push({ path, body: JSON.parse(String(options?.body)) })
        return new Promise<Response>((resolve, reject) => {
            pending = { resolve, reject }
        })
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = () => (
        <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter key={routeVersion} searchParams={window.location.search}>
                {window.location.pathname === '/verify' ? (
                    <VerifyRoute />
                ) : (
                    <KycFeatureActivationGate feature={fixture.feature}>
                        <div>Feature ready</div>
                    </KycFeatureActivationGate>
                )}
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    mockNavigate = (path) => {
        if (new URL(path, window.location.origin).pathname === '/verify') invitationPath = path
        window.history.replaceState(null, '', path)
    }
    const view = render(tree())
    await act(async () => {})
    await act(async () => {
        fireEvent.click(screen.getByTestId(conflict ? 'kyc-activation-continue' : 'feature-reverification-open'))
    })

    const tapStart = () => fireEvent.click(screen.getByTestId('verify-reverification-start'))
    const requestInFlight = () => {
        if (!pending) throw new Error('No re-verification request pending')
        const request = pending
        pending = null
        return request
    }

    return {
        invitationUrl: () => {
            if (!invitationPath) throw new Error('The feature gate did not navigate to verification')
            return invitationPath
        },
        openInvitation: async () => {
            routeVersion += 1
            await act(async () => view.rerender(tree()))
            await screen.findByTestId('verify-reverification-start')
        },
        doubleTapStart: async () => {
            await act(async () => {
                tapStart()
                tapStart()
            })
        },
        rejectPendingStartAsTimeout: async () => {
            await act(async () => requestInFlight().reject(new Error('Connection timed out')))
        },
        retryStart: async () => {
            await act(async () => {
                tapStart()
            })
        },
        resolvePendingStart: async () => {
            await act(async () => {
                if (!fixture.startResponse) throw new Error('No scripted start response')
                activeEntry = fixture.startResponse
                requestInFlight().resolve(
                    response(200, { attemptId: activeEntry.attemptId, status: 'READY', entry: activeEntry })
                )
            })
        },
        postRequests: () => [...requests],
        currentCandidate: () => {
            const candidate = screen.queryByTestId('feature-reverification-candidate')
            return candidate
                ? {
                      feature: candidate.dataset.feature,
                      targetProvider: candidate.dataset.targetProvider,
                      attemptId: candidate.dataset.attemptId,
                  }
                : null
        },
        currentPath: () => window.location.pathname + window.location.search,
        reload: async () => {
            routeVersion += 1
            await act(async () => view.rerender(tree()))
        },
        switchAccount: async () => {
            mockUserId = 'contract-user-b'
            setMockToken()
            await act(async () => view.rerender(tree()))
        },
        dispose: () => {
            if (originalToken) setAuthToken(originalToken)
            else void clearAuthToken()
            if (originalUuid) Object.defineProperty(crypto, 'randomUUID', originalUuid)
            else Reflect.deleteProperty(crypto, 'randomUUID')
            view.unmount()
            queryClient.clear()
            window.history.replaceState(null, '', originalPath)
            sessionStorage.clear()
        },
    }
}
