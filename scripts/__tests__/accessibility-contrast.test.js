const fs = require('fs')
const path = require('path')
const css = fs.readFileSync(path.join(__dirname, '../../src/styles/globals.css'), 'utf8')
// Measure shipped semantic colors, including alpha compositing on badge fills.
const colors = Object.fromEntries(
    [...css.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6}(?:[\da-f]{2})?);/gi)].map((m) => [m[1], m[2]]).reverse()
)
const rgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
const luminance = (channels) =>
    channels
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
const ratio = (foreground, background) => {
    const bg = rgb(background)
    const alpha = foreground.length === 9 ? parseInt(foreground.slice(7), 16) / 255 : 1
    const fg = rgb(foreground).map((c, i) => c * alpha + bg[i] * (1 - alpha))
    const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
    return (light + 0.05) / (dark + 0.05)
}

describe('accessible semantic text colors', () => {
    it.each(['background-default', 'background-page'])(
        'body, placeholder and error text meet 4.5:1 on %s',
        (background) => {
            for (const foreground of ['foreground-primary', 'foreground-secondary', 'foreground-error']) {
                expect(ratio(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5)
            }
            expect(ratio(colors['action-focus'], colors[background])).toBeGreaterThanOrEqual(3)
            expect(ratio(colors['border-error'], colors[background])).toBeGreaterThanOrEqual(3)
        }
    )
    it.each(['success', 'attention', 'error', 'info', 'accent', 'helper'])('%s status text meets 4.5:1', (status) => {
        expect(
            ratio(colors['foreground-over-color-secondary'], colors[`background-badge-${status}`])
        ).toBeGreaterThanOrEqual(4.5)
    })
})
