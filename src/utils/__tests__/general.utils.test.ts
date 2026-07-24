import {
    formatAmount,
    formatExtendedNumber,
    generateInviteCodeLink,
    getContributorsFromCharge,
    getRequestLink,
    formatTokenAmount,
    isUuid,
    printableUserHandle,
    toInviteCode,
} from '../general.utils'
import { AccountType } from '@/interfaces'
import { type ChargeEntry, type Payment, type TStatus } from '@/services/services.types'

describe('General Utilities', () => {
    describe('Amount Formatting Utilities', () => {
        describe('formatTokenAmount', () => {
            describe('input mode (forInput: true) - locale-aware handling', () => {
                // Note: These tests run with the test environment's locale
                // The actual behavior adapts to user's browser locale at runtime

                it('should handle US format (comma as thousands, dot as decimal)', () => {
                    // Assuming test env is en-US or similar
                    expect(formatTokenAmount('1,000', 2, true)).toBe('1000')
                    expect(formatTokenAmount('10,000.50', 2, true)).toBe('10000.50')
                    expect(formatTokenAmount('1,234,567', 2, true)).toBe('1234567')
                })

                it('should preserve progressive typing with decimal', () => {
                    expect(formatTokenAmount('123.', 2, true)).toBe('123.')
                    expect(formatTokenAmount('0.', 2, true)).toBe('0.')
                })

                it('should limit decimal places to maxFractionDigits', () => {
                    expect(formatTokenAmount('123.456789', 2, true)).toBe('123.45')
                    expect(formatTokenAmount('123.4', 2, true)).toBe('123.4')
                })

                it('should handle whole numbers', () => {
                    expect(formatTokenAmount('123', 2, true)).toBe('123')
                    expect(formatTokenAmount('1000', 2, true)).toBe('1000')
                })
            })
        })

        describe('formatAmount', () => {
            describe('edge cases', () => {
                it('should handle empty string', () => {
                    expect(formatAmount('')).toBe('0')
                })

                it('should handle invalid string input', () => {
                    expect(formatAmount('invalid')).toBe('0')
                })

                it('should handle NaN', () => {
                    expect(formatAmount(NaN)).toBe('0')
                })
            })

            describe('small numbers (< 0.01)', () => {
                it('should format to 2 significant digits', () => {
                    expect(formatAmount(0.0012345)).toBe('0.0012')
                    expect(formatAmount(0.00456)).toBe('0.0046')
                    expect(formatAmount(0.000789)).toBe('0.00079')
                })

                it('should handle negative small numbers', () => {
                    expect(formatAmount(-0.0012345)).toBe('-0.0012')
                    expect(formatAmount(-0.00456)).toBe('-0.0046')
                })

                it('should handle string inputs of small numbers', () => {
                    expect(formatAmount('0.0012345')).toBe('0.0012')
                    expect(formatAmount('-0.00456')).toBe('-0.0046')
                })
            })

            describe('regular numbers (≥ 0.01)', () => {
                it('should format to at most 2 decimal places', () => {
                    expect(formatAmount(1.23456)).toBe('1.23')
                    expect(formatAmount(10.9876)).toBe('10.99')
                    expect(formatAmount(0.01)).toBe('0.01')
                })

                it('should remove trailing zeros after decimal', () => {
                    expect(formatAmount('1.230')).toBe('1.23')
                    expect(formatAmount('1.200')).toBe('1.2')
                    expect(formatAmount(10.5)).toBe('10.5')
                })

                it('should handle negative numbers', () => {
                    expect(formatAmount(-1.23456)).toBe('-1.23')
                    expect(formatAmount('-10.9876')).toBe('-10.99')
                })
            })

            describe('whole numbers', () => {
                it('should remove decimal part if all zeros', () => {
                    expect(formatAmount('1000.00')).toBe('1000')
                    expect(formatAmount(1.0)).toBe('1')
                })

                it('should handle zero', () => {
                    expect(formatAmount(0)).toBe('0')
                    expect(formatAmount('0.00')).toBe('0')
                })

                it('should handle string whole numbers', () => {
                    expect(formatAmount('100')).toBe('100')
                    expect(formatAmount('-1000')).toBe('-1000')
                })
            })
        })

        describe('formatExtendedNumber', () => {
            describe('edge cases', () => {
                it('should handle empty string', () => {
                    expect(formatExtendedNumber('')).toBe('0')
                })

                it('should handle invalid string input', () => {
                    expect(formatExtendedNumber('invalid')).toBe('0')
                })

                it('should handle NaN', () => {
                    expect(formatExtendedNumber(NaN)).toBe('0')
                })

                it('should handle undefined and null', () => {
                    expect(formatExtendedNumber(undefined as any)).toBe('0')
                    expect(formatExtendedNumber(null as any)).toBe('0')
                })
            })

            describe('numbers with 6 or fewer digits', () => {
                it('should not apply suffix for numbers with 6 or fewer digits', () => {
                    expect(formatExtendedNumber(12345)).toBe('12345')
                    expect(formatExtendedNumber(999)).toBe('999')
                    expect(formatExtendedNumber(1000)).toBe('1000')
                    expect(formatExtendedNumber(999999)).toBe('999999')
                })

                it('should handle decimal numbers with 6 or fewer total digits', () => {
                    expect(formatExtendedNumber(12.34)).toBe('12.34')
                    expect(formatExtendedNumber(123.4)).toBe('123.4')
                    expect(formatExtendedNumber(0.123)).toBe('0.12')
                    expect(formatExtendedNumber(1234.5)).toBe('1234.5')
                })

                it('should handle negative numbers with 6 or fewer digits', () => {
                    expect(formatExtendedNumber(-1234)).toBe('-1234')
                    expect(formatExtendedNumber(-12.34)).toBe('-12.34')
                    expect(formatExtendedNumber(-99999)).toBe('-99999')
                })

                it('should handle string inputs with 6 or fewer digits', () => {
                    expect(formatExtendedNumber('12345')).toBe('12345')
                    expect(formatExtendedNumber('-1234')).toBe('-1234')
                    expect(formatExtendedNumber('999.99')).toBe('999.99')
                })
            })

            describe('numbers exceeding 6 digits', () => {
                it('should format whole numbers exceeding 6 digits', () => {
                    expect(formatExtendedNumber(1234567)).toBe('1.23M')
                    expect(formatExtendedNumber(9876543)).toBe('9.88M')
                })

                it('should format decimal numbers exceeding 6 total digits', () => {
                    expect(formatExtendedNumber(1234.567)).toBe('1.23K')
                    expect(formatExtendedNumber(12345.67)).toBe('12.35K')
                })

                it('should format negative numbers exceeding 6 digits', () => {
                    expect(formatExtendedNumber(-1234567)).toBe('-1.23M')
                    expect(formatExtendedNumber(-1234.567)).toBe('-1.23K')
                })
            })

            describe('suffix selection', () => {
                it('should apply K suffix for appropriate ranges', () => {
                    expect(formatExtendedNumber(1234567)).toBe('1.23M')
                    expect(formatExtendedNumber(1234.567)).toBe('1.23K')
                })

                it('should apply M suffix for appropriate ranges', () => {
                    expect(formatExtendedNumber(12345678)).toBe('12.35M')
                    expect(formatExtendedNumber(123456789)).toBe('123.46M')
                })

                it('should apply B suffix for appropriate ranges', () => {
                    expect(formatExtendedNumber(1234567890)).toBe('1.23B')
                    expect(formatExtendedNumber(12345678901)).toBe('12.35B')
                })

                it('should apply T suffix for appropriate ranges', () => {
                    expect(formatExtendedNumber(1234567890000)).toBe('1.23T')
                    expect(formatExtendedNumber(12345678900000)).toBe('12.35T')
                })
            })

            describe('boundary cases', () => {
                it('should handle numbers at the 6-digit boundary', () => {
                    expect(formatExtendedNumber(999999)).toBe('999999')
                    expect(formatExtendedNumber(1000000)).toBe('1M')
                    expect(formatExtendedNumber(999.9999)).toBe('1000')
                    expect(formatExtendedNumber(999.99999)).toBe('1000')
                })

                it('should handle numbers at suffix boundaries', () => {
                    expect(formatExtendedNumber(999999.9)).toBe('1M')
                    expect(formatExtendedNumber(999999999)).toBe('1B')
                    expect(formatExtendedNumber(999999999999)).toBe('1T')
                })
            })
        })
    })

    describe('getRequestLink', () => {
        // getRequestLink now uses shareableUrl which reads window.location.origin
        // (so a link shared from staging stays on staging). Mock origin so existing
        // assertions against peanut.example.org keep working.
        const originalLocation = window.location
        beforeAll(() => {
            Object.defineProperty(window, 'location', {
                value: new URL('https://peanut.example.org'),
                writable: true,
            })
        })
        afterAll(() => {
            Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
        })

        it.each([
            // For Peanut Wallet users (username-based links)
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.PEANUT_WALLET,
                        user: {
                            username: 'satoshi',
                        },
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink: 'https://peanut.example.org/satoshi/?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            // For Peanut Wallet users with token amount
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.PEANUT_WALLET,
                        user: {
                            username: 'satoshi',
                        },
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    tokenAmount: '10',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink: 'https://peanut.example.org/satoshi/10?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.PEANUT_WALLET,
                        user: {
                            username: 'satoshi',
                        },
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    tokenAmount: '10.000000',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink: 'https://peanut.example.org/satoshi/10?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.PEANUT_WALLET,
                        user: {
                            username: 'satoshi',
                        },
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    tokenAmount: '10.110000',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink: 'https://peanut.example.org/satoshi/10.11?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            // For Peanut Wallet users with token amount and symbol
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.PEANUT_WALLET,
                        user: {
                            username: 'satoshi',
                        },
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    tokenAmount: '10',
                    tokenSymbol: 'ETH',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink: 'https://peanut.example.org/satoshi/10ETH?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            // For EVM address users (address-based links)
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.EVM_ADDRESS,
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    chainId: '1',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink:
                    'https://peanut.example.org/0x1234567890123456789012345678901234567890@1/?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            // For EVM address users with token amount
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.EVM_ADDRESS,
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    chainId: '1',
                    tokenAmount: '5.5',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink:
                    'https://peanut.example.org/0x1234567890123456789012345678901234567890@1/5.5?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            // For EVM address users with token amount and symbol
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.EVM_ADDRESS,
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    chainId: '1',
                    tokenAmount: '5.5',
                    tokenSymbol: 'USDC',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink:
                    'https://peanut.example.org/0x1234567890123456789012345678901234567890@1/5.5USDC?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            // Using chargeId instead of uuid
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.PEANUT_WALLET,
                        user: {
                            username: 'satoshi',
                        },
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    chargeId: 'charge_123456789',
                },
                expectedLink: 'https://peanut.example.org/satoshi/?chargeId=charge_123456789',
            },
            // The bug we're fixing: BE returns an EVM_ADDRESS-typed account
            // for a recipient that DOES have a Peanut user attached. Username
            // wins regardless of `type`.
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.EVM_ADDRESS,
                        user: {
                            username: 'hugo0',
                        },
                    },
                    recipientAddress: '0xb009da0b0824ba04bfd7eb2757e064a8e184d338',
                    chainId: '42161',
                    tokenAmount: '0.38',
                    tokenSymbol: 'USDC',
                    uuid: '04acc664-c572-4d12-bb15-6d286ac80e81',
                },
                expectedLink: 'https://peanut.example.org/hugo0/0.38USDC?id=04acc664-c572-4d12-bb15-6d286ac80e81',
            },
            // Defensive: unprojected Prisma enum value flowing through. Same
            // outcome — username wins.
            {
                requestData: {
                    recipientAccount: {
                        type: 'WALLET_SMART',
                        user: {
                            username: 'satoshi',
                        },
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    chainId: '1',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink: 'https://peanut.example.org/satoshi/?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            // PEANUT_WALLET type with no `user` field — previously threw
            // TypeError via `user!.username`. Now falls back to the address
            // gracefully.
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.PEANUT_WALLET,
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    chainId: '42161',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink:
                    'https://peanut.example.org/0x1234567890123456789012345678901234567890@42161/?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
            // Token symbol but no amount
            {
                requestData: {
                    recipientAccount: {
                        type: AccountType.PEANUT_WALLET,
                        user: {
                            username: 'satoshi',
                        },
                    },
                    recipientAddress: '0x1234567890123456789012345678901234567890',
                    tokenSymbol: 'ETH',
                    uuid: 'c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
                },
                expectedLink: 'https://peanut.example.org/satoshi/ETH?id=c4fc57cb-deae-4ea2-bdb3-aeaa996255ad',
            },
        ])('should return the correct link', ({ requestData, expectedLink }) => {
            expect(getRequestLink(requestData)).toBe(expectedLink)
        })
    })

    describe('isUuid', () => {
        it('matches lowercase, uppercase, and mixed-case UUIDs', () => {
            expect(isUuid('7077676f-2bba-4ef2-b2ab-2d37aed69c69')).toBe(true)
            expect(isUuid('7077676F-2BBA-4EF2-B2AB-2D37AED69C69')).toBe(true)
            expect(isUuid('c4fc57cb-deae-4ea2-bdb3-aeaa996255ad')).toBe(true)
        })

        it('rejects non-UUID strings', () => {
            expect(isUuid('alice')).toBe(false)
            expect(isUuid('')).toBe(false)
            expect(isUuid('0x1234567890123456789012345678901234567890')).toBe(false)
            // Missing one hex char in the last group.
            expect(isUuid('7077676f-2bba-4ef2-b2ab-2d37aed69c6')).toBe(false)
            // Wrong delimiter.
            expect(isUuid('7077676f2bba4ef2b2ab2d37aed69c69')).toBe(false)
        })
    })

    describe('printableUserHandle', () => {
        it('shortens UUID identifiers so the activity feed never renders the full string', () => {
            const out = printableUserHandle('7077676f-2bba-4ef2-b2ab-2d37aed69c69')
            expect(out).not.toBe('7077676f-2bba-4ef2-b2ab-2d37aed69c69')
            expect(out).toContain('...')
            expect(out.length).toBeLessThan('7077676f-2bba-4ef2-b2ab-2d37aed69c69'.length)
        })

        it('shortens EVM addresses', () => {
            const out = printableUserHandle('0x1234567890123456789012345678901234567890')
            expect(out).toContain('...')
        })

        it('leaves real usernames untouched', () => {
            expect(printableUserHandle('alice')).toBe('alice')
            expect(printableUserHandle('hugo.peanut')).toBe('hugo.peanut')
        })

        it('returns empty string unchanged', () => {
            expect(printableUserHandle('')).toBe('')
        })
    })

    describe('generateInviteCodeLink', () => {
        const originalLocation = window.location
        beforeAll(() => {
            Object.defineProperty(window, 'location', {
                value: new URL('https://peanut.example.org'),
                writable: true,
            })
        })
        afterAll(() => {
            Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
        })

        it('emits a username-only invite code (no INVITESYOU, no suffix)', () => {
            const { inviteCode, inviteLink } = generateInviteCodeLink('alice')
            expect(inviteCode).toBe('alice')
            expect(inviteLink).toBe('https://peanut.example.org/invite?code=alice')
        })

        it('lowercases mixed-case usernames', () => {
            const { inviteCode, inviteLink } = generateInviteCodeLink('Alice')
            expect(inviteCode).toBe('alice')
            expect(inviteLink).toBe('https://peanut.example.org/invite?code=alice')
        })
    })

    describe('toInviteCode', () => {
        it('returns the bare lowercased username — no INVITESYOU, no suffix', () => {
            expect(toInviteCode('alice')).toBe('alice')
            expect(toInviteCode('Alice')).toBe('alice')
            expect(toInviteCode('HUGO')).toBe('hugo')
        })

        it('tolerates hand-typed input: trims whitespace, strips a leading @', () => {
            expect(toInviteCode('@alice')).toBe('alice')
            expect(toInviteCode(' @Alice ')).toBe('alice')
            expect(toInviteCode('  hugo')).toBe('hugo')
        })

        it('passes legacy invite codes through with unchanged meaning (BE uppercases before parsing)', () => {
            expect(toInviteCode('ALICEINVITESYOU610')).toBe('aliceinvitesyou610')
        })
    })

    describe('getContributorsFromCharge', () => {
        const makePayment = (status: TStatus, username: string | null): Payment => ({
            uuid: `pay-${username ?? 'anon'}-${status}`,
            chargeUuid: 'charge-1',
            payerTransactionHash: '0xhash',
            payerChainId: '1',
            paidTokenAddress: '0xtoken',
            paidAmountInRequestedToken: '10',
            payerAddress: '0xpayer',
            fulfillmentTransactionHash: null,
            status,
            reason: null,
            createdAt: '2026-01-01T00:00:00Z',
            verifiedAt: null,
            payerAccount: {
                userId: username ? 'user-id' : null,
                identifier: username ?? '0xanon',
                type: 'PEANUT',
                user: username ? { username, bridgeKycStatus: 'approved' } : null,
            },
        })

        const makeCharge = (uuid: string, payments: Payment[]): ChargeEntry =>
            ({
                uuid,
                tokenAmount: '10',
                payments,
                fulfillmentPayment: null,
            }) as ChargeEntry

        it('drops charges that have no successful payment', () => {
            const charges = [makeCharge('c1', [makePayment('FAILED', 'bob'), makePayment('PENDING', 'bob')])]
            expect(getContributorsFromCharge(charges)).toEqual([])
        })

        it('counts only charges with a successful payment (no inflated count)', () => {
            const charges = [
                makeCharge('c1', [makePayment('SUCCESSFUL', 'alice')]),
                makeCharge('c2', [makePayment('FAILED', 'bob')]),
            ]
            const contributors = getContributorsFromCharge(charges)
            expect(contributors).toHaveLength(1)
            expect(contributors[0].username).toBe('alice')
        })

        it('picks the last SUCCESSFUL payment, not the last payment overall', () => {
            // a failed retry after a successful payment must not surface the failed payer
            const charges = [makeCharge('c1', [makePayment('SUCCESSFUL', 'alice'), makePayment('FAILED', 'mallory')])]
            const contributors = getContributorsFromCharge(charges)
            expect(contributors).toHaveLength(1)
            expect(contributors[0].username).toBe('alice')
        })
    })
})
