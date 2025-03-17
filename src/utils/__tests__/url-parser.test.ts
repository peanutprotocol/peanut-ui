import { EParseUrlError, parsePaymentURL } from '@/lib/url-parser/parser'

// mock ENS resolution
jest.mock('@/utils', () => {
    const originalModule = jest.requireActual('@/utils')
    return {
        ...originalModule,
        resolveFromEnsName: (name: string) => {
            if (name === 'vitalik.eth') {
                return Promise.resolve('0x1234567890123456789012345678901234567890')
            }
            if (name.endsWith('.testvc.eth')) {
                return Promise.resolve('0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271')
            }
            return Promise.resolve(null)
        },
    }
})

// mock Peanut username validation
jest.mock('@/lib/validation/recipient', () => {
    const originalModule = jest.requireActual('@/lib/validation/recipient')
    return {
        ...originalModule,
        validateAndResolveRecipient: async (recipient: string) => {
            if (recipient === 'kusharc') {
                return {
                    identifier: 'kusharc',
                    recipientType: 'USERNAME',
                    resolvedAddress: '0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271',
                }
            }
            return originalModule.validateAndResolveRecipient(recipient)
        },
    }
})

// mock Squid data
jest.mock('@/app/actions/squid', () => ({
    getSquidChainsAndTokens: () => ({
        '1': {
            chainId: 1,
            name: 'Ethereum',
            tokens: [
                { symbol: 'ETH', address: 'native' },
                { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
            ],
        },
        '42161': {
            chainId: 42161,
            name: 'Arbitrum',
            tokens: [
                { symbol: 'ETH', address: 'native' },
                { symbol: 'USDC', address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8' },
            ],
        },
        '8453': {
            chainId: '8453',
            name: 'Base',
            networkIdentifier: 'base',
            chainName: 'Chain 8453',
            axelarChainName: 'base',
            type: 'evm',
            networkName: 'Base',
            tokens: [
                {
                    symbol: 'ETH',
                    address: 'native',
                    chainId: '8453',
                    name: 'ETH',
                    decimals: 18,
                    active: true,
                },
                {
                    symbol: 'USDC',
                    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                    chainId: '8453',
                    name: 'USDC',
                    decimals: 6,
                    active: true,
                },
            ],
        },
    }),
}))

jest.mock('@/constants', () => ({
    JUSTANAME_ENS: process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || '',
    PEANUT_WALLET_CHAIN: {
        id: '42161',
        name: 'Arbitrum',
    },
    PEANUT_WALLET_TOKEN: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    chains: [
        { id: 1, name: 'Ethereum' },
        { id: 42161, name: 'Arbitrum' },
    ],
}))

jest.mock('@/lib/url-parser/parser.consts', () => ({
    POPULAR_CHAIN_NAME_VARIANTS: {
        '1': ['eth', 'ethereum'],
        '42161': ['arbitrum', 'arb'],
        '8453': ['base'],
    },
}))

jest.mock('@/lib/validation/resolvers/chain-resolver', () => ({
    resolveChainId: (chainIdentifier: string | number): string => {
        const chainMap: { [key: string]: string } = {
            eth: '1',
            ethereum: '1',
            arbitrum: '42161',
            base: '8453',
            '1': '1',
            '42161': '42161',
            '8453': '8453',
        }
        if (!chainMap[chainIdentifier.toString()]) {
            throw new Error(`Chain ${chainIdentifier} is either not supported or invalid`)
        }
        return chainMap[chainIdentifier.toString()]
    },
    getReadableChainName: (chainId: string | number) => {
        const nameMap: { [key: string]: string } = {
            '1': 'Ethereum',
            '42161': 'Arbitrum',
            '8453': 'Base',
        }
        return nameMap[chainId.toString()] || 'Unknown Chain'
    },
}))

describe('URL Parser Tests', () => {
    describe('Recipient Format Tests', () => {
        it('should parse Ethereum address', async () => {
            const result = await parsePaymentURL(['0x1234567890123456789012345678901234567890'])
            expect(result.parsedUrl?.recipient).toEqual({
                identifier: '0x1234567890123456789012345678901234567890',
                recipientType: 'ADDRESS',
                resolvedAddress: '0x1234567890123456789012345678901234567890',
            })
        })

        it('should parse ENS name', async () => {
            const result = await parsePaymentURL(['vitalik.eth'])
            expect(result.parsedUrl?.recipient).toEqual({
                identifier: 'vitalik.eth',
                recipientType: 'ENS',
                resolvedAddress: '0x1234567890123456789012345678901234567890',
            })
        })

        it('should parse Peanut username', async () => {
            const result = await parsePaymentURL(['kusharc'])
            expect(result.parsedUrl?.recipient).toEqual({
                identifier: 'kusharc',
                recipientType: 'USERNAME',
                resolvedAddress: '0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271',
            })
        })
    })

    describe('Chain Format Tests', () => {
        it('should parse chain by decimal ID', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A@1'])
            expect(result.parsedUrl?.chain).toEqual(
                expect.objectContaining({
                    chainId: 1,
                    name: 'Ethereum',
                })
            )
        })

        it('should parse chain by hex ID', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A@0x1'])
            expect(result.parsedUrl?.chain).toEqual(
                expect.objectContaining({
                    chainId: 1,
                    name: 'Ethereum',
                })
            )
        })

        it('should parse chain by name', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A@ethereum'])
            expect(result.parsedUrl?.chain).toEqual(
                expect.objectContaining({
                    chainId: 1,
                    name: 'Ethereum',
                })
            )
        })

        it('should return recipient details only if other parms are not specified', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A'])
            expect(result.parsedUrl).toEqual(
                expect.objectContaining({
                    recipient: {
                        identifier: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                        recipientType: 'ADDRESS',
                        resolvedAddress: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                    },
                    chain: undefined,
                    token: undefined,
                    amount: undefined,
                })
            )
        })
    })

    describe('Amount and Token Tests', () => {
        it('token without chain should return arbitrum as default chain', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A', '0.1USDC'])
            expect(result.error).toBeNull()
            expect(result.parsedUrl).toEqual(
                expect.objectContaining({
                    recipient: {
                        identifier: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                        recipientType: 'ADDRESS',
                        resolvedAddress: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                    },
                    amount: '0.1',
                    token: expect.objectContaining({
                        symbol: 'USDC',
                    }),
                    chain: expect.objectContaining({
                        chainId: 42161,
                    }),
                })
            )
        })

        it('should parse amount without token', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A', '0.1'])
            expect(result.parsedUrl?.amount).toBe('0.1')
            // Default token should be USDC on Arbitrum
            expect(result.parsedUrl?.token?.symbol).toBe(undefined)
        })

        it('should default to Arbitrum chain when only token symbol is provided', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A', 'ETH'])
            expect(result.error).toBeNull()
            expect(result.parsedUrl).toEqual(
                expect.objectContaining({
                    recipient: {
                        identifier: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                        recipientType: 'ADDRESS',
                        resolvedAddress: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                    },
                    amount: undefined,
                    token: expect.objectContaining({
                        symbol: 'ETH',
                    }),
                    chain: expect.objectContaining({
                        chainId: 42161,
                    }),
                })
            )
        })
    })

    describe('Combined Format Tests', () => {
        it('should parse full URL format', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A@arbitrum', '0.1USDC'])
            expect(result.parsedUrl).toEqual({
                recipient: expect.any(Object),
                chain: expect.objectContaining({ chainId: 42161 }),
                amount: '0.1',
                token: expect.objectContaining({ symbol: 'USDC' }),
            })
        })

        it('should parse ENS with chain and token', async () => {
            const result = await parsePaymentURL(['vitalik.eth@ethereum', '1ETH'])
            expect(result.parsedUrl).toEqual(
                expect.objectContaining({
                    recipient: expect.objectContaining({
                        identifier: 'vitalik.eth',
                        recipientType: 'ENS',
                        resolvedAddress: expect.any(String),
                    }),
                    chain: expect.objectContaining({ chainId: 1 }),
                    amount: '1',
                    token: expect.objectContaining({ symbol: 'ETH' }),
                })
            )
        })

        it('should parse username with default chain', async () => {
            const result = await parsePaymentURL(['kusharc', '5'])
            expect(result.parsedUrl).toMatchObject({
                recipient: {
                    identifier: 'kusharc',
                    recipientType: 'USERNAME',
                    resolvedAddress: '0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271',
                },
                amount: '5',
                chain: {
                    chainId: 42161,
                    name: 'Arbitrum',
                },
                token: {
                    symbol: 'USDC',
                },
            })
        })
    })

    describe('Chain and Token Tests', () => {
        it('should handle address without chain or token', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A'])
            expect(result.parsedUrl).toEqual({
                recipient: {
                    identifier: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                    recipientType: 'ADDRESS',
                    resolvedAddress: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                },
                chain: undefined,
                token: undefined,
                amount: undefined,
            })
        })

        it('should use default chain and token for username', async () => {
            const result = await parsePaymentURL(['kusharc'])
            expect(result.parsedUrl).toEqual(
                expect.objectContaining({
                    recipient: {
                        identifier: 'kusharc',
                        recipientType: 'USERNAME',
                        resolvedAddress: '0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271',
                    },
                    amount: undefined,
                    chain: expect.objectContaining({
                        chainId: 42161,
                    }),
                    token: expect.objectContaining({
                        symbol: 'USDC',
                    }),
                })
            )
        })

        it('should handle token without chain for Peanut username', async () => {
            const result = await parsePaymentURL(['kusharc', '5USDC'])
            expect(result.error).toBeNull()
            expect(result.parsedUrl).toEqual(
                expect.objectContaining({
                    recipient: {
                        identifier: 'kusharc',
                        recipientType: 'USERNAME',
                        resolvedAddress: '0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271',
                    },
                    amount: '5',
                    token: expect.objectContaining({
                        symbol: 'USDC',
                    }),
                    chain: expect.objectContaining({
                        chainId: 42161,
                    }),
                })
            )
        })

        it('should handle token without chain for address', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A', '5USDC'])
            expect(result.error).toBeNull()
            expect(result.parsedUrl).toEqual(
                expect.objectContaining({
                    recipient: {
                        identifier: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                        recipientType: 'ADDRESS',
                        resolvedAddress: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                    },
                    amount: '5',
                    token: expect.objectContaining({
                        symbol: 'USDC',
                    }),
                    chain: expect.objectContaining({
                        chainId: 42161,
                    }),
                })
            )
        })

        it('should correctly resolve Ethereum chain by name', async () => {
            const result = await parsePaymentURL(['vitalik.eth@ethereum', '5ETH'])
            expect(result.parsedUrl).toEqual(
                expect.objectContaining({
                    recipient: expect.objectContaining({
                        identifier: 'vitalik.eth',
                        recipientType: 'ENS',
                        resolvedAddress: '0x1234567890123456789012345678901234567890',
                    }),
                    chain: expect.objectContaining({
                        chainId: 1,
                        name: 'Ethereum',
                    }),
                    amount: '5',
                    token: expect.objectContaining({
                        symbol: 'ETH',
                    }),
                })
            )
        })

        it('should handle ETH on different chains', async () => {
            // ETH on Ethereum
            const ethResult = await parsePaymentURL(['vitalik.eth@ethereum', '1ETH'])
            expect(ethResult.parsedUrl).toEqual(
                expect.objectContaining({
                    chain: expect.objectContaining({ chainId: 1 }),
                    token: expect.objectContaining({ symbol: 'ETH' }),
                })
            )

            // ETH on Arbitrum
            const arbResult = await parsePaymentURL(['vitalik.eth@arbitrum', '0.5ETH'])
            expect(arbResult.parsedUrl).toEqual(
                expect.objectContaining({
                    chain: expect.objectContaining({ chainId: 42161 }),
                    token: expect.objectContaining({ symbol: 'ETH' }),
                })
            )
        })

        it('should handle USDC on different chains', async () => {
            // USDC on Ethereum
            const ethResult = await parsePaymentURL(['0x1234567890123456789012345678901234567890@ethereum', '100USDC'])
            expect(ethResult.parsedUrl).toEqual(
                expect.objectContaining({
                    chain: expect.objectContaining({ chainId: 1 }),
                    token: expect.objectContaining({
                        symbol: 'USDC',
                        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                    }),
                })
            )

            // USDC on Arbitrum
            const arbResult = await parsePaymentURL(['0x1234567890123456789012345678901234567890@arbitrum', '50USDC'])
            expect(arbResult.parsedUrl).toEqual(
                expect.objectContaining({
                    chain: expect.objectContaining({ chainId: 42161 }),
                    token: expect.objectContaining({
                        symbol: 'USDC',
                        address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
                    }),
                })
            )
        })

        it('should handle chain name variants', async () => {
            const variants = ['ethereum', 'eth', '1', '0x1']
            for (const variant of variants) {
                const result = await parsePaymentURL([`vitalik.eth@${variant}`, '1ETH'])
                expect(result.parsedUrl?.chain).toEqual(expect.objectContaining({ chainId: 1 }))
            }

            const arbVariants = ['arbitrum', 'arb', '42161']
            for (const variant of arbVariants) {
                const result = await parsePaymentURL([`vitalik.eth@${variant}`, '1ETH'])
                expect(result.parsedUrl?.chain).toEqual(expect.objectContaining({ chainId: 42161 }))
            }
        })

        it('should handle default tokens for different recipient types', async () => {
            const usernameResult = await parsePaymentURL(['kusharc'])
            expect(usernameResult.parsedUrl).toEqual(
                expect.objectContaining({
                    chain: expect.objectContaining({ chainId: 42161 }),
                    token: expect.objectContaining({
                        symbol: 'USDC',
                        address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
                    }),
                })
            )

            const addressResult = await parsePaymentURL(['0x1234567890123456789012345678901234567890'])
            expect(addressResult.parsedUrl?.chain).toBeUndefined()
            expect(addressResult.parsedUrl?.token).toBeUndefined()
        })

        it('should handle invalid token/chain combinations', async () => {
            const result1 = await parsePaymentURL(['vitalik.eth@ethereum', '1DOGE'])
            expect(result1.error?.message).toBe(EParseUrlError.INVALID_TOKEN)

            const result2 = await parsePaymentURL(['vitalik.eth@solana', '1ETH'])
            expect(result2.error?.message).toBe(EParseUrlError.INVALID_CHAIN)

            const result3 = await parsePaymentURL(['vitalik.eth@invalid', '1INVALID'])
            expect(result3.error?.message).toBe(EParseUrlError.INVALID_CHAIN)
        })
    })

    describe('Error Cases', () => {
        it('should return error for invalid Peanut usernames', async () => {
            const result = await parsePaymentURL(['0xinvalid'])
            expect(result.error).toBeTruthy()
            expect(result.parsedUrl).toBeNull()
        })

        it('should return error for invalid chain', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A@invalidchain'])
            expect(result.error).toBeTruthy()
            expect(result.parsedUrl).toBeNull()
        })

        it('should return error for invalid amount param', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A', 'invalid'])
            expect(result.error).toBeTruthy()
            expect(result.parsedUrl).toBeNull()
        })

        it('should return error for invalid token', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A', '1UNKNOWN'])
            expect(result.error).toBeTruthy()
            expect(result.parsedUrl).toBeNull()
        })
    })
})
