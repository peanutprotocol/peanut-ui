import { expect, test } from '@playwright/test'
import { DEFAULT_LOCALE, ROUTE_SLUGS, SUPPORTED_LOCALES } from '../../src/i18n/config'

test('invalid localized paths return 404 across every locale and marketing route family', async ({ request }) => {
    // Locale routing depends only on the first segment, while the default-locale
    // cases below exercise every marketing family. Cover both dimensions
    // without multiplying identical SSR work into a 100-request matrix.
    const invalidPaths = [
        ...SUPPORTED_LOCALES.map((locale) => `/${locale}/definitely-not-a-real-page`),
        ...ROUTE_SLUGS.map((route) => `/${DEFAULT_LOCALE}/${route}/definitely-not-a-real-page`),
    ]

    for (const path of invalidPaths) {
        const response = await request.get(path)
        expect.soft(response.status(), path).toBe(404)
    }
})

for (const path of ['/send', '/request']) {
    test(`${path} remains a canonical app route`, async ({ request }) => {
        const response = await request.get(path)
        expect(response.status()).toBe(200)
    })
}
