/** @jest-environment jsdom */
import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
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
// as the real step: the step it was opened for, read once, and its loader once the answers are saved
function MockQuestions(props: { feature: string; requiredStep?: string; onDone: () => void }) {
    const [step] = useState(props.requiredStep)
    const [saved, setSaved] = useState(false)
    if (saved) return <div>saving answers</div>
    return (
        <button
            onClick={() => {
                setSaved(true)
                props.onDone()
            }}
        >
            questions {props.feature} {step}
        </button>
    )
}
jest.mock('@/features/paperwork-verification/AddFeatureFlow', () => ({
    AddFeatureQuestions: (props: { feature: string; requiredStep?: string; onDone: () => void }) => (
        <MockQuestions {...props} />
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
const missingStep = (step: string) => ({ result: { kind: 'conflict', code: 'questions_missing', step } })

describe('PixAccountOpening', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockActivation = {}
        mockDegraded = false
    })

    // API-CONTRACT-M3 section 3: one activation for every residence, with no report scope to read
    it('activates the pix feature with no tap', () => {
        renderOpening()
        expect(mockHook).toHaveBeenCalledWith('pix', { enabled: true, automatic: true })
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
        fireEvent.click(screen.getByRole('button', { name: `questions pix ${step}` }))
        expect(mockActivate).toHaveBeenCalledTimes(1)
    })

    // review finding 1: the API can ask again, first for the feature's step, then for Avenia's own
    it('asks the next missing step afresh after an answer, never leaving the saved step on its loader', () => {
        mockActivation = missingStep('address')
        const { rerender } = renderOpening()
        fireEvent.click(screen.getByRole('button', { name: 'questions pix address' }))
        mockActivation = missingStep('tax')
        rerender(<PixAccountOpening title="Add money" onBack={jest.fn()} />)
        expect(screen.getByRole('button', { name: 'questions pix tax' })).toBeInTheDocument()
        expect(screen.queryByText('saving answers')).toBeNull()
    })

    // an answer cannot change after approval, so asking the same step again would loop
    it('shows the failure screen when the step just answered is asked again', () => {
        mockActivation = missingStep('address')
        const { rerender } = renderOpening()
        fireEvent.click(screen.getByRole('button', { name: 'questions pix address' }))
        rerender(<PixAccountOpening title="Add money" onBack={jest.fn()} />)
        expect(screen.getByText('activation status failed')).toBeInTheDocument()
        expect(screen.queryByText('saving answers')).toBeNull()
    })

    // review finding 3: a redirect would send Back from /verify straight into /verify again
    it("shows Pix's verify screen for an identity not approved, and opens /verify only on a tap", () => {
        mockActivation = { result: { kind: 'conflict', code: 'identity_not_approved' } }
        renderOpening()
        expect(mockPush).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: en.pix.setup.verifyCta }))
        expect(mockPush).toHaveBeenCalledWith('/verify')
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
        expect(mockHook).toHaveBeenCalledWith('pix', expect.objectContaining({ enabled: false }))
    })
})
