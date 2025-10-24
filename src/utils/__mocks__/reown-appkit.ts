/**
 * Mock for @reown/appkit/react
 * Used in Jest tests to avoid ESM import issues
 */

export const useAppKit = jest.fn(() => ({
    open: jest.fn(),
    close: jest.fn(),
}))

export const useAppKitTheme = jest.fn(() => ({
    themeMode: 'light',
    themeVariables: {},
    setThemeMode: jest.fn(),
    setThemeVariables: jest.fn(),
}))

export const useAppKitState = jest.fn(() => ({
    open: false,
    selectedNetworkId: undefined,
}))

export const useAppKitAccount = jest.fn(() => ({
    address: undefined,
    isConnected: false,
    caipAddress: undefined,
    status: 'disconnected',
}))

export const useAppKitNetwork = jest.fn(() => ({
    chainId: undefined,
    caipNetworkId: undefined,
    switchNetwork: jest.fn(),
}))

export const useDisconnect = jest.fn(() => ({
    disconnect: jest.fn(),
}))

export const useAppKitProvider = jest.fn(() => ({
    walletProvider: undefined,
    walletProviderType: undefined,
}))
