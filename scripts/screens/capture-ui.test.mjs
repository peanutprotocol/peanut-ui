import assert from 'node:assert/strict'
import test from 'node:test'
import {
    CAPTURE_STATIC_CSS,
    FIXTURE_BANNER_CANDIDATE_SELECTOR,
    finishOverlayAnimations,
    hideFixtureBanners,
} from './capture-ui.mjs'

test('capture finishes finite overlay motion and leaves looping animations for static CSS', () => {
    const finished = []
    const animation = (name, endTime, playState = 'running') => ({
        playState,
        effect: { getComputedTiming: () => ({ endTime }) },
        finish: () => finished.push(name),
    })
    finishOverlayAnimations({
        querySelectorAll: () => [
            {
                getAnimations: () => [
                    animation('drawer', 500),
                    animation('popover', 150),
                    animation('already-finished', 500, 'finished'),
                    animation('spinner', Infinity),
                ],
            },
        ],
    })
    assert.deepEqual(finished, ['drawer', 'popover'])
    assert.match(CAPTURE_STATIC_CSS, /will-change:auto!important/)
    assert.doesNotMatch(CAPTURE_STATIC_CSS, /transform\s*:|opacity\s*:|filter\s*:/)
})

const element = ({ testId, role = 'alert', text = '' }) => {
    const declarations = []
    return {
        textContent: text,
        getAttribute(name) {
            if (name === 'data-testid') return testId ?? null
            if (name === 'role') return role
            return null
        },
        style: {
            setProperty(...args) {
                declarations.push(args)
            },
        },
        declarations,
    }
}

test('capture hides current and historical fixture banners without hiding product notifications', () => {
    const current = element({ testId: 'fixture-banner', text: 'Fixture mode' })
    const historical = element({ text: 'API responses on this page are simulated.' })
    const productAlert = element({ text: 'Your transfer failed. Try again.' })

    hideFixtureBanners([current, historical, productAlert])

    assert.deepEqual(current.declarations, [['display', 'none', 'important']])
    assert.deepEqual(historical.declarations, [['display', 'none', 'important']])
    assert.deepEqual(productAlert.declarations, [])
    assert.match(FIXTURE_BANNER_CANDIDATE_SELECTOR, /fixture-banner/)
})
