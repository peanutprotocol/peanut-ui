/** @jest-environment node */
import { STAR_LP_QR_LEVEL, starLpQrUrl } from '@/components/Marketing/StarLp/starLpQr.utils'

describe('starLpQrUrl', () => {
    it('uses the app-entry path DownloadQR uses, tagged with the page and slot', () => {
        const url = new URL(
            starLpQrUrl({
                origin: 'http://192.168.0.9:8765',
                campaign: 'qr-brazil',
                slot: 'ways-in',
            })
        )
        expect(url.origin).toBe('http://192.168.0.9:8765')
        expect(url.pathname).toBe('/home')
        expect(url.searchParams.get('app_entry')).toBe('1')
        expect(url.searchParams.get('utm_source')).toBe('star-lp')
        expect(url.searchParams.get('utm_medium')).toBe('content')
        expect(url.searchParams.get('utm_campaign')).toBe('qr-br')
        expect(url.searchParams.get('utm_content')).toBe('w')
    })

    it('tags the homepage stickers with their own one-letter slot', () => {
        const url = new URL(
            starLpQrUrl({ origin: 'https://peanut.me', campaign: 'qr-argentina', slot: 'home-sticker' })
        )
        expect(url.searchParams.get('utm_campaign')).toBe('qr-ar')
        expect(url.searchParams.get('utm_content')).toBe('m')
    })

    it('fits QR version 5 at level L on prod (byte capacity 106)', () => {
        for (const slot of ['hero-sticker', 'close-sticker', 'ways-in', 'home-sticker'] as const) {
            for (const campaign of ['qr-argentina', 'qr-brazil'] as const) {
                expect(starLpQrUrl({ origin: 'https://peanut.me', campaign, slot }).length).toBeLessThanOrEqual(106)
            }
        }
        expect(STAR_LP_QR_LEVEL).toBe('L')
    })
})
