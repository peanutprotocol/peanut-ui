// Stress mode for fixtures (TASK-23132): `?__fixture=<name>&__stress=1`
// rewrites every API answer with worst-case values — long and unusual names,
// huge and tiny amounts, long lists — so any fixture doubles as a stress test.
// Loaded only from respond.ts, so it inherits the DEV_TOOLS_ENABLED gate.

export const STRESS_PARAM = '__stress'
export const STRESS_STORAGE_KEY = 'peanut_fixture_stress'

/** Reads `?__stress=1|0` first, then the session, like the fixture name itself. */
export function isStressActive(): boolean {
    if (typeof window === 'undefined') return false
    const fromUrl = new URLSearchParams(window.location.search).get(STRESS_PARAM)
    try {
        if (fromUrl === '1') window.sessionStorage.setItem(STRESS_STORAGE_KEY, '1')
        if (fromUrl === '0') window.sessionStorage.removeItem(STRESS_STORAGE_KEY)
        return window.sessionStorage.getItem(STRESS_STORAGE_KEY) === '1'
    } catch {
        return fromUrl === '1'
    }
}

const LONG_TEXT = 'Pago de alquiler compartido del departamento, expensas, luz y gas de septiembre. '
    .repeat(4)
    .slice(0, 280)

export const STRESS_VALUES = {
    name: [
        'Maximiliano Alejandro Fernández de la Vega y Santibáñez',
        'Wolfeschlegelsteinhausenbergerdorffwelchevoralternwarengewissenhaft',
        'محمد عبد الرحمن الشمري',
        '王小明 👩🏽‍💻 Zoë Ångström',
        '<b>hi</b> & "quotes"',
        '  Ana​Maria‍  ',
    ],
    // usernames stay URL-safe: they end up in routes like /<username>
    username: ['maximilianoalejandrofernandezdelavegaysantibanez', 'x'],
    email: [
        `${'a'.repeat(64)}@${'sub'.repeat(20)}.${'b'.repeat(60)}.${'c'.repeat(60)}.example.com`.slice(0, 254),
        'ana+peanut-savings@mail.sub.example.co',
        'usuario@correo.españa',
    ],
    text: [LONG_TEXT, 'x', '🥜🥜🥜 <script>alert(1)</script> שלום 你好'],
    amount: ['999999999.99', '0.000001', '0', '123456789.123456789012345678'],
}

const KEYS: Record<keyof typeof STRESS_VALUES, Set<string>> = {
    name: new Set(['fullName', 'firstName', 'lastName', 'name', 'accountOwnerName', 'bankName', 'displayName']),
    username: new Set(['username']),
    email: new Set(['email']),
    text: new Set(['memo', 'label', 'description', 'note']),
    amount: new Set(['amount', 'usdAmount', 'tokenAmount', 'amountUsd', 'amountInUsd']),
}

// lists that hold rows a user scrolls (history, contacts); other arrays
// (rails, capabilities) are config, and duplicating them changes app logic
const LIST_KEYS = new Set(['entries', 'contacts'])
const LIST_LENGTH = 50
const ID_KEYS = new Set(['id', 'uuid', 'userId'])

const kindOf = (key: string) =>
    (Object.keys(KEYS) as (keyof typeof STRESS_VALUES)[]).find((kind) => KEYS[kind].has(key))

/**
 * Returns a copy of an API answer with worst-case values. Only non-empty
 * strings and numeric amounts change, so an absent field stays absent and an
 * empty state stays empty. Values cycle, so neighbouring rows differ.
 */
export function stressResponse(data: unknown): unknown {
    // one counter per kind, so neighbouring rows get different values
    const turns: Partial<Record<keyof typeof STRESS_VALUES, number>> = {}
    const pick = (kind: keyof typeof STRESS_VALUES) => {
        const turn = (turns[kind] = (turns[kind] ?? -1) + 1)
        return STRESS_VALUES[kind][turn % STRESS_VALUES[kind].length]
    }

    const walk = (value: unknown, key: string): unknown => {
        if (Array.isArray(value)) {
            if (!LIST_KEYS.has(key) || value.length === 0 || typeof value[0] !== 'object') {
                return value.map((item) => walk(item, ''))
            }
            return Array.from({ length: LIST_LENGTH }, (_, i) => {
                const row = walk(value[i % value.length], '') as Record<string, unknown>
                for (const id of ID_KEYS) if (typeof row[id] === 'string') row[id] = `${row[id]}-stress-${i}`
                return row
            })
        }
        if (typeof value === 'object' && value !== null) {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]))
        }
        const kind = kindOf(key)
        if (!kind) return value
        if (kind === 'amount') {
            if (typeof value === 'number') return Number(pick('amount'))
            return typeof value === 'string' && value !== '' && !Number.isNaN(Number(value)) ? pick('amount') : value
        }
        return typeof value === 'string' && value !== '' ? pick(kind) : value
    }

    return walk(data, '')
}
