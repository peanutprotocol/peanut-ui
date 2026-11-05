jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/kyc-paperwork-verification', () => ({
    getKycQuestions: jest.fn(),
    saveKycAnswers: jest.fn(),
    searchKycPlaces: jest.fn(),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({ user: { user: { username: 'tester' } }, fetchUser: jest.fn() }),
}))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

import { useState, type PropsWithChildren } from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { searchKycPlaces } from '@/app/actions/kyc-paperwork-verification'
import type {
    PaperworkVerificationField,
    PaperworkVerificationStep,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { PaperworkVerificationTrackingProvider, KycControlScreenProvider } from '../analytics'
import { QuestionFields } from '../components/QuestionFields'
import { QuestionStepScreen } from '../components/QuestionStepScreen'
import { AnswerPicker } from '../components/AnswerPicker'
import { PlacePicker } from '../components/PlaceField'

const capture = posthog.capture as jest.Mock
const search = searchKycPlaces as jest.Mock
const context = { flow: 'paperwork_verification' as const, residence: 'BR', features: { card: true }, step: 'address' }
const base = {
    flow: 'paperwork_verification',
    residence: 'BR',
    feature_card: true,
    step: 'address',
    screen_id: 'address+phone',
}
const controls = () => capture.mock.calls.filter(([event]) => event === 'control_used').map(([, props]) => props)
const matching = (control: string, action: string) =>
    controls().filter((event) => event.control === control && event.action === action)
const expectControl = (control: string, action: string, value?: string) => {
    expect(matching(control, action)).toContainEqual(
        expect.objectContaining({ ...base, control, action, ...(value === undefined ? {} : { value }) })
    )
    if (value === undefined) for (const event of matching(control, action)) expect(event).not.toHaveProperty('value')
}
const noSecrets = () => {
    const payload = JSON.stringify(capture.mock.calls)
    for (const secret of ['Secret Street', 'Secret Name', '123456789', '987654321', 'Kleindorf', 'privatequery'])
        expect(payload).not.toContain(secret)
}
function Providers({ children }: PropsWithChildren) {
    return (
        <PaperworkVerificationTrackingProvider value={context}>
            <KycControlScreenProvider value="address+phone">{children}</KycControlScreenProvider>
        </PaperworkVerificationTrackingProvider>
    )
}
const field = (key: string, kind: PaperworkVerificationField['kind'] = 'text'): PaperworkVerificationField => ({
    key,
    kind,
    required: true,
    value: null,
})
function FieldsHarness() {
    const [values, setValues] = useState<Record<string, string>>({})
    return (
        <QuestionFields
            fields={[
                field('street'),
                field('taxId'),
                field('phone', 'phone'),
                { ...field('state', 'select'), options: ['CA', 'NY'] },
            ]}
            values={values}
            errors={{}}
            residence="US"
            onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        />
    )
}
beforeEach(() => {
    capture.mockClear()
    search.mockReset()
})

describe('question controls', () => {
    it('reports only the first edit per field per mount, and records safe state codes', () => {
        const view = renderWithIntl(
            <Providers>
                <FieldsHarness />
            </Providers>
        )
        for (const [key, value] of [
            ['street', 'Secret Street'],
            ['taxId', '123456789'],
            ['phone', '987654321'],
        ]) {
            const input = screen.getByTestId(`verify-input-${key}`)
            fireEvent.change(input, { target: { value } })
            fireEvent.change(input, { target: { value: `${value}2` } })
            expectControl(key, 'change')
            expect(matching(key, 'change')).toHaveLength(1)
        }
        fireEvent.change(screen.getByRole('combobox', { name: /state or region/i }), { target: { value: 'CA' } })
        expectControl('state', 'select')
        noSecrets()
        view.unmount()
        renderWithIntl(
            <Providers>
                <FieldsHarness />
            </Providers>
        )
        fireEvent.change(screen.getByTestId('verify-input-street'), { target: { value: 'Secret Street' } })
        expect(matching('street', 'change')).toHaveLength(2)
    })

    it('tracks a locked residence change', () => {
        const onChangeResidence = jest.fn()
        renderWithIntl(
            <Providers>
                <QuestionFields
                    fields={[{ ...field('country', 'country'), locked: true, value: 'BR' }]}
                    values={{ country: 'BR' }}
                    errors={{}}
                    residence="BR"
                    onChange={jest.fn()}
                    onChangeResidence={onChangeResidence}
                />
            </Providers>
        )
        fireEvent.click(screen.getByTestId('verify-change-residence'))
        expect(onChangeResidence).toHaveBeenCalledTimes(1)
        expectControl('change_residence', 'tap')
    })

    it('tracks country picker choice without a dismiss event', () => {
        renderWithIntl(
            <Providers>
                <AnswerPicker field={field('countryOfBirth', 'country')} value="" onChange={jest.fn()} />
            </Providers>
        )
        fireEvent.click(screen.getByTestId('verify-pick-countryOfBirth'))
        expectControl('countryOfBirth', 'open')
        fireEvent.change(screen.getByRole('searchbox', { name: /search countries/i }), {
            target: { value: 'United States' },
        })
        fireEvent.click(screen.getByRole('button', { name: /united states/i }))
        expectControl('countryOfBirth_search', 'change')
        expectControl('countryOfBirth', 'select')
        expect(matching('countryOfBirth', 'dismiss')).toHaveLength(0)
    })
})

describe('place picker controls', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())
    const place: PaperworkVerificationField = { ...field('cityOfBirth', 'place'), countryField: 'countryOfBirth' }
    async function type(value: string) {
        fireEvent.change(screen.getByTestId('verify-input-place'), { target: { value } })
        await act(async () => {
            jest.advanceTimersByTime(300)
        })
    }
    it('tracks search once and selection without sending search or selected city', async () => {
        search.mockResolvedValue([{ name: 'Kleindorf', region: 'Bavaria' }])
        renderWithIntl(
            <Providers>
                <PlacePicker field={place} value="" country="DE" onChange={jest.fn()} />
            </Providers>
        )
        fireEvent.click(screen.getByTestId('verify-pick-cityOfBirth'))
        await type('privatequery')
        await type('Kleindorf')
        fireEvent.click(screen.getByRole('option', { name: /Kleindorf/ }))
        expectControl('cityOfBirth', 'change')
        expect(matching('cityOfBirth', 'change')).toHaveLength(1)
        expectControl('cityOfBirth', 'select', 'suggestion')
        expect(matching('cityOfBirth', 'select')).toHaveLength(1)
        expect(matching('cityOfBirth', 'dismiss')).toHaveLength(0)
        noSecrets()
    })
    it('records Done as one selection of what was typed, never the place or a dismiss', async () => {
        search.mockResolvedValue([])
        renderWithIntl(
            <Providers>
                <PlacePicker field={place} value="" country="DE" onChange={jest.fn()} />
            </Providers>
        )
        fireEvent.click(screen.getByTestId('verify-pick-cityOfBirth'))
        await type('Kleindorf')
        const beforeDone = controls().length
        fireEvent.click(screen.getByTestId('verify-place-done'))
        expect(controls().slice(beforeDone)).toEqual([
            expect.objectContaining({ ...base, control: 'cityOfBirth', action: 'select', value: 'typed' }),
        ])
        expect(matching('cityOfBirth', 'dismiss')).toHaveLength(0)
        noSecrets()
    })
})

it('tracks question screen continue and why interactions', () => {
    const steps: PaperworkVerificationStep[] = [
        { id: 'address', features: ['base'], answered: false, fields: [field('street')] },
        { id: 'phone', features: ['card'], answered: false, fields: [field('phone', 'phone')] },
    ]
    renderWithIntl(
        <PaperworkVerificationTrackingProvider value={context}>
            <QuestionStepScreen steps={steps} residence="BR" onSubmitted={jest.fn()} />
        </PaperworkVerificationTrackingProvider>
    )
    fireEvent.change(screen.getByTestId('verify-input-street'), { target: { value: 'Secret Street' } })
    fireEvent.change(screen.getByTestId('verify-input-phone'), { target: { value: '+5511987654321' } })
    fireEvent.click(screen.getByTestId('verify-continue'))
    expectControl('continue', 'tap')
    fireEvent.click(screen.getByTestId('verify-why'))
    expectControl('why', 'open')
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expectControl('why_got_it', 'tap')
    expect(matching('why', 'dismiss')).toHaveLength(0)
})

it('tracks replacement of a masked tax ID without sending the number', () => {
    const onChange = jest.fn()
    renderWithIntl(
        <Providers>
            <QuestionFields
                fields={[{ ...field('taxId', 'taxId'), value: '•••• 1234', masked: true, format: 'cuit' }]}
                values={{ taxId: '•••• 1234' }}
                errors={{}}
                residence="BR"
                onChange={onChange}
            />
        </Providers>
    )
    fireEvent.click(screen.getByTestId('verify-tax-replace'))
    expectControl('taxId_clear', 'tap')
    noSecrets()
    expect(JSON.stringify(capture.mock.calls)).not.toContain('1234')
})

it('records a declaration toggle by its field key, never its answer', () => {
    function Toggle() {
        const [value, setValue] = useState('no')
        return (
            <QuestionFields
                fields={[field('isFatca', 'toggle')]}
                values={{ isFatca: value }}
                errors={{}}
                residence="BR"
                onChange={(_, next) => setValue(next)}
            />
        )
    }
    renderWithIntl(
        <Providers>
            <Toggle />
        </Providers>
    )
    fireEvent.click(screen.getByTestId('verify-toggle-isFatca'))
    fireEvent.click(screen.getByTestId('verify-toggle-isFatca'))
    expectControl('isFatca', 'toggle')
    expect(matching('isFatca', 'toggle')).toHaveLength(2)
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/"(on|off|yes|no)"/)
})

it('records a picker dismissal and deduplicates search across reopening', async () => {
    renderWithIntl(
        <Providers>
            <AnswerPicker field={field('countryOfBirth', 'country')} value="" onChange={jest.fn()} />
        </Providers>
    )
    fireEvent.click(screen.getByTestId('verify-pick-countryOfBirth'))
    fireEvent.change(screen.getByRole('searchbox', { name: /search countries/i }), {
        target: { value: 'privatequery' },
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(matching('countryOfBirth', 'dismiss')).toHaveLength(1))
    fireEvent.click(screen.getByTestId('verify-pick-countryOfBirth'))
    fireEvent.change(screen.getByRole('searchbox', { name: /search countries/i }), {
        target: { value: 'United States' },
    })
    expectControl('countryOfBirth_search', 'change')
    expect(matching('countryOfBirth_search', 'change')).toHaveLength(1)
    noSecrets()
})

it('deduplicates place answer edits across drawer closure and reopening', async () => {
    search.mockResolvedValue([])
    const place: PaperworkVerificationField = { ...field('cityOfBirth', 'place'), countryField: 'countryOfBirth' }
    renderWithIntl(
        <Providers>
            <PlacePicker field={place} value="" country="DE" onChange={jest.fn()} />
        </Providers>
    )
    fireEvent.click(screen.getByTestId('verify-pick-cityOfBirth'))
    fireEvent.change(screen.getByTestId('verify-input-place'), { target: { value: 'Kleindorf' } })
    fireEvent.click(screen.getByTestId('verify-place-done'))
    await waitFor(() => expect(screen.getByTestId('verify-pick-cityOfBirth')).toHaveAttribute('aria-expanded', 'false'))
    fireEvent.click(screen.getByTestId('verify-pick-cityOfBirth'))
    fireEvent.change(screen.getByTestId('verify-input-place'), { target: { value: 'privatequery' } })
    expectControl('cityOfBirth', 'change')
    expect(matching('cityOfBirth', 'change')).toHaveLength(1)
    noSecrets()
})

it('tracks Back and Why dismissal independently of submission', async () => {
    const onBack = jest.fn()
    const steps: PaperworkVerificationStep[] = [
        { id: 'address', features: ['base'], answered: false, fields: [field('street')] },
        { id: 'phone', features: ['card'], answered: false, fields: [field('phone', 'phone')] },
    ]
    renderWithIntl(
        <PaperworkVerificationTrackingProvider value={context}>
            <QuestionStepScreen steps={steps} residence="BR" onBack={onBack} onSubmitted={jest.fn()} />
        </PaperworkVerificationTrackingProvider>
    )
    fireEvent.click(screen.getByTestId('verify-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
    expectControl('back', 'tap')
    fireEvent.click(screen.getByTestId('verify-why'))
    expectControl('why', 'open')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expectControl('why', 'dismiss'))
    expect(matching('why_got_it', 'tap')).toHaveLength(0)
})
