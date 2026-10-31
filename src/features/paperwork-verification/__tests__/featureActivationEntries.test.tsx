import { useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { activateKycFeature } from '@/app/actions/kyc-feature-activation'
import { AddMoneyBankPage } from '@/features/add-money/AddMoneyBankPage'
import WithdrawBankPage from '@/app/(mobile-ui)/withdraw/[country]/bank/page'
import MantecaAddMoney from '@/components/AddMoney/components/MantecaAddMoney'
import MantecaWithdrawFlow from '@/app/(mobile-ui)/withdraw/manteca/page'
import { ClaimAccountScreen } from '@/features/deposit-accounts/components/ClaimAccountScreen'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'

let mockOneShot: boolean | undefined = true
const mockPush = jest.fn()
const mockProvider = jest.fn()
const mockFetchUser = jest.fn(async () => null)
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'test-user' }, identityVerification: { oneShot: mockOneShot } },
        fetchUser: mockFetchUser,
    }),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => new URLSearchParams('country=argentina'),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/app/actions/kyc-feature-activation', () => ({ activateKycFeature: jest.fn() }))
jest.mock('../paperworkVerificationEntry', () => ({
    paperworkVerificationFeaturePath: (feature: string) => `/verify?feature=${feature}`,
}))
jest.mock('@/features/add-money/useMantecaBankRedirect', () => ({
    useMantecaBankRedirect: () => ({ isMantecaRoute: false }),
}))
jest.mock('@/features/kill-switches/useKillSwitches', () => ({
    useKillSwitches: () => ({ disabledMantecaCurrencies: [] }),
}))
jest.mock('@/features/withdraw/views/PixKeySendView', () => ({ __esModule: true, default: () => <div>PIX entry</div> }))
jest.mock('../FeatureAction', () => ({ FeatureAction: ({ action }: { action: string }) => <div>{action}</div> }))
jest.mock('../components/StatusScreens', () => ({ FeatureReadyScreen: () => <div>existing setting up screen</div> }))
jest.mock('../components/VerifyLayout', () => ({
    VerifyHeroLayout: ({ title, description }: { title: string; description: string }) => (
        <div>
            {title} {description}
        </div>
    ),
    VerifyFooter: () => null,
}))

function MockProvider() {
    useEffect(() => {
        mockProvider()
    }, [])
    return <div>provider flow</div>
}
jest.mock('@/features/add-money/views/BridgeBankOnrampView', () => ({ BridgeBankOnrampView: () => <MockProvider /> }))
jest.mock('@/features/withdraw/views/BridgeBankWithdrawView', () => ({
    __esModule: true,
    default: () => <MockProvider />,
}))
jest.mock('@/features/withdraw/views/MantecaBankWithdrawFlow', () => ({
    __esModule: true,
    default: () => <MockProvider />,
}))
jest.mock('@/components/AddMoney/components/MantecaAddMoneyFlow', () => ({
    __esModule: true,
    default: () => <MockProvider />,
}))
jest.mock('@/features/deposit-accounts/components/ClaimAccountContent', () => ({
    ClaimAccountContent: () => <MockProvider />,
}))

const entries = [
    ['Bridge add money', 'bank', () => <AddMoneyBankPage />],
    ['Bridge withdraw', 'bank', () => <WithdrawBankPage />],
    ['Manteca add money', 'local', () => <MantecaAddMoney />],
    ['Manteca withdraw', 'local', () => <MantecaWithdrawFlow />],
    [
        'deposit account claim',
        'bank',
        () => (
            <ClaimAccountScreen
                rail={DEPOSIT_RAILS.SEPA_EU}
                userName="Demo User"
                isClaiming={false}
                onClaim={jest.fn()}
                onBack={jest.fn()}
            />
        ),
    ],
] as const

beforeEach(() => {
    jest.clearAllMocks()
    mockOneShot = true
    jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'report', report: { state: 'on' } })
})

describe.each(entries)('%s activation entry', (_name, feature, Entry) => {
    it('activates before mounting any provider flow', async () => {
        let resolve!: (reply: Awaited<ReturnType<typeof activateKycFeature>>) => void
        jest.mocked(activateKycFeature).mockReturnValue(
            new Promise((done) => {
                resolve = done
            })
        )
        render(<Entry />)
        expect(activateKycFeature).toHaveBeenCalledWith(feature)
        expect(mockProvider).not.toHaveBeenCalled()
        await act(async () => {
            resolve({ kind: 'report', report: { state: 'on' } })
        })
        await waitFor(() => expect(mockProvider).toHaveBeenCalledTimes(1))
        expect(mockFetchUser).toHaveBeenCalledWith({ throwOnError: true })
    })
    it.each([false, undefined])('legacy oneShot=%s preserves the provider path', async (oneShot) => {
        mockOneShot = oneShot
        render(<Entry />)
        expect(mockProvider).toHaveBeenCalledTimes(1)
        expect(activateKycFeature).not.toHaveBeenCalled()
    })
    it.each(['setting_up', 'pending'] as const)(
        '%s shows existing setup and prevents provider calls',
        async (state) => {
            jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'report', report: { state } })
            render(<Entry />)
            await waitFor(() => expect(activateKycFeature).toHaveBeenCalledTimes(1))
            expect(screen.getByText('existing setting up screen')).toBeInTheDocument()
            expect(mockProvider).not.toHaveBeenCalled()
        }
    )
    it('routes missing questions to its feature verification path', async () => {
        jest.mocked(activateKycFeature).mockResolvedValue({ kind: 'conflict', code: 'questions_missing', step: 'tax' })
        render(<Entry />)
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/verify?feature=${feature}`))
        expect(mockProvider).not.toHaveBeenCalled()
    })
    it('opens the existing supplement action', async () => {
        const action = feature === 'bank' ? 'supplement:bridge' : 'supplement:manteca'
        jest.mocked(activateKycFeature).mockResolvedValue({
            kind: 'report',
            report: { state: 'action_required', action },
        })
        render(<Entry />)
        expect(await screen.findByText(action)).toBeInTheDocument()
        expect(mockProvider).not.toHaveBeenCalled()
    })
    it('shows the existing refusal copy and never starts the provider', async () => {
        jest.mocked(activateKycFeature).mockResolvedValue({
            kind: 'report',
            report: { state: 'refused', reason: 'identity_document_insufficient' },
        })
        render(<Entry />)
        expect(await screen.findByText(/supplement.identityDocumentInsufficient/)).toBeInTheDocument()
        expect(mockProvider).not.toHaveBeenCalled()
    })
})
