/** @jest-environment jsdom */
import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import CreatorPageBoundary from '../CreatorPageBoundary'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))

// A same-document handoff, so jsdom can follow the replace.
const handoff = '/go/alice/ig#handoff'

function BrokenPage(): never {
    throw new Error('page bug')
}

beforeEach(() => {
    window.history.replaceState({}, '', '/go/alice/ig')
    jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    jest.restoreAllMocks()
    document.body.innerHTML = ''
})

async function serveAndHydrate(page: React.ReactNode) {
    const tree = <CreatorPageBoundary handoff={handoff}>{page}</CreatorPageBoundary>
    const container = document.createElement('div')
    container.innerHTML = renderToString(tree)
    document.body.appendChild(container)
    await act(async () => {
        hydrateRoot(container, tree, { onRecoverableError: () => {} })
    })
    return container
}

it('answers the request when the page throws, then sends the visitor on to the handoff', async () => {
    await serveAndHydrate(<BrokenPage />)
    expect(window.location.hash).toBe('#handoff')
})

it('renders a working page unchanged and stays on it', async () => {
    const container = await serveAndHydrate(<p>{'Nita'}</p>)
    expect(container.textContent).toBe('Nita')
    expect(window.location.hash).toBe('')
})
