import { renderHookWithIntl } from '@/test-utils/intl'
import { useRegionLabel } from '../useRegionLabel'

const region = (path: string, name: string, description?: string) => ({ path, name, icon: '', description })

describe('useRegionLabel', () => {
    it('resolves catalog copy from the region path, dashes and all', () => {
        const { result } = renderHookWithIntl(() => useRegionLabel())
        expect(result.current(region('north-america', 'North America')).name).toBe('North America')
        expect(result.current(region('rest-of-the-world', 'Rest of the world')).name).toBe('Rest of the world')
    })

    it('resolves the QR-only country descriptions', () => {
        const { result } = renderHookWithIntl(() => useRegionLabel())
        expect(result.current(region('brazil', 'Brazil', 'Only PIX QR payments')).description).toBe(
            'Only PIX QR payments'
        )
    })

    it('falls back to the internal name for a region with no catalog entry', () => {
        const { result } = renderHookWithIntl(() => useRegionLabel())
        const label = result.current(region('atlantis', 'Atlantis', 'Underwater only'))
        expect(label).toEqual({ name: 'Atlantis', description: 'Underwater only' })
    })
})
