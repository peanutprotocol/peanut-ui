/**
 * 02 Username suggestions (contract C.md § 4.3, checks C-01..C-04). The module is loaded per test, so this suite
 * compiles and runs before the builder adds `src/features/setup/username-suggestions.ts`; each test then fails
 * with "Cannot find module" instead of the whole file failing to compile.
 */
import { isReservedSignupUsername } from '@/features/setup/reserved-username'

type UsernameCheck = 'free' | 'taken' | 'invalid' | 'error'
/** The contract's API (C.md § 4.3). */
type UsernameSuggestions = {
    suggestionCandidates: (locale: string, start: number) => Iterable<string>
    alternativeCandidates: (name: string, locale: string) => string[]
    checkUsernameFree: (name: string) => Promise<UsernameCheck>
    firstFreeName: (
        candidates: Iterable<string>,
        check: (name: string) => Promise<UsernameCheck>,
        maxTries: number
    ) => Promise<string | null>
}
const load = (): UsernameSuggestions => require('@/features/setup/username-suggestions')

const mockApiFetch = jest.fn()
let mockNative = false
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => mockNative,
}))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))

// The mock's lists (scaffold screens/02-username/screen.js:12-15).
const ES_NOUNS = [
    'tigre',
    'puma',
    'mate',
    'tango',
    'loro',
    'pato',
    'zorro',
    'gato',
    'luna',
    'nube',
    'rayo',
    'condor',
    'ombu',
    'yacare',
]
const ES_ADJS = ['feliz', 'azul', 'veloz', 'audaz', 'genial', 'libre', 'alegre', 'zen', 'lila', 'dulce']
const EN_ADJS = ['lucky', 'sunny', 'brave', 'tiny', 'jolly', 'swift', 'mellow', 'cosmic', 'zippy', 'bold']
const EN_NOUNS = ['otter', 'fox', 'koala', 'mango', 'comet', 'panda', 'tiger', 'maple', 'robin', 'pixel']
const PATTERN = /^[a-z][a-z0-9]{3,11}$/

const take = (iterable: Iterable<string>, count: number) => {
    const out: string[] = []
    for (const value of iterable) {
        out.push(value)
        if (out.length === count) break
    }
    return out
}
const respond = (status: number) => ({ status, ok: status >= 200 && status < 300, json: async () => ({}) })

beforeEach(() => {
    jest.clearAllMocks()
    mockNative = false
})

describe('02 Username suggestions (C.md § 4.3)', () => {
    it('C-01 suggestion candidates follow the mock word lists per locale, all valid and none reserved', () => {
        const { suggestionCandidates } = load()
        for (const start of [0, 1, 7, 13, 139]) {
            const en = take(suggestionCandidates('en', start), 30)
            en.forEach((name, k) => {
                const i = start + k
                expect(name).toBe(EN_ADJS[i % 10] + EN_NOUNS[Math.floor(i / 10) % 10])
            })
            for (const locale of ['es-AR', 'es-419']) {
                take(suggestionCandidates(locale, start), 30).forEach((name, k) => {
                    const i = start + k
                    expect(name).toBe(ES_NOUNS[i % 14] + ES_ADJS[Math.floor(i / 14) % 10])
                })
            }
            // pt-BR uses the en list until L supplies a checked pt list (§ 12 C10)
            expect(take(suggestionCandidates('pt-BR', start), 30)).toEqual(en)
        }
        for (const locale of ['en', 'es-AR', 'es-419', 'pt-BR']) {
            const first300 = take(suggestionCandidates(locale, 0), 300)
            expect(first300).toHaveLength(300)
            for (const name of first300) {
                expect(name).toMatch(PATTERN)
                expect(isReservedSignupUsername(name)).toBe(false)
            }
        }
    })

    it('TASK-25341 one lap of the list offers every word pair once (en 100, es 140), not 10 names', () => {
        const { suggestionCandidates } = load()
        // the old index math gave en only 10 names, all of them registered on prod, so every roll failed
        expect(new Set(take(suggestionCandidates('en', 37), 100)).size).toBe(100)
        expect(new Set(take(suggestionCandidates('es-AR', 37), 140)).size).toBe(140)
    })

    it('C-02 firstFreeName returns the first free candidate, skips taken/invalid/error, and stops after maxTries', async () => {
        const { firstFreeName } = load()
        const answers: Record<string, UsernameCheck> = {
            a1: 'taken',
            a2: 'invalid',
            a3: 'error',
            a4: 'free',
            a5: 'free',
        }
        const asked: string[] = []
        const check = async (name: string) => {
            asked.push(name)
            return answers[name] ?? 'error'
        }
        await expect(firstFreeName(['a1', 'a2', 'a3', 'a4', 'a5'], check, 5)).resolves.toBe('a4')
        expect(asked).toEqual(['a1', 'a2', 'a3', 'a4'])

        asked.length = 0
        const endless = (function* () {
            for (let i = 0; ; i++) yield `n${i}`
        })()
        await expect(firstFreeName(endless, async (name) => (asked.push(name), 'error'), 5)).resolves.toBeNull()
        expect(asked).toHaveLength(5)

        asked.length = 0
        await expect(
            firstFreeName(['x1', 'x2', 'x3'], async (name) => (asked.push(name), 'taken'), 5)
        ).resolves.toBeNull()
        expect(asked).toEqual(['x1', 'x2', 'x3'])
    })

    it('C-03 alternatives: name + digit first, then adjective + name (en) or name + adjective (es), shortest adjective first', () => {
        const { alternativeCandidates } = load()
        const en = alternativeCandidates('tiger', 'en')
        expect(en[0]).toBe('tiger' + String((('t'.charCodeAt(0) + 5) % 8) + 2))
        expect(en[0]).toBe('tiger3')
        // shortest adjectives first ("tiny", "bold" are 4 letters), as the mock's stable sort
        expect(en.slice(1, 3)).toEqual(['tinytiger', 'boldtiger'])
        const byLength = [...EN_ADJS].sort((x, y) => x.length - y.length)
        const enLater = byLength.map((adj) => adj + 'tiger').filter((name) => name.length <= 12)
        // the builder may cap the list (at most 6 checks), but what it lists is that order from the start
        expect(enLater.slice(0, en.length - 1)).toEqual(en.slice(1))

        const es = alternativeCandidates('tigre', 'es-AR')
        expect(es[0]).toBe('tigre' + String((('t'.charCodeAt(0) + 5) % 8) + 2))
        const esByLength = [...ES_ADJS].sort((x, y) => x.length - y.length)
        const esLater = esByLength.map((adj) => 'tigre' + adj).filter((name) => name.length <= 12)
        expect(es.length).toBeGreaterThan(2)
        expect(esLater.slice(0, es.length - 1)).toEqual(es.slice(1))

        // a 12-letter name keeps its first 11 letters before the digit
        const long = alternativeCandidates('abcdefghijkl', 'en')
        expect(long[0]).toBe('abcdefghijk' + String((('a'.charCodeAt(0) + 12) % 8) + 2))
        for (const name of [...en, ...es, ...long]) {
            expect(name.length).toBeLessThanOrEqual(12)
            expect(name).toMatch(PATTERN)
        }
    })

    it('C-04 checkUsernameFree sends HEAD on web and GET in the app, without auth, and maps the status', async () => {
        const { checkUsernameFree } = load()
        mockApiFetch.mockResolvedValue(respond(404))
        await expect(checkUsernameFree('mellowfox')).resolves.toBe('free')
        expect(mockApiFetch).toHaveBeenLastCalledWith(
            '/users/username/mellowfox',
            expect.objectContaining({ method: 'HEAD', includeAuth: false })
        )

        mockNative = true
        await checkUsernameFree('mellowfox')
        expect(mockApiFetch).toHaveBeenLastCalledWith(
            '/users/username/mellowfox',
            expect.objectContaining({ method: 'GET', includeAuth: false })
        )

        const cases: [number, UsernameCheck][] = [
            [404, 'free'],
            [200, 'taken'],
            [400, 'invalid'],
            [500, 'error'],
            [503, 'error'],
        ]
        for (const [status, expected] of cases) {
            mockApiFetch.mockResolvedValueOnce(respond(status))
            await expect(checkUsernameFree('tiger')).resolves.toBe(expected)
        }
        mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
        await expect(checkUsernameFree('tiger')).resolves.toBe('error')
    })
})
