/** @jest-environment node */
import { STAR_LP_QR_LEVEL, starLpQrUrl } from '@/components/Marketing/StarLp/starLpQr.utils'

describe('starLpQrUrl', () => {
    it('sends a scan to web signup, tagged with the page and slot, while the PWA sunset is off', () => {
        expect(
            starLpQrUrl({
                origin: 'https://peanut.me',
                migrationOn: false,
                campaign: 'qr-argentina',
                slot: 'hero-sticker',
            })
        ).toBe('https://peanut.me/setup?utm_source=star-lp&utm_medium=content&utm_campaign=qr-ar&utm_content=h')
    })

    it('uses the app-entry path DownloadQR uses once the sunset is on', () => {
        const url = new URL(
            starLpQrUrl({
                origin: 'http://192.168.0.9:8765',
                migrationOn: true,
                campaign: 'qr-brazil',
                slot: 'ways-in',
            })
        )
        expect(url.origin).toBe('http://192.168.0.9:8765')
        expect(url.pathname).toBe('/home')
        expect(url.searchParams.get('app_entry')).toBe('1')
        expect(url.searchParams.get('utm_campaign')).toBe('qr-br')
        expect(url.searchParams.get('utm_content')).toBe('w')
    })

    it('fits QR version 5 at level L on prod, flag on or off (byte capacity 106)', () => {
        for (const migrationOn of [false, true]) {
            const url = starLpQrUrl({
                origin: 'https://peanut.me',
                migrationOn,
                campaign: 'qr-argentina',
                slot: 'close-sticker',
            })
            expect(url.length).toBeLessThanOrEqual(106)
        }
        expect(STAR_LP_QR_LEVEL).toBe('L')
    })
})
