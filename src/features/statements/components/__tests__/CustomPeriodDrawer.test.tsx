import { fireEvent, render, screen } from '@testing-library/react'
import type { DateRange } from 'react-day-picker'
import { CustomPeriodDrawer } from '../CustomPeriodDrawer'
import { toLocalDateString } from '../../statementPeriod.utils'

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useLocale: () => 'en',
}))
jest.mock('@/utils/haptics', () => ({ impactHaptic: jest.fn(), heavyImpactHaptic: jest.fn(), WEB_TAP_MS: 15 }))

const AUG_3 = new Date(2026, 7, 3)
const AUG_14 = new Date(2026, 7, 14)

const day = (iso: string) => document.querySelector(`[data-day="${iso}"]`)
const tapDay = (iso: string) => fireEvent.click(day(iso)!.querySelector('button')!)
const apply = () => screen.getByRole('button', { name: 'customPeriod.apply' })

function renderDrawer(days: DateRange | undefined) {
    const onApply = jest.fn()
    const onClose = jest.fn()
    const view = render(<CustomPeriodDrawer open days={days} onApply={onApply} onClose={onClose} />)
    const setOpen = (open: boolean) =>
        view.rerender(<CustomPeriodDrawer open={open} days={days} onApply={onApply} onClose={onClose} />)
    return { onApply, onClose, setOpen }
}

describe('CustomPeriodDrawer', () => {
    it('opens on the applied period, under its title and one line of copy', () => {
        renderDrawer({ from: AUG_3, to: AUG_14 })

        expect(screen.getByRole('dialog')).toHaveAttribute('data-vaul-drawer')
        // the period concept: a calendar on blue (design.md bubble colour ruling, 2026-09-25)
        expect(
            screen.getByRole('dialog').querySelector('.bg-background-icon-bubble-blue .lucide-calendar')
        ).not.toBeNull()
        expect(screen.getByRole('heading', { name: 'periods.custom' })).toBeInTheDocument()
        expect(screen.getByText('customPeriod.description')).toBeInTheDocument()
        expect(screen.getByText('August 2026')).toBeInTheDocument()
        expect(day('2026-08-03')).toHaveAttribute('aria-selected', 'true')
        expect(day('2026-08-14')).toHaveAttribute('aria-selected', 'true')
        expect(apply()).toBeEnabled()
    })

    it('waits for a first day before Apply, and applies a single day on its own', () => {
        const { onApply } = renderDrawer(undefined)
        expect(apply()).toBeDisabled()

        const today = new Date()
        tapDay(toLocalDateString(today))
        expect(apply()).toBeEnabled()
        fireEvent.click(apply())

        expect(onApply).toHaveBeenCalledWith({
            from: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            to: undefined,
        })
    })

    it('hands Apply the two tapped days, a new range once the applied one is finished', () => {
        const { onApply, onClose } = renderDrawer({ from: AUG_3, to: AUG_14 })
        tapDay('2026-08-20')
        tapDay('2026-08-25')
        fireEvent.click(apply())

        expect(onApply).toHaveBeenCalledWith({ from: new Date(2026, 7, 20), to: new Date(2026, 7, 25) })
        expect(onClose).not.toHaveBeenCalled()
    })

    it('closes on Escape without applying, and the next opening starts from the applied period again', () => {
        const { onApply, onClose, setOpen } = renderDrawer({ from: AUG_3, to: AUG_14 })
        fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
        tapDay('2026-07-10')
        fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onApply).not.toHaveBeenCalled()

        // the page closes it, and later opens it again
        setOpen(false)
        setOpen(true)

        expect(screen.getByText('August 2026')).toBeInTheDocument()
        expect(day('2026-08-03')).toHaveAttribute('aria-selected', 'true')
        expect(day('2026-08-14')).toHaveAttribute('aria-selected', 'true')
        // the unapplied July pick went with the July page
        expect(day('2026-07-10')).toBeNull()
    })
})
