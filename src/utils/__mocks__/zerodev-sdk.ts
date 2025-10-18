// Mock for @zerodev/sdk to avoid ESM issues in tests

export const createKernelAccount = jest.fn(() =>
    Promise.resolve({
        address: '0x1234567890123456789012345678901234567890',
        signMessage: jest.fn(),
        signTypedData: jest.fn(),
    })
)

export const createKernelMigrationAccount = jest.fn(() =>
    Promise.resolve({
        address: '0x1234567890123456789012345678901234567890',
        signMessage: jest.fn(),
        signTypedData: jest.fn(),
    })
)

export const createKernelAccountClient = jest.fn(() => ({
    account: {
        address: '0x1234567890123456789012345678901234567890',
    },
    sendUserOperation: jest.fn(),
    waitForUserOperationReceipt: jest.fn(),
}))

export const createZeroDevPaymasterClient = jest.fn(() => ({
    sponsorUserOperation: jest.fn(),
}))

export const createPasskeyValidator = jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
}))

export const toPasskeyValidator = jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
}))

export const toWebAuthnKey = jest.fn(() => ({
    pubX: BigInt(0),
    pubY: BigInt(0),
}))

export const createWeightedValidator = jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
}))

export const toECDSASigner = jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
}))

export const signerToEcdsaValidator = jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
}))

export const KERNEL_V3_1 = '0x0DA6a956B9488eD4dd761E59f52FDc6c8068E6B5'

export const getEntryPoint = jest.fn((version: string) => ({
    address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as `0x${string}`,
    version: version as '0.6' | '0.7',
}))

export const constants = {
    KERNEL_V3_1: '0x0DA6a956B9488eD4dd761E59f52FDc6c8068E6B5',
    getEntryPoint,
}
