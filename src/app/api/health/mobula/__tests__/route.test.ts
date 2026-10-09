/** @jest-environment node */
import { GET } from '../route'
import { _resetMobulaVerdict, getMobulaVerdict } from '../mobula-probe'

const realFetch = global.fetch
let fetchMock: jest.Mock

function respond(status: number, body: unknown) {
    fetchMock = jest.fn(async () => new Response(JSON.stringify(body), { status }))
    global.fetch = fetchMock as unknown as typeof fetch
}

beforeEach(() => {
    _resetMobulaVerdict()
    process.env.MOBULA_API_URL = 'https://mobula.test'
    process.env.MOBULA_API_KEY = 'test-key'
})

afterAll(() => {
    global.fetch = realFetch
})

describe('GET /api/health/mobula', () => {
    it('asks Mobula for one price and never for a wallet portfolio', async () => {
        respond(200, { data: { price: 1 } })
        const response = await GET()
        expect(response.status).toBe(200)
        expect((await response.json()).status).toBe('healthy')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(String(fetchMock.mock.calls[0][0])).toContain('/api/1/market/data')
        expect(String(fetchMock.mock.calls[0][0])).not.toContain('portfolio')
    })

    it('reports the upstream status as unhealthy', async () => {
        respond(403, { message: 'Forbidden' })
        const response = await GET()
        expect(response.status).toBe(500)
        expect(await response.json()).toMatchObject({ status: 'unhealthy', error: 'Price API returned 403' })
    })

    it('serves one verdict to every caller for five minutes, failures included', async () => {
        respond(403, { message: 'Forbidden' })
        const t0 = Date.now()
        await GET()
        await GET()
        await getMobulaVerdict(t0 + 4 * 60 * 1000)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        await getMobulaVerdict(t0 + 6 * 60 * 1000)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('concurrent callers share a single Mobula request', async () => {
        respond(200, { data: { price: 1 } })
        await Promise.all([GET(), GET(), GET()])
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('gives up on a hung Mobula call with a timeout signal', async () => {
        respond(200, { data: { price: 1 } })
        await GET()
        const init = fetchMock.mock.calls[0][1] as RequestInit
        expect(init.signal).toBeInstanceOf(AbortSignal)
    })
})
