import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'

describe('hosted KYC preparation copy', () => {
    it.each(APP_LOCALES)('uses short requirements and non-numeric duration in %s', async (locale) => {
        const prep = (await loadMessages(locale)).kyc.prep
        expect(prep.items.id.title.length).toBeLessThan(32)
        expect(prep.items.proofOfAddress.title.length).toBeLessThan(32)
        expect(prep.items.selfie.title).not.toBe(prep.items.selfie.label)
        expect(prep.items.selfie.body.toLowerCase()).not.toMatch(/short selfie|selfie corta|selfie rápida/)
        expect(prep.howLong.standard).not.toMatch(/\d+\s*(minutes|minutos)/)
        // no number of minutes (ui#3465), but the reviewer caveat stays: a
        // hosted check a person reviews takes days, not minutes
        expect(prep.howLong.hosted).not.toMatch(/\d+\s*(minutes|minutos)/)
        expect(prep.howLong.hosted).toMatch(/1 (to|a) 3 (business days|días hábiles|dias úteis)/)
        expect(prep.howLong.hosted.length).toBeGreaterThan(40)
    })

    it('uses the requested English duration sentence', async () => {
        const prep = (await loadMessages('en')).kyc.prep
        expect(prep.howLong.hosted).toBe(
            'Verification process usually takes a few minutes if you have all the documents in hand. If a reviewer has to look at it, 1 to 3 business days.'
        )
    })

    it('resolves the Argentine labels through the es-419 fallback', async () => {
        const prep = (await loadMessages('es-AR')).kyc.prep
        expect(prep.items.id.label).toBe('Documento')
        expect(prep.items.proofOfAddress.label).toBe('Dirección')
    })
})
