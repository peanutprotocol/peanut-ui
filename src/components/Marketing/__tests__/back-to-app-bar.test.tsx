// BackToAppBar gates on the session cookie: marketing pages are SSG with no
// auth providers, so the cookie read is the only logged-in signal. The bar
// must never render for logged-out visitors (SEO pages are their front door).
import { render, screen, waitFor } from '@testing-library/react'
import Cookies from 'js-cookie'
import { BackToAppBar } from '../BackToAppBar'

jest.mock('js-cookie', () => ({ get: jest.fn() }))

const mockGet = Cookies.get as unknown as jest.MockedFunction<(key: string) => string | undefined>

describe('BackToAppBar', () => {
    afterEach(() => jest.clearAllMocks())

    it('renders a link back into the app when the session cookie is set', async () => {
        mockGet.mockReturnValue('some-jwt')
        render(<BackToAppBar locale="en" />)
        const link = await screen.findByRole('link', { name: /back to app/i })
        expect(link).toHaveAttribute('href', '/home')
    })

    it('renders nothing for logged-out visitors', async () => {
        mockGet.mockReturnValue(undefined)
        const { container } = render(<BackToAppBar locale="en" />)
        await waitFor(() => expect(mockGet).toHaveBeenCalledWith('jwt-token'))
        expect(container).toBeEmptyDOMElement()
    })

    it('localizes the label from the page locale', async () => {
        mockGet.mockReturnValue('some-jwt')
        render(<BackToAppBar locale="pt-br" />)
        expect(await screen.findByText('Voltar ao app')).toBeInTheDocument()
    })
})
