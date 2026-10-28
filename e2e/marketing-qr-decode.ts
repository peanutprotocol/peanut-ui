import type { BrowserContext, Locator } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export async function decodeQr(context: BrowserContext, element: Locator, baseURL: string): Promise<string> {
    // Inline stickers drop in with a framer-motion spring, which `animations: 'disabled'` does not
    // stop. Decode the resting pose a person scans, not a frame from the middle of the drop.
    let previousBox = ''
    for (let attempt = 0; attempt < 20; attempt++) {
        const box = JSON.stringify(await element.boundingBox())
        if (box === previousBox) break
        previousBox = box
        await element.page().waitForTimeout(150)
    }
    // Decode pixels from the rendered QR, not its DOM data attribute or source URL.
    const png = await element.screenshot({ animations: 'disabled' })
    const modulePath = path.dirname(require.resolve('qr-scanner'))
    const decoder = await context.newPage()
    await decoder.route('**/__marketing-qr-decoder/**', async (route) => {
        const name = new URL(route.request().url()).pathname.split('/').pop()
        if (name === 'index.html') {
            await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local QR decoder</title>' })
            return
        }
        if (name === 'qr-scanner.min.js' || name === 'qr-scanner-worker.min.js') {
            await route.fulfill({ contentType: 'text/javascript', body: await readFile(path.join(modulePath, name)) })
            return
        }
        await route.abort()
    })
    try {
        await decoder.goto(`${baseURL}/__marketing-qr-decoder/index.html`)
        return await decoder.evaluate(async (data) => {
            const moduleUrl = new URL('qr-scanner.min.js', window.location.href).href
            const { default: QrScanner } = await import(/* webpackIgnore: true */ moduleUrl)
            const result = await QrScanner.scanImage(`data:image/png;base64,${data}`, {
                returnDetailedScanResult: true,
            })
            return result.data
        }, png.toString('base64'))
    } finally {
        await decoder.close()
    }
}
