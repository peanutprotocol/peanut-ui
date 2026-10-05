import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
// The browser condition chosen by jsdom requires MessageChannel; exercise
// real SSR with the Node entry point while using the public server typings.
const { renderToString } = require('react-dom/server.node') as typeof import('react-dom/server')
import { useDeviceType } from '../useGetDeviceType'

function Device() {
    const { deviceType } = useDeviceType()
    return <span>{deviceType}</span>
}

test.each(['iPhone', 'Android'])('hydrates prerendered HTML without a mismatch on %s', async (userAgent) => {
    const ua = jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
    const container = document.createElement('div')
    container.innerHTML = renderToString(<Device />)
    expect(container.textContent).toBe('web')
    document.body.appendChild(container)
    const onRecoverableError = jest.fn()
    let root!: ReturnType<typeof hydrateRoot>
    await act(async () => {
        root = hydrateRoot(container, <Device />, { onRecoverableError })
    })
    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(container.textContent).toBe(userAgent === 'iPhone' ? 'ios' : 'android')
    act(() => root.unmount())
    container.remove()
    ua.mockRestore()
})
