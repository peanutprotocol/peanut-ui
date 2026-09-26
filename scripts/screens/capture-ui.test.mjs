import assert from 'node:assert/strict'
import test from 'node:test'
import { FIXTURE_BANNER_CANDIDATE_SELECTOR, hideFixtureBanners } from './capture-ui.mjs'

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
