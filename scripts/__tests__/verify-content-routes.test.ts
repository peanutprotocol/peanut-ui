/** @jest-environment node */

import { isKnownRouteOrLocaleRedirect } from '../verify-content-routes'

describe('content route aliases', () => {
    const validPaths = new Set(['/en/pricing', '/es-419/help/delete-account'])

    it('accepts direct routes and retired-locale aliases with real destinations', () => {
        expect(isKnownRouteOrLocaleRedirect('/en/pricing', validPaths)).toBe(true)
        expect(isKnownRouteOrLocaleRedirect('/es-es', validPaths)).toBe(true)
        expect(isKnownRouteOrLocaleRedirect('/es-es/help/delete-account', validPaths)).toBe(true)
    })

    it('rejects retired-locale aliases whose destinations do not exist', () => {
        expect(isKnownRouteOrLocaleRedirect('/es-es/definitely-not-a-route', validPaths)).toBe(false)
    })
})
