/**
 * Behavior-equality proof for the CHAIN_REGISTRY refactor: every derived map
 * must match the hand-maintained literals it replaced (values captured from
 * feat/solana-tron-withdrawals @ ea63b6ca). If you're editing these
 * EXPECTATIONS to make a failure pass, you're changing chain behavior —
 * verify against Rhino's live catalogs first.
 */
// TokenSelector.consts imports the wagmi `networks` config, which cannot
// construct under jest (appkit env) — only the id list matters here.
jest.mock('@/config/wagmi.config', () => ({ networks: [] }))

import {
    CHAIN_LOGOS,
    SUPPORTED_EVM_CHAINS,
    OTHER_SUPPORTED_CHAINS,
    EVM_CHAIN_ID_TO_RHINO_NAME,
    NON_EVM_CHAIN_ID_TO_RHINO_NAME,
    chainIdToRhinoName,
    EVM_DEPOSIT_TOKEN_EXCEPTIONS,
} from '../rhino.consts'
import { RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN } from '@/components/Global/TokenSelector/TokenSelector.consts'
import {
    CHAIN_REGISTRY,
    NON_EVM_WITHDRAW_CHAINS,
    resolveChainRegistryEntry,
    rhinoWithdrawTokenSymbol,
} from '../chainRegistry.consts'
import tokenDetails from '../token-details.json'

describe('CHAIN_REGISTRY derivations match the replaced literals', () => {
    it('EVM_CHAIN_ID_TO_RHINO_NAME', () => {
        expect(EVM_CHAIN_ID_TO_RHINO_NAME).toEqual({
            '1': 'ETHEREUM',
            '10': 'OPTIMISM',
            '56': 'BINANCE',
            '100': 'GNOSIS',
            '137': 'MATIC_POS',
            '42161': 'ARBITRUM',
            '421614': 'ARBITRUM',
            '8453': 'BASE',
            '42220': 'CELO',
            '43114': 'AVALANCHE',
            '999': 'HYPEREVM',
            '57073': 'INK',
            '59144': 'LINEA',
            '5000': 'MANTLE',
            '9745': 'PLASMA',
            '988': 'STABLE',
            '4217': 'TEMPO',
            // NEW vs the literal (deliberate): Kaia now maps — it's a deposit
            // chain and webhook/receipt surfaces may reference it. It is NOT a
            // withdraw destination (no entry in the withdraw gate below).
            '8217': 'KAIA',
        })
        // SCROLL and KATANA must never come back without a live-catalog re-check
        expect(EVM_CHAIN_ID_TO_RHINO_NAME['534352']).toBeUndefined()
        expect(EVM_CHAIN_ID_TO_RHINO_NAME['747474']).toBeUndefined()
    })

    it('non-EVM mapping and the combined resolver', () => {
        expect(NON_EVM_CHAIN_ID_TO_RHINO_NAME).toEqual({ solana: 'SOLANA', tron: 'TRON' })
        expect(chainIdToRhinoName('SOLANA')).toBe('SOLANA')
        expect(chainIdToRhinoName(421614)).toBe('ARBITRUM')
        expect(chainIdToRhinoName('534352')).toBeUndefined()
    })

    it('RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN', () => {
        expect(RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN).toEqual({
            '42161': ['ETH', 'USDC', 'USDT'],
            // EURC (TASK-24704): Rhino marks it "Accept and deliver" here
            '1': ['ETH', 'USDC', 'USDT', 'EURC'],
            '10': ['ETH', 'USDC', 'USDT', 'EURC'],
            '137': ['USDC', 'USDT'],
            '100': ['USDC', 'USDT'],
            '56': ['BNB', 'USDC', 'USDT'],
            // Added 2026-07-13 (Hugo): the June curation oversight, fixed —
            // verified live (quotes ETH/USDC/USDT + SDA create) same day.
            '8453': ['ETH', 'USDC', 'USDT', 'EURC'],
            // USDe (TASK-24704): upper-cased here, Rhino's spelling stays in the registry
            '43114': ['USDC', 'USDT', 'USDE'],
            '999': ['USDC', 'USDT'],
            '57073': ['USDC', 'USDT'],
            '59144': ['USDC', 'USDT'],
            '5000': ['USDC', 'USDT'],
            '9745': ['USDT'],
            '988': ['USDT'],
            '4217': ['USDC', 'USDT'],
            solana: ['USDC', 'USDT', 'EURC'],
            tron: ['USDT'],
        })
        // Kaia/opBNB rejected at SDA create; Scroll and Katana disabled — must stay out
        expect(RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN['8217']).toBeUndefined()
        expect(RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN['534352']).toBeUndefined()
        expect(RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN['747474']).toBeUndefined()
    })

    it('deposit surfaces: chains, exceptions, logos', () => {
        expect([...SUPPORTED_EVM_CHAINS].sort()).toEqual(
            [
                'ARBITRUM',
                'ETHEREUM',
                'BASE',
                'OPTIMISM',
                'BNB',
                'POLYGON',
                'GNOSIS',
                'CELO',
                'TEMPO',
                'KAIA',
                'PLASMA',
            ].sort()
        )
        expect([...OTHER_SUPPORTED_CHAINS].sort()).toEqual(['SOLANA', 'TRON'])
        expect(EVM_DEPOSIT_TOKEN_EXCEPTIONS).toEqual({
            KAIA: ['USDT'],
            PLASMA: ['USDT'],
            TEMPO: ['USDT', 'USDC'],
            CELO: ['USDT', 'USDC'],
            GNOSIS: ['USDT', 'USDC', 'EURe'],
        })
        // every advertised chain has a logo (broken-logo class of bug)
        for (const chain of [...SUPPORTED_EVM_CHAINS, ...OTHER_SUPPORTED_CHAINS]) {
            expect(CHAIN_LOGOS[chain]).toMatch(/^https:\/\//)
        }
        expect(CHAIN_LOGOS.SCROLL).toMatch(/^https:\/\//) // legacy display-only
        expect(CHAIN_LOGOS.KATANA).toMatch(/^https:\/\//) // legacy display-only
    })

    it('NON_EVM_WITHDRAW_CHAINS synthetic records', () => {
        expect(Object.keys(NON_EVM_WITHDRAW_CHAINS).sort()).toEqual(['solana', 'tron'])
        expect(NON_EVM_WITHDRAW_CHAINS.solana.tokens.map((t) => t.symbol)).toEqual(['USDC', 'USDT', 'EURC'])
        expect(NON_EVM_WITHDRAW_CHAINS.solana.tokens[0].address).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
        expect(NON_EVM_WITHDRAW_CHAINS.tron.tokens.map((t) => t.symbol)).toEqual(['USDT'])
        expect(NON_EVM_WITHDRAW_CHAINS.tron.tokens[0].address).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
    })

    it('resolves wire identifiers to the canonical explorer metadata', () => {
        expect(resolveChainRegistryEntry('421614')?.id).toBe('42161')
        expect(resolveChainRegistryEntry('MATIC_POS')?.id).toBe('137')
        expect(resolveChainRegistryEntry(' solana ')?.transactionExplorerUrlPrefix).toBe('https://solscan.io/tx/')
        expect(resolveChainRegistryEntry('TRON')?.transactionExplorerUrlPrefix).toBe(
            'https://tronscan.org/#/transaction/'
        )
        expect(resolveChainRegistryEntry('unknown')).toBeUndefined()
        // old receipts on a display-only chain still resolve by id and by name
        expect(resolveChainRegistryEntry('747474')?.displayName).toBe('KATANA')
        expect(resolveChainRegistryEntry('KATANA')?.id).toBe('747474')
    })

    it('registry invariants', () => {
        const ids = CHAIN_REGISTRY.map((c) => c.id)
        expect(new Set(ids).size).toBe(ids.length) // no duplicate ids
        for (const entry of CHAIN_REGISTRY) {
            // a routable chain must have a Rhino name
            if (entry.deposit || entry.withdraw) expect(entry.rhinoName).toBeTruthy()
            // a deposit-advertised chain must be displayable
            if (entry.deposit) {
                expect(entry.displayName).toBeTruthy()
                expect(entry.logoUrl).toBeTruthy()
            }
            // non-EVM withdraw destinations need their synthetic record
            if (entry.withdraw && entry.family !== 'evm') expect(entry.nonEvmRecord).toBeTruthy()
        }
    })
})

/**
 * TASK-24704: EURC and USDe are withdrawable on exactly these pairs — the ones
 * Rhino's supported-chains page marks "Accept and deliver". A symbol with no
 * token record would not appear in the selector, so each pair must also carry
 * the address and decimals of Rhino's catalog (checked on-chain 2026-11-09).
 */
describe('non-USD withdraw tokens', () => {
    const PAIRS = [
        { chainId: '8453', symbol: 'EURC', address: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42', decimals: 6 },
        { chainId: '1', symbol: 'EURC', address: '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c', decimals: 6 },
        { chainId: '10', symbol: 'EURC', address: '0xdcb612005417dc906ff72c87df732e5a90d49e11', decimals: 6 },
        { chainId: 'solana', symbol: 'EURC', address: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr', decimals: 6 },
        { chainId: '43114', symbol: 'USDe', address: '0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34', decimals: 18 },
    ]

    const tokenRecord = (chainId: string, symbol: string) =>
        (
            NON_EVM_WITHDRAW_CHAINS[chainId]?.tokens ?? tokenDetails.find((chain) => chain.chainId === chainId)?.tokens
        )?.find((t) => t.symbol === symbol)

    it.each(PAIRS)('$symbol on chain $chainId has the token record the selector needs', (pair) => {
        expect(CHAIN_REGISTRY.find((c) => c.id === pair.chainId)?.withdraw?.tokens).toContain(pair.symbol)
        const record = tokenRecord(pair.chainId, pair.symbol)
        expect(record?.address).toBe(pair.address)
        expect(record?.decimals).toBe(pair.decimals)
    })

    it('offers them nowhere else: not on the other chains, and not the other On-demand tokens', () => {
        const added = CHAIN_REGISTRY.flatMap((c) =>
            (c.withdraw?.tokens ?? [])
                .filter((t) => !['ETH', 'BNB', 'USDC', 'USDT'].includes(t))
                .map((t) => `${t}@${c.id}`)
        ).sort()
        expect(added).toEqual(PAIRS.map((p) => `${p.symbol}@${p.chainId}`).sort())
    })

    it('sends Rhino its own spelling: USDe quotes, USDE does not', () => {
        expect(rhinoWithdrawTokenSymbol('43114', 'USDE')).toBe('USDe')
        expect(rhinoWithdrawTokenSymbol('43114', 'usde')).toBe('USDe')
        expect(rhinoWithdrawTokenSymbol('8453', 'eurc')).toBe('EURC')
        // an unlisted symbol stays upper-cased, as it always was
        expect(rhinoWithdrawTokenSymbol('8453', 'WETH')).toBe('WETH')
        expect(rhinoWithdrawTokenSymbol('unknown-chain', 'usdc')).toBe('USDC')
    })
})
