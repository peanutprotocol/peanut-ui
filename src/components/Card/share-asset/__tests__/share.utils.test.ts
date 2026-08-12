/**
 * @jest-environment jsdom
 */

/**
 * Share-caption composition tests.
 *
 * The win captions carry no URL of their own, so the sharer's profile link is
 * appended at share time. Both share paths — `navigator.share({ text, files })`
 * and the desktop twitter intent — take ONE composed string, so the shape of
 * that string is the whole contract.
 *
 * STRUCTURE ONLY: never assert on the real caption pool (winCaptions.ts is
 * marketing copy and rotates), so every case below feeds a synthetic caption.
 */

import { composeShareCaption, shareCardOnTwitter } from '../share.utils'

const CAPTION = 'caption-under-test'
const PROFILE_URL = 'https://peanut.me/alice'

describe('composeShareCaption', () => {
    it('appends the url after a blank line', () => {
        expect(composeShareCaption(CAPTION, PROFILE_URL)).toBe(`${CAPTION}\n\n${PROFILE_URL}`)
    })

    it('returns the caption unchanged when there is no url (anti-dox / unknown handle)', () => {
        expect(composeShareCaption(CAPTION, undefined)).toBe(CAPTION)
        expect(composeShareCaption(CAPTION)).toBe(CAPTION)
    })
})

describe('shareCardOnTwitter', () => {
    let openSpy: jest.SpyInstance

    beforeEach(() => {
        openSpy = jest.spyOn(window, 'open').mockReturnValue(null)
    })

    afterEach(() => {
        openSpy.mockRestore()
    })

    it('opens the twitter intent with the composed text encoded in the text= param', () => {
        const composed = composeShareCaption(CAPTION, PROFILE_URL)
        shareCardOnTwitter(composed)

        expect(openSpy).toHaveBeenCalledTimes(1)
        const [href, target, features] = openSpy.mock.calls[0] as [string, string, string]
        expect(target).toBe('_blank')
        expect(features).toBe('noopener')

        // The URL must survive encoding intact — a mangled text= param is how a
        // shared link silently stops being clickable.
        const intent = new URL(href)
        expect(intent.origin + intent.pathname).toBe('https://twitter.com/intent/tweet')
        expect(intent.searchParams.get('text')).toBe(composed)
    })
})
