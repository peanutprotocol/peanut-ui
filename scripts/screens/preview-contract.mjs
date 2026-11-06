import assert from 'node:assert/strict'

/**
 * Playwright contract assertions for the enlarged screen preview.
 *
 * The adapter bridges synthetic-report setup and product-specific navigation:
 * openViewer(page), closeDiscussion(page) are required. Optional locator factories
 * commentsButton, discussionPanel, preview receive page. Optional actions are
 * closeViewer, openSingleScreenshot, openEqualSourcePair, switchMode, navigateScreen.
 * Verdict adapters: countVerdictGroups(page), isAfterScreenshotEligible(page),
 * isBeforeScreenshotEligible(page), assertVerdictEligibility(page). eligibleHistory defaults to true.
 */
export async function assertScreenLibraryPreviewContract(page, adapter) {
    assert.equal(typeof adapter?.openViewer, 'function', 'adapter.openViewer(page) is required')
    assert.equal(typeof adapter?.closeDiscussion, 'function', 'adapter.closeDiscussion(page) is required')

    const button = (name) => page.getByRole('button', { name, exact: true })
    const comments = adapter.commentsButton?.(page) ?? button('Comments')
    const discussion =
        adapter.discussionPanel?.(page) ?? page.getByRole('complementary', { name: 'Screen discussion', exact: true })
    const preview = adapter.preview?.(page) ?? page.getByRole('img', { name: /screen preview/i }).first()

    await adapter.openViewer(page)
    if (adapter.eligibleHistory !== false) await button('History').waitFor({ state: 'visible' })
    else assert.equal(await button('History').count(), 0, 'History must be absent when ineligible')

    await button('Close').waitFor({ state: 'visible' })
    assert.equal(await comments.count(), 1, 'viewer must expose exactly one Comments control')
    await comments.waitFor({ state: 'visible' })
    assert.equal(await discussion.count(), 0, 'discussion must start closed when the viewer opens')

    // Keyboard focus must be both keyboard-visible and visibly styled.
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    assert.ok(await focused.count(), 'Tab should move focus to an interactive viewer control')
    assert.equal(
        await focused.evaluate((el) => el.matches(':focus-visible')),
        true,
        'keyboard-focused controls must match :focus-visible'
    )
    const focusStyle = await focused.evaluate((el) => {
        const s = getComputedStyle(el)
        return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow, border: s.border }
    })
    const hasVisibleFocusStyle =
        (focusStyle.outlineStyle !== 'none' && parseFloat(focusStyle.outlineWidth) > 0) ||
        focusStyle.boxShadow !== 'none' ||
        focusStyle.border !== 'none'
    assert.equal(hasVisibleFocusStyle, true, 'keyboard focus must have a visible outline, shadow, or border')

    await comments.click()
    await discussion.waitFor({ state: 'visible' })
    assert.notEqual(await discussion.getAttribute('aria-hidden'), 'true', 'visible discussion cannot be aria-hidden')
    assert.equal(
        await discussion.evaluate((el) => el.contains(document.activeElement)),
        true,
        'opening discussion must move focus into the panel'
    )

    await discussion.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
    const panelBox = await discussion.boundingBox()
    const viewport = page.viewportSize()
    assert.ok(panelBox && viewport, 'discussion and viewport must have measurable geometry')
    assert.ok(
        Math.abs(panelBox.height - viewport.height) <= 2,
        `discussion should span viewport height (${panelBox.height}px vs ${viewport.height}px)`
    )
    assert.ok(panelBox.x + panelBox.width >= viewport.width - 2, 'discussion must be anchored to the right edge')

    if (viewport.width >= 700) {
        const previewBox = await preview.boundingBox()
        assert.ok(previewBox, 'desktop preview must remain measurable')
        const overlaps =
            previewBox.x < panelBox.x + panelBox.width &&
            previewBox.x + previewBox.width > panelBox.x &&
            previewBox.y < panelBox.y + panelBox.height &&
            previewBox.y + previewBox.height > panelBox.y
        assert.equal(overlaps, false, 'discussion must consume layout width without overlapping preview')
        assert.ok(
            previewBox.x + previewBox.width <= panelBox.x + 2,
            'preview layout must end before the discussion panel begins'
        )
    } else {
        // The preview may move offscreen on mobile; discussion controls remain operable.
        const closeDiscussion = discussion.getByRole('button', { name: /close/i }).first()
        await closeDiscussion.waitFor({ state: 'visible' })
        await closeDiscussion.click()
        await discussion.waitFor({ state: 'hidden' })
        await comments.click()
        await discussion.waitFor({ state: 'visible' })
    }

    await adapter.closeDiscussion(page)
    await discussion.waitFor({ state: 'hidden' })
    assert.equal(
        await comments.evaluate((el) => el === document.activeElement),
        true,
        'closing discussion must return focus to Comments'
    )
    assert.ok(await preview.boundingBox(), 'closing discussion must restore the preview layout')

    // Reduced motion must remove slide transitions and animations.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await comments.click()
    await discussion.waitFor({ state: 'visible' })
    const durations = await discussion.evaluate((el) => {
        const s = getComputedStyle(el)
        return [s.transitionDuration, s.animationDuration]
    })
    const seconds = (value) =>
        value.split(',').map((part) => {
            const v = part.trim()
            return v.endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v)
        })
    assert.ok(
        seconds(durations[0]).every((n) => n === 0),
        `reduced motion must disable slide transitions (got ${durations[0]})`
    )
    assert.ok(
        seconds(durations[1]).every((n) => n === 0),
        `reduced motion must disable animations (got ${durations[1]})`
    )
    await adapter.closeDiscussion(page)
    await discussion.waitFor({ state: 'hidden' })

    // One screenshot has no verdict controls. Equal-source pairs get at most one group;
    // the after screenshot, and only the after screenshot, is eligible for a vote.
    if (adapter.openSingleScreenshot && adapter.openEqualSourcePair && adapter.countVerdictGroups) {
        await adapter.openSingleScreenshot(page)
        assert.equal(await adapter.countVerdictGroups(page), 0, 'single screenshot must not expose verdict controls')
        await adapter.openEqualSourcePair(page)
        assert.ok(
            (await adapter.countVerdictGroups(page)) <= 1,
            'paired equal source images may expose at most one verdict control group'
        )
        if (adapter.isAfterScreenshotEligible) {
            assert.equal(await adapter.isAfterScreenshotEligible(page), true, 'after screenshot must be vote eligible')
        }
        if (adapter.isBeforeScreenshotEligible) {
            assert.equal(
                await adapter.isBeforeScreenshotEligible(page),
                false,
                'before screenshot must not be vote eligible'
            )
        }
        if (adapter.assertVerdictEligibility) await adapter.assertVerdictEligibility(page)
    }

    // Mode changes and screen navigation must not duplicate shared viewer controls.
    for (const action of [adapter.switchMode, adapter.navigateScreen]) {
        if (!action) continue
        await action(page)
        assert.equal(await button('Close').count(), 1, 'viewer must retain one Close control')
        assert.equal(await comments.count(), 1, 'viewer must retain one Comments control')
    }
    if (adapter.closeViewer) await adapter.closeViewer(page)
}

/** Negative assertion for an explicitly ineligible state, such as History. */
export async function assertPreviewControlAbsent(page, name) {
    assert.equal(
        await page.getByRole('button', { name, exact: true }).count(),
        0,
        `${name} must be absent in this ineligible state`
    )
}
