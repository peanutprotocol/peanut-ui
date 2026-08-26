import {
    daysSince,
    lastUsedTone,
    normalizeSavedAddress,
    savedAddressKey,
    savedAddressLabel,
    shortSavedAddress,
} from '../saved-address.utils'

const HEX = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'
const TRON = 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9'

describe('saved-address.utils', () => {
    it('keys match the BE canon: lowercase hex, verbatim base58, lowercase chain', () => {
        expect(savedAddressKey('42161', HEX)).toBe(`42161:${HEX.toLowerCase()}`)
        expect(savedAddressKey('TRON', ` ${TRON} `)).toBe(`tron:${TRON}`)
        expect(normalizeSavedAddress('0XABC')).toBe('0xabc')
    })

    it('label = nickname + last 4 chars', () => {
        expect(savedAddressLabel('Binance', HEX)).toBe('Binance · …eC9B')
    })

    it('short form keeps 6+4 for hex, 4+4 for base58', () => {
        expect(shortSavedAddress(HEX)).toBe('0xAb58…eC9B')
        expect(shortSavedAddress(TRON)).toBe('TN3W…b3m9')
        expect(shortSavedAddress('short')).toBe('short')
    })

    it('tone: <7d recent, 7–30d aging, 30+ stale', () => {
        const now = new Date('2026-08-26T12:00:00Z')
        expect(daysSince('2026-08-26T01:00:00Z', now)).toBe(0)
        expect(daysSince('2026-08-20T12:00:00Z', now)).toBe(6)
        expect(lastUsedTone(6)).toBe('recent')
        expect(lastUsedTone(7)).toBe('aging')
        expect(lastUsedTone(30)).toBe('aging')
        expect(lastUsedTone(31)).toBe('stale')
    })
})
