/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
let mockDegraded = false
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => mockDegraded }))
const mockMarkSubmitted = jest.fn()
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: () => mockMarkSubmitted() }))
const mockActivate = jest.fn()
let mockActivation: Record<string, unknown> = {}
const mockHook = jest.fn()
jest.mock('@/features/paperwork-verification/useKycFeatureActivation', () => ({
    useKycFeatureActivation: (...args: unknown[]) => {
        mockHook(...args)
        return { activate: mockActivate, isLoading: false, allowed: false, result: null, ...mockActivation }
    },
}))
jest.mock('@/features/paperwork-verification/AddFeatureFlow', () => ({
    AddFeatureQuestions: (props: { feature: string; requiredStep?: string; onDone: () => void }) => (
        <button onClick={props.onDone}>
            questions {props.feature} {props.requiredStep}
        </button>
    ),
}))
jest.mock('@/features/paperwork-verification/KycFeatureActivationStatus', () => ({
    KycFeatureActivationStatus: (props: { result: { kind: string } }) => (
        <div>activation status {props.result.kind}</div>
    ),
}))
jest.mock('@/features/paperwork-verification/components/LoadScreens', () => ({
    VerificationOutage: () => <div>verification outage</div>,
}))

import { PixAccountOpening } from '../components/PixAccountOpening'

const renderOpening = () => renderWithIntl(<PixAccountOpening title="Add money" onBack={jest.fn()} />)

describe('PixAccountOpening', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockActivation = {}
        mockDegraded = false
    })

    it('activates the local feature for Brazil with no tap', () => {
        renderOpening()
        expect(mockHook).toHaveBeenCalledWith('local', {
            scope: { channel: 'bank', country: 'BR' },
            enabled: true,
            automatic: true,
        })
    })

    it.each([
        ['before the answer', { result: null }],
        ['while the call runs', { isLoading: true, result: { kind: 'failed' } }],
        ['while the account opens', { result: { kind: 'report', report: { state: 'setting_up' } } }],
        ['while the API cannot read the facts yet', { result: { kind: 'report', report: { state: 'pending' } } }],
        [
            'once the account is open, until the route is ready',
            { allowed: true, result: { kind: 'report', report: { state: 'on' } } },
        ],
    ])('shows the wait %s', (_name, activation) => {
        mockActivation = activation
        renderOpening()
        expect(screen.getByText(en.pix.setup.reviewing)).toBeInTheDocument()
        expect(screen.queryByRole('button')).toBeNull()
    })

    it('arms the user poller while the account opens, so the route moves on', () => {
        mockActivation = { result: { kind: 'report', report: { state: 'setting_up' } } }
        renderOpening()
        expect(mockMarkSubmitted).toHaveBeenCalledTimes(1)
    })

    it.each(['address', 'tax'])('asks the missing %s step in place, then activates again', (step) => {
        mockActivation = { result: { kind: 'conflict', code: 'questions_missing', step } }
        renderOpening()
        fireEvent.click(screen.getByRole('button', { name: `questions local ${step}` }))
        expect(mockActivate).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['a failure', { kind: 'failed' }],
        ['a refusal', { kind: 'report', report: { state: 'refused', reason: 'under_minimum_age' } }],
    ])("shows the activation's own status screen for %s", (_name, result) => {
        mockActivation = { result }
        renderOpening()
        expect(screen.getByText(`activation status ${result.kind}`)).toBeInTheDocument()
    })

    it('shows the verification outage while the checks are degraded', () => {
        mockDegraded = true
        renderOpening()
        expect(screen.getByText('verification outage')).toBeInTheDocument()
        expect(mockHook).toHaveBeenCalledWith('local', expect.objectContaining({ enabled: false }))
    })
})
