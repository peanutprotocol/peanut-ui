import { tabSlideDirection } from '../tab-order'

describe('tabSlideDirection', () => {
    it('slides left from home to card and right from card to home', () => {
        expect(tabSlideDirection('/home', '/card')).toBe('left')
        expect(tabSlideDirection('/card', '/home')).toBe('right')
    })

    it('tolerates trailing slashes', () => {
        expect(tabSlideDirection('/home/', '/card/')).toBe('left')
    })

    it('does not slide for the same tab, deeper card pages, or any other route', () => {
        expect(tabSlideDirection('/home', '/home')).toBeNull()
        expect(tabSlideDirection('/home', '/card/pin')).toBeNull()
        expect(tabSlideDirection('/card', '/card/limit')).toBeNull()
        expect(tabSlideDirection('/profile', '/home')).toBeNull()
        expect(tabSlideDirection('/home', '/profile')).toBeNull()
        expect(tabSlideDirection(null, '/card')).toBeNull()
        expect(tabSlideDirection('/home', undefined)).toBeNull()
    })
})
