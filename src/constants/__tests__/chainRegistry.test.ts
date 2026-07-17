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
import { CHAIN_REGISTRY, CHAIN_ROLLOUT_FLAGS, NON_EVM_WITHDRAW_CHAINS } from '../chainRegistry.consts'

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
            '747474': 'KATANA',
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
        // SCROLL must never come back without a live-catalog re-check
        expect(EVM_CHAIN_ID_TO_RHINO_NAME['534352']).toBeUndefined()
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
            '1': ['ETH', 'USDC', 'USDT'],
            '10': ['ETH', 'USDC', 'USDT'],
            '137': ['USDC', 'USDT'],
            '100': ['USDC', 'USDT'],
            '56': ['BNB', 'USDC', 'USDT'],
            // Added 2026-07-13 (Hugo): the June curation oversight, fixed —
            // verified live (quotes ETH/USDC/USDT + SDA create) same day.
            '8453': ['ETH', 'USDC', 'USDT'],
            '43114': ['USDC', 'USDT'],
            '999': ['USDC', 'USDT'],
            '57073': ['USDC', 'USDT'],
            '747474': ['USDC', 'USDT'],
            '59144': ['USDC', 'USDT'],
            '5000': ['USDC', 'USDT'],
            '9745': ['USDT'],
            '988': ['USDT'],
            '4217': ['USDC', 'USDT'],
            solana: ['USDC', 'USDT'],
            tron: ['USDT'],
        })
        // Kaia/opBNB rejected at SDA create; Scroll disabled — must stay out
        expect(RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN['8217']).toBeUndefined()
        expect(RHINO_WITHDRAW_SUPPORTED_TOKENS_BY_CHAIN['534352']).toBeUndefined()
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
                'KATANA',
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
            GNOSIS: ['USDT', 'USDC'],
        })
        // every advertised chain has a logo (broken-logo class of bug)
        for (const chain of [...SUPPORTED_EVM_CHAINS, ...OTHER_SUPPORTED_CHAINS]) {
            expect(CHAIN_LOGOS[chain]).toMatch(/^https:\/\//)
        }
        expect(CHAIN_LOGOS.SCROLL).toMatch(/^https:\/\//) // legacy display-only
    })

    it('CHAIN_ROLLOUT_FLAGS — every surface key of a flagged chain maps to ONE flag', () => {
        expect(CHAIN_ROLLOUT_FLAGS).toEqual({
            '8453': 'chain-rollout-base',
            BASE: 'chain-rollout-base',
            '43114': 'chain-rollout-avalanche',
            '999': 'chain-rollout-hyperevm',
            '57073': 'chain-rollout-ink',
            '747474': 'chain-rollout-katana',
            KATANA: 'chain-rollout-katana',
            '59144': 'chain-rollout-linea',
            '5000': 'chain-rollout-mantle',
            '9745': 'chain-rollout-plasma',
            PLASMA: 'chain-rollout-plasma',
            '988': 'chain-rollout-stable',
            '4217': 'chain-rollout-tempo',
            TEMPO: 'chain-rollout-tempo',
            '8217': 'chain-rollout-kaia',
            KAIA: 'chain-rollout-kaia',
            solana: 'chain-rollout-solana',
            SOLANA: 'chain-rollout-solana',
            tron: 'chain-rollout-tron',
            TRON: 'chain-rollout-tron',
        })
    })

    it('NON_EVM_WITHDRAW_CHAINS synthetic records', () => {
        expect(Object.keys(NON_EVM_WITHDRAW_CHAINS).sort()).toEqual(['solana', 'tron'])
        expect(NON_EVM_WITHDRAW_CHAINS.solana.tokens.map((t) => t.symbol)).toEqual(['USDC', 'USDT'])
        expect(NON_EVM_WITHDRAW_CHAINS.solana.tokens[0].address).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
        expect(NON_EVM_WITHDRAW_CHAINS.tron.tokens.map((t) => t.symbol)).toEqual(['USDT'])
        expect(NON_EVM_WITHDRAW_CHAINS.tron.tokens[0].address).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
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
