/**
 * Mock for @justaname.id/react
 * Used in Jest tests to avoid ESM import issues
 */

export const usePrimaryName = jest.fn(() => ({
    primaryName: undefined,
    isLoading: false,
    error: null,
}))

export const useRecords = jest.fn(() => ({
    records: {},
    isLoading: false,
    error: null,
}))

export const useAddresses = jest.fn(() => ({
    addresses: [],
    isLoading: false,
    error: null,
}))
