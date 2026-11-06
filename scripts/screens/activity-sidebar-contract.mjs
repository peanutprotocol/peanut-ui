import assert from 'node:assert/strict'

// The caller supplies a loaded gallery page and, optionally, a way to open a preview.
// Assertions intentionally use accessible names and observable layout rather than implementation selectors.
export async function acceptActivitySidebar(page, { openPreview } = {}) {
    await page.setViewportSize({ width: 1440, height: 900 })
    const trigger = page.getByRole('button', { name: /latest activity/i })
    const panel = page.getByRole('complementary', { name: /latest activity/i })
    const gallery = page.getByRole('main')
    await assertVisible(trigger)
    assert.equal(await panel.isVisible(), false, 'activity starts hidden')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    const before = await gallery.boundingBox()
    assert.ok(before, 'gallery has a measurable layout')
    await trigger.focus()
    await page.keyboard.press('Enter')
    await assertVisible(panel)
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    const after = await gallery.boundingBox()
    const panelBox = await panel.boundingBox()
    assert.ok(after && panelBox, 'open layout is measurable')
    assert.ok(after.width < before.width, 'desktop gallery yields width')
    assert.ok(after.x + after.width <= panelBox.x + 2, 'sidebar does not cover gallery')
    const close = panel.getByRole('button', { name: /close/i })
    await assertVisible(close)
    await close.focus()
    await page.keyboard.press('Enter')
    assert.equal(await panel.isVisible(), false, 'close hides activity')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true, 'close returns focus')
    await page.keyboard.press('Enter')
    await assertVisible(panel)
    await page.keyboard.press('Escape')
    assert.equal(await panel.isVisible(), false, 'Escape hides activity')
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true, 'Escape returns focus')
    await page.setViewportSize({ width: 375, height: 812 })
    await trigger.click()
    await assertVisible(panel)
    await assertVisible(close)
    const narrow = await close.boundingBox()
    assert.ok(
        narrow && narrow.x >= 0 && narrow.x + narrow.width <= 375 && narrow.y >= 0 && narrow.y + narrow.height <= 812,
        'narrow-screen close action is within viewport'
    )
    await close.click()
    assert.equal(await panel.isVisible(), false)
    if (openPreview) {
        await openPreview(page)
        const comments = page.getByRole('dialog').getByRole('button', { name: 'Comments', exact: true })
        await assertVisible(comments)
        await comments.click()
        assert.equal(await panel.isVisible(), false, 'preview Comments does not open Latest activity')
    }
}
async function assertVisible(locator) {
    await locator.waitFor({ state: 'visible', timeout: 5000 })
}
