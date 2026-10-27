import { render } from '@testing-library/react'
import { QrArgentinaScanFrame } from '../pages/QrArgentinaScanFrame'

const scanBar = (container: HTMLElement) => container.querySelector('.bg-pink-500')

describe('QrArgentinaScanFrame', () => {
    it('sweeps a scan line over the sticker by default', () => {
        const { container } = render(
            <QrArgentinaScanFrame>
                <p>sticker</p>
            </QrArgentinaScanFrame>
        )
        expect(scanBar(container)).not.toBeNull()
    })

    it('draws only the corners without the scan line, and takes a wider frame', () => {
        const { container, getByText } = render(
            <QrArgentinaScanFrame scanLine={false} className="w-full md:w-120">
                <p>two stickers</p>
            </QrArgentinaScanFrame>
        )
        expect(scanBar(container)).toBeNull()
        expect(getByText('two stickers')).toBeInTheDocument()
        const frame = container.firstElementChild as HTMLElement
        expect(frame.className).toContain('w-full')
        expect(frame.className).toContain('md:w-120')
        expect(frame.className).not.toMatch(/\bw-52\b/)
        // the four corners still lock in
        expect(frame.querySelectorAll(':scope > span.size-10')).toHaveLength(4)
    })
})
