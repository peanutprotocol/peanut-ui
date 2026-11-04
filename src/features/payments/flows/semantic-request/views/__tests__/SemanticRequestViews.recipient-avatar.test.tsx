/**
 * /alice/25 shows alice's picked avatar on the amount and confirm screens
 * (TASK-23756). The URL parser fetched her profile, avatar included, but the
 * recipient it returned had no slot for it, so both cards drew her letter. The
 * cards are real here: the older view tests mock them away, which is why
 * nothing caught it.
 */
import React, { useEffect, type ReactNode } from 'react'
import { waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { queryClient } from '@/config/queryClient'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { AccountType } from '@/interfaces/interfaces'
import { parsePaymentURL } from '@/lib/url-parser/parser'
import type { ParsedURL } from '@/lib/url-parser/types/payment'
import { type ApiUser, usersApi } from '@/services/users'
import type { TRequestChargeResponse } from '@/services/services.types'
import { SemanticRequestFlowProvider, useSemanticRequestFlowContext } from '../../SemanticRequestFlowContext'
import { SemanticRequestInputView } from '../SemanticRequestInputView'
import { SemanticRequestConfirmView } from '../SemanticRequestConfirmView'

jest.mock('@/services/users', () => ({
    ...jest.requireActual('@/services/users'),
    usersApi: { getByUsername: jest.fn() },
}))
jest.mock('@/app/actions/ens', () => ({ resolveEns: jest.fn() }))
jest.mock('@/app/actions/supported-chains', () => ({
    getSupportedChainsAndTokens: () =>
        Promise.resolve({
            [String(jest.requireActual('@/constants/zerodev.consts').PEANUT_WALLET_CHAIN.id)]: {
                chainId: String(jest.requireActual('@/constants/zerodev.consts').PEANUT_WALLET_CHAIN.id),
                name: 'Arbitrum',
                tokens: [],
            },
        }),
}))

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    useSearchParams: () => ({ get: () => null }),
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: React.ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))
// The label beside the avatar reads the signed-in user; it is not under test.
jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name }: { name: string }) => <span>{name}</span>,
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AmountInput', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/DisplayIcon', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: () => null,
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({ resolvedChainName: 'Arbitrum', resolvedTokenSymbol: 'USDC' }),
}))

// The flow hook's own state (balance, route, wallet) is static; the recipient,
// the parsed URL and the charge come from the real flow context.
const mockFlowState = {
    formattedBalance: '100.00',
    balanceFillAmount: 100,
    canProceed: true,
    isInsufficientBalance: false,
    isLoading: false,
    isLoggedIn: true,
    handlePayment: jest.fn(),
    calculatedReceiveAmount: '25',
    calculatedGasCost: 0,
    calculatedFeeUsd: 0,
    isCalculatingRoute: false,
    isFeeEstimationError: false,
    routeError: null,
    isXChain: false,
    isDiffToken: false,
    isFetchingCharge: false,
    selectedChainID: '42161',
    selectedTokenData: { symbol: 'USDC' },
    goBackToInitial: jest.fn(),
    executePayment: jest.fn(),
    prepareRoute: jest.fn(),
}
jest.mock('../../useSemanticRequestFlow', () => {
    const { useSemanticRequestFlowContext } = jest.requireActual('../../SemanticRequestFlowContext')
    return { useSemanticRequestFlow: () => ({ ...useSemanticRequestFlowContext(), ...mockFlowState }) }
})

const ALICE_WALLET = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const CLOUD = 'img[src*="/avatars/basic/cloud.webp"]'

const alice = {
    userId: 'u-alice',
    username: 'alice',
    fullName: 'Alice Doe',
    showFullName: false,
    avatarKey: 'basic.cloud',
    accounts: [{ identifier: ALICE_WALLET, type: AccountType.PEANUT_WALLET }],
    isVerified: false,
} as unknown as ApiUser

// what handlePayment stores before the confirm screen: a charge to alice's wallet
const chargeToAlice = {
    uuid: 'charge-1',
    chainId: String(PEANUT_WALLET_CHAIN.id),
    tokenAddress: PEANUT_WALLET_TOKEN,
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    tokenAmount: '25',
    requestLink: { recipientAddress: ALICE_WALLET },
} as unknown as TRequestChargeResponse

function WithCharge({ children }: { children: ReactNode }) {
    const { charge, setCharge } = useSemanticRequestFlowContext()
    useEffect(() => setCharge(chargeToAlice), [setCharge])
    return charge ? children : null
}

const parseAliceUrl = async (): Promise<ParsedURL> => {
    const { parsedUrl, error } = await parsePaymentURL(['alice', '25'])
    expect(error).toBeNull()
    return parsedUrl!
}

beforeEach(() => {
    queryClient.clear()
    jest.mocked(usersApi.getByUsername).mockReset().mockResolvedValue(alice)
})

describe('/alice/25 shows the avatar alice picked', () => {
    it('on the amount screen', async () => {
        const parsedUrl = await parseAliceUrl()

        const { container } = renderWithIntl(
            <SemanticRequestFlowProvider initialParsedUrl={parsedUrl}>
                <SemanticRequestInputView />
            </SemanticRequestFlowProvider>
        )

        expect(container.querySelector(CLOUD)).toBeInTheDocument()
        expect(container.querySelector('img[src*="/avatars/letter/"]')).toBeNull()
        expect(usersApi.getByUsername).toHaveBeenCalledWith('alice')
    })

    it('on the confirm screen, once the charge to her wallet exists', async () => {
        const parsedUrl = await parseAliceUrl()

        const { container } = renderWithIntl(
            <SemanticRequestFlowProvider initialParsedUrl={parsedUrl}>
                <WithCharge>
                    <SemanticRequestConfirmView />
                </WithCharge>
            </SemanticRequestFlowProvider>
        )

        await waitFor(() => expect(container.querySelector(CLOUD)).toBeInTheDocument())
        expect(container.querySelector('img[src*="/avatars/letter/"]')).toBeNull()
    })
})
