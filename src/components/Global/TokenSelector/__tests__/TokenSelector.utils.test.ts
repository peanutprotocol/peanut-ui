import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import type { ChainWithTokens } from '@/interfaces/chain-meta'
import type { IToken } from '@/interfaces/interfaces'
import {
    buildTokenOptions,
    fallbackSelection,
    filterTokenOptions,
    findSelection,
    isFeeFreeRoute,
    networkRowsForToken,
    pickDefaultNetwork,
    splitNetworkBadges,
    WALLET_CHAIN_ID,
    withWalletChain,
} from '../TokenSelector.utils'

const USDT_ETH = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const USDT_TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

const token = (chainId: string, address: string, symbol: string): IToken =>
    ({ chainId, address, symbol, name: symbol, decimals: 6, logoURI: `${symbol}.png` }) as IToken
const chain = (chainId: string, networkName: string, tokens: IToken[]): ChainWithTokens => ({
    chainId,
    networkName,
    chainIconURI: `${chainId}.png`,
    tokens,
})

// the wallet chain carries the wallet USDC, so USDC there is the free route
const CHAINS: Record<string, ChainWithTokens> = {
    [WALLET_CHAIN_ID]: chain(WALLET_CHAIN_ID, 'Arbitrum', [
        token(WALLET_CHAIN_ID, PEANUT_WALLET_TOKEN, 'USDC'),
        token(WALLET_CHAIN_ID, '0xusdcE', 'USDC'), // bridged variant listed second
        token(WALLET_CHAIN_ID, '0xusdtArb', 'USDT'),
        token(WALLET_CHAIN_ID, ETH, 'ETH'),
    ]),
    '1': chain('1', 'Ethereum', [
        token('1', '0xusdcEth', 'USDC'),
        token('1', USDT_ETH, 'USDT'),
        token('1', ETH, 'ETH'),
    ]),
    '10': chain('10', 'Optimism', [token('10', '0xusdcOp', 'USDC'), token('10', ETH, 'ETH')]),
    tron: chain('tron', 'Tron', [token('tron', USDT_TRON, 'USDT')]),
}
// registry order puts Ethereum before Arbitrum on purpose: the wallet chain must still lead
const ORDER = ['1', WALLET_CHAIN_ID, '10', 'tron']
const all = () => true
const options = () => buildTokenOptions(CHAINS, ORDER, all)
const option = (symbol: string) => options().find((o) => o.symbol === symbol)!

describe('isFeeFreeRoute — the one fee rule', () => {
    test('only the wallet USDC on the wallet chain is free', () => {
        expect(isFeeFreeRoute(WALLET_CHAIN_ID, PEANUT_WALLET_TOKEN)).toBe(true)
        expect(isFeeFreeRoute(WALLET_CHAIN_ID, PEANUT_WALLET_TOKEN.toUpperCase())).toBe(true)
        expect(isFeeFreeRoute(WALLET_CHAIN_ID, '0xusdtArb')).toBe(false)
        expect(isFeeFreeRoute('1', PEANUT_WALLET_TOKEN)).toBe(false)
    })

    test.each(['8453', '56', '137', '10', '9745'])('chain %s still charges (TASK-23632 has not shipped)', (chainId) => {
        expect(isFeeFreeRoute(chainId, PEANUT_WALLET_TOKEN)).toBe(false)
    })
})

describe('buildTokenOptions', () => {
    test('one option per symbol, stablecoins first, then alphabetical', () => {
        expect(options().map((o) => o.symbol)).toEqual(['USDC', 'USDT', 'ETH'])
    })

    test('networks follow the token: Tron only carries USDT', () => {
        expect(option('USDC').networks.map((n) => n.chainId)).not.toContain('tron')
        expect(option('USDT').networks.map((n) => n.chainId)).toContain('tron')
    })

    test('order: free first, wallet chain first, then the given order', () => {
        expect(option('USDC').networks.map((n) => n.chainId)).toEqual([WALLET_CHAIN_ID, '1', '10'])
        expect(option('USDT').networks.map((n) => n.chainId)).toEqual([WALLET_CHAIN_ID, '1', 'tron'])
    })

    test('labels only the free route as free', () => {
        const usdc = option('USDC')
        expect(usdc.networks.filter((n) => n.isFree).map((n) => n.chainId)).toEqual([WALLET_CHAIN_ID])
        expect(option('USDT').networks.some((n) => n.isFree)).toBe(false)
    })

    test('keeps the canonical token when a chain lists two of one symbol', () => {
        const arb = option('USDC').networks.find((n) => n.chainId === WALLET_CHAIN_ID)!
        expect(arb.token.address).toBe(PEANUT_WALLET_TOKEN)
    })

    test('the allow-list decides per chain and token', () => {
        const noEthOnOp = buildTokenOptions(CHAINS, ORDER, (chainId, t) => !(chainId === '10' && t.symbol === 'ETH'))
        expect(noEthOnOp.find((o) => o.symbol === 'ETH')!.networks.map((n) => n.chainId)).not.toContain('10')
    })

    test('chains missing from the record are skipped', () => {
        expect(buildTokenOptions(CHAINS, ['999', 'tron'], all).map((o) => o.symbol)).toEqual(['USDT'])
    })
})

describe('splitNetworkBadges', () => {
    test('first two, then a count of the rest', () => {
        const { shown, rest } = splitNetworkBadges(option('USDT').networks)
        expect(shown.map((n) => n.chainId)).toEqual([WALLET_CHAIN_ID, '1'])
        expect(rest).toBe(1)
    })

    test('two or fewer networks: no count', () => {
        const twoOnly = buildTokenOptions(CHAINS, ['1', '10'], all).find((o) => o.symbol === 'USDC')!
        expect(splitNetworkBadges(twoOnly.networks).rest).toBe(0)
    })
})

describe('pickDefaultNetwork', () => {
    test('keeps the current network when it carries the token', () => {
        expect(pickDefaultNetwork(option('USDT'), 'tron').chainId).toBe('tron')
    })

    test('otherwise the wallet chain (Arbitrum) when it carries the token', () => {
        expect(pickDefaultNetwork(option('ETH'), 'tron').chainId).toBe(WALLET_CHAIN_ID)
    })

    test('otherwise the first network in order', () => {
        const noArb = buildTokenOptions(CHAINS, ['1', '10', 'tron'], all)
        expect(pickDefaultNetwork(noArb.find((o) => o.symbol === 'USDT')!, '10').chainId).toBe('1')
    })
})

describe('findSelection / fallbackSelection', () => {
    test('finds an EVM pair case-insensitively', () => {
        expect(findSelection(options(), '1', USDT_ETH.toLowerCase())?.option.symbol).toBe('USDT')
    })

    test('base58 addresses must match exactly', () => {
        expect(findSelection(options(), 'tron', USDT_TRON)?.network.chainId).toBe('tron')
        expect(findSelection(options(), 'tron', USDT_TRON.toLowerCase())).toBeUndefined()
    })

    test('a pair the selector does not offer is not found', () => {
        expect(findSelection(options(), 'tron', PEANUT_WALLET_TOKEN)).toBeUndefined()
        expect(findSelection(options(), '', '')).toBeUndefined()
    })

    test('fallback keeps the token and moves it to its default network', () => {
        const usdtOnly = buildTokenOptions(CHAINS, ['1', 'tron'], all)
        // USDT on Arbitrum is not offered here; USDT itself is
        const pick = fallbackSelection(usdtOnly, CHAINS, WALLET_CHAIN_ID, '0xusdtArb')
        expect(pick?.option.symbol).toBe('USDT')
        expect(pick?.network.chainId).toBe('1')
    })

    test('fallback picks the first token when the selected one is not offered', () => {
        const pick = fallbackSelection(options(), CHAINS, '', '')
        expect(pick?.option.symbol).toBe('USDC')
        expect(pick?.network.chainId).toBe(WALLET_CHAIN_ID)
    })

    test('nothing offered, nothing to fall back to', () => {
        expect(fallbackSelection([], CHAINS, '1', USDT_ETH)).toBeUndefined()
    })
})

test('filterTokenOptions matches symbol or name substrings', () => {
    expect(filterTokenOptions(options(), 'usd').map((o) => o.symbol)).toEqual(['USDC', 'USDT'])
    expect(filterTokenOptions(options(), '  ').length).toBe(3)
})

test('withWalletChain adds the wallet chain only when the record lacks it', () => {
    expect(withWalletChain(CHAINS)).toBe(CHAINS)
    const added = withWalletChain({ tron: CHAINS.tron })
    expect(added[WALLET_CHAIN_ID].tokens[0].address).toBe(PEANUT_WALLET_TOKEN)
})

describe("networkRowsForToken — every network, the token's own first", () => {
    test('USDC lists Tron last, and a tap there selects USDT on Tron (TASK-24035)', () => {
        const rows = networkRowsForToken(options(), option('USDC'))
        expect(rows.map((r) => [r.network.chainId, r.otherToken, r.network.token.symbol])).toEqual([
            [WALLET_CHAIN_ID, false, 'USDC'],
            ['1', false, 'USDC'],
            ['10', false, 'USDC'],
            ['tron', true, 'USDT'],
        ])
        expect(rows[3].network.token.address).toBe(USDT_TRON)
    })

    test('a network without the token offers the first token it carries, in token order', () => {
        // Optimism carries USDC and ETH: USDC ranks first
        const rows = networkRowsForToken(options(), option('USDT'))
        const optimism = rows.find((r) => r.network.chainId === '10')!
        expect(optimism).toMatchObject({ otherToken: true, network: { token: { symbol: 'USDC' } } })
        expect(rows.filter((r) => r.otherToken)).toHaveLength(1)
        expect(rows).toHaveLength(4)
    })

    test('a supported row carries the token on that chain', () => {
        const eth = networkRowsForToken(options(), option('ETH')).find((r) => r.network.chainId === '1')!
        expect(eth).toMatchObject({ otherToken: false, network: { token: { address: ETH } } })
    })
})
