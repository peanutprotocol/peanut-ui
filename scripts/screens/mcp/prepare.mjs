import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function mcpWorkerConfiguration(env = process.env) {
    const origin = new URL(env.SCREEN_LIBRARY_MCP_URL)
    if (
        origin.protocol !== 'https:' ||
        origin.pathname !== '/' ||
        origin.search ||
        origin.hash ||
        origin.hostname.endsWith('.workers.dev')
    )
        throw new Error('Configure SCREEN_LIBRARY_MCP_URL as a custom HTTPS origin')
    if (!env.SCREEN_LIBRARY_ACCESS_AUD) throw new Error('Configure SCREEN_LIBRARY_ACCESS_AUD')
    return {
        name: 'peanut-screen-library-mcp',
        main: 'index.mjs',
        compatibility_date: '2026-09-16',
        compatibility_flags: ['nodejs_compat'],
        workers_dev: false,
        preview_urls: false,
        routes: [{ pattern: origin.hostname, custom_domain: true }],
        vars: {
            SCREEN_LIBRARY_MCP_URL: origin.origin,
            SCREEN_LIBRARY_ACCESS_AUD: env.SCREEN_LIBRARY_ACCESS_AUD,
        },
        services: [{ binding: 'COLLECTIONS', service: 'peanut-screen-library-collections' }],
    }
}

export function prepareMcpWorker(targetArg = '.screen-mcp-worker', env = process.env) {
    const target = resolve(targetArg)
    mkdirSync(join(target, 'mcp'), { recursive: true })
    for (const file of ['index.mjs', 'client.mjs'])
        copyFileSync(`scripts/screens/mcp/${file}`, join(target, 'mcp', file))
    // Keep the entry point at the deployment root while preserving relative imports.
    writeFileSync(join(target, 'index.mjs'), "export { default } from './mcp/index.mjs'\n")
    writeFileSync(join(target, 'wrangler.json'), JSON.stringify(mcpWorkerConfiguration(env), null, 2))
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) prepareMcpWorker(process.argv[2])
