/**
 * Capture-only answers for the app's own chain RPC endpoints. Aborting them left on-chain
 * reads retrying with backoff, so a screen settled whenever its last retry gave up, often
 * after the stability window had already accepted the earlier frame. Fixture wallets are
 * not deployed accounts and hold nothing beyond the balance the fixture shows.
 */
import {
    decodeFunctionData,
    encodeAbiParameters,
    encodeFunctionResult,
    erc20Abi,
    multicall3Abi,
    parseUnits,
    toFunctionSelector,
    type Hex,
} from 'viem'
import { arbitrum, arbitrumSepolia } from 'viem/chains'
import { rpcUrls } from '../../src/constants/general.consts'
import { PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS, USE_SEPOLIA } from '../../src/constants/wallet-token.consts'
import { DEMO_BALANCE_UNITS } from '../../src/constants/demo-data'
import { FIXTURES } from '../../src/dev/fixtures/registry'

const WALLET_CHAIN_ID = USE_SEPOLIA ? arbitrumSepolia.id : arbitrum.id
const MULTICALL3 = '0xca11bde05977b3631167028862be2a173976ca11'
const BALANCE_OF = toFunctionSelector('balanceOf(address)')
const RHINO_TOKEN_CONFIGS = 'https://api.rhino.fi/bridge/bridge-swap-token-configs'

function endpoint(url: string): string {
    const { origin, pathname } = new URL(url)
    return origin + pathname.replace(/\/+$/, '')
}

const CHAIN_OF_ENDPOINT = new Map(
    Object.entries(rpcUrls).flatMap(([chainId, urls]) => urls.map((url) => [endpoint(url), Number(chainId)] as const))
)

export function isChainRpc(url: string): boolean {
    return CHAIN_OF_ENDPOINT.has(endpoint(url))
}

/** Recover Funds lists Rhino's bridge tokens; an empty list keeps its scan to the built-in tokens. */
export function isRhinoTokenConfigs(url: string): boolean {
    return endpoint(url) === RHINO_TOKEN_CONFIGS
}

type RpcCall = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown[] }
export type RpcAnswer = { body: string; unmapped: string[] }

/** The wallet balance the fixture shows, so the on-chain read agrees with the screen. */
function walletBalance(fixture: string): bigint {
    const balance = FIXTURES[fixture]?.balance
    return balance === undefined ? DEMO_BALANCE_UNITS : parseUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)
}

function tokenBalance(chainId: number, token: string, fixture: string): bigint {
    return chainId === WALLET_CHAIN_ID && token.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()
        ? walletBalance(fixture)
        : 0n
}

const uint256 = (value: bigint) => encodeAbiParameters([{ type: 'uint256' }], [value])

function call(chainId: number, to: string, data: Hex, fixture: string): Hex | undefined {
    if (data.toLowerCase().startsWith(BALANCE_OF)) return uint256(tokenBalance(chainId, to, fixture))
    if (to.toLowerCase() !== MULTICALL3) return undefined
    const decoded = decodeFunctionData({ abi: multicall3Abi, data })
    if (decoded.functionName !== 'aggregate3') return undefined
    const results = []
    for (const inner of decoded.args[0]) {
        const read = decodeFunctionData({ abi: erc20Abi, data: inner.callData })
        if (read.functionName !== 'balanceOf') return undefined
        results.push({ success: true, returnData: uint256(tokenBalance(chainId, inner.target, fixture)) })
    }
    return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results })
}

function result(rpc: RpcCall, chainId: number, fixture: string): unknown {
    const params = rpc.params ?? []
    switch (rpc.method) {
        case 'net_listening':
            return true
        case 'eth_getBalance':
            return '0x0'
        case 'eth_getCode':
            return '0x'
        case 'eth_call': {
            const request = params[0] as { to?: string; data?: Hex } | undefined
            return request?.to && request.data ? call(chainId, request.to, request.data, fixture) : undefined
        }
        default:
            return undefined
    }
}

export function answerRpc(url: string, fixture: string, body: string): RpcAnswer {
    const chainId = CHAIN_OF_ENDPOINT.get(endpoint(url))!
    const parsed = JSON.parse(body) as RpcCall | RpcCall[]
    const unmapped: string[] = []
    const reply = (rpc: RpcCall) => {
        let value: unknown
        try {
            value = result(rpc, chainId, fixture)
        } catch {
            value = undefined
        }
        if (value !== undefined) return { jsonrpc: '2.0', id: rpc.id, result: value }
        const data = (rpc.params?.[0] as { data?: string } | undefined)?.data
        unmapped.push(rpc.method === 'eth_call' ? `RPC eth_call ${data?.slice(0, 10)}` : `RPC ${rpc.method}`)
        return { jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'Unmapped synthetic RPC' } }
    }
    return { body: JSON.stringify(Array.isArray(parsed) ? parsed.map(reply) : reply(parsed)), unmapped }
}
