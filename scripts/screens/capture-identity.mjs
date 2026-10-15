import { execFileSync } from 'node:child_process'
import { knownNonvisual } from './capture-plan.mjs'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export function fileIdentity(paths, read = readFileSync) {
    const digest = createHash('sha256').update('screen-capture-identity-v2\0')
    const frame = (bytes) => {
        const length = Buffer.alloc(8)
        length.writeBigUInt64BE(BigInt(bytes.byteLength))
        digest.update(length).update(bytes)
    }
    for (const path of [...new Set(paths)].sort()) {
        const bytes = read(path)
        if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array))
            throw new Error('Capture identity requires raw file bytes')
        frame(Buffer.from(path, 'utf8'))
        frame(bytes)
    }
    return digest.digest('hex')
}

/** Installed packages/build output must not distinguish the same committed harness. */
export function harnessIdentityFiles(trackedFiles) {
    const files =
        trackedFiles ??
        execFileSync('git', ['ls-files', '--cached', '-z'], {
            encoding: 'utf8',
            timeout: 60000,
            maxBuffer: 16 * 1024 * 1024,
        })
            .split('\0')
            .filter(Boolean)
    if (!Array.isArray(files) || files.length > 20000 || files.some((path) => typeof path !== 'string'))
        throw new Error('Invalid tracked harness inventory')
    return [...new Set(files)]
        .filter(
            (path) =>
                (['pnpm-lock.yaml', 'package.json'].includes(path) ||
                    /^(?:scripts\/(?:screens|next-font-google)\/|src\/dev\/(?:screens|surfaces)\/)/.test(path)) &&
                !/(?:^|\/)(?:node_modules|\.next|\.cache|__shots__)\//.test(path) &&
                !knownNonvisual(path)
        )
        .sort()
}
