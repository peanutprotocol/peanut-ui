/** @jest-environment node */
import { CREATOR_PAGE_EXPERIMENT_IDS } from '../experiment-ids'
import { CREATOR_PAGE_EXPERIMENTS } from '../experiments'
import { selectCreatorPage } from '../registry'

const mockCookies = new Map<string, string>()
const mockSet = jest.fn()
jest.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => (mockCookies.has(name) ? { name, value: mockCookies.get(name) } : undefined),
        set: mockSet,
    }),
}))
const creator = (username: string) => ({ username, linkId: 'invite_' + '0'.repeat(64) })

beforeEach(() => mockCookies.clear())
afterEach(() => jest.restoreAllMocks())

describe('selectCreatorPage', () => {
    it('returns null for a creator without an experiment, including Object.prototype names', async () => {
        expect(await selectCreatorPage(creator('nobody'))).toBeNull()
        expect(await selectCreatorPage(creator('constructor'))).toBeNull()
        expect(await selectCreatorPage(creator('toString'))).toBeNull()
    })

    it('keeps the variant from the cookie and never sets a cookie', async () => {
        const { id, variants } = CREATOR_PAGE_EXPERIMENTS.juanacervio
        jest.spyOn(Math, 'random').mockReturnValue(0)
        mockCookies.set('cpv_juanacervio', `${id}.e1`)
        const selection = await selectCreatorPage(creator('juanacervio'))
        expect(selection).toEqual({
            variant: 'e1',
            experimentId: 'nita-2026-11-a',
            Page: variants.find((variant) => variant.id === 'e1')!.Page,
        })
        expect(mockSet).not.toHaveBeenCalled()
    })

    it('picks by weight without a cookie or with one from an older experiment', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.5)
        expect((await selectCreatorPage(creator('juanacervio')))?.variant).toBe('g2')
        mockCookies.set('cpv_juanacervio', 'nita-2026-10-z.a1')
        expect((await selectCreatorPage(creator('juanacervio')))?.variant).toBe('g2')
    })

    it('draws once per selection: later random values do not change the pick', async () => {
        const random = jest.spyOn(Math, 'random')
        random.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1).mockReturnValue(0.5)
        expect((await selectCreatorPage(creator('juanacervio')))?.variant).toBe('e1')
        random.mockReset().mockReturnValueOnce(0.1).mockReturnValueOnce(0.9).mockReturnValue(0.5)
        expect((await selectCreatorPage(creator('juanacervio')))?.variant).toBe('a1')
        random.mockReset().mockReturnValueOnce(0.5).mockReturnValueOnce(0.9).mockReturnValue(0.1)
        expect((await selectCreatorPage(creator('juanacervio')))?.variant).toBe('g2')
    })

    it('gives every new visitor a page, in the shares the weights set', async () => {
        const DRAWS = 6000
        const counts: Record<string, number> = {}
        for (let i = 0; i < DRAWS; i++) {
            const variant = (await selectCreatorPage(creator('juanacervio')))?.variant ?? 'null'
            counts[variant] = (counts[variant] ?? 0) + 1
        }
        // Real Math.random. One arm of 6,000 equal draws has a standard deviation of 37, so ±250 is
        // more than six of them: the old per-variant draw (33% / 22% / 15% / 30% no page) fails, chance does not.
        expect(Object.keys(counts).sort()).toEqual(['a1', 'e1', 'g2'])
        for (const count of Object.values(counts)) expect(Math.abs(count - DRAWS / 3)).toBeLessThan(250)
    })
})

describe('CREATOR_PAGE_EXPERIMENTS', () => {
    it('has valid ids, live weights and one experiment id per creator', () => {
        expect(Object.keys(CREATOR_PAGE_EXPERIMENTS).sort()).toEqual(Object.keys(CREATOR_PAGE_EXPERIMENT_IDS).sort())
        for (const [username, experiment] of Object.entries(CREATOR_PAGE_EXPERIMENTS)) {
            expect(username).toMatch(/^[a-z0-9]{1,64}$/)
            expect(experiment.id).toBe(CREATOR_PAGE_EXPERIMENT_IDS[username])
            expect(experiment.id).toMatch(/^[a-z0-9][a-z0-9-]{0,31}$/)
            const ids = experiment.variants.map((variant) => variant.id)
            expect(new Set(ids).size).toBe(ids.length)
            for (const variant of experiment.variants) {
                expect(variant.id).toMatch(/^[a-z0-9][a-z0-9-]{0,31}$/)
                expect(variant.weight).toBeGreaterThanOrEqual(0)
            }
        }
    })

    it('runs Nita as an equal three-way split', () => {
        expect(CREATOR_PAGE_EXPERIMENTS.juanacervio.id).toBe('nita-2026-11-a')
        expect(CREATOR_PAGE_EXPERIMENTS.juanacervio.variants.map(({ id, weight }) => [id, weight])).toEqual([
            ['a1', 1],
            ['g2', 1],
            ['e1', 1],
        ])
    })
})
