import { fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import type { VerifyOnceStep } from '@/app/actions/types/kyc-verify-once.types'
import { saveKycAnswers } from '@/app/actions/kyc-verify-once'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { VerifyOnceTrackingProvider } from '../analytics'
import { QuestionStepScreen } from '../components/QuestionStepScreen'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/kyc-verify-once', () => ({ saveKycAnswers: jest.fn() }))

const mockCapture = posthog.capture as jest.Mock
const mockSave = saveKycAnswers as jest.MockedFunction<typeof saveKycAnswers>

const text = (key: string) => ({ key, kind: 'text' as const, required: true, value: null })
const steps: VerifyOnceStep[] = [
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
        <VerifyOnceTrackingProvider value={{ flow: 'verify_once', residence: 'BR', features: { card: true } }}>
            <QuestionStepScreen
                steps={steps}
                residence="BR"
                progress={{ current: 4, total: 7 }}
                onSaved={jest.fn()}
                onChangeResidence={onChangeResidence}
            />
        </VerifyOnceTrackingProvider>
    )
    return onChangeResidence
}

function fillIn() {
    fireEvent.change(screen.getByTestId('verify-input-street'), { target: { value: 'Rua Augusta 1508' } })
    fireEvent.change(screen.getByTestId('verify-input-town'), { target: { value: 'São Paulo' } })
    fireEvent.change(screen.getByTestId('verify-input-postCode'), { target: { value: '01304-001' } })
    fireEvent.change(screen.getByTestId('verify-input-phone'), { target: { value: '+55 11 98765 4321' } })
}

beforeEach(() => jest.clearAllMocks())

describe('verify-once tracking', () => {
    it('reports the screen, the submit and the save with the flow, residence, features and both step ids', async () => {
        mockSave.mockResolvedValue({ kind: 'saved', next: 'tax' })
        renderScreen()
        fillIn()
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(events()).toContain(ANALYTICS_EVENTS.KYC_VO_STEP_SAVED))
        expect(events()).toEqual([
            ANALYTICS_EVENTS.KYC_VO_STEP_VIEWED,
            ANALYTICS_EVENTS.KYC_VO_STEP_SUBMITTED,
            ANALYTICS_EVENTS.KYC_VO_STEP_SAVED,
        ])
        expect(propsOf(ANALYTICS_EVENTS.KYC_VO_STEP_VIEWED)[0]).toMatchObject({
            flow: 'verify_once',
            residence: 'BR',
            feature_card: true,
            step: 'address',
            steps: 'address+phone',
            screen_index: 4,
            screen_total: 7,
        })
        expect(propsOf(ANALYTICS_EVENTS.KYC_VO_STEP_SAVED)[0]).toMatchObject({ rejected_before: 0 })
    })

    it('names every refused field with its code, and never sends what was typed', async () => {
        mockSave
            .mockResolvedValueOnce({ kind: 'saved', next: 'phone' })
            .mockResolvedValueOnce({ kind: 'invalid', errors: { phone: 'invalid_phone' } })
        renderScreen()
        fillIn()
        fireEvent.click(screen.getByTestId('verify-continue'))
        await waitFor(() => expect(events()).toContain(ANALYTICS_EVENTS.KYC_VO_FIELD_ERROR))
        expect(propsOf(ANALYTICS_EVENTS.KYC_VO_STEP_REJECTED)[0]).toMatchObject({
            failed_step: 'phone',
            fields: ['phone'],
            codes: ['invalid_phone'],
            attempt: 1,
        })
        expect(propsOf(ANALYTICS_EVENTS.KYC_VO_FIELD_ERROR)[0]).toMatchObject({
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
        expect(propsOf(ANALYTICS_EVENTS.KYC_VO_FIELD_ERROR)).toEqual([
            expect.objectContaining({ field: 'phone', code: 'invalid_phone', source: 'typing' }),
        ])
    })

    it('keeps the country locked, offers the residence change and reports it', () => {
        const onChangeResidence = renderScreen()
        expect(screen.getByTestId('verify-input-country')).toHaveAttribute('readonly')
        fireEvent.click(screen.getByTestId('verify-change-residence'))
        expect(onChangeResidence).toHaveBeenCalled()
        expect(events()).toContain(ANALYTICS_EVENTS.KYC_VO_RESIDENCE_CHANGE_OPENED)
    })

    it('reports "Why do we ask?" with the steps it explains', () => {
        renderScreen()
        fireEvent.click(screen.getByTestId('verify-why'))
        expect(propsOf(ANALYTICS_EVENTS.KYC_VO_WHY_OPENED)[0]).toMatchObject({ steps: 'address+phone' })
    })
})
