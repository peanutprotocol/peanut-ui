// BackToAppBar gates on the session cookie: marketing pages are SSG with no
// auth in the prerendered markup, so the cookie read is the only logged-in
// signal. The button must never render for logged-out visitors (SEO pages are
// their front door). The button itself is the design-system NavHeader — its
// rendering is covered by its own usage; here we only test the gate.
import { render, waitFor } from '@testing-library/react'
import Cookies from 'js-cookie'
import { BackToAppBar } from '../BackToAppBar'

jest.mock('js-cookie', () => ({ get: jest.fn() }))

jest.mock('next/navigation', () => ({
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => <div data-testid="nav-header" />,
}))

const mockGet = Cookies.get as unknown as jest.MockedFunction<(key: string) => string | undefined>

describe('BackToAppBar', () => {
    afterEach(() => jest.clearAllMocks())

    it('renders the NavHeader back button when the session cookie is set', async () => {
        mockGet.mockReturnValue('some-jwt')
        const { findByTestId } = render(<BackToAppBar />)
        expect(await findByTestId('nav-header')).toBeInTheDocument()
    })

    it('renders nothing for logged-out visitors', async () => {
        mockGet.mockReturnValue(undefined)
        const { container } = render(<BackToAppBar />)
        await waitFor(() => expect(mockGet).toHaveBeenCalledWith('jwt-token'))
        expect(container).toBeEmptyDOMElement()
    })
})
