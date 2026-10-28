/**
 * Pins recover-funds balance discovery (TASK-21829, TASK-23850).
 *
 * Balances are read on-chain over our token list plus Rhino's, so a token our
 * list misses (USDT on Base) is still found, and the exact bigint is kept so
 * a transfer moves all of it. The branch under test decides whether a user is
 * told they have funds to recover, so the lies it must never tell are pinned:
 * - a failed read must surface the retryable error state, not an infinite
 *   loader and not "no tokens to recover";
 * - a failed Rhino list must not hide the tokens our own list knows.
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { ContractFunctionRevertedError, erc20Abi } from 'viem'
import { useRecoverableBalances } from '@/hooks/useRecoverableBalances'
import { fetchRhinoTokenConfigs } from '@/services/rhino-token-configs'
import { fetchTokenPrice } from '@/services/tokens-price'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import type { RhinoTokenConfigs } from '@/types/recover-funds'

jest.mock('@/services/rhino-token-configs', () => ({ fetchRhinoTokenConfigs: jest.fn() }))
jest.mock('@/services/tokens-price', () => ({ fetchTokenPrice: jest.fn() }))

// one fake client per chain: native balance, and balanceOf results by token address.
// 'fail' fails that token inside the multicall; `alone` answers its own read.
type ChainState = {
    native: bigint
    tokens: Record<string, bigint | 'fail'>
    alone?: Record<string, bigint | Error>
    fail?: boolean
}
let mockChains: Record<string, ChainState> = {}
const mockMulticall = jest.fn()
const mockReadContract = jest.fn()
jest.mock('@/app/actions/clients', () => ({
    getPublicClient: (chainId: number) => {
        const state = (): ChainState => mockChains[String(chainId)] ?? { native: 0n, tokens: {} }
        return {
            getBalance: async () => {
                if (state().fail) throw new Error(`rpc down on ${chainId}`)
                return state().native
            },
            multicall: async (args: { contracts: { address: string }[]; allowFailure: boolean }) => {
                mockMulticall(chainId, args)
                if (state().fail) throw new Error(`rpc down on ${chainId}`)
                return args.contracts.map(({ address }) => {
                    const balance = state().tokens[address.toLowerCase()] ?? 0n
                    return balance === 'fail'
                        ? { status: 'failure', error: new Error('out of gas') }
                        : { status: 'success', result: balance }
                })
            },
            readContract: async ({ address }: { address: string }) => {
                mockReadContract(chainId, address.toLowerCase())
                const answer = state().alone?.[address.toLowerCase()]
                if (answer instanceof Error) throw answer
                return answer ?? 0n
            },
        }
    },
}))

const mockCaptureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureException: (...args: unknown[]) => mockCaptureException(...args) }))

const mockFetchRhinoTokenConfigs = fetchRhinoTokenConfigs as jest.MockedFunction<typeof fetchRhinoTokenConfigs>
const mockFetchTokenPrice = fetchTokenPrice as jest.MockedFunction<typeof fetchTokenPrice>

const WALLET_CHAIN = PEANUT_WALLET_CHAIN.id.toString()
const BASE = '8453'
const ETHEREUM = '1'
// on our list (token-details.json)
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
// on Rhino's list only: the tokens users strand that our list misses
const BASE_USDT = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2'
const ETHEREUM_CBBTC = '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'

const RHINO_LIST: RhinoTokenConfigs = {
    BASE: [
        { tokenAddress: BASE_USDC, symbol: 'USDC', name: 'USDC', decimals: 6 },
        { tokenAddress: BASE_USDT, symbol: 'USDT', name: 'USDT', decimals: 6, iconUrl: '' },
    ],
    ETHEREUM: [{ tokenAddress: ETHEREUM_CBBTC, symbol: 'cbBTC', name: 'cbBTC', decimals: 8, iconUrl: '' }],
}

const readAddresses = (chainId: string): string[] =>
    mockMulticall.mock.calls
        .filter(([id]) => String(id) === chainId)
        .flatMap(([, args]) => args.contracts.map(({ address }: { address: string }) => address.toLowerCase()))

const render = async (address: string | undefined = '0xabc') => {
    const hook = renderHook(() => useRecoverableBalances(address))
    await waitFor(() => expect(hook.result.current.fetchingBalances).toBe(false))
    return hook
}

describe('useRecoverableBalances', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockChains = {}
        mockFetchRhinoTokenConfigs.mockResolvedValue(RHINO_LIST)
        mockFetchTokenPrice.mockResolvedValue(undefined)
    })

    it("finds a token only Rhino's list has, with its exact on-chain amount", async () => {
        mockChains[BASE] = { native: 0n, tokens: { [BASE_USDT]: 12_345_678n } }
        const { result } = await render()

        expect(result.current.balancesError).toBe(false)
        expect(result.current.tokenBalances).toEqual([
            expect.objectContaining({ chainId: BASE, address: BASE_USDT, symbol: 'USDT', rawAmount: 12_345_678n }),
        ])
        expect(result.current.tokenBalances[0].amount).toBeCloseTo(12.345678)
    })

    it('reads each address once: a token on both lists is not read twice', async () => {
        await render()
        const base = readAddresses(BASE)
        expect(base.filter((address) => address === BASE_USDC)).toHaveLength(1)
        expect(base).toContain(BASE_USDT)
    })

    it('keeps the full 18-decimal amount as a bigint, never a float', async () => {
        const WEI = 49_917_499_999_999_997n
        mockChains[BASE] = { native: WEI, tokens: {} }
        const { result } = await render()

        expect(result.current.tokenBalances).toEqual([
            expect.objectContaining({ chainId: BASE, symbol: 'ETH', decimals: 18, rawAmount: WEI }),
        ])
    })

    it("still reads our own list when Rhino's list fails", async () => {
        mockFetchRhinoTokenConfigs.mockRejectedValue(new Error('rhino down'))
        mockChains[BASE] = { native: 0n, tokens: { [BASE_USDC]: 2_500_000n, [BASE_USDT]: 1_000_000n } }
        const { result } = await render()

        expect(result.current.balancesError).toBe(false)
        expect(readAddresses(BASE)).toContain(BASE_USDC)
        expect(readAddresses(BASE)).not.toContain(BASE_USDT)
        expect(result.current.tokenBalances).toEqual([expect.objectContaining({ address: BASE_USDC })])
    })

    it('never offers the Peanut wallet USDC: that is the wallet balance', async () => {
        await render()
        expect(readAddresses(WALLET_CHAIN)).not.toContain(PEANUT_WALLET_TOKEN.toLowerCase())
    })

    describe('USD values', () => {
        it('prices stablecoins at $1, the native coin at the API price, anything else not at all', async () => {
            mockChains[BASE] = { native: 10n ** 17n, tokens: { [BASE_USDT]: 5_000_000n } }
            mockChains[ETHEREUM] = { native: 0n, tokens: { [ETHEREUM_CBBTC]: 100_000_000n } }
            mockFetchTokenPrice.mockResolvedValue({ price: 2500 } as Awaited<ReturnType<typeof fetchTokenPrice>>)
            const { result } = await render()

            const bySymbol = (symbol: string) => result.current.tokenBalances.find((b) => b.symbol === symbol)
            expect(bySymbol('USDT')?.price).toBe(1)
            expect(bySymbol('ETH')?.price).toBe(2500)
            expect(bySymbol('cbBTC')?.price).toBe(0)
            expect(mockFetchTokenPrice).toHaveBeenCalledTimes(1)
            expect(mockFetchTokenPrice).toHaveBeenCalledWith('0x0000000000000000000000000000000000000000', BASE)
        })

        it('lists the native coin without a USD value when its price fails', async () => {
            mockChains[BASE] = { native: 10n ** 17n, tokens: {} }
            mockFetchTokenPrice.mockRejectedValue(new Error('price down'))
            const { result } = await render()

            expect(result.current.balancesError).toBe(false)
            expect(result.current.tokenBalances).toEqual([expect.objectContaining({ symbol: 'ETH', price: 0 })])
        })
    })

    describe('a chain whose read fails', () => {
        it('surfaces the error state (not "no tokens") when nothing else is recoverable', async () => {
            mockChains[BASE] = { native: 0n, tokens: {}, fail: true }
            const { result } = await render()

            expect(result.current.balancesError).toBe(true)
            expect(result.current.tokenBalances).toHaveLength(0)
            expect(mockCaptureException).toHaveBeenCalled()
        })

        it('keeps the other chains when they hold something, and reports the failure', async () => {
            mockChains[BASE] = { native: 0n, tokens: {}, fail: true }
            mockChains[ETHEREUM] = { native: 0n, tokens: { [ETHEREUM_CBBTC]: 1n } }
            const { result } = await render()

            expect(result.current.balancesError).toBe(false)
            expect(result.current.tokenBalances).toEqual([expect.objectContaining({ address: ETHEREUM_CBBTC })])
            expect(mockCaptureException).toHaveBeenCalledTimes(1)
        })
    })

    // Multicall3 gives every token one shared gas budget, so a token can fail
    // inside it and still answer its own call (Chip, #3880).
    describe('a token whose read fails inside the multicall', () => {
        it('is read again on its own, and its balance counts', async () => {
            mockChains[BASE] = { native: 0n, tokens: { [BASE_USDT]: 'fail' }, alone: { [BASE_USDT]: 7_000_000n } }
            const { result } = await render()

            expect(mockReadContract).toHaveBeenCalledWith(Number(BASE), BASE_USDT)
            expect(result.current.balancesError).toBe(false)
            expect(result.current.tokenBalances).toEqual([
                expect.objectContaining({ address: BASE_USDT, rawAmount: 7_000_000n }),
            ])
        })

        // EURO3 on Linea reverts balanceOf for every holder: treating that as an
        // unknown chain would show every empty wallet an error.
        it('is skipped when it reverts on its own too, without an error', async () => {
            const revert = new ContractFunctionRevertedError({ abi: erc20Abi, functionName: 'balanceOf' })
            mockChains[BASE] = { native: 0n, tokens: { [BASE_USDT]: 'fail' }, alone: { [BASE_USDT]: revert } }
            const { result } = await render()

            expect(result.current.balancesError).toBe(false)
            expect(result.current.tokenBalances).toHaveLength(0)
        })

        it('fails the chain when its own read fails for another reason', async () => {
            mockChains[BASE] = {
                native: 0n,
                tokens: { [BASE_USDT]: 'fail' },
                alone: { [BASE_USDT]: new Error('rpc timeout') },
            }
            const { result } = await render()

            expect(result.current.balancesError).toBe(true)
            expect(mockCaptureException).toHaveBeenCalled()
        })
    })

    it('shows no tokens, and no error, when every read succeeds with nothing to recover', async () => {
        const { result } = await render()
        expect(result.current.balancesError).toBe(false)
        expect(result.current.tokenBalances).toHaveLength(0)
    })

    it('retry reads again after a failure', async () => {
        mockChains[BASE] = { native: 0n, tokens: {}, fail: true }
        const { result } = await render()
        expect(result.current.balancesError).toBe(true)

        mockChains[BASE] = { native: 0n, tokens: { [BASE_USDT]: 1_000_000n } }
        act(() => result.current.retry())
        await waitFor(() => expect(result.current.tokenBalances).toHaveLength(1))
        expect(result.current.balancesError).toBe(false)
    })

    it('does nothing until the wallet address resolves', () => {
        const { result } = renderHook(() => useRecoverableBalances(undefined))
        expect(mockFetchRhinoTokenConfigs).not.toHaveBeenCalled()
        expect(result.current.fetchingBalances).toBe(true) // the page keeps its loader
    })
})
