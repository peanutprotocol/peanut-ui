import { render, screen } from '@testing-library/react'
import { ConnectivityBanner } from '../ConnectivityBanner'

describe('ConnectivityBanner', () => {
    // react-fast-marquee's autoFill duplicates children, so match all copies.
    it('tells the user they are offline when the device has no connection', () => {
        render(<ConnectivityBanner isOffline={true} />)
        expect(screen.getAllByText(/no internet connection/i).length).toBeGreaterThan(0)
    })

    it('tells the user we are unreachable (not to contact support) on a timeout', () => {
        render(<ConnectivityBanner isOffline={false} />)
        expect(screen.getAllByText(/trouble reaching peanut/i).length).toBeGreaterThan(0)
        expect(screen.queryAllByText(/support/i)).toHaveLength(0)
    })
})
