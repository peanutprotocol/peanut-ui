import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mcpWorkerConfiguration, prepareMcpWorker } from './mcp/prepare.mjs'

const mcpWorkerEnv = {
    SCREEN_LIBRARY_MCP_URL: 'https://screen-library-mcp.peanut.me',
    SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
}

test('MCP Worker is private to a custom Access domain and uses a service binding', () => {
    const config = mcpWorkerConfiguration(mcpWorkerEnv)
    assert.equal(config.workers_dev, false)
    assert.equal(config.preview_urls, false)
    assert.deepEqual(config.routes, [{ pattern: 'screen-library-mcp.peanut.me', custom_domain: true }])
    assert.deepEqual(config.services, [{ binding: 'COLLECTIONS', service: 'peanut-screen-library-collections' }])
    assert.equal(config.vars.SCREEN_LIBRARY_ACCESS_AUD, 'screen-library-access')
})

test('MCP Worker preparation emits the access helper beside the generated entry point', () => {
    const target = mkdtempSync(join(tmpdir(), 'screen-mcp-worker-'))
    try {
        prepareMcpWorker(target, mcpWorkerEnv)
        assert.equal(existsSync(join(target, 'access.mjs')), true)
        assert.equal(existsSync(join(target, 'mcp', 'index.mjs')), true)
        assert.match(readFileSync(join(target, 'mcp', 'index.mjs'), 'utf8'), /\.\.\/access\.mjs/)
    } finally {
        rmSync(target, { recursive: true, force: true })
    }
})

test('MCP Worker refuses a public workers.dev alternate origin', () => {
    assert.throws(
        () =>
            mcpWorkerConfiguration({
                SCREEN_LIBRARY_MCP_URL: 'https://screen-library-mcp.example.workers.dev',
                SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
            }),
        /custom HTTPS origin/
    )
})
