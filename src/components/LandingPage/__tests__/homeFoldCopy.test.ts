import en from '@/i18n/en.json'
import es419 from '@/i18n/es-419.json'
import esAr from '@/i18n/es-ar.json'
import ptBr from '@/i18n/pt-br.json'

const CATALOGS = { en, 'es-419': es419, 'es-ar': esAr, 'pt-br': ptBr }
const words = (text: string) => text.trim().split(/\s+/).length

describe.each(Object.entries(CATALOGS))('home fold copy (%s)', (_locale, catalog) => {
    // The fees fold sets this in Knerd at hero size; one word fits a 320px column in every locale.
    it('keeps the fees headline to one word', () => {
        expect(words(catalog.landingZeroFees)).toBe(1)
    })

    // Round 2: Konrad asked for the security columns cut drastically, so each stays one short line.
    it.each(['landingSecurityTotalDesc', 'landingSecurityControlDesc', 'landingSecurityHelpDesc'] as const)(
        'keeps %s to a few words',
        (key) => {
            expect(words(catalog[key])).toBeLessThanOrEqual(8)
        }
    )

    it('keeps both country slots in the pay-local lead', () => {
        expect(catalog.landingPayLocalLead).toContain('{argentina}')
        expect(catalog.landingPayLocalLead).toContain('{brazil}')
    })
})

it('tells the English reader QR pay needs no local ID, not "with your passport"', () => {
    expect(en.landingPayLocalLead).toMatch(/No DNI, no CPF\.$/)
    expect(en.landingPayLocalLead).not.toMatch(/passport/i)
})
