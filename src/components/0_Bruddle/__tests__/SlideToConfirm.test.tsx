import { fireEvent, render, screen } from '@testing-library/react'
import SlideToConfirm from '../SlideToConfirm'

// the track measures itself via clientWidth (0 in jsdom); give it a real width
// so maxTravel = 200 - 40 - 6 = 154px
const TRACK_WIDTH = 200
let clientWidthSpy: jest.SpyInstance

beforeAll(() => {
    clientWidthSpy = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => TRACK_WIDTH)
})

afterAll(() => {
    clientWidthSpy.mockRestore()
})

const getHandle = (label: string) => screen.getByRole('button', { name: label })

describe('SlideToConfirm', () => {
    it('does not confirm on Enter or Space (no instant keyboard confirm)', () => {
        const onConfirm = jest.fn()
        render(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} />)
        const handle = getHandle('Slide to pay')
        fireEvent.keyDown(handle, { key: 'Enter' })
        fireEvent.keyDown(handle, { key: ' ' })
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('confirms only when arrow presses reach 100% travel', () => {
        const onConfirm = jest.fn()
        render(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} />)
        const handle = getHandle('Slide to pay')
        // 10% per press: 9 presses = 90%, must NOT commit (the old 0.9 threshold bug)
        for (let i = 0; i < 9; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).not.toHaveBeenCalled()
        fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('fires once: further keys after completion are ignored', () => {
        const onConfirm = jest.fn()
        render(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} />)
        const handle = getHandle('Slide to pay')
        for (let i = 0; i < 12; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('ArrowLeft moves the handle back so completion needs net-100%', () => {
        const onConfirm = jest.fn()
        render(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} />)
        const handle = getHandle('Slide to pay')
        for (let i = 0; i < 9; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
        fireEvent.keyDown(handle, { key: 'ArrowLeft' })
        fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).not.toHaveBeenCalled()
        fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('ignores keys and drag while disabled', () => {
        const onConfirm = jest.fn()
        render(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} disabled />)
        const handle = getHandle('Slide to pay')
        for (let i = 0; i < 10; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).not.toHaveBeenCalled()
        expect(handle).toBeDisabled()
    })

    it('resets the latch when disabled goes true -> false (in-place retry after failure)', () => {
        const onConfirm = jest.fn()
        const { rerender } = render(<SlideToConfirm label="Slide to lock" onConfirm={onConfirm} />)
        const handle = getHandle('Slide to lock')
        for (let i = 0; i < 10; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).toHaveBeenCalledTimes(1)

        // host runs the action (disabled), it fails, host re-enables — the card
        // modals' exact lifecycle (disabled={phase === 'loading'})
        rerender(<SlideToConfirm label="Slide to lock" onConfirm={onConfirm} disabled />)
        rerender(<SlideToConfirm label="Slide to lock" onConfirm={onConfirm} />)

        for (let i = 0; i < 10; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).toHaveBeenCalledTimes(2)
    })

    it('stays latched while the host keeps it enabled (no accidental double-fire)', () => {
        const onConfirm = jest.fn()
        const { rerender } = render(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} />)
        const handle = getHandle('Slide to pay')
        for (let i = 0; i < 10; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
        rerender(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} />)
        for (let i = 0; i < 10; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })
})
