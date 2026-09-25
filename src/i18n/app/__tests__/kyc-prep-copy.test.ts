import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'

describe('hosted KYC preparation copy', () => {
    it.each(APP_LOCALES)('uses short requirements and non-numeric duration in %s', async (locale) => {
        const prep = (await loadMessages(locale)).kyc.prep
        expect(prep.items.id.title.length).toBeLessThan(32)
        expect(prep.items.proofOfAddress.title.length).toBeLessThan(32)
        expect(prep.items.selfie.body.toLowerCase()).not.toMatch(/short selfie|selfie corta|selfie rápida/)
        expect(prep.howLong.standard).not.toMatch(/\d+\s*(minutes|minutos)/)
        expect(prep.howLong.hosted).not.toMatch(/\d/)
        expect(prep.howLong.hosted).not.toMatch(/business days|días hábiles|dias úteis/)
        expect(prep.howLong.hosted.length).toBeGreaterThan(40)
    })

    it('resolves the Argentine labels through the es-419 fallback', async () => {
        const prep = (await loadMessages('es-AR')).kyc.prep
        expect(prep.items.id.label).toBe('Documento')
        expect(prep.items.proofOfAddress.label).toBe('Dirección')
    })
})
