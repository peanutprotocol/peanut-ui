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
process.env.PEANUT_API_KEY = process.env.PEANUT_API_KEY || 'test-peanut-api-key'

// jsdom has no ResizeObserver; components using it (e.g. react-fast-marquee) need a stub.
global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
}

// jsdom has no IntersectionObserver; embla-carousel's SlidesInView needs it on init.
global.IntersectionObserver = class {
    root = null
    rootMargin = ''
    thresholds = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return []
    }
} as unknown as typeof IntersectionObserver

// jsdom has no matchMedia; embla-carousel calls it for breakpoint options on init.
// Suites that assert on matchMedia behavior override this with their own stub.
// Guarded: a few suites run in the node environment, where window doesn't exist.
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }),
    })
}

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

// UserAvatar renders in most screens, and many suites mount them without a
// QueryClientProvider. An empty map is the bundled-art path; a suite that
// tests served art mocks this module itself.
jest.mock('@/components/Avatar/useAvatarArt', () => ({ useAvatarArt: () => ({}), useSettledAvatarArt: () => ({}) }))
