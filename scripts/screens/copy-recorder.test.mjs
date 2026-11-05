import assert from 'node:assert/strict'
import test from 'node:test'
import { shownCopyKeys } from './copy-coverage.mjs'
import { COPY_EVIDENCE_SCRIPT, copyGeometry, installCopyRecorder } from './copy-recorder.mjs'

const geometry = copyGeometry()
const rect = (left, top, right, bottom) => ({ left, top, right, bottom })
const line = (text, left, top, width = 10, height = 20) =>
    [...text].map((character, i) => ({
        text: character,
        rects: character === ' ' ? [] : [rect(left + i * width, top, left + (i + 1) * width, top + height)],
    }))
const viewport = rect(0, 0, 400, 800)

test('paintedText keeps characters whose boxes lie inside the region', () => {
    assert.equal(geometry.paintedText(line('Send money', 0, 0), viewport), 'Send money')
})

test('paintedText drops characters an overflow box clips and never joins words across the gap', () => {
    const box = geometry.intersect(viewport, rect(0, 0, 45, 20))
    const shown = geometry.paintedText(line('Send money now', 0, 0), box)
    assert.equal(shown, 'Send \u0000 \u0000')
    assert.deepEqual(shownCopyKeys({ resolved: [['a.whole', 'Send money now']], corpus: shown }), [])
    assert.deepEqual(shownCopyKeys({ resolved: [['a.start', 'Send']], corpus: shown }), ['a.start'])
})

test('paintedText treats a character straddling the clip edge as hidden', () => {
    assert.equal(geometry.paintedText(line('ab', 0, 0), rect(0, 0, 15, 20)), 'a\u0000')
})

test('paintedText drops a line pushed below a clipped box and characters under an ellipsis', () => {
    const characters = [...line('First line', 0, 0), ...line('second', 0, 20)]
    const clamp = rect(0, 0, 100, 20)
    assert.equal(geometry.paintedText(characters, clamp), 'First line\u0000')
    const ellipsis = geometry.ellipsisArea(rect(0, 0, 100, 20), 16, false, 20)
    assert.equal(geometry.paintedText(line('Truncated!', 0, 0), clamp, [ellipsis]), 'Truncate\u0000')
})

test('paintedText keeps glyphs whose ascent and descent overhang a tight line box', () => {
    assert.equal(geometry.paintedText(line('ab', 0, 0, 10, 20), rect(0, 3, 100, 17)), 'ab')
    assert.equal(geometry.paintedText(line('ab', 0, 0, 10, 20), rect(0, 0, 100, 8)), '\u0000')
})

test('paintedText reads rect edges through getters, as DOMRect exposes them', () => {
    class Box {
        #edges
        constructor(...edges) {
            this.#edges = edges
        }
        get left() {
            return this.#edges[0]
        }
        get top() {
            return this.#edges[1]
        }
        get right() {
            return this.#edges[2]
        }
        get bottom() {
            return this.#edges[3]
        }
    }
    const characters = [{ text: 'a', rects: [new Box(0, 0, 10, 20)] }]
    assert.equal(geometry.paintedText(characters, rect(0, 3, 100, 17)), 'a')
})

test('paintedText hides characters with no painted box', () => {
    assert.equal(geometry.paintedText([{ text: 'x', rects: [rect(5, 5, 5, 25)] }], viewport), '\u0000')
    assert.equal(geometry.paintedText([{ text: 'x', rects: [] }], viewport), '\u0000')
})

test('overflowRegion clips to the padding box only on non-visible axes', () => {
    const box = rect(10, 10, 110, 60)
    const borders = { left: 1, top: 2, right: 3, bottom: 4 }
    assert.equal(geometry.overflowRegion(box, borders, 'visible', 'visible'), null)
    assert.deepEqual(geometry.overflowRegion(box, borders, 'hidden', 'auto'), rect(11, 12, 107, 56))
    assert.deepEqual(geometry.overflowRegion(box, borders, 'clip', 'visible'), rect(11, -Infinity, 107, Infinity))
})

test('clip-path and clip regions follow inset, polygon and rect values', () => {
    const box = rect(0, 0, 200, 100)
    assert.equal(geometry.clipPathRegion(box, 'none'), null)
    assert.deepEqual(geometry.clipPathRegion(box, 'inset(10px 20px)'), rect(20, 10, 180, 90))
    assert.deepEqual(geometry.clipPathRegion(box, 'inset(0px 50% 0px 0px round 8px)'), rect(0, 0, 100, 100))
    assert.deepEqual(geometry.clipPathRegion(box, 'polygon(0% 0%, 50% 0%, 50% 100%)'), rect(0, 0, 100, 100))
    assert.deepEqual(geometry.clipPathRegion(box, 'circle(50% at 50% 50%)'), box)
    assert.deepEqual(geometry.clipRectRegion(box, 'rect(0px, 0px, 0px, 0px)'), rect(0, 0, 0, 0))
    assert.deepEqual(
        geometry.clipRectRegion(box, 'rect(auto, 50px, auto, auto)'),
        rect(-Infinity, -Infinity, 50, Infinity)
    )
    assert.equal(geometry.clipRectRegion(box, 'auto'), null)
})

async function launchChromium() {
    let playwright
    try {
        playwright = await import('@playwright/test')
    } catch {
        return null
    }
    // The screen-tests job installs no Playwright browser; its runner image ships Google Chrome.
    for (const options of [{}, { channel: 'chrome' }])
        try {
            return await playwright.chromium.launch(options)
        } catch {}
    return null
}

const page = `<!doctype html>
<style>
    body { margin: 0; font: 16px/20px sans-serif; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }
</style>
<h1>Visible heading</h1>
<button style="display: inline-flex"><span style="display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1">Tight label</span></button>
<input placeholder="Search contacts" style="width: 300px">
<input placeholder="A placeholder far too long for its tiny input box" style="width: 60px">
<div style="height: 20px; overflow: hidden"><p style="margin: 0">Shown line</p><p style="margin: 0">Clipped away entirely</p></div>
<p style="width: 120px; margin: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2">Line clamp text that spans many lines and the end gets hidden</p>
<div id="ellipsis" style="width: 120px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">Ellipsis truncated sentence here</div>
<button aria-label="Close drawer" title="Close tooltip"><svg width="16" height="16"><title>Close icon</title><rect width="16" height="16" /></svg></button>
<img alt="Peanut logo" width="16" height="16" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
<span class="sr-only">Screen reader only</span>
<div style="height: 0; overflow: hidden"><div style="position: fixed; top: 400px; left: 0">Fixed drawer copy</div></div>
<div style="position: relative; height: 0; overflow: hidden"><div style="position: absolute; top: 0">Hidden absolute copy</div></div>
<div style="height: 0; overflow: hidden"><div style="position: absolute; top: 450px">Escaped absolute copy</div></div>
<div style="clip-path: inset(0 0 100% 0)">Clip path copy</div>
<p style="margin-top: 2000px">Below the fold</p>`

const messages = {
    visible: 'Visible heading',
    tight: 'Tight label',
    search: 'Search contacts',
    longPlaceholder: 'A placeholder far too long for its tiny input box',
    shownLine: 'Shown line',
    clipped: 'Clipped away entirely',
    clamp: 'Line clamp text that spans many lines and the end gets hidden',
    clampStart: 'Line clamp text',
    ellipsisWhole: 'Ellipsis truncated sentence here',
    close: 'Close drawer',
    tooltip: 'Close tooltip',
    icon: 'Close icon',
    logo: 'Peanut logo',
    srOnly: 'Screen reader only',
    fixed: 'Fixed drawer copy',
    hiddenAbsolute: 'Hidden absolute copy',
    escaped: 'Escaped absolute copy',
    clipPath: 'Clip path copy',
    belowFold: 'Below the fold',
}

test('collectCopyEvidence credits only copy painted inside the viewport', async (t) => {
    const browser = await launchChromium()
    if (!browser) return t.skip('No Chromium or Chrome to launch')
    try {
        const tab = await browser.newPage({ viewport: { width: 400, height: 800 } })
        await tab.setContent(page)
        await tab.evaluate(installCopyRecorder)
        await tab.evaluate((catalogue) => {
            const copy = window.__screenCaptureCopy({ app: catalogue })
            for (const key of Object.keys(catalogue)) void copy.app[key]
        }, messages)
        const evidence = await tab.evaluate(COPY_EVIDENCE_SCRIPT)
        assert.equal(evidence.recorded, true)
        assert.deepEqual(
            shownCopyKeys(evidence),
            ['clampStart', 'escaped', 'fixed', 'search', 'shownLine', 'tight', 'visible'].map((key) => `app.${key}`)
        )

        // The ellipsis covers characters that still lie inside the box; none of those may count.
        const inBox = await tab.evaluate(() => {
            const element = document.getElementById('ellipsis')
            const node = element.firstChild
            const right = element.getBoundingClientRect().right
            const range = document.createRange()
            let text = ''
            for (let i = 0; i < node.length; i++) {
                range.setStart(node, i)
                range.setEnd(node, i + 1)
                if (range.getBoundingClientRect().right > right) break
                text += node.nodeValue[i]
            }
            return text
        })
        const painted = evidence.corpus.split('\n').find((part) => part.startsWith('Ellipsis'))
        assert.ok(painted, 'the visible start of the ellipsized text is recorded')
        const prefix = painted.split('\u0000')[0]
        assert.ok(prefix.length < inBox.length, `"${prefix}" stops before the ellipsis that covers "${inBox}"`)
    } finally {
        await browser.close()
    }
})
