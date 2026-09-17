import test from 'node:test'
import assert from 'node:assert/strict'
import { routePatternFor } from './routes.mjs'
test('literal prefixes beat a shorter dynamic route even when ending in a catch-all', () => {
    const routes = ['/pay/[...recipient]', '/[locale]/[country]', '/[...recipient]', '/pay/request']
    assert.equal(routePatternFor('/pay/demo', routes), '/pay/[...recipient]')
    assert.equal(routePatternFor('/pay/request', routes), '/pay/request')
    assert.equal(routePatternFor('/demo', routes), '/[...recipient]')
    assert.equal(routePatternFor('/en/argentina', routes), '/[locale]/[country]')
})
