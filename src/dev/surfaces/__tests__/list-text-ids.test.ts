import { SCREENS } from '../../screens/catalogue'
import { API_CONTRACT_STATES } from '../api-contract-states'
import { SETUP_REDESIGN_SURFACES, SURFACE_META } from '../list'

it('resolves every catalogue surface route through the live application registries', () => {
    const known = new Set([...Object.keys(SURFACE_META), ...Object.keys(SETUP_REDESIGN_SURFACES)])
    const surfaces = SCREENS.map((screen) => new URL(screen.route, 'http://localhost')).filter(
        (url) => url.pathname === '/dev/surfaces'
    )
    expect(surfaces.length).toBeGreaterThan(0)
    expect(surfaces.filter((url) => !known.has(url.searchParams.get('s') ?? '')).map((url) => url.search)).toEqual([])
})

it('lists every API ribbon state', () => {
    expect(Object.keys(API_CONTRACT_STATES).filter((id) => !SURFACE_META[id])).toEqual([])
})
