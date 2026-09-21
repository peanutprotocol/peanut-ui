/**
 * The marketing layout owns the launcher's visibility through this component's
 * lifetime. Unmount is the load-bearing half: leaving marketing for the app is
 * a client-side navigation in the same document, so nothing else removes the
 * bubble.
 */
import React from 'react'
import { render } from '@testing-library/react'
import { CrispLauncher } from '../CrispLauncher'

const queued = () => (window.$crisp ?? []) as unknown[][]

describe('CrispLauncher', () => {
    beforeEach(() => {
        window.$crisp = undefined
        document.head.querySelectorAll('script[src="https://client.crisp.chat/l.js"]').forEach((el) => el.remove())
    })

    it('shows the launcher while a marketing page is mounted', () => {
        render(<CrispLauncher />)

        expect(queued()).toContainEqual(['do', 'chat:show'])
        expect(document.head.querySelector('script[src="https://client.crisp.chat/l.js"]')).not.toBeNull()
    })

    it('hides the launcher when marketing unmounts — the app must never see it', () => {
        const { unmount } = render(<CrispLauncher />)

        unmount()

        expect(queued().slice(-2)).toEqual([
            ['do', 'chat:close'],
            ['do', 'chat:hide'],
        ])
    })

    it('shows it again when the reader returns to marketing', () => {
        const first = render(<CrispLauncher />)
        first.unmount()

        render(<CrispLauncher />)

        expect(queued().at(-1)).toEqual(['do', 'chat:show'])
    })
})
