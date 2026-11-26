jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => true) }))

import { messageTypeOfLink, readMessageType } from '../notification-message'
import { deepLinkToNativePath } from '../native-routes'

describe('notification message tag (TASK-22683)', () => {
    it('reads the message type from a deep link or app URL', () => {
        expect(messageTypeOfLink('/home?msg=lifecycle.welcome')).toBe('lifecycle.welcome')
        expect(messageTypeOfLink('https://peanut.me/add-money?country=argentina&msg=kyc.bank_ready')).toBe(
            'kyc.bank_ready'
        )
        expect(messageTypeOfLink('/home')).toBeUndefined()
        expect(messageTypeOfLink(undefined)).toBeUndefined()
    })

    it('passes nothing that is not shaped like an event type', () => {
        expect(readMessageType('a@b.com')).toBeUndefined()
        expect(readMessageType('<script>')).toBeUndefined()
        expect(readMessageType('x'.repeat(81))).toBeUndefined()
        expect(readMessageType('deposit.crypto.under_min')).toBe('deposit.crypto.under_min')
    })

    // The API appends msg to every push deep link; the native mapper must still route each one.
    it.each([
        '/home',
        '/home?support=open',
        '/add-money',
        '/add-money?country=argentina&view=manteca',
        '/receipt/intent-1?kind=ONRAMP',
        '/card',
        '/verify',
        '/profile/identity-verification',
        '/claim?c=abc#p=secret',
    ])('routes %s the same with the tag', (link) => {
        const hash = link.indexOf('#')
        const base = hash === -1 ? link : link.slice(0, hash)
        const tagged = `${base}${base.includes('?') ? '&' : '?'}msg=kyc.approved${hash === -1 ? '' : link.slice(hash)}`
        const plain = deepLinkToNativePath(link)
        const mapped = deepLinkToNativePath(tagged)
        expect(plain).not.toBeNull()
        expect(mapped).not.toBeNull()
        const [plainPath] = plain!.split(/[?#]/)
        expect(mapped!.split(/[?#]/)[0]).toBe(plainPath)
        expect(new URL(mapped!, 'https://peanut.me').searchParams.get('msg')).toBe('kyc.approved')
    })
})
