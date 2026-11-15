import { deviceOs, inAppBrowser } from '../environment'
import { USER_AGENTS } from './user-agents'

describe('environment', () => {
    it.each([
        ['instagramIos', 'ios', 'instagram'],
        ['instagramAndroid', 'android', 'instagram'],
        ['facebookIos', 'ios', 'facebook'],
        ['facebookAndroid', 'android', 'facebook'],
        ['xIos', 'ios', 'x'],
        ['tiktokIos', 'ios', 'tiktok'],
        ['tiktokAndroid', 'android', 'tiktok'],
        ['xAndroid', 'android', 'x'],
        ['threadsIos', 'ios', 'threads'],
        ['threadsAndroid', 'android', 'threads'],
        ['linkedinIos', 'ios', 'linkedin'],
        ['linkedinAndroid', 'android', 'linkedin'],
        ['instagramIpad', 'ios', 'instagram'],
        ['safariIpad', 'other', 'none'],
        ['safariIos', 'ios', 'none'],
        ['chromeAndroid', 'android', 'none'],
        ['chromeMac', 'other', 'none'],
    ] as const)('%s → %s, %s', (name, os, browser) => {
        expect(deviceOs(USER_AGENTS[name])).toBe(os)
        expect(inAppBrowser(USER_AGENTS[name])).toBe(browser)
    })

    it('does not read `trill` inside another word as TikTok', () => {
        expect(inAppBrowser(`${USER_AGENTS.chromeAndroid} Electrillium/1.0`)).toBe('none')
    })

    it('reads an empty user agent as other / none', () => {
        expect(deviceOs('')).toBe('other')
        expect(inAppBrowser('')).toBe('none')
    })
})
