/**
 * A send link's password is a bearer secret for the unclaimed funds: it is
 * kept under the account that made the link and goes at sign-out, so the next
 * person on a shared device never finds it.
 */
import { forgetSendLinkPasswords, keepSendLinkPassword, readSendLinkPassword } from '../send-link-password'

beforeEach(() => window.localStorage.clear())

it('keeps a password under the account that made the link, and only that account reads it', () => {
    keepSendLinkPassword('u1', '0xAbC', 'secret')
    expect(readSendLinkPassword('u1', '0xabc')).toBe('secret')
    expect(readSendLinkPassword('u2', '0xabc')).toBeNull()
    expect(window.localStorage.getItem('sendLink::password::0xAbC')).toBeNull()
})

it("moves a password stored before it was keyed by account under the link's account", () => {
    window.localStorage.setItem('sendLink::password::0xabc', JSON.stringify('legacy'))
    expect(readSendLinkPassword('u1', '0xabc')).toBe('legacy')
    expect(window.localStorage.getItem('sendLink::password::0xabc')).toBeNull()
    expect(readSendLinkPassword('u1', '0xabc')).toBe('legacy')
})

it("sign-out removes the account's passwords and the unkeyed ones, never another account's", () => {
    keepSendLinkPassword('u1', '0xaaa', 'mine')
    keepSendLinkPassword('u2', '0xbbb', 'theirs')
    window.localStorage.setItem('sendLink::password::0xccc', JSON.stringify('legacy'))

    forgetSendLinkPasswords('u1')

    expect(readSendLinkPassword('u1', '0xaaa')).toBeNull()
    expect(window.localStorage.getItem('sendLink::password::0xccc')).toBeNull()
    expect(readSendLinkPassword('u2', '0xbbb')).toBe('theirs')
})
