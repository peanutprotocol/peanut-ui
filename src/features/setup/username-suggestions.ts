import { isReservedSignupUsername } from '@/features/setup/reserved-username'
import { apiFetch } from '@/utils/api-fetch'
import { isCapacitor } from '@/utils/capacitor'

/**
 * Username ideas for the sign-up username screen (02): the die's names, the first suggestion and the chips under a
 * taken name. Every name is checked against the API before it shows. Word lists and rules: mock
 * scaffold/screens/02-username/screen.js; contract: mono _temp/signup-redesign/r2/r9/build/contract/C.md § 4.3.
 */

export const USERNAME_PATTERN = /^[a-z][a-z0-9]{3,11}$/
export const USERNAME_MAX = 12

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

export type UsernameCheck = 'free' | 'taken' | 'invalid' | 'error'

// pt-BR takes the English words until a checked Portuguese list exists (contract § 12 C10).
const isSpanish = (locale: string) => locale.toLowerCase().startsWith('es')

const usable = (name: string) => USERNAME_PATTERN.test(name) && !isReservedSignupUsername(name)

/** Where a mount starts in the idea list, so two people rarely see the same first name. Tests mock it. */
export const randomSuggestionStart = () => Math.floor(Math.random() * 140)

/**
 * Endless ideas from index `start` on: en adjective + noun, es noun + adjective. Each pair shows once per lap of
 * the list: the old `(i * 3) % 10` noun index tied the noun to the adjective, so en had only 10 names and all 10
 * were registered, which made every roll fail (TASK-25341).
 */
export function* suggestionCandidates(locale: string, start: number): Generator<string> {
    for (let i = start; ; i++) {
        const name = isSpanish(locale)
            ? ES_NOUNS[i % 14] + ES_ADJS[Math.floor(i / 14) % 10]
            : EN_ADJS[i % 10] + EN_NOUNS[Math.floor(i / 10) % 10]
        if (usable(name)) yield name
    }
}

/** Free-name ideas for a taken name, in the order they are checked: name + digit, then the shortest adjectives. */
export function alternativeCandidates(name: string, locale: string): string[] {
    const digit = ((name.charCodeAt(0) + name.length) % 8) + 2
    const adjectives = [...(isSpanish(locale) ? ES_ADJS : EN_ADJS)].sort((a, b) => a.length - b.length)
    const candidates = [
        name.slice(0, USERNAME_MAX - 1) + String(digit),
        ...adjectives.map((adjective) => (isSpanish(locale) ? name + adjective : adjective + name)),
    ]
    return [...new Set(candidates)].filter((candidate) => candidate !== name && usable(candidate))
}

/**
 * The public, pre-auth availability lookup: the HTTP status, or null when the request failed. Capacitor's HTTP
 * layer has no HEAD, so native sends GET. 200 = taken, 404 = free, 400 = invalid.
 */
export async function lookupUsername(name: string): Promise<number | null> {
    try {
        const res = await apiFetch(`/users/username/${name}`, {
            method: isCapacitor() ? 'GET' : 'HEAD',
            includeAuth: false,
        })
        return res.status
    } catch {
        return null
    }
}

export async function checkUsernameFree(name: string): Promise<UsernameCheck> {
    const status = await lookupUsername(name)
    if (status === 404) return 'free'
    if (status === 200) return 'taken'
    if (status === 400) return 'invalid'
    return 'error'
}

/** The first candidates that check free, in order, with at most `maxTries` checks. */
export async function freeNames(
    candidates: Iterable<string>,
    check: (name: string) => Promise<UsernameCheck>,
    want: number,
    maxTries: number
): Promise<string[]> {
    const found: string[] = []
    let tries = 0
    for (const name of candidates) {
        if (tries >= maxTries || found.length >= want) break
        tries += 1
        if ((await check(name)) === 'free') found.push(name)
    }
    return found
}

export async function firstFreeName(
    candidates: Iterable<string>,
    check: (name: string) => Promise<UsernameCheck>,
    maxTries: number
): Promise<string | null> {
    return (await freeNames(candidates, check, 1, maxTries))[0] ?? null
}
