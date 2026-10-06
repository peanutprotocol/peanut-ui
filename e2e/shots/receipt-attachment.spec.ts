import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fixtureHref, FIXTURE_STORAGE_KEY } from '../../src/dev/fixtures/active'
import { FIXTURES } from '../../src/dev/fixtures/registry'
import { blockExternal, FREEZE_CSS, FROZEN_NOW, seenOnceModals } from './fixture-page'

const ATTACHMENT_URL = 'https://peanut-notes.s3.eu-north-1.amazonaws.com/fixture-receipt.pdf'
const OUT_DIR = process.env.RECEIPT_SHOTS_OUT ?? process.env.SHOTS_OUT ?? 'e2e/__shots__/receipt-attachment'

// a complete blank pdf, including byte offsets, so the saved download is a real file.
function blankPdf(): Buffer {
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>',
        '<< /Length 0 >>\nstream\nendstream',
    ]
    let pdf = '%PDF-1.4\n'
    const offsets = objects.map((object, index) => {
        const offset = Buffer.byteLength(pdf)
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
        return offset
    })
    const xref = Buffer.byteLength(pdf)
    pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
    pdf += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    return Buffer.from(pdf)
}

const PDF = blankPdf()

test.beforeEach(async ({ page }) => {
    await blockExternal(page)
    // the drawer also prefetches its generated receipt pdf. keep that separate action
    // available without sending the synthetic entry to a real backend.
    await page.route('**/receipt/fixture-receipt-attachment/pdf?*', (route) =>
        route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF })
    )
    await page.clock.setFixedTime(FROZEN_NOW)
    await page.addInitScript(seenOnceModals)
})

async function openReceipt(page: Page, name = 'history-receipt-attachment'): Promise<Locator> {
    await page.goto(fixtureHref(FIXTURES[name].route, name), { waitUntil: 'domcontentloaded' })
    await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), FIXTURE_STORAGE_KEY)).toBe(name)
    expect(new URL(page.url()).pathname).toBe('/history')
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('Dinner', { exact: true })).toBeVisible()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.addStyleTag({ content: `${FREEZE_CSS}\n[data-fixture-banner] { display: none !important; }` })
    return drawer
}

function attachmentRow(drawer: Locator): Locator {
    return drawer.locator('.ds-data-row').filter({ hasText: /^Attachment/ })
}

async function capture(page: Page, state: string, testInfo: TestInfo, detail?: Locator): Promise<void> {
    await mkdir(OUT_DIR, { recursive: true })
    const name = `receipt-attachment-${state}@${testInfo.project.name}`
    const path = join(OUT_DIR, `${name}.png`)
    await page.screenshot({ path, animations: 'disabled', scale: 'css' })
    await testInfo.attach(name, { path, contentType: 'image/png' })
    const box = detail && (await detail.boundingBox())
    if (detail && box && (box.y < 0 || box.y + box.height > (page.viewportSize()?.height ?? 667))) {
        await detail.scrollIntoViewIfNeeded()
        const detailPath = join(OUT_DIR, `${name}-detail.png`)
        await page.screenshot({ path: detailPath, animations: 'disabled', scale: 'css' })
        await testInfo.attach(`${name}-detail`, { path: detailPath, contentType: 'image/png' })
    }
}

test('receipt attachment loads and downloads the fetched PDF', async ({ page }, testInfo) => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => (release = resolve))
    await page.route(ATTACHMENT_URL, async (route) => {
        await pending
        await route.fulfill({
            status: 200,
            contentType: 'application/pdf',
            headers: { 'access-control-allow-origin': '*' },
            body: PDF,
        })
    })
    try {
        const drawer = await openReceipt(page)
        const row = attachmentRow(drawer)
        await expect(row.getByRole('status')).toBeVisible()
        await expect(row.getByRole('button', { name: 'Download' })).toHaveCount(0)
        await capture(page, 'loading', testInfo, row)
        release()
        const downloadButton = row.getByRole('button', { name: 'Download', exact: true })
        await expect(downloadButton).toBeEnabled()
        await capture(page, 'ready', testInfo, row)
        const downloadEvent = page.waitForEvent('download')
        await downloadButton.click()
        const download = await downloadEvent
        expect(download.suggestedFilename()).toBe('peanut-attachment.pdf')
        const savedPath = testInfo.outputPath('peanut-attachment.pdf')
        await download.saveAs(savedPath)
        expect(await readFile(savedPath)).toEqual(PDF)
        expect(new URL(page.url()).pathname).toBe('/history')
    } finally {
        release()
    }
})

for (const response of [
    { name: '404', status: 404 },
    { name: 'html', status: 200 },
]) {
    test(`receipt attachment rejects ${response.name} and retries`, async ({ page }, testInfo) => {
        let attempts = 0
        await page.route(ATTACHMENT_URL, (route) => {
            attempts += 1
            return route.fulfill({
                headers: { 'access-control-allow-origin': '*' },
                ...(attempts === 1
                    ? { status: response.status, contentType: 'text/html', body: '<html>File not found</html>' }
                    : { status: 200, contentType: 'application/pdf', body: PDF }),
            })
        })
        const drawer = await openReceipt(page)
        const row = attachmentRow(drawer)
        await expect(row.getByRole('alert')).toHaveText('Attachment is unavailable. Try again or contact support.')
        await expect(row.getByRole('button', { name: 'Download' })).toHaveCount(0)
        await capture(page, `${response.name}-error`, testInfo, row)
        await row.getByRole('button', { name: 'Try again', exact: true }).click()
        await expect(row.getByRole('button', { name: 'Download', exact: true })).toBeEnabled()
        expect(attempts).toBe(2)
        expect(new URL(page.url()).pathname).toBe('/history')
        await capture(page, `${response.name}-recovered`, testInfo, row)
    })
}

test('receipt without an attachment has no attachment row', async ({ page }, testInfo) => {
    let attachmentRequests = 0
    await page.route(ATTACHMENT_URL, (route) => {
        attachmentRequests += 1
        return route.abort()
    })
    const drawer = await openReceipt(page, 'history-receipt-no-attachment')
    await expect(attachmentRow(drawer)).toHaveCount(0)
    expect(attachmentRequests).toBe(0)
    await capture(page, 'absent', testInfo)
})
