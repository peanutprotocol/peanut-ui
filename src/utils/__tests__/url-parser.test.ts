import { parsePaymentURL } from '@/lib/url-parser/parser'

// mock ENS resolution
jest.mock('@/utils', () => ({
    resolveFromEnsName: (name: string) => {
        if (name === 'vitalik.eth') {
            return Promise.resolve('0x1234567890123456789012345678901234567890')
        }
        if (name.endsWith('.testvc.eth')) {
            return Promise.resolve('0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271')
        }
        return Promise.resolve(null)
    },
}))

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
    },
}))

jest.mock('@/lib/validation/resolvers/chain-resolver', () => ({
    resolveChainId: (chainIdentifier: string | number): string => {
        const chainMap: { [key: string]: string } = {
            eth: '1',
            ethereum: '1',
            arbitrum: '42161',
            '1': '1',
            '42161': '42161',
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
        it('should parse amount with token', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A', '0.1USDC'])
            expect(result.parsedUrl?.amount).toBe('0.1')
            expect(result.parsedUrl?.token?.symbol).toBe('USDC')
        })

        it('should parse amount without token', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A', '0.1'])
            expect(result.parsedUrl?.amount).toBe('0.1')
            // Default token should be USDC on Arbitrum
            expect(result.parsedUrl?.token?.symbol).toBe(undefined)
        })

        it('should parse token without amount', async () => {
            const result = await parsePaymentURL(['0x0fdaEB9903A291aB8450DFA25B3fa962E075547A', 'ETH'])
            expect(result.parsedUrl?.token).toEqual(
                expect.objectContaining({
                    symbol: 'ETH',
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

        it('should handle token without chain for peanut username', async () => {
            const result = await parsePaymentURL(['kusharc', '5USDC'])
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
            expect(result.parsedUrl).toEqual(
                expect.objectContaining({
                    recipient: {
                        identifier: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                        recipientType: 'ADDRESS',
                        resolvedAddress: '0x0fdaEB9903A291aB8450DFA25B3fa962E075547A',
                    },
                    amount: '5',
                    chain: undefined,
                    token: expect.objectContaining({
                        symbol: 'USDC',
                    }),
                })
            )
        })
    })

    describe('Error Cases', () => {
        it('should return error for invalid peanut usernames', async () => {
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

    describe('Chain and Token Tests', () => {
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

        // todo: add more tests for chain and token resolution
    })
})
