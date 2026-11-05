/** Spec-only L8 acceptance tests: fixtures come from the public FeatureReport contract. */
import { act } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { deriveCapabilityPhaseSignals, useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import type { FeatureReportEntry, NextAction, UserCapabilities } from '@/types/capabilities'
import type { VerificationActionSession } from '@/app/actions/types/sumsub.types'
import { confirmBridgeTos } from '@/app/actions/users'

const mockFetchUser = jest.fn()
const mockApproval: { handler?: () => Promise<void> | void } = {}
const mockCloseVerificationProgressModal = jest.fn()
const mockLegacyInitiate = jest.fn(async () => true)
let mockCapabilities: UserCapabilities | undefined
let mockSession: VerificationActionSession | undefined
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/kyc-workflow', () => ({
    findKycDocumentPlan: jest.fn(async () => ({ available: false, flow: null })),
    getKycDocumentStatus: jest.fn(async () => 'NOT_STARTED'),
    findKycReplacementPlan: jest.fn(async () => null),
    resumeKycDocumentAttempt: jest.fn(),
}))
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    initiateSumsubKyc: jest.fn(),
    getVerificationSession: jest.fn(),
    refreshVerificationSession: jest.fn(),
    initiateSelfHealResubmission: jest.fn(),
    restartIdentityVerification: jest.fn(),
    startResidenceChangeVerification: jest.fn(),
    startKycAction: jest.fn(),
}))
jest.mock('@/hooks/useSumsubKycFlow', () => ({
    useSumsubKycFlow: (options: { onKycSuccess?: () => Promise<void> | void }) => {
        mockApproval.handler = options.onKycSuccess
        return {
            isLoading: false,
            error: null,
            errorCooldown: null,
            dismissErrorCooldown: jest.fn(),
            isTerminalError: false,
            showWrapper: false,
            accessToken: null,
            liveKycStatus: undefined,
            handleInitiateKyc: mockLegacyInitiate,
            handleRestartIdentity: jest.fn(),
            handleResidenceChange: jest.fn(),
            handleSelfHealResubmit: jest.fn(),
            handleStartAction: jest.fn(),
            getActionKey: jest.fn(),
            isProviderRequest: false,
            handleFixableRejection: jest.fn(),
            handleFixableGate: jest.fn(),
            handleSdkComplete: jest.fn(),
            handleClose: jest.fn(),
            refreshToken: jest.fn(),
            isVerificationProgressModalOpen: !!mockSession,
            closeVerificationProgressModal: mockCloseVerificationProgressModal,
            isActionFlow: false,
            isResidenceChangeFlow: false,
            isMultiLevel: false,
            documentConfig: undefined,
            documentAttemptId: undefined,
            verificationSession: mockSession,
            showCorrection: false,
            correctVerificationData: jest.fn(),
            dismissCorrection: jest.fn(),
        }
    },
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isAndroidNative: () => false }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        fetchUser: mockFetchUser,
        user: { user: { username: 'test' }, identityVerification: { status: 'verified' } },
    }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: mockCapabilities }) }))
jest.mock('@/hooks/useSumsubReloadResume', () => ({ useSumsubReloadResume: jest.fn() }))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn() }))
jest.mock('@/app/actions/users', () => ({ getBridgeTosLink: jest.fn(), confirmBridgeTos: jest.fn() }))

type CompletionNotice = { kind: 'action' | 'review'; currencies: string[] } | null
// Narrow compatibility cast lets the unmodified baseline reach behavior assertions.
const notice = (value: unknown): CompletionNotice => (value as { completionNotice: CompletionNotice }).completionNotice
const action = (kind: NextAction['kind'], key = 'ar-step'): NextAction => ({
    key,
    kind,
    purpose: 'unlock-local',
    feature: 'local',
})
const snapshot = (
    ars: FeatureReportEntry,
    nextActions: NextAction[] = [],
    options: { brl?: FeatureReportEntry; usd?: FeatureReportEntry } = {}
): UserCapabilities => ({
    rails: [],
    restrictions: [],
    nextActions,
    features: {
        qr: { state: 'on' },
        card: { state: 'ready' },
        local: { state: ars.state, accounts: { ARS: ars, ...(options.brl ? { BRL: options.brl } : {}) } },
        bank: { state: options.usd?.state ?? 'pending', accounts: options.usd ? { USD: options.usd } : {} },
    },
})

beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockCapabilities = undefined
    mockSession = undefined
    mockApproval.handler = undefined
    mockLegacyInitiate.mockReset().mockResolvedValue(true)
    mockFetchUser.mockImplementation(async () => ({ user: { username: 'test' }, capabilities: mockCapabilities }))
})

describe('L8 deferred refresh and session recovery', () => {
    it('a terms step that becomes provider review completes without asking for terms again', async () => {
        const onKycSuccess = jest.fn()
        const view = await approvedFlow(
            snapshot({ state: 'action_required', action: 'ar-step' }, [action('accept-tos')]),
            { onKycSuccess }
        )
        expect(view.result.current.modalPhase).toBe('bridge_tos')
        mockCapabilities = snapshot({ state: 'setting_up', action: 'ar-step' }, [action('wait')])
        view.rerender()
        expect(view.result.current.modalPhase).toBe('complete')
        expect(notice(view.result.current)).toEqual({ kind: 'review', currencies: ['ARS'] })
        expect(onKycSuccess).not.toHaveBeenCalled()
    })
    it('immediate no-SDK approval uses the country selected in the same initiation', async () => {
        mockCapabilities = snapshot({ state: 'action_required', action: 'ar-step' }, [action('questions')], {
            brl: { state: 'on' },
        })
        mockCapabilities.features!.local.state = 'on'
        mockLegacyInitiate.mockImplementationOnce(async () => {
            await mockApproval.handler?.()
            return false
        })
        const onKycSuccess = jest.fn()
        const view = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))
        await act(async () => {
            await view.result.current.handleInitiateKyc('LATAM', undefined, false, 'AR')
        })
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(notice(view.result.current)).toEqual({ kind: 'action', currencies: ['ARS'] })
    })
    it('a late capability update after closing does not reopen the modal', async () => {
        const view = await approvedFlow(snapshot({ state: 'setting_up' }))
        act(() => view.result.current.handleModalClose())
        mockCapabilities = snapshot({ state: 'action_required', action: 'ar-step' }, [action('questions')])
        view.rerender()
        expect(view.result.current.isModalOpen).toBe(false)
        expect(notice(view.result.current)).toBeNull()
    })

    it('an unrelated bank review cannot finish an AR flow whose account is refused', async () => {
        const capabilities = snapshot({ state: 'refused' })
        capabilities.features!.bank = { state: 'setting_up', reason: 'requirements_in_review', accounts: {} }
        const onKycSuccess = jest.fn()
        await approvedFlow(capabilities, { onKycSuccess })
        expect(onKycSuccess).not.toHaveBeenCalled()
    })

    it('a delayed terms confirmation cannot reopen a dismissed setup', async () => {
        const view = await approvedFlow(snapshot({ state: 'setting_up' }))
        let resolve!: (value: unknown) => void
        jest.mocked(confirmBridgeTos).mockImplementationOnce(
            () =>
                new Promise((done) => {
                    resolve = done
                }) as never
        )
        let confirmation!: Promise<void>
        await act(async () => {
            confirmation = view.result.current.handleTosIframeClose('tos_accepted')
        })
        act(() => view.result.current.handleModalClose())
        mockCapabilities = snapshot({ state: 'action_required', action: 'ar-step' }, [action('questions')])
        await act(async () => {
            resolve({ data: { accepted: true } })
            await confirmation
        })
        expect(view.result.current.isModalOpen).toBe(false)
        expect(notice(view.result.current)).toBeNull()
    })

    it.each(['close', 'new-attempt', 'unmount'] as const)(
        'ignores an approval refresh that finishes after %s',
        async (interruption) => {
            mockCapabilities = snapshot({ state: 'pending' })
            let resolve!: (value: unknown) => void
            const pending = new Promise((done) => {
                resolve = done
            })
            mockFetchUser.mockReturnValueOnce(pending)
            const onKycSuccess = jest.fn()
            const view = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))
            await act(async () => {
                await view.result.current.handleInitiateKyc('LATAM', undefined, false, 'AR')
            })
            let approval!: Promise<void>
            await act(async () => {
                approval = Promise.resolve(mockApproval.handler?.())
            })
            if (interruption === 'close') act(() => view.result.current.handleModalClose())
            else if (interruption === 'new-attempt') {
                await act(async () => {
                    await view.result.current.handleInitiateKyc('LATAM', undefined, false, 'BR')
                })
            } else view.unmount()
            await act(async () => {
                resolve({
                    capabilities: snapshot({ state: 'action_required', action: 'ar-step' }, [action('questions')]),
                })
                await approval
            })
            expect(onKycSuccess).not.toHaveBeenCalled()
            expect(notice(view.result.current)).toBeNull()
            expect(view.result.current.isModalOpen).toBe(false)
        }
    )

    it('a new attempt resets the previous notice and permits real money readiness', async () => {
        const onKycSuccess = jest.fn()
        const view = await approvedFlow(
            snapshot({ state: 'action_required', action: 'ar-step' }, [action('questions')]),
            { onKycSuccess }
        )
        act(() => view.result.current.completeFlow())
        mockCapabilities = snapshot({ state: 'on' })
        await act(async () => {
            await view.result.current.handleInitiateKyc('LATAM', undefined, false, 'AR')
        })
        expect(notice(view.result.current)).toBeNull()
        await act(async () => {
            await mockApproval.handler?.()
        })
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
    })

    it.each(['READY', 'PROVIDER_PENDING'] as const)(
        'a %s legacy session ends with a truthful remaining-step notice',
        async (state) => {
            mockCapabilities = snapshot({ state: 'action_required', action: 'ar-step' }, [action('questions')])
            mockSession = {
                id: 'session-1',
                generation: 0,
                state,
                targetCountry: 'AR',
                reasonCode: null,
                externalActionId: 'action-1',
                isMultiLevel: true,
            }
            const onKycSuccess = jest.fn()
            const view = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))
            await act(async () => {
                await Promise.resolve()
            })
            expect(view.result.current.modalPhase).toBe('complete')
            expect(notice(view.result.current)).toEqual({ kind: 'action', currencies: ['ARS'] })
            const reads = mockFetchUser.mock.calls.length
            await act(async () => {
                jest.advanceTimersByTime(31_000)
            })
            expect(view.result.current.preparingTimedOut).toBe(false)
            expect(mockFetchUser).toHaveBeenCalledTimes(reads)
            expect(onKycSuccess).not.toHaveBeenCalled()
        }
    )

    it('a provider-pending session cannot invoke a money callback even if capabilities are ahead of it', async () => {
        mockCapabilities = snapshot({ state: 'on' })
        mockSession = {
            id: 'session-1',
            generation: 0,
            state: 'PROVIDER_PENDING',
            targetCountry: 'AR',
            reasonCode: null,
            externalActionId: 'action-1',
            isMultiLevel: true,
        }
        const onKycSuccess = jest.fn()
        const view = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))
        await act(async () => {
            await Promise.resolve()
        })
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(view.result.current.modalPhase).toBe('preparing')
    })
})
afterEach(() => jest.useRealTimers())

describe('L8 capability completion is separate from money readiness', () => {
    it.each(['questions', 'bridge-hosted', 'rain-hosted', 'provide-email'] as const)(
        '%s parks the known remaining action and names its currency',
        (kind) => {
            const result = deriveCapabilityPhaseSignals(
                snapshot({ state: 'action_required', action: 'ar-step' }, [action(kind)]),
                'LATAM',
                'AR'
            )
            expect(result.allSettled).toBe(false)
            expect(notice(result)).toEqual({ kind: 'action', currencies: ['ARS'] })
        }
    )

    it.each([
        { entry: { state: 'setting_up', action: 'ar-step' } as const, actions: [action('wait')] },
        { entry: { state: 'setting_up', reason: 'requirements_in_review' } as const, actions: [] },
    ])('explicit provider review is completed setup, without money readiness: %j', ({ entry, actions }) => {
        const result = deriveCapabilityPhaseSignals(snapshot(entry, actions), 'LATAM', 'AR')
        expect(result.allSettled).toBe(false)
        expect(notice(result)).toEqual({ kind: 'review', currencies: ['ARS'] })
    })

    it.each([
        { state: 'setting_up' },
        { state: 'pending' },
        { state: 'action_required', action: 'missing' },
        { state: 'action_required' },
        { state: 'refused', action: 'ar-step' },
    ] satisfies FeatureReportEntry[])('does not finish unknown, provisioning, or refused state: %j', (entry) => {
        const result = deriveCapabilityPhaseSignals(snapshot(entry, [action('questions')]), 'LATAM', 'AR')
        expect(result.allSettled).toBe(false)
        expect(notice(result)).toBeNull()
    })

    it('missing feature reports remain unknown', () => {
        const result = deriveCapabilityPhaseSignals({ rails: [], restrictions: [], nextActions: [] }, 'LATAM', 'AR')
        expect(result.allSettled).toBe(false)
        expect(notice(result)).toBeNull()
    })

    it.each([
        { kind: 'accept-tos' as const, key: 'ar-step' },
        { kind: 'sumsub' as const, key: 'supplement:bridge' },
    ])('$kind / $key retains its dedicated step', ({ kind, key }) => {
        const result = deriveCapabilityPhaseSignals(
            snapshot({ state: 'action_required', action: key }, [action(kind, key)]),
            'LATAM',
            'AR'
        )
        expect(result.allSettled).toBe(false)
        expect(notice(result)).toBeNull()
    })

    it('a generic Sumsub RFI without a dedicated supplement step parks the remaining action', () => {
        const result = deriveCapabilityPhaseSignals(
            snapshot({ state: 'action_required', action: 'ar-rfi' }, [action('sumsub', 'ar-rfi')]),
            'LATAM',
            'AR'
        )
        expect(result.allSettled).toBe(false)
        expect(notice(result)).toEqual({ kind: 'action', currencies: ['ARS'] })
    })

    it('another country and enabled QR cannot finish the requested bank account', () => {
        const capabilities = snapshot({ state: 'pending' }, [], { brl: { state: 'on' }, usd: { state: 'on' } })
        const result = deriveCapabilityPhaseSignals(capabilities, 'LATAM', 'AR')
        expect(result.allSettled).toBe(false)
        expect(notice(result)).toBeNull()
    })

    it('another country action cannot be mistaken for the requested country', () => {
        const capabilities = snapshot({ state: 'action_required', action: 'ar-step' }, [action('questions')], {
            brl: { state: 'setting_up' },
        })
        const result = deriveCapabilityPhaseSignals(capabilities, 'LATAM', 'BR')
        expect(result.allSettled).toBe(false)
        expect(notice(result)).toBeNull()
    })

    it('an unrelated ready region cannot authorize the requested intent', () => {
        const result = deriveCapabilityPhaseSignals(snapshot({ state: 'on' }), 'NA', 'US')
        expect(result.allSettled).toBe(false)
        expect(notice(result)).toBeNull()
    })

    it('a usable requested account is settled without a notice', () => {
        const result = deriveCapabilityPhaseSignals(snapshot({ state: 'on' }), 'LATAM', 'AR')
        expect(result.allSettled).toBe(true)
        expect(notice(result)).toBeNull()
    })
})

const approvedFlow = async (
    capabilities: UserCapabilities,
    options: Parameters<typeof useMultiPhaseKycFlow>[0] = {}
) => {
    mockCapabilities = capabilities
    const view = renderHook(() => useMultiPhaseKycFlow({ regionIntent: 'LATAM', ...options }))
    await act(async () => {
        await view.result.current.handleInitiateKyc('LATAM', undefined, false, 'AR')
    })
    act(() => view.result.current.handleSdkComplete())
    expect(mockApproval.handler).toEqual(expect.any(Function))
    await act(async () => {
        await mockApproval.handler?.()
    })
    return view
}

describe('L8 post-approval completion lifecycle', () => {
    it.each([
        {
            entry: { state: 'action_required', action: 'ar-step' } as const,
            actions: [action('questions')],
            kind: 'action',
        },
        { entry: { state: 'setting_up', action: 'ar-step' } as const, actions: [action('wait')], kind: 'review' },
    ])('fresh approval completes $kind promptly and cannot time out later', async ({ entry, actions, kind }) => {
        const onKycSuccess = jest.fn()
        const view = await approvedFlow(snapshot(entry, actions), { onKycSuccess })
        expect(view.result.current.modalPhase).toBe('complete')
        expect(view.result.current.isModalOpen).toBe(true)
        expect(notice(view.result.current)).toEqual({ kind, currencies: ['ARS'] })
        await act(async () => {
            jest.advanceTimersByTime(31_000)
        })
        expect(view.result.current.preparingTimedOut).toBe(false)
        expect(view.result.current.modalPhase).toBe('complete')
        expect(onKycSuccess).not.toHaveBeenCalled()
    })

    it.each([
        {
            entry: { state: 'action_required', action: 'ar-step' } as const,
            actions: [action('questions')],
            kind: 'action',
        },
        { entry: { state: 'setting_up', reason: 'requirements_in_review' } as const, actions: [], kind: 'review' },
    ])(
        'a reactive provisioning to $kind transition completes and clears its timer',
        async ({ entry, actions, kind }) => {
            const view = await approvedFlow(snapshot({ state: 'setting_up' }))
            expect(view.result.current.modalPhase).toBe('preparing')
            mockCapabilities = snapshot(entry, actions)
            view.rerender()
            expect(view.result.current.modalPhase).toBe('complete')
            expect(notice(view.result.current)).toEqual({ kind, currencies: ['ARS'] })
            await act(async () => {
                jest.advanceTimersByTime(31_000)
            })
            expect(view.result.current.preparingTimedOut).toBe(false)
        }
    )

    it('ordinary provisioning retains timeout recovery and later usable completion', async () => {
        const onKycSuccess = jest.fn()
        const view = await approvedFlow(snapshot({ state: 'setting_up' }), { onKycSuccess })
        expect(view.result.current.modalPhase).toBe('preparing')
        await act(async () => {
            jest.advanceTimersByTime(31_000)
        })
        expect(view.result.current.preparingTimedOut).toBe(true)
        expect(onKycSuccess).not.toHaveBeenCalled()
        mockCapabilities = snapshot({ state: 'on' })
        view.rerender()
        expect(view.result.current.modalPhase).toBe('complete')
        expect(notice(view.result.current)).toBeNull()
        await act(async () => {
            await view.result.current.completeFlow()
        })
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
    })

    it('duplicate Continue on parked action closes exactly once without money flow or abandonment', async () => {
        const onKycSuccess = jest.fn()
        const onManualClose = jest.fn()
        const view = await approvedFlow(
            snapshot({ state: 'action_required', action: 'ar-step' }, [action('questions')]),
            { onKycSuccess, onManualClose }
        )
        const complete = view.result.current.completeFlow
        await act(async () => {
            await complete()
        })
        const captureCount = jest.mocked(posthog.capture).mock.calls.length
        const closeCount = onManualClose.mock.calls.length
        await act(async () => {
            await complete()
            await view.result.current.completeFlow()
        })
        expect(view.result.current.isModalOpen).toBe(false)
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(onManualClose.mock.calls.length).toBe(closeCount)
        expect(closeCount).toBeLessThanOrEqual(1)
        expect(jest.mocked(posthog.capture).mock.calls.length).toBe(captureCount)
        expect(jest.mocked(posthog.capture).mock.calls.some(([event]) => /kyc.*abandon/i.test(event))).toBe(false)
    })

    it('failed approval refresh never calls the money callback', async () => {
        mockFetchUser.mockRejectedValue(new Error('temporary refresh failure'))
        const onKycSuccess = jest.fn()
        const view = await approvedFlow(snapshot({ state: 'pending' }), { onKycSuccess })
        await act(async () => {
            jest.advanceTimersByTime(31_000)
        })
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(notice(view.result.current)).toBeNull()
        expect(view.result.current.modalPhase).not.toBe('complete')
    })
})
