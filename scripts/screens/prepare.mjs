/** Capture-only overlay. Never copy product components/styles between revisions. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { hash } from './core.mjs'
export function prepare(source) {
    const recordPath = join(source, '.screen-capture-adapter.json')
    const previous = existsSync(recordPath) ? JSON.parse(readFileSync(recordPath, 'utf8')).changed : []
    const changed = []
    const edit = (path, transform) => {
        const full = join(source, path)
        if (!existsSync(full)) return
        const before = readFileSync(full, 'utf8'),
            after = transform(before)
        if (before !== after) {
            writeFileSync(full, after)
            changed.push({ path, before: hash(before), after: hash(after) })
        }
    }
    edit('next.config.js', (s) => {
        if (s.includes('screen-capture-cache-v1')) return s
        return s.replace(
            /webpack:\s*\(config,\s*[^)]*\)\s*=>\s*\{/,
            `$&
        /* screen-capture-cache-v1 */
        if (process.env.SCREEN_CAPTURE_BUILD === '1') config.cache = false`
        )
    })
    const marker = '/* screen-capture-adapter-v1 */'
    edit('src/utils/api-fetch.ts', (s) => {
        if (s.includes(marker)) return s
        const anchor = /async function callApi\([^)]*\): Promise<Response> \{/
        if (!anchor.test(s)) throw new Error('Historical API entry shape is unsupported')
        return s.replace(
            anchor,
            `$&\n    ${marker}\n    if (typeof window !== 'undefined' && (window as unknown as {__screenCapture?: boolean}).__screenCapture) {\n        return fetch('/screen-capture-api' + path, options)\n    }`
        )
    })
    // Apply the same synthetic-wallet transport behavior as modern fixture mode.
    // Do not change isDemoMode globally: that would also hide product UI banners.
    for (const path of [
        'src/context/kernelClient.context.tsx',
        'src/hooks/wallet/useWallet.ts',
        'src/services/websocket.ts',
    ])
        edit(path, (s) => {
            if (s.includes(marker)) return s
            return s.replaceAll(
                'isDemoMode()',
                `(isDemoMode() || (typeof window !== 'undefined' && (window as unknown as {__screenCapture?: boolean}).__screenCapture === true)) ${marker}`
            )
        })
    const records = new Map(previous.map((entry) => [entry.path, entry]))
    for (const entry of changed) records.set(entry.path, entry)
    writeFileSync(recordPath, JSON.stringify({ version: 1, changed: [...records.values()] }, null, 2))
    return changed
}
if (process.argv[1]?.endsWith('/prepare.mjs')) prepare(process.argv[2])
