/**
 * Mock for @/config/wagmi.config to avoid ESM import issues in Jest
 */

export const wagmiConfig = {}
export const networks = []

// Mock ContextProvider component
export const ContextProvider = ({ children }: { children: any; cookies: string | null }) => children
