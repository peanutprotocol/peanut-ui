import { renderToString } from 'react-dom/server'
import { screen, within } from '@testing-library/react'
import ShhhhhPage from '../page'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
jest.mock('../ShhhhhLandingPage', () => ({ __esModule: true, default: () => <main>Peanut Card</main> }))
jest.mock('@/components/Global/FooterVisibilityObserver', () => ({ FooterVisibilityObserver: () => null }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

afterEach(() => {
    document.body.innerHTML = ''
})

it('server-renders country-neutral navigation on the legacy card entry', () => {
    document.body.innerHTML = renderToString(<ShhhhhPage />)
    const navigation = screen.getByRole('navigation', { name: 'Features' })

    expect(
        within(navigation)
            .getAllByRole('link')
            .map((link) => link.getAttribute('href'))
    ).toEqual(['/request-links', '/self-custody', '/peanut-card', '/lp#footer-features'])
    expect(screen.queryByRole('button', { name: /^Language:/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Status$/ })).not.toBeInTheDocument()
})
