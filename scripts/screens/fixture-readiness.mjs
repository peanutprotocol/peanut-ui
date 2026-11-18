export async function waitForFixtureReady(page, selector) {
    if (selector) await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15000 })
}

/** Scroll as a user can, then verify a fixed footer does not cover the checkpoint. */
export async function revealCheckpoint(page, selector) {
    const target = page.locator(selector).first()
    await target.waitFor({ state: 'visible', timeout: 15000 })
    await target.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await target.click({ trial: true, timeout: 5000 })
}
