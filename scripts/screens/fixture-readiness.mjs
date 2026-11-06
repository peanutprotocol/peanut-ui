export async function waitForFixtureReady(page, selector) {
    if (selector) await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15000 })
}
