import { renderWithIntl } from '@/test-utils/intl'
import HelpLanding from '../HelpLanding'
import { act } from '@testing-library/react'
import { isNativeHelpContext } from '@/utils/native-help-context'

let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
    useSearchParams: () => mockSearchParams,
}))
jest.mock('@/utils/native-help-context', () => ({ isNativeHelpContext: jest.fn(() => false) }))

const STRINGS = {
    searchPlaceholder: 'Search help articles...',
    clearSearch: 'Clear search',
    noResults: 'Nothing matches your search.',
    cantFind: 'Cannot find an answer?',
    cantFindDesc: 'Chat with us.',
}

describe('HelpLanding owner links', () => {
    beforeEach(() => {
        jest.mocked(isNativeHelpContext).mockReturnValue(false)
        mockSearchParams = new URLSearchParams()
        window.$crisp = undefined
    })

    afterEach(() => jest.useRealTimers())

    it('renders the server-provided href instead of reconstructing it from the hub locale', () => {
        const { container } = renderWithIntl(
            <HelpLanding
                articles={[
                    {
                        slug: 'passkeys',
                        href: '/es-419/help/passkeys',
                        title: 'Passkeys',
                        description: 'Passkey help',
                        category: 'Security',
                    },
                    {
                        slug: 'mercadopago-qr',
                        href: '/es-ar/help/mercadopago-qr',
                        title: 'Mercado Pago QR',
                        description: 'QR help',
                        category: 'Payments',
                    },
                ]}
                categories={['Security', 'Payments']}
                strings={STRINGS}
            />
        )
        const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((link) =>
            link.getAttribute('href')
        )

        expect(hrefs).toEqual(['/es-419/help/passkeys', '/es-ar/help/mercadopago-qr'])
    })

    it.each([false, true])('only shows the chat-bubble instructions for web visits (native: %s)', (native) => {
        jest.mocked(isNativeHelpContext).mockReturnValue(native)
        const { queryByText } = renderWithIntl(<HelpLanding articles={[]} categories={[]} strings={STRINGS} />)
        expect(queryByText(STRINGS.cantFindDesc) !== null).toBe(!native)
    })

    it('opens chat when a native visitor explicitly follows the Support link', () => {
        jest.useFakeTimers()
        jest.mocked(isNativeHelpContext).mockReturnValue(true)
        mockSearchParams = new URLSearchParams('chat=open')
        window.$crisp = []
        renderWithIntl(<HelpLanding articles={[]} categories={[]} strings={STRINGS} />)
        act(() => jest.advanceTimersByTime(200))
        expect(window.$crisp).toEqual([
            ['do', 'chat:show'],
            ['do', 'chat:open'],
        ])
    })
})
