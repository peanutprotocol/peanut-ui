/** @jest-environment node */

// A main push that changes only release-web-only-paths.json paths starts no OTA
// and no store build (release-ota.yml paths-ignore). That is safe only while no
// app bundle contains those files. These tests hold the two ways in: a route
// the native build keeps, and a reference from app code.

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..')
const WEB_ONLY_PATHS = require('../release-web-only-paths.json')
const { ITEMS_TO_DISABLE } = require('../native-build.js')

// The routes and folders that may reference each other.
const ALLOWED_DIRS = ['src/app/go/', 'src/app/c/', 'src/features/go-links/', 'src/features/creator-pages/']
// src/content is the content submodule (Markdown, web only).
const SKIPPED_DIRS = ['src/content/']
const SCANNED = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|json)$/
// A module path or URL with a `go-links` or `creator-pages` segment, in any
// import, import(), next/dynamic, require() or asset URL.
const REFERENCE = /(^|[/'"`@])(go-links|creator-pages)(?=[/'"`]|$)/m

function filesUnder(dir) {
    return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
        const rel = `${dir}/${entry.name}`
        if (entry.isDirectory()) return SKIPPED_DIRS.includes(`${rel}/`) ? [] : filesUnder(rel)
        return entry.isFile() && SCANNED.test(entry.name) ? [rel] : []
    })
}

it('keeps every web-only src/app route out of the native build while it exists', () => {
    const routes = WEB_ONLY_PATHS.filter((pattern) => /^src\/app\/[^/]+\/\*\*$/.test(pattern))
    expect(routes.length).toBeGreaterThan(0)
    for (const pattern of routes) {
        const route = pattern.slice('src/app/'.length, -'/**'.length)
        const disabled = ITEMS_TO_DISABLE.some((item) => item.path === route && item.type === 'dir')
        // A listed route that does not exist yet cannot reach the bundle. Once its
        // folder lands, the native build must strip it in the same change.
        const exists = fs.existsSync(path.join(ROOT, 'src', 'app', route))
        expect([pattern, disabled || !exists]).toEqual([pattern, true])
    }
})

it('finds no reference to the web-only feature folders outside them', () => {
    const hits = filesUnder('src')
        .filter((file) => !ALLOWED_DIRS.some((dir) => file.startsWith(dir)))
        .filter((file) => REFERENCE.test(fs.readFileSync(path.join(ROOT, file), 'utf8')))
    expect(hits).toEqual([])
})

it('matches static, dynamic and require references and asset URLs', () => {
    for (const source of [
        "import { GO_REDIRECTS } from '@/features/go-links/go-map'",
        "const page = dynamic(() => import('../creator-pages/Page'))",
        "const map = require('@/features/go-links')",
        'const src = `/creator-pages/nita.webp`',
        "background: url('/creator-pages/hero.png')",
    ]) {
        expect([source, REFERENCE.test(source)]).toEqual([source, true])
    }
    for (const source of ["import x from '@/features/go-linkshelper'", "const id = 'my-creator-pages-list'"]) {
        expect([source, REFERENCE.test(source)]).toEqual([source, false])
    }
})
