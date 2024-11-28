import '@testing-library/jest-dom'

// Add any global test setup here
global.console = {
    ...console,
    // Uncomment to ignore a specific log level
    // log: jest.fn(),
    debug: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
}
