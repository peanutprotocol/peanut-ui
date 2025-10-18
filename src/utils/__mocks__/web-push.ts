/**
 * Mock for web-push
 * Used in Jest tests to avoid VAPID key validation issues
 */

export const setVapidDetails = jest.fn()
export const sendNotification = jest.fn(() => Promise.resolve())
export const generateVAPIDKeys = jest.fn(() => ({
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
}))

const webpush = {
    setVapidDetails,
    sendNotification,
    generateVAPIDKeys,
}

export default webpush
