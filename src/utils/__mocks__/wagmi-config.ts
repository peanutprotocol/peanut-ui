/**
 * Mock for @/config/wagmi.config to avoid AppKit ESM import issues in Jest
 */

export const wagmiAdapter = {}
export const networks = []
export const projectId = 'test-project-id'
export const metadata = {
    name: 'Peanut Protocol',
    description: 'Test',
    url: 'https://peanut.to',
    icons: [],
}

// Mock AppKit initialization
export const initializeAppKit = jest.fn().mockResolvedValue(undefined)

// Mock ContextProvider component
export const ContextProvider = ({ children }: { children: any; cookies: string | null }) => children
