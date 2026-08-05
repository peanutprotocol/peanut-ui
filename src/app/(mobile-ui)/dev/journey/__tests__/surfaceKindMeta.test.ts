import { IN_APP_SURFACES } from '../journeyData'
import { SURFACE_KIND_META, SURFACE_KIND_ORDER } from '../surfaceKindMeta'

describe('surfaceKindMeta', () => {
    it('legend covers every kind used by the catalog', () => {
        for (const surface of IN_APP_SURFACES) {
            expect(SURFACE_KIND_META[surface.kind]).toBeDefined()
        }
    })

    it('legend order lists every kind exactly once', () => {
        expect([...SURFACE_KIND_ORDER].sort()).toEqual(Object.keys(SURFACE_KIND_META).sort())
    })

    it('every kind has a non-empty label and explanation', () => {
        for (const kind of SURFACE_KIND_ORDER) {
            expect(SURFACE_KIND_META[kind].label.length).toBeGreaterThan(0)
            expect(SURFACE_KIND_META[kind].description.length).toBeGreaterThan(0)
        }
    })
})
