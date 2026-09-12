import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { validateCapture, compare, verifyAsset } from './core.mjs'
export function bundle(directory) {
    const dir = resolve(directory),
        assets = join(dir, 'assets'),
        out = join(dir, 'offline')
    const input = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
    const report = input.type === 'capture' ? validateCapture(input) : compare(input.before, input.after, assets)
    mkdirSync(join(out, 'assets'), { recursive: true })
    const refs = new Set()
    for (const c of report.type === 'capture' ? [report] : [report.before, report.after])
        for (const s of c.screens)
            if (s.status === 'captured') {
                refs.add(s.image)
                refs.add(s.thumbnail)
            }
    if (report.type === 'comparison') for (const s of report.screens) if (s.diff) refs.add(s.diff)
    for (const name of refs) {
        verifyAsset(assets, name)
        copyFileSync(join(assets, name), join(out, 'assets', name))
    }
    const json = JSON.stringify(report)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
    writeFileSync(join(out, 'report.js'), `window.SCREEN_REPORT=${json};`)
    const html = readFileSync('public/screen-library/index.html', 'utf8')
        .replaceAll('/screen-library/', './')
        .replace(
            '<script defer src="./viewer.js">',
            '<script src="./report.js"></script><script defer src="./viewer.js">'
        )
    writeFileSync(join(out, 'index.html'), html)
    for (const name of ['viewer.js', 'viewer.css']) copyFileSync(`public/screen-library/${name}`, join(out, name))
    execFileSync('tar', ['-czf', join(dir, 'offline.tar.gz'), '-C', out, '.'])
    return out
}
if (process.argv[1]?.endsWith('/bundle.mjs')) console.log(bundle(process.argv[2]))
