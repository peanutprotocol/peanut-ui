import { isCrossOriginDataRequest } from '../sw-api-privacy'

const request = (destination: string) => ({ destination }) as Request

describe('isCrossOriginDataRequest', () => {
    it('keeps fetch and XHR calls to another origin out of the cache', () => {
        expect(isCrossOriginDataRequest({ request: request(''), sameOrigin: false })).toBe(true)
    })

    it.each(['image', 'font', 'script', 'style'])('leaves %s requests to the default rules', (destination) => {
        expect(isCrossOriginDataRequest({ request: request(destination), sameOrigin: false })).toBe(false)
    })

    it('leaves same-origin requests to the default rules', () => {
        expect(isCrossOriginDataRequest({ request: request(''), sameOrigin: true })).toBe(false)
    })
})
