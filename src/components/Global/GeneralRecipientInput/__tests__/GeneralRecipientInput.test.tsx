import { render, act } from '@testing-library/react'
import GeneralRecipientInput from '../index'
import * as utils from '@/utils'
import * as ens from '@/app/actions/ens'
import type { RecipientType } from '@/interfaces'
import { validateEnsName } from '@/utils'

// Test case type definition for better maintainability
type TestCase = {
    input: string
    expectedType: RecipientType
    expectedValid: boolean
    description: string
    expectedAddress?: string
    expectedName?: string
    expectedError?: string
}

// Mock dependencies
jest.mock('@/utils', () => {
    const actualUtils = jest.requireActual('@/utils')
    return {
        validateBankAccount: jest.fn(),
        sanitizeBankAccount: (input: string) => input.toLowerCase().replace(/\s/g, ''),
        validateEnsName: actualUtils.validateEnsName, // Use the actual implementation
    }
})

jest.mock('@/app/actions/ens', () => ({
    resolveEns: jest.fn(),
}))

jest.mock('@/hooks/useRecentRecipients', () => ({
    useRecentRecipients: jest.fn(() => ({
        getSuggestions: () => [],
        addRecipient: jest.fn(),
    })),
}))

// Mock viem's isAddress function
jest.mock('viem', () => ({
    isAddress: (address: string) => address.startsWith('0x') && address.length === 42,
    http: jest.fn(),
    createPublicClient: jest.fn(),
}))

describe('GeneralRecipientInput Type Detection', () => {
    let onUpdateMock: jest.Mock

    beforeEach(() => {
        onUpdateMock = jest.fn()
        jest.clearAllMocks()
        ;(utils.validateBankAccount as jest.Mock).mockResolvedValue(true)
    })

    const setup = async (initialValue = '') => {
        let component: ReturnType<typeof render>
        await act(async () => {
            component = render(
                <GeneralRecipientInput
                    placeholder="Enter recipient"
                    recipient={{ address: initialValue, name: undefined }}
                    onUpdate={onUpdateMock}
                />
            )
        })
        return component!
    }

    const testCases: TestCase[] = [
        // US Bank Account cases
        {
            input: '091311229',
            expectedType: 'us',
            expectedValid: true,
            description: 'valid 9-digit US account',
        },
        {
            input: '0913 1122 9',
            expectedType: 'us',
            expectedValid: true,
            description: 'valid US account with spaces',
            expectedAddress: '091311229',
        },
        {
            input: '    0913 1122 9         ',
            expectedType: 'us',
            expectedValid: true,
            description: 'valid US account with spaces 2',
            expectedAddress: '091311229',
        },
        {
            input: '123456',
            expectedType: 'us',
            expectedValid: true,
            description: 'minimum length (6 digits) US account',
        },
        {
            input: '12345678901234567',
            expectedType: 'us',
            expectedValid: true,
            description: 'maximum length (17 digits) US account',
        },
        {
            input: '123456789012345678',
            expectedType: 'address',
            expectedValid: false,
            description: 'too long for US account',
            expectedError: 'Invalid Peanut username',
        },

        // IBAN cases
        {
            input: 'DE89370400440532013000',
            expectedType: 'iban',
            expectedValid: true,
            description: 'valid German IBAN',
            expectedAddress: 'de89370400440532013000',
        },
        {
            input: 'GB29 NWBK 6016 1331 9268 19',
            expectedType: 'iban',
            expectedValid: true,
            description: 'valid UK IBAN with spaces',
            expectedAddress: 'gb29nwbk60161331926819',
        },
        {
            input: 'IT60X0542811101000000123456',
            expectedType: 'iban',
            expectedValid: true,
            description: 'valid Italian IBAN',
            expectedAddress: 'it60x0542811101000000123456',
        },

        // ETH Address cases
        {
            input: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            expectedType: 'address',
            expectedValid: true,
            description: 'valid ETH address',
        },
        {
            input: '0x742d35cc6634c0532925a3b844bc454e4438f44e',
            expectedType: 'address',
            expectedValid: true,
            description: 'valid ETH address in lowercase',
        },
        {
            input: '  0x742d35Cc6634C0532925a3b844Bc454e4438f44e  ',
            expectedType: 'address',
            expectedValid: true,
            description: 'valid ETH address with surrounding spaces',
            expectedAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        },
        {
            input: '0x742d35Cc6634C0532925a3b844Bc454e4438f44',
            expectedType: 'address',
            expectedValid: false,
            description: 'invalid ETH address (too short)',
            expectedError: 'Invalid Ethereum address',
        },
        {
            input: '0x742d35Cc6634C0532925a3b844Bc454e4438f44ez',
            expectedType: 'address',
            expectedValid: false,
            description: 'invalid ETH address (invalid characters)',
            expectedError: 'Invalid Ethereum address',
        },
        {
            input: '742d35Cc6634C0532925a3b844Bc454e4438f44e',
            expectedType: 'address',
            expectedValid: false,
            description: 'invalid ETH address (missing 0x prefix)',
            expectedError: 'Invalid Peanut username',
        },

        // ENS cases
        {
            input: 'vitalik.eth',
            expectedType: 'ens',
            expectedValid: true,
            description: 'valid ENS name',
            expectedAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            expectedName: 'vitalik.eth',
        },
        {
            input: 'not-found.eth',
            expectedType: 'address',
            expectedValid: false,
            description: 'unresolvable ENS name',
            expectedError: 'ENS name not found',
        },
    ]

    describe('Input Type Detection and Validation', () => {
        testCases.forEach(
            ({ input, expectedType, expectedValid, description, expectedAddress, expectedName, expectedError }) => {
                it(`should handle ${description}`, async () => {
                    // Setup ENS mock if needed
                    if (validateEnsName(input)) {
                        ;(ens.resolveEns as jest.Mock).mockResolvedValue(expectedValid ? expectedAddress : null)
                    }

                    await setup(input)

                    await act(async () => {
                        await new Promise((resolve) => setTimeout(resolve, 0))
                    })

                    expect(onUpdateMock).toHaveBeenCalledWith(
                        expect.objectContaining({
                            type: expectedType,
                            isValid: expectedValid,
                            recipient: expectedValid
                                ? {
                                      address: expectedAddress ?? input,
                                      name: expectedName,
                                  }
                                : expect.any(Object),
                            ...(expectedError && { errorMessage: expectedError }),
                        })
                    )
                })
            }
        )
    })
})
