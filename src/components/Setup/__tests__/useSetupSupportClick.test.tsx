import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '@/i18n/app/messages/en.json'
import { SETUP_SUPPORT_FALLBACK_URL, useSetupSupportClick } from '../useSetupSupportClick'

const mockOpenSupportWithMessage = jest.fn()
let mockModals: { openSupportWithMessage: jest.Mock } | null = null

jest.mock('@/context/ModalsContext', () => ({
    useModalsContextOptional: () => mockModals,
}))

function TestSupportLink({ onSupport }: { onSupport?: () => void }) {
    const supportLink = useSetupSupportClick({ key: 'setupPasskey' }, onSupport)
    return (
        <a href={supportLink.href ?? SETUP_SUPPORT_FALLBACK_URL} onClick={supportLink.onClick}>
            Contact support
        </a>
    )
}

const renderWithIntl = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
            {ui}
        </NextIntlClientProvider>
    )

describe('useSetupSupportClick', () => {
    beforeEach(() => {
        mockOpenSupportWithMessage.mockReset()
        mockModals = null
    })

    it('opens the in-app SupportDrawer with the localized topic and prevents external navigation when ModalsContext is mounted', () => {
        mockModals = { openSupportWithMessage: mockOpenSupportWithMessage }
        const onSupport = jest.fn()

        renderWithIntl(<TestSupportLink onSupport={onSupport} />)

        const link = screen.getByRole('link', { name: 'Contact support' })
        const prevented = !fireEvent.click(link)
        expect(prevented).toBe(true)
        expect(onSupport).toHaveBeenCalledTimes(1)
        expect(mockOpenSupportWithMessage).toHaveBeenCalledWith(enMessages.stuckBuddy.supportTopics.setupPasskey)
    })

    it('preserves the external fallback link when rendered without ModalsContext', () => {
        const onSupport = jest.fn()
        renderWithIntl(<TestSupportLink onSupport={onSupport} />)
        const link = screen.getByRole('link', { name: 'Contact support' })
        expect(link).toHaveAttribute('href', SETUP_SUPPORT_FALLBACK_URL)
        fireEvent.click(link)
        expect(onSupport).toHaveBeenCalledTimes(1)
        expect(mockOpenSupportWithMessage).not.toHaveBeenCalled()
    })
})
