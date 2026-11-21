/** @jest-environment node */
const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('noteUpdateRequired', () => {
    const load = () => require('../update-required') as typeof import('../update-required')

    beforeEach(() => jest.resetModules())

    it('blocks the app on 426 CLIENT_UPDATE_REQUIRED and leaves the body to the caller', async () => {
        const { noteUpdateRequired, getUpdateRequired, subscribeUpdateRequired } = load()
        const listener = jest.fn()
        subscribeUpdateRequired(listener)
        const response = json(426, { code: 'CLIENT_UPDATE_REQUIRED', update: 'store', error: 'old' })

        await noteUpdateRequired(response)

        expect(getUpdateRequired()).toEqual({ update: 'store' })
        expect(listener).toHaveBeenCalledTimes(1)
        expect(await response.json()).toMatchObject({ code: 'CLIENT_UPDATE_REQUIRED' })
    })

    it('treats any update other than store as a reload', async () => {
        const { noteUpdateRequired, getUpdateRequired } = load()
        await noteUpdateRequired(json(426, { code: 'CLIENT_UPDATE_REQUIRED' }))
        expect(getUpdateRequired()).toEqual({ update: 'reload' })
    })

    it.each([
        ['another status', json(500, { code: 'CLIENT_UPDATE_REQUIRED', update: 'store' })],
        ['a 426 without our code', json(426, { code: 'SOMETHING_ELSE' })],
        ['a 426 that is not JSON', new Response('upgrade', { status: 426 })],
        ['no response', undefined],
    ])('ignores %s', async (_label, response) => {
        const { noteUpdateRequired, getUpdateRequired } = load()
        await noteUpdateRequired(response)
        expect(getUpdateRequired()).toBeNull()
    })
})
