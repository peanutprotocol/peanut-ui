import {
    daysSince,
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
        expect(savedAddressKey(42161, HEX)).toBe(savedAddressKey('42161', HEX))
    })

    it('label = nickname + last 4 chars', () => {
        expect(savedAddressLabel('Binance', HEX)).toBe('Binance · ...eC9B')
    })

    it('short form keeps 6+4 for hex, 4+4 for base58', () => {
        expect(shortSavedAddress(HEX)).toBe('0xAb58...eC9B')
        expect(shortSavedAddress(TRON)).toBe('TN3W...b3m9')
        expect(shortSavedAddress('not-an-address')).toBe('not-an-address')
    })

    it('counts whole days since the last use', () => {
        const now = new Date(2026, 7, 26, 12, 0)
        expect(daysSince(new Date(2026, 7, 26, 1, 0).toISOString(), now)).toBe(0)
        expect(daysSince(new Date(2026, 7, 20, 12, 0).toISOString(), now)).toBe(6)
    })

    // TASK-23927: 46 hours read "used yesterday" for a use two calendar days back.
    // Local constructors keep the cases true in any TZ, as in dateGrouping.utils.test.ts.
    it('counts calendar days in the local time zone, not 24-hour blocks', () => {
        const now = new Date(2026, 9, 21, 12, 0)
        expect(daysSince(new Date(2026, 9, 19, 14, 0).toISOString(), now)).toBe(2)
        expect(daysSince(new Date(2026, 9, 21, 0, 30).toISOString(), new Date(2026, 9, 21, 23, 30))).toBe(0)
        expect(daysSince(new Date(2026, 9, 20, 23, 30).toISOString(), new Date(2026, 9, 21, 0, 30))).toBe(1)
    })
})
