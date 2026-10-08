export const FIXTURE_BANNER_CANDIDATE_SELECTOR = '[data-testid="fixture-banner"], [role="alert"], [role="status"]'

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
