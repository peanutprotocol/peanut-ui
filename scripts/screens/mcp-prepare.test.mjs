import test from 'node:test'
import assert from 'node:assert/strict'
import { mcpWorkerConfiguration } from './mcp/prepare.mjs'

test('MCP Worker is private to a custom Access domain and uses a service binding', () => {
    const config = mcpWorkerConfiguration({ SCREEN_LIBRARY_MCP_URL: 'https://screen-library-mcp.peanut.me' })
    assert.equal(config.workers_dev, false)
    assert.equal(config.preview_urls, false)
    assert.deepEqual(config.routes, [{ pattern: 'screen-library-mcp.peanut.me', custom_domain: true }])
    assert.deepEqual(config.services, [{ binding: 'COLLECTIONS', service: 'peanut-screen-library-collections' }])
})

test('MCP Worker refuses a public workers.dev alternate origin', () => {
    assert.throws(
        () => mcpWorkerConfiguration({ SCREEN_LIBRARY_MCP_URL: 'https://screen-library-mcp.example.workers.dev' }),
        /custom HTTPS origin/
    )
})
