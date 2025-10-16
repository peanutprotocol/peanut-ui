import '@testing-library/jest-dom'

// Add TextEncoder/TextDecoder to global scope for viem
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

require('dotenv').config({ path: '.env.test' })

// Setup minimal environment variables for tests
process.env.NEXT_PUBLIC_ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'test-key'
process.env.NEXT_PUBLIC_INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY || 'test-key'
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'test-vapid-public'
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'test-vapid-private'
process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:test@example.com'

// Add any global test setup here
global.console = {
    ...console,
    // Uncomment to ignore a specific log level
    // log: jest.fn(),
    debug: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
}

// Mock next/cache
jest.mock('next/cache', () => ({
    unstable_cache: (fn: Function) => fn,
}))

jest.mock('@/app/actions/tokens', () => ({
    fetchTokenPriceApi: jest.fn(() => Promise.resolve({ price: 100, symbol: 'TEST' })),
    getTokenBalances: jest.fn(() => Promise.resolve([])),
    getTokenPrice: jest.fn(() => Promise.resolve(100)),
    fetchERC20Data: jest.fn(() => Promise.resolve({ name: 'Test Token', symbol: 'TEST', decimals: 18 })),
}))
