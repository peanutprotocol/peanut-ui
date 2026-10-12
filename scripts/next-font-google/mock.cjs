/**
 * Serves next/font/google from the files in this folder instead of Google
 * Fonts, through Next's NEXT_FONT_GOOGLE_MOCKED_RESPONSES hook. CI builds set
 * that variable to this file's absolute path.
 *
 * Why: on 2026-09-24 Google answered a CI build with a font file URL that
 * next/font cannot parse, and the build failed. Stored responses do not change.
 * The CSS is Google's response as stored, with each font file pointed at its
 * stored copy, so the build emits the same fonts and CSS as a live build.
 */
const { execFileSync } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const manifestPath = join(__dirname, 'manifest.json')
const readManifest = () => (existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {})

function storedCss(url) {
    let cssFile = readManifest()[url]
    if (!cssFile) {
        // A next/font/google call changed since the last fetch: get it now, as a live build would.
        execFileSync(process.execPath, [join(__dirname, 'fetch.mjs'), url], { stdio: 'inherit' })
        cssFile = readManifest()[url]
    }
    return readFileSync(join(__dirname, 'css', cssFile), 'utf8').replace(
        /url\(https:\/\/fonts\.gstatic\.com(\/[^)]+)\)/g,
        (_, path) => `url(${join(__dirname, 'files', path)})`
    )
}

// next/font reads each response as mockFile[url].
module.exports = new Proxy(
    {},
    {
        get: (_, url) =>
            typeof url === 'string' && url.startsWith('https://fonts.googleapis.com/') ? storedCss(url) : undefined,
    }
)
