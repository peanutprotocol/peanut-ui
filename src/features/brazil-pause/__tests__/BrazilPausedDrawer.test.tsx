import { act, fireEvent, screen } from '@testing-library/react'
import en from '@/i18n/app/messages/en.json'
import { renderWithIntl } from '@/test-utils/intl'
import {
    closeBrazilPausedDrawer,
    isBrazilPausedDrawerOpen,
    openBrazilPausedDrawer,
} from '../brazil-paused-drawer-store'
import { BrazilPausedDrawer } from '../components/BrazilPausedDrawer'

afterEach(() => act(() => closeBrazilPausedDrawer()))

describe('BrazilPausedDrawer', () => {
    it('stays shut until a Brazil entry opens it', () => {
        renderWithIntl(<BrazilPausedDrawer />)
        expect(screen.queryByTestId('brazil-paused-drawer')).not.toBeInTheDocument()
    })

    it('explains the pause and closes on Got it', () => {
        renderWithIntl(<BrazilPausedDrawer />)
        act(() => openBrazilPausedDrawer())

        expect(screen.getByText(en.brazilPause.title)).toBeInTheDocument()
        expect(screen.getByText(en.brazilPause.body)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: en.common.gotIt }))
        expect(isBrazilPausedDrawerOpen()).toBe(false)
    })
})
