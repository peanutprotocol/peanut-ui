/**
 * Self-tests for the overflow detector (overflow-check.ts): synthetic pages
 * with known clipping shapes, asserting the detector catches every bug shape
 * and stays quiet on every deliberate one. If the detector logic breaks, this
 * fails — not a week of silently-green gate runs.
 */

import { expect, test } from '@playwright/test'
import { findOverflows, type Overflow } from './overflow-check'

async function detect(page: import('@playwright/test').Page, html: string): Promise<Overflow[]> {
    // the viewport meta matters: the base config emulates mobile, and without
    // it the layout viewport falls back to 980px — real app pages always ship
    // the meta, so the synthetic ones must too or document-level overflow
    // (anything under 980px wide) is invisible here
    await page.setContent(
        `<head><meta name="viewport" content="width=device-width, initial-scale=1"></head>` +
            `<body style="margin:0;font-family:sans-serif">${html}</body>`
    )
    return page.evaluate(findOverflows, ['.exempt-me'])
}

test('flags an element clipping its own nowrap text', async ({ page }) => {
    const found = await detect(
        page,
        `<div style="width:100px;overflow:hidden;white-space:nowrap">este texto traducido es demasiado largo</div>`
    )
    expect(found).toHaveLength(1)
    expect(found[0].kind).toBe('clip-x')
})

test('flags the nested shape: full-width nowrap child inside a clipping parent', async ({ page }) => {
    // the child box ends exactly at the parent edge; only its TEXT overflows
    const found = await detect(
        page,
        `<div style="width:100px;overflow:hidden">
            <div style="width:100%;white-space:nowrap">este texto traducido es demasiado largo</div>
        </div>`
    )
    expect(found).toHaveLength(1)
    expect(found[0].kind).toBe('clip-x')
})

test('flags a descendant box crossing the clip edge', async ({ page }) => {
    const found = await detect(
        page,
        `<div style="width:100px;overflow:hidden">
            <span style="display:inline-block;white-space:nowrap">este texto traducido es demasiado largo</span>
        </div>`
    )
    expect(found).toHaveLength(1)
    expect(found[0].kind).toBe('clip-x')
})

test('flags a placeholder wider than its input', async ({ page }) => {
    const found = await detect(page, `<input style="width:80px" placeholder="Nombre de usuario demasiado largo">`)
    expect(found).toHaveLength(1)
    expect(found[0].kind).toBe('placeholder')
})

test('flags vertically clipped text in a fixed-height box', async ({ page }) => {
    const found = await detect(
        page,
        `<div style="width:120px;height:20px;overflow:hidden;line-height:20px">línea uno línea dos línea tres línea cuatro</div>`
    )
    expect(found).toHaveLength(1)
    expect(found[0].kind).toBe('clip-y')
})

test('flags a document that scrolls horizontally with nothing clipped', async ({ page }) => {
    // no element clips, so the per-element scan is blind to this by design
    const found = await detect(page, `<div style="position:absolute;left:0;top:0;width:400px;height:10px"></div>`)
    expect(found).toHaveLength(1)
    expect(found[0].kind).toBe('document-horizontal-scroll')
})

test('stays quiet on deliberate truncation, scrollers, hidden text and exemptions', async ({ page }) => {
    const found = await detect(
        page,
        `
        <div style="width:100px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">0xdec0debad1dec0debad1dec0debad1</div>
        <div style="width:100px;overflow-x:auto;white-space:nowrap">una tabla ancha que se desplaza dentro de su borde</div>
        <span style="position:absolute;width:1px;height:1px;overflow:hidden">solo para lectores de pantalla</span>
        <div class="exempt-me" style="width:100px;overflow:hidden;white-space:nowrap">texto de marquesina en movimiento</div>
        <input style="width:200px" placeholder="Tu usuario">
        <div style="width:200px">texto corto que cabe</div>
        `
    )
    expect(found).toEqual([])
})
