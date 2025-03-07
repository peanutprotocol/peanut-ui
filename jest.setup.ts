import '@testing-library/jest-dom'

// Add TextEncoder/TextDecoder to global scope for viem
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
require('dotenv').config({ path: '.env.test' })

// Add any global test setup here
global.console = {
    ...console,
    // Uncomment to ignore a specific log level
    // log: jest.fn(),
    debug: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
}
