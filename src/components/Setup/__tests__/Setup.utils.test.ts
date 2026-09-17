import { isLikelyWebview } from '../Setup.utils'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const setUserAgent = (userAgent: string) => {
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent })
}

describe('isLikelyWebview', () => {
    const originalUserAgent = window.navigator.userAgent

    afterEach(() => setUserAgent(originalUserAgent))

    it.each([
        [
            'Android Chrome',
            'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
        ],
        [
            'iOS Chrome',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1',
        ],
        [
            'iOS Safari',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
        ],
    ])('does not reject %s', (_browser, userAgent) => {
        setUserAgent(userAgent)

        expect(isLikelyWebview()).toBe(false)
    })

    it.each([
        [
            'Instagram on Android',
            'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36 Instagram 396.0.0.0.40 Android',
        ],
        [
            'an iOS non-Safari webview',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        ],
    ])('still identifies %s', (_browser, userAgent) => {
        setUserAgent(userAgent)

        expect(isLikelyWebview()).toBe(true)
    })
})
