/**
 * NavHeader's default back (no `onPrev`) returns to the page it was opened
 * from. Following its `/home` link pushed home on top instead, so browser back
 * from home reopened the page: Activity → back → home → back → Activity.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import NavHeader from '../index'
import en from '@/i18n/app/messages/en.json'
import { __testing } from '@/hooks/useSafeBack'

jest.mock('next/navigation', () => ({
    usePathname: () => '/history',
}))

const renderHeader = () =>
    render(
        <NextIntlClientProvider locale="en" messages={en}>
            <NavHeader title="Activity" />
        </NextIntlClientProvider>
    )

describe('NavHeader default back', () => {
    let back: jest.SpyInstance
    beforeEach(() => {
        __testing.reset()
        back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined)
    })
    afterEach(() => back.mockRestore())

    it('pops in-app history instead of following the link', () => {
        window.history.pushState({}, '', '/history')
        renderHeader()

        const click = new MouseEvent('click', { bubbles: true, cancelable: true })
        fireEvent(screen.getByTestId('nav-back'), click)

        expect(back).toHaveBeenCalledTimes(1)
        expect(click.defaultPrevented).toBe(true)
    })

    it('follows the /home link when there is no in-app history (a deep link)', () => {
        renderHeader()

        const link = screen.getByTestId('nav-back')
        fireEvent.click(link)

        expect(back).not.toHaveBeenCalled()
        expect(link).toHaveAttribute('href', '/home')
    })
})
