/**
 * A send link's index comes from its deposit's receipt, never from a count
 * read beside the deposit: another link can take that index first, and a
 * failed read used to fail the flow while the deposit still landed. No receipt
 * means the deposit may have landed: the caller's recovery reads it.
 */
import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { encodeAbiParameters, encodeEventTopics, type Address } from 'viem'

jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return { loadingStateContext: ReactActual.createContext({ setLoadingState: () => {} }) }
})
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/constants/general.consts', () => ({ BASE_URL: 'https://peanut.test' }))
jest.mock('@/app/actions/clients', () => ({ PUBLIC_CLIENTS_BY_CHAIN: {} }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    withCeremonyFlow: (_name: string, run: () => Promise<unknown>) => run(),
}))
const SENDER = '0x2222222222222222222222222222222222222222' as Address
const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: SENDER, sendTransactions: mockSendTransactions }),
}))

import { useCreateLink } from '../useCreateLink'
import { getContractAddress, getLatestContractVersion, peanutVaultAbi } from '@/utils/peanut-claim.utils'
import { spendMayHaveBroadcast } from '@/hooks/wallet/spendBroadcast'
import { readSendLinkPassword } from '@/utils/send-link-password'

const contractVersion = getLatestContractVersion({ chainId: '42161', type: 'normal' })
const vault = getContractAddress('42161', contractVersion) as Address

const depositLog = (index: bigint, sender: Address, amount: bigint) => ({
    address: vault,
    topics: encodeEventTopics({
        abi: peanutVaultAbi,
        eventName: 'DepositEvent',
        args: { _index: index, _contractType: 1, _senderAddress: sender },
    }),
    data: encodeAbiParameters([{ type: 'uint256' }], [amount]),
    blockHash: `0x${'1'.repeat(64)}`,
    blockNumber: 1n,
    logIndex: 0,
    transactionHash: `0x${'2'.repeat(64)}`,
    transactionIndex: 0,
    removed: false,
})

const noop = () => {}
const run = async () => {
    const { result } = renderHook(() => useCreateLink())
    let outcome: unknown
    await act(async () => {
        outcome = await result.current
            .createLink(20_000000n, { onBegin: noop, onBroadcast: noop })
            .catch((error: unknown) => error)
    })
    return outcome as Record<string, unknown>
}

beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
})

it("reads the index of this wallet's deposit from the receipt, past another sender's deposit in the bundle", async () => {
    const other = '0x3333333333333333333333333333333333333333' as Address
    mockSendTransactions.mockResolvedValue({
        receipt: {
            transactionHash: `0x${'2'.repeat(64)}`,
            logs: [depositLog(11n, other, 5_000000n), depositLog(12n, SENDER, 20_000000n)],
        },
        intentId: undefined,
    })

    const created = await run()

    expect(created.depositIdx).toBe(12)
    expect(created.amount).toBe(20_000000n)
    expect(created.link).toContain('i=12')
    // the password is kept under the link's key, before anything was signed
    expect(readSendLinkPassword(created.pubKey as string)).not.toBeNull()
})

it('a deposit with no receipt is handed to the recovery, never built from a guessed index', async () => {
    mockSendTransactions.mockResolvedValue({ receipt: null, intentId: undefined })

    const outcome = await run()

    expect(outcome).toBeInstanceOf(Error)
    expect(spendMayHaveBroadcast(outcome)).toBe(true)
})
