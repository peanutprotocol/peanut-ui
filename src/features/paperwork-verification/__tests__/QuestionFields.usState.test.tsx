/** Fix E: spec-only server state-choice acceptance, independent of rendering implementation. */
import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import type {
    PaperworkVerificationField,
    PaperworkVerificationStep,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { QuestionFields } from '../components/QuestionFields'
import { QuestionStepScreen } from '../components/QuestionStepScreen'
import { stepComplete } from '../paperworkVerification.utils'

jest.mock('@/app/actions/kyc-paperwork-verification', () => ({
    getKycQuestions: jest.fn(),
    saveKycAnswers: jest.fn(),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({ user: { user: { username: 'tester' } }, fetchUser: jest.fn() }),
}))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

const STATES =
    'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR GU VI AS MP'.split(
        ' '
    )
const stateField = (kind: 'choice' | 'select', value: string | null = null): PaperworkVerificationField => ({
    key: 'state',
    kind: kind as PaperworkVerificationField['kind'],
    required: true,
    options: STATES,
    value,
})

function FieldsHarness({ kind, onChange }: { kind: 'choice' | 'select'; onChange: jest.Mock }) {
    const [values, setValues] = useState<Record<string, string>>({ state: '' })
    return (
        <QuestionFields
            fields={[stateField(kind)]}
            values={values}
            errors={{}}
            residence="US"
            onChange={(key, value) => {
                setValues((current) => ({ ...current, [key]: value }))
                onChange(key, value)
            }}
        />
    )
}

describe.each(['choice', 'select'] as const)('server kind %s', (kind) => {
    it('renders a labelled picker with all server options and records the selected code', () => {
        const onChange = jest.fn()
        renderWithIntl(<FieldsHarness kind={kind} onChange={onChange} />)
        const picker = screen.getByRole('combobox', { name: /state or region/i }) as HTMLSelectElement
        const codes = Array.from(picker.options)
            .map((option) => option.value)
            .filter(Boolean)
        expect(codes).toEqual(STATES)
        expect(codes).toHaveLength(56)
        expect(screen.queryByRole('textbox', { name: /state or region/i })).not.toBeInTheDocument()
        fireEvent.change(picker, { target: { value: 'CA' } })
        expect(onChange).toHaveBeenLastCalledWith('state', 'CA')
        expect(picker).toHaveValue('CA')
    })

    it.each(STATES)('accepts the server-listed state %s', (state) => {
        expect(stepComplete([stateField(kind)], { state })).toBe(true)
    })

    it.each([undefined, '', ' ', 'ZZ', 'California', 'ca'])('rejects a missing or non-option state %s', (state) => {
        expect(stepComplete([stateField(kind)], state === undefined ? {} : { state })).toBe(false)
    })

    it.each([null, 'ZZ'])('blocks submission for initial state %s, then submits after a valid selection', (value) => {
        const onSubmitted = jest.fn()
        const step: PaperworkVerificationStep = {
            id: 'address',
            features: ['bank'],
            fields: [stateField(kind, value)],
            answered: false,
        }
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
        renderWithIntl(
            <NuqsTestingAdapter searchParams="?step=address">
                <QueryClientProvider client={queryClient}>
                    <QuestionStepScreen steps={[step]} residence="US" onSubmitted={onSubmitted} />
                </QueryClientProvider>
            </NuqsTestingAdapter>
        )
        const picker = screen.getByRole('combobox', { name: /state or region/i })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(onSubmitted).not.toHaveBeenCalled()
        expect(screen.getByText(/answer this to continue|choose one of the options/i)).toBeVisible()
        fireEvent.change(picker, { target: { value: 'CA' } })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(onSubmitted).toHaveBeenCalledTimes(1)
        expect(onSubmitted).toHaveBeenCalledWith(expect.objectContaining({ state: 'CA' }), expect.any(Number))
        queryClient.clear()
    })
})

it('an ordinary city text field remains a text input', () => {
    const onChange = jest.fn()
    renderWithIntl(
        <QuestionFields
            fields={[{ key: 'city', kind: 'text', required: true, value: null }]}
            values={{ city: '' }}
            errors={{}}
            residence="US"
            onChange={onChange}
        />
    )
    const input = screen.getByRole('textbox', { name: /city/i })
    fireEvent.change(input, { target: { value: 'Austin' } })
    expect(onChange).toHaveBeenCalledWith('city', 'Austin')
})
