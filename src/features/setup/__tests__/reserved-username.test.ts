import { isReservedSignupUsername } from '../reserved-username'

describe('isReservedSignupUsername', () => {
    it.each([
        'peanut',
        'PEANUT',
        'PeAnUt',
        'teampeanut',
        'peanutteam',
        'aPeAnUtZ',
        'official',
        'Official',
        'OFFICIAL',
        'verified',
        'VERIFIED',
        'Verified',
        'helpdesk',
        'HelpDesk',
        'HELPDESK',
        'customercare',
        'CustomerCare',
        'CUSTOMERCARE',
    ])('refuses %s', (username) => {
        expect(isReservedSignupUsername(username)).toBe(true)
    })

    it.each([
        '',
        'kimchi',
        'officialfan',
        'verified1',
        'myhelpdesk',
        'customercare1',
        ' official ',
        'verified ',
        'helpdesk1',
        'mycustomercare',
        'pean ut',
    ])('allows %s', (username) => {
        expect(isReservedSignupUsername(username)).toBe(false)
    })
})
