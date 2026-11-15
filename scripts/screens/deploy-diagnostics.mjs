import { closeSync, fstatSync, openSync, readSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { pathToFileURL } from 'node:url'

function readLog(path, limit, tail = true) {
    let fd
    try {
        fd = openSync(path, 'r')
        const size = fstatSync(fd).size
        const start = Math.max(0, size - limit)
        // Never parse a tail of structured records: a truncated debug entry
        // could contain text resembling a user-facing record header.
        if (start && !tail) return null
        const buffer = Buffer.alloc(Math.min(size, limit))
        const bytes = readSync(fd, buffer, 0, buffer.length, start)
        const value = buffer.subarray(0, bytes).toString('utf8')
        // A partial line could start halfway through a credential.
        return start ? (value.includes('\n') ? value.slice(value.indexOf('\n') + 1) : '') : value
    } catch (error) {
        if (error.code === 'ENOENT') return ''
        throw error
    } finally {
        if (fd !== undefined) closeSync(fd)
    }
}

export function sanitizeDiagnostics(value, env = process.env) {
    let text = stripVTControlCharacters(value)
    const secrets = Object.entries(env)
        .filter(([key, secret]) => /secret|token|password|api_?key|private_?key|account_?id/i.test(key) && secret)
        .flatMap(([, secret]) => [
            secret,
            stripVTControlCharacters(secret),
            encodeURIComponent(secret),
            JSON.stringify(secret).slice(1, -1),
        ])
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
    for (const secret of new Set(secrets)) text = text.split(secret).join('[REDACTED]')
    return (
        text
            .replace(/\b(Bearer|Basic)\s+[^\s"'<>]+/gi, '$1 [REDACTED]')
            .replace(
                /((?:["']?)(?:[\w-]*(?:token|secret|password|(?:api|private|auth)[_-]?key|account[_-]?id))["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi,
                '$1[REDACTED]'
            )
            .replace(/\b[a-f0-9]{32}\b/gi, '[REDACTED]')
            .replace(/\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b/gi, '[REDACTED]')
            .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[REDACTED]')
            .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
            .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[REDACTED]')
            // Strip controls and prefix every line so text cannot issue Actions commands.
            .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '')
    )
}

export function wranglerMessages(log) {
    // Only user-facing records. Debug entries can contain HTTP bodies, headers
    // and configuration; never use the raw private log as a failure fallback.
    return [...log.matchAll(/^--- \d{4}-\d\d-\d\dT[\d:.]+Z (\w+)\n([\s\S]*?)\n---(?:\n|$)/gm)]
        .filter((record) => ['log', 'info', 'warn', 'error'].includes(record[1]))
        .map((record) => record[2])
        .join('\n')
}

const directory = process.argv[2]
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url && directory) {
    const consoleText = readLog(join(directory, 'console.log'), 128 * 1024)
    const privateLog = process.argv[3] !== '0' ? readLog(join(directory, 'wrangler.log'), 4 * 1024 * 1024, false) : ''
    const privateText =
        privateLog === null
            ? 'Wrangler private log exceeds the 4 MiB safe read limit; only console diagnostics are available.'
            : wranglerMessages(privateLog)
    const sanitized = sanitizeDiagnostics([consoleText, privateText].filter(Boolean).join('\n'))
    const bounded =
        sanitized.length > 64 * 1024
            ? sanitized
                  .slice(-64 * 1024)
                  .split('\n')
                  .slice(1)
                  .join('\n')
            : sanitized
    for (const line of bounded.split('\n')) if (line.trim()) process.stdout.write(`diagnostic: ${line}\n`)
}
