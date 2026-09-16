import { renderHook, waitFor } from '@testing-library/react'
import { BrowserType, useGetBrowserType } from '../useGetBrowserType'

const setUserAgent = (userAgent: string): void => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
}

describe('useGetBrowserType', () => {
    const originalUserAgent = navigator.userAgent

    afterEach(() => setUserAgent(originalUserAgent))

    test.each([
        [
            'Android Chrome',
            'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
            BrowserType.CHROME,
        ],
        [
            'iOS Chrome',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1',
            BrowserType.CHROME,
        ],
        [
            'iOS Safari',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
            BrowserType.SAFARI,
        ],
    ])('detects %s before passkey guidance is selected', async (_name, userAgent, expectedBrowser) => {
        setUserAgent(userAgent)

        const { result } = renderHook(() => useGetBrowserType())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.browserType).toBe(expectedBrowser)
    })
})
