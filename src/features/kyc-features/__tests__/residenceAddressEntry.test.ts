import { residenceAddressEntry } from '../residenceAddressEntry'

it('keeps an unresolved setup without an address descriptor unavailable', () => {
    expect(residenceAddressEntry({ state: 'setting_up', reason: 'residence_unresolved' }, [])).toBe('unavailable')
})

it('distinguishes confirmed address review from unresolved setup', () => {
    expect(residenceAddressEntry({ state: 'setting_up', reason: 'residence_address_in_review' }, [])).toBe('in_review')
})

it.each(['on', 'ready', 'refused'] as const)('does not override a %s feature with stale residence reason', (state) => {
    expect(residenceAddressEntry({ state, reason: 'residence_unresolved' }, [])).toBeNull()
})
