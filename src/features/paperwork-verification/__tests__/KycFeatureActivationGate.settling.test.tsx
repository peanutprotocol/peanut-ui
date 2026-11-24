/**
 * TASK-25059: while the peso account is being opened, the gate shows a progress screen with no button that
 * leaves the flow; the set-up screen ("Set up local transfers", "Our partner will review…") never shows.
 * Only after the wait does the "we'll let you know" screen with its button come back.
 */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import messages from '@/i18n/app/messages/en.json'
import type { KycFeatureActivationResult } from '@/app/actions/kyc-feature-activation'
import { useKycFeatureActivation } from '../useKycFeatureActivation'
import { KycFeatureActivationGate } from '../KycFeatureActivationGate'

jest.mock('../useKycFeatureActivation', () => ({ useKycFeatureActivation: jest.fn() }))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

const activation = messages.kyc.paperworkVerification.activation
const settingUpTitle = activation.settingUpAccount.replace('{currency}', 'ARS')

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
    expect(screen.getByText(settingUpTitle)).toBeInTheDocument()
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

it('after the wait: the "we\'ll let you know" screen and its button', () => {
    state({ result: { kind: 'report', report: { state: 'pending' } }, settling: false })
    renderGate()
    expect(screen.getByText(settingUpTitle)).toBeInTheDocument()
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
