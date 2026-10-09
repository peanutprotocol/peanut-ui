export const FIXTURE_BANNER_CANDIDATE_SELECTOR = '[data-testid="fixture-banner"], [role="alert"], [role="status"]'

// Vaul keeps will-change:transform after its opening animation. That retains
// a separately rasterized layer: equal final layouts can produce different
// image resampling and text edges depending on when the layer was painted.
// Drop the promotion for stills, while retaining all product geometry/styles.
export const CAPTURE_STATIC_CSS = `
*,*::before,*::after {
    animation:none!important;
    transition:none!important;
    will-change:auto!important;
    caret-color:transparent!important;
    scroll-behavior:auto!important;
}
[data-testid="fixture-banner"],a[href*="__fixture=off"] { display:none!important; }
`

/**
 * Finish finite overlay motion before cancelling CSS animations for stills.
 * @param {Document | void} [root]
 */
export function finishOverlayAnimations(root) {
    for (const overlay of (root ?? document).querySelectorAll('[role="dialog"], [role="listbox"]')) {
        for (const animation of overlay.getAnimations({ subtree: true })) {
            if (animation.playState !== 'finished' && Number.isFinite(animation.effect?.getComputedTiming().endTime))
                animation.finish()
        }
    }
}

/**
 * Hide only the fixture safety notice before capture. Product alerts and
 * notifications remain visible because they are legitimate screen states.
 *
 * The text fallback keeps before/after comparisons compatible with revisions
 * that predate the dedicated test id.
 */
export function hideFixtureBanners(elements) {
    for (const element of elements) {
        const fixtureTestId = element.getAttribute('data-testid') === 'fixture-banner'
        const role = element.getAttribute('role')
        const legacyFixtureBanner =
            (role === 'alert' || role === 'status') &&
            element.textContent?.includes('API responses on this page are simulated.')
        if (fixtureTestId || legacyFixtureBanner) element.style.setProperty('display', 'none', 'important')
    }
}
