/**
 * TASK-25059: while the peso account is being opened, the gate shows a progress screen whose only exit is the
 * header back; the set-up screen ("Set up local transfers", "Our partner will review…") never shows.
 * Only after the wait does the "we'll let you know" screen with its button come back.
 */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import messages from '@/i18n/app/messages/en.json'
import type { KycFeatureActivationResult } from '@/app/actions/kyc-feature-activation'
import { useKycFeatureActivation } from '../useKycFeatureActivation'
import { KycFeatureActivationGate } from '../KycFeatureActivationGate'

jest.mock('../useKycFeatureActivation', () => ({ useKycFeatureActivation: jest.fn() }))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
const mockBack = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => mockBack }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

const activation = messages.kyc.paperworkVerification.activation
const progressTitle = activation.settingUpTitle.replace('{currency}', 'ARS')
const laterTitle = activation.settingUpAccount.replace('{currency}', 'ARS')

function state({
    result,
    settling,
    isLoading = false,
}: {
    result: KycFeatureActivationResult | null
    settling: boolean
    isLoading?: boolean
}) {
    jest.mocked(useKycFeatureActivation).mockReturnValue({
        allowed: false,
        userReady: true,
        selectedStatus: undefined,
        result,
        reverification: null,
        isLoading,
        settling,
        arsProvisioning: false,
        activate: jest.fn(),
    } as unknown as ReturnType<typeof useKycFeatureActivation>)
}

const renderGate = () =>
    renderWithIntl(
        <KycFeatureActivationGate feature="local" selectedCurrency="ARS" startOnArrival>
            <div>amount screen</div>
        </KycFeatureActivationGate>
    )

beforeEach(() => jest.clearAllMocks())

it('while the start request runs: progress, not the set-up screen', () => {
    state({ result: null, settling: true, isLoading: true })
    renderGate()
    expect(screen.getByText(progressTitle)).toBeInTheDocument()
    expect(screen.getByText(activation.settingUpWait)).toBeInTheDocument()
    expect(screen.queryByText(activation.description)).toBeNull()
    expect(screen.queryByRole('button', { name: activation.cta.local })).toBeNull()
})

it('while the account is pending inside the wait: progress, with no button that leaves the flow', () => {
    state({ result: { kind: 'report', report: { state: 'pending' } }, settling: true })
    renderGate()
    expect(screen.getByText(activation.settingUpWait)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: messages.common.gotIt })).toBeNull()
    expect(screen.queryByText('amount screen')).toBeNull()
})

it('the header back still leaves while the account opens, and starts nothing again', () => {
    state({ result: { kind: 'report', report: { state: 'pending' } }, settling: true })
    renderGate()
    fireEvent.click(screen.getByTestId('nav-back'))
    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(jest.mocked(useKycFeatureActivation).mock.results[0].value.activate).not.toHaveBeenCalled()
})

it('after the wait: the "we\'ll let you know" screen and its button', () => {
    state({ result: { kind: 'report', report: { state: 'pending' } }, settling: false })
    renderGate()
    expect(screen.getByText(laterTitle)).toBeInTheDocument()
    expect(screen.queryByText(activation.settingUpWait)).toBeNull()
    expect(screen.getByRole('button', { name: messages.common.gotIt })).toBeInTheDocument()
})

it('a failed start shows its retry, not the progress screen', () => {
    state({ result: { kind: 'failed' }, settling: false })
    renderGate()
    expect(screen.queryByText(activation.settingUpWait)).toBeNull()
    expect(
        screen.getByRole('button', { name: messages.kyc.paperworkVerification.loadFailed.retry })
    ).toBeInTheDocument()
})

it.each([
    ['identity_not_approved', activation.identityRequired],
    ['questions_missing', activation.description],
] as const)('a start on arrival answered %s shows the set-up tap, not a refusal', (code, description) => {
    state({ result: { kind: 'conflict', code } as KycFeatureActivationResult, settling: false })
    renderGate()
    expect(screen.getByText(description)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('kyc-activation-continue'))
    expect(jest.mocked(useKycFeatureActivation).mock.results[0].value.activate).toHaveBeenCalledTimes(1)
})
