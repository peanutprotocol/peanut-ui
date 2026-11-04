jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
import { setAuthToken } from '@/utils/auth-token'
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import type { PaperworkVerificationStep } from '@/app/actions/types/kyc-paperwork-verification.types'
import { saveKycAnswers } from '@/app/actions/kyc-paperwork-verification'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    KycControlFlowProvider,
    KycControlScreenProvider,
    PaperworkVerificationTrackingProvider,
    trackKycControl,
    useKycControl,
    type KycControlFlow,
    type PaperworkVerificationTrackingContext,
} from '../analytics'
import { QuestionStepScreen, trackSaveOutcome } from '../components/QuestionStepScreen'

jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => ({ user: { user: { userId: 'user-a' } } }),
}))

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/kyc-paperwork-verification', () => ({ saveKycAnswers: jest.fn() }))

const mockCapture = posthog.capture as jest.Mock
const mockSave = saveKycAnswers as jest.MockedFunction<typeof saveKycAnswers>

const text = (key: string) => ({ key, kind: 'text' as const, required: true, value: null })
const steps: PaperworkVerificationStep[] = [
    {
        id: 'address',
        features: ['base'],
        answered: false,
        fields: [
            text('street'),
            text('town'),
            text('postCode'),
            { key: 'country', kind: 'country', required: true, locked: true, value: 'BR' },
        ],
    },
    {
        id: 'phone',
        features: ['card'],
        answered: false,
        fields: [{ key: 'phone', kind: 'phone', required: true, value: null }],
    },
]

const events = () => mockCapture.mock.calls.map(([event]) => event)
const propsOf = (event: string) => mockCapture.mock.calls.filter(([e]) => e === event).map(([, props]) => props)

function renderScreen(onChangeResidence = jest.fn()) {
    renderWithIntl(
        <PaperworkVerificationTrackingProvider
            value={{ flow: 'paperwork_verification', residence: 'BR', features: { card: true } }}
        >
            <QuestionStepScreen
                steps={steps}
                residence="BR"
                progress={{ current: 4, total: 7 }}
                onSaved={jest.fn()}
                onChangeResidence={onChangeResidence}
            />
        </PaperworkVerificationTrackingProvider>
    )
    return onChangeResidence
}

function fillIn() {
    fireEvent.change(screen.getByTestId('verify-input-street'), { target: { value: 'Rua Augusta 1508' } })
    fireEvent.change(screen.getByTestId('verify-input-town'), { target: { value: 'São Paulo' } })
    fireEvent.change(screen.getByTestId('verify-input-postCode'), { target: { value: '01304-001' } })
    fireEvent.change(screen.getByTestId('verify-input-phone'), { target: { value: '+55 11 98765 4321' } })
}

beforeEach(() => {
    jest.clearAllMocks()
    setAuthToken(`x.${btoa(JSON.stringify({ userId: 'user-a' }))}.y`)
})

describe('Smart Paperwork Verification tracking', () => {
    it('reports the screen, the submit and the save with the flow, residence, features and both step ids', async () => {
        mockSave.mockResolvedValue({ kind: 'saved', next: 'tax' })
        renderScreen()
        fillIn()
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(events()).toContain(ANALYTICS_EVENTS.KYC_PV_STEP_SAVED))
        expect(events().filter((event) => event !== ANALYTICS_EVENTS.CONTROL_USED)).toEqual([
            ANALYTICS_EVENTS.KYC_PV_STEP_VIEWED,
            ANALYTICS_EVENTS.KYC_PV_STEP_SUBMITTED,
            ANALYTICS_EVENTS.KYC_PV_STEP_SAVED,
        ])
        expect(propsOf(ANALYTICS_EVENTS.KYC_PV_STEP_VIEWED)[0]).toMatchObject({
            flow: 'paperwork_verification',
            residence: 'BR',
            feature_card: true,
            step: 'address',
            steps: 'address+phone',
            screen_index: 4,
            screen_total: 7,
        })
        expect(propsOf(ANALYTICS_EVENTS.KYC_PV_STEP_SAVED)[0]).toMatchObject({ rejected_before: 0 })
    })

    it('names every refused field with its code, and never sends what was typed', async () => {
        mockSave
            .mockResolvedValueOnce({ kind: 'saved', next: 'phone' })
            .mockResolvedValueOnce({ kind: 'invalid', errors: { phone: 'invalid_phone' } })
        renderScreen()
        fillIn()
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(events()).toContain(ANALYTICS_EVENTS.KYC_PV_FIELD_ERROR))
        expect(propsOf(ANALYTICS_EVENTS.KYC_PV_STEP_REJECTED)[0]).toMatchObject({
            failed_step: 'phone',
            fields: ['phone'],
            codes: ['invalid_phone'],
            attempt: 1,
        })
        expect(propsOf(ANALYTICS_EVENTS.KYC_PV_FIELD_ERROR)[0]).toMatchObject({
            field: 'phone',
            code: 'invalid_phone',
            source: 'server',
        })
        const sent = JSON.stringify(mockCapture.mock.calls)
        for (const typed of ['Augusta', 'São Paulo', '01304', '98765']) expect(sent).not.toContain(typed)
    })

    it('flags a phone the check would refuse once it is typed, once per field and code', () => {
        renderScreen()
        const phone = screen.getByTestId('verify-input-phone')
        fireEvent.change(phone, { target: { value: '11 98765 4321' } })
        fireEvent.blur(phone)
        fireEvent.blur(phone)
        expect(propsOf(ANALYTICS_EVENTS.KYC_PV_FIELD_ERROR)).toEqual([
            expect.objectContaining({ field: 'phone', code: 'invalid_phone', source: 'typing' }),
        ])
    })

    it('keeps the country locked, offers the residence change and reports it', () => {
        const onChangeResidence = renderScreen()
        expect(screen.getByTestId('verify-input-country')).toHaveAttribute('readonly')
        fireEvent.click(screen.getByTestId('verify-change-residence'))
        expect(onChangeResidence).toHaveBeenCalled()
        expect(events()).toContain(ANALYTICS_EVENTS.KYC_PV_RESIDENCE_CHANGE_OPENED)
    })

    it('reports "Why do we ask?" with the steps it explains', () => {
        renderScreen()
        fireEvent.click(screen.getByTestId('verify-why'))
        expect(propsOf(ANALYTICS_EVENTS.KYC_PV_WHY_OPENED)[0]).toMatchObject({ steps: 'address+phone' })
    })
})

describe('declaration analytics privacy', () => {
    it('normalizes the tax-answer refusal in both step and field events', () => {
        const track = jest.fn()
        trackSaveOutcome(
            track,
            {
                ok: false,
                step: 'declarations',
                rejected: { step: 'declarations', errors: { isFatca: 'us_citizen_not_supported' } },
            },
            { seconds: 4, rejectedBefore: 0 }
        )
        expect(track).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.KYC_PV_STEP_REJECTED,
            expect.objectContaining({ codes: ['not_supported'] })
        )
        expect(track).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.KYC_PV_FIELD_ERROR,
            expect.objectContaining({ field: 'isFatca', code: 'not_supported' })
        )
        const sent = JSON.stringify(track.mock.calls)
        expect(sent).not.toMatch(/us_citizen_not_supported|us_person|local_refused/)
    })
})

describe('KYC control tracking contract', () => {
    const context = {
        flow: 'paperwork_verification' as const,
        residence: 'BR',
        features: { card: true, base: false },
        feature: 'card' as const,
        step: 'address',
        restart: true,
    }

    function Provider({ children }: PropsWithChildren) {
        return <PaperworkVerificationTrackingProvider value={context}>{children}</PaperworkVerificationTrackingProvider>
    }

    function renderControl(flowOverride?: Parameters<typeof useKycControl>[1]) {
        return renderHook(() => useKycControl('verification-details', flowOverride), { wrapper: Provider })
    }

    // KC-01: controls inherit the same provider context as existing verification events.
    it('captures the control with all existing provider context dimensions', () => {
        const { result } = renderControl()

        act(() => result.current.track('continue', 'tap', 'next'))

        expect(mockCapture).toHaveBeenCalledTimes(1)
        expect(mockCapture).toHaveBeenCalledWith(
            'control_used',
            expect.objectContaining({
                flow: 'paperwork_verification',
                residence: 'BR',
                feature_card: true,
                feature_base: false,
                feature: 'card',
                step: 'address',
                restart: true,
                screen_id: 'verification-details',
                control: 'continue',
                action: 'tap',
                value: 'next',
            })
        )
    })

    // KC-02: an override supplies context only when there is no provider.
    it('keeps provider flow and context when an explicit fallback flow is also supplied', () => {
        const { result } = renderControl('kyc_status')

        act(() => result.current.track('continue', 'tap'))

        expect(propsOf('control_used')).toEqual([
            expect.objectContaining({
                flow: 'paperwork_verification',
                residence: 'BR',
                step: 'address',
                restart: true,
                feature: 'card',
                feature_card: true,
                feature_base: false,
            }),
        ])
    })

    it.each(['kyc_status', 'kyc_legacy', 'kyc_provider_request'] as const)(
        'captures controls safely outside the provider with the explicit %s fallback',
        (flow) => {
            const { result } = renderHook(() => useKycControl('verification-details', flow))

            act(() => {
                result.current.track('continue', 'tap')
                result.current.trackOnce('street', 'change')
            })

            expect(propsOf('control_used')).toEqual([
                expect.objectContaining({
                    flow,
                    screen_id: 'verification-details',
                    control: 'continue',
                    action: 'tap',
                }),
                expect.objectContaining({
                    flow,
                    screen_id: 'verification-details',
                    control: 'street',
                    action: 'change',
                }),
            ])
        }
    )

    // KC-03: an unscoped control must never be attributed to a guessed KYC flow.
    it('does nothing without both a provider and an explicit fallback', () => {
        const { result, rerender } = renderHook(() => useKycControl('verification-details'))

        expect(() => {
            act(() => {
                result.current.track('continue', 'tap', 'next')
                result.current.trackOnce('street', 'change')
            })
            rerender()
            act(() => result.current.trackOnce('street', 'change'))
        }).not.toThrow()
        expect(mockCapture).not.toHaveBeenCalled()
    })

    // KC-04: ordinary interactions remain repeatable; only trackOnce deduplicates.
    it('captures every ordinary track invocation for the same control and action', () => {
        const { result } = renderControl()

        act(() => {
            result.current.track('continue', 'tap')
            result.current.track('continue', 'tap')
        })

        expect(propsOf('control_used')).toHaveLength(2)
    })

    it('deduplicates trackOnce by control and action for one mount, including rerenders', () => {
        const { result, rerender } = renderControl()

        act(() => {
            result.current.trackOnce('street', 'change')
            result.current.trackOnce('street', 'change')
        })
        rerender()
        act(() => result.current.trackOnce('street', 'change'))

        expect(propsOf('control_used')).toEqual([expect.objectContaining({ control: 'street', action: 'change' })])
    })

    it('tracks a different control or action independently in the same mount', () => {
        const { result } = renderControl()

        act(() => {
            result.current.trackOnce('street', 'change')
            result.current.trackOnce('street', 'error')
            result.current.trackOnce('town', 'change')
            result.current.trackOnce('street', 'error')
            result.current.trackOnce('town', 'change')
        })

        expect(propsOf('control_used')).toEqual([
            expect.objectContaining({ control: 'street', action: 'change' }),
            expect.objectContaining({ control: 'street', action: 'error' }),
            expect.objectContaining({ control: 'town', action: 'change' }),
        ])
    })

    it('resets trackOnce deduplication on a new mount', () => {
        const first = renderControl()
        act(() => first.result.current.trackOnce('street', 'change'))
        first.unmount()

        const second = renderControl()
        act(() => second.result.current.trackOnce('street', 'change'))

        expect(propsOf('control_used')).toEqual([
            expect.objectContaining({ control: 'street', action: 'change' }),
            expect.objectContaining({ control: 'street', action: 'change' }),
        ])
    })

    // KC-05: omit an absent value rather than emitting an undefined property.
    it('omits the value property when no value or an explicit undefined is supplied', () => {
        const { result } = renderControl()

        act(() => {
            result.current.track('continue', 'tap')
            result.current.track('back', 'tap', undefined)
            result.current.trackOnce('street', 'change')
        })

        expect(propsOf('control_used')).toHaveLength(3)
        for (const props of propsOf('control_used')) expect(props).not.toHaveProperty('value')
    })

    // KC-06: telemetry failure cannot escape into the interaction handler.
    it('contains capture exceptions for both tracking methods and allows later interactions', () => {
        const { result } = renderControl()
        mockCapture
            .mockImplementationOnce(() => {
                throw new Error('capture unavailable')
            })
            .mockImplementationOnce(() => {
                throw new Error('capture unavailable')
            })

        expect(() => act(() => result.current.track('continue', 'tap'))).not.toThrow()
        expect(() => act(() => result.current.trackOnce('street', 'change'))).not.toThrow()
        expect(() => act(() => result.current.track('back', 'tap'))).not.toThrow()

        expect(mockCapture).toHaveBeenCalledTimes(3)
        expect(propsOf('control_used')[2]).toMatchObject({ control: 'back', action: 'tap' })
    })

    // KC-07: field interaction telemetry carries identifiers, never typed answers.
    it('keeps typed secrets out of the captured control payloads', () => {
        const typed = { street: 'Rua Privada 42', postCode: '04512-999', phone: '+55 11 91234 5678' }
        renderWithIntl(
            <Provider>
                <QuestionStepScreen steps={steps} residence="BR" onSaved={jest.fn()} />
            </Provider>
        )
        for (const [key, value] of Object.entries(typed)) {
            const input = screen.getByTestId(`verify-input-${key}`)
            fireEvent.focus(input)
            fireEvent.change(input, { target: { value } })
            fireEvent.change(input, { target: { value: `${value}0` } })
            fireEvent.blur(input)
        }

        const edits = propsOf('control_used').filter((props) => props.action === 'change')
        expect(edits.map((props) => props.control)).toEqual(Object.keys(typed))
        for (const props of edits) expect(props).not.toHaveProperty('value')
        const sent = JSON.stringify(mockCapture.mock.calls)
        for (const secret of ['Privada', '04512', '91234']) expect(sent).not.toContain(secret)
    })
})

describe('KYC control scopes', () => {
    const scoped = (
        flow: KycControlFlow | null,
        screenId: string | null,
        ctx: PaperworkVerificationTrackingContext | null = null
    ) =>
        function Scoped({ children }: PropsWithChildren) {
            return (
                <PaperworkVerificationTrackingProvider value={ctx}>
                    <KycControlFlowProvider value={flow}>
                        <KycControlScreenProvider value={screenId}>{children}</KycControlScreenProvider>
                    </KycControlFlowProvider>
                </PaperworkVerificationTrackingProvider>
            )
        }

    it('takes the screen from the surrounding screen when the control names none, and its own over it', () => {
        const { result } = renderHook(
            () => ({ picker: useKycControl(), back: useKycControl('documents', 'kyc_status') }),
            { wrapper: scoped('kyc_status', 'address+phone') }
        )
        act(() => {
            result.current.picker.track('countryOfBirth', 'select', 'BR')
            result.current.back.track('back', 'tap')
        })
        expect(propsOf(ANALYTICS_EVENTS.CONTROL_USED)).toEqual([
            {
                flow: 'kyc_status',
                screen_id: 'address+phone',
                control: 'countryOfBirth',
                action: 'select',
                value: 'BR',
            },
            { flow: 'kyc_status', screen_id: 'documents', control: 'back', action: 'tap' },
        ])
    })

    it('reports nothing without a screen, even with a flow', () => {
        const { result } = renderHook(() => useKycControl(undefined, 'kyc_status'))
        act(() => result.current.track('back', 'tap'))
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it("lets a surface's flow outrank a control's fallback, and /verify's context outrank both", () => {
        const fallback = renderHook(() => useKycControl('id-check', 'kyc_legacy'), {
            wrapper: scoped('kyc_provider_request', null),
        })
        act(() => fallback.result.current.track('close', 'tap'))
        const inFlow = renderHook(() => useKycControl('id-check', 'kyc_legacy'), {
            wrapper: scoped('kyc_provider_request', null, { flow: 'add_later', residence: 'AR', feature: 'local' }),
        })
        act(() => inFlow.result.current.track('close', 'tap'))
        expect(propsOf(ANALYTICS_EVENTS.CONTROL_USED)).toEqual([
            { flow: 'kyc_provider_request', screen_id: 'id-check', control: 'close', action: 'tap' },
            {
                flow: 'add_later',
                residence: 'AR',
                feature: 'local',
                screen_id: 'id-check',
                control: 'close',
                action: 'tap',
            },
        ])
    })

    it('trackKycControl sends the same shape for a screen that builds its own context', () => {
        trackKycControl(
            { ctx: { flow: 'paperwork_verification', residence: 'BR', step: 'tax' }, screenId: 'tax' },
            'continue',
            'tap'
        )
        trackKycControl({ ctx: null, screenId: 'tax' }, 'continue', 'tap')
        trackKycControl({ ctx: null, flow: 'kyc_status', screenId: null }, 'continue', 'tap')
        expect(propsOf(ANALYTICS_EVENTS.CONTROL_USED)).toEqual([
            {
                flow: 'paperwork_verification',
                residence: 'BR',
                step: 'tax',
                screen_id: 'tax',
                control: 'continue',
                action: 'tap',
            },
        ])
    })
})
