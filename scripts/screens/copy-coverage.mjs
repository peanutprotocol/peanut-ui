export const COPY_LOCALES = ['en', 'es-419', 'es-AR', 'pt-BR']
export const COPY_EXCEPTION_PREFIX = 'Screen Library copy exception:'
export const COPY_SHOWN_LIMIT = 5000
const copyKey = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/
const exceptionLine = /^Screen Library copy exception:[ \t]*(\S[^\r\n]*)$/gm
const separator = '\u0000'

export const isCopyKey = (value) => typeof value === 'string' && value.length <= 300 && copyKey.test(value)

function merge(base, override) {
    const result = { ...base }
    for (const [key, value] of Object.entries(override ?? {})) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            result[key] &&
            typeof result[key] === 'object'
        )
            result[key] = merge(result[key], value)
        else if (value !== null && value !== undefined) result[key] = value
    }
    return result
}

/** The catalogue a locale renders: es-AR stores deltas over es-419, which stores deltas over English. */
export function localeMessages(locale, read) {
    if (!COPY_LOCALES.includes(locale)) throw new Error(`Unsupported copy locale: ${locale}`)
    const english = read('en')
    if (locale === 'en') return english
    const regional = merge(english, read(locale === 'es-AR' ? 'es-419' : locale))
    return locale === 'es-AR' ? merge(regional, read('es-AR')) : regional
}

export function flattenMessages(messages, prefix = '', out = new Map()) {
    for (const [key, value] of Object.entries(messages ?? {})) {
        const path = prefix ? `${prefix}.${key}` : key
        if (typeof value === 'string') out.set(path, value)
        else if (value && typeof value === 'object' && !Array.isArray(value)) flattenMessages(value, path, out)
    }
    return out
}

export const normalizeCopy = (value) => value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US')

function splitTopLevel(template) {
    const text = []
    const args = []
    let depth = 0
    let start = -1
    let buffer = ''
    for (let i = 0; i < template.length; i++) {
        const char = template[i]
        if (char === "'" && template[i + 1] === "'") {
            if (depth === 0) buffer += "'"
            i++
        } else if (char === '{') {
            if (depth === 0) {
                text.push(buffer)
                buffer = ''
                start = i
            }
            depth++
        } else if (char === '}' && depth > 0) {
            depth--
            if (depth === 0) args.push(template.slice(start + 1, i))
        } else if (depth === 0) buffer += char
    }
    text.push(buffer)
    return { text, args }
}

function literalFragments(pieces) {
    return pieces
        .flatMap((piece) => piece.replace(/<\/?[A-Za-z0-9_-]+\s*\/?>/g, separator).split(separator))
        .map(normalizeCopy)
        .filter((fragment) => fragment.replace(/[^\p{L}\p{N}]/gu, '').length >= 2)
}

function branchBodies(argument) {
    const match = /^\s*[A-Za-z0-9_]+\s*,\s*(plural|select|selectordinal)\s*,(.*)$/s.exec(argument)
    if (!match) return []
    const bodies = []
    const rest = match[2]
    let depth = 0
    let start = -1
    for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '{') {
            if (depth === 0) start = i
            depth++
        } else if (rest[i] === '}' && depth > 0) {
            depth--
            if (depth === 0) bodies.push(rest.slice(start + 1, i).replaceAll('#', '{n}'))
        }
    }
    return bodies
}

/** Whether a message's literal text is on the page; plural and select need any one branch. */
export function copyVisible(template, corpus) {
    const { text, args } = splitTopLevel(template)
    if (!literalFragments(text).every((fragment) => corpus.includes(fragment))) return false
    return args.every((argument) => {
        const bodies = branchBodies(argument)
        return !bodies.length || bodies.some((body) => copyVisible(body, corpus))
    })
}

export function copyVerifiable(template) {
    const { text, args } = splitTopLevel(template)
    return (
        literalFragments(text).length > 0 ||
        args.some((argument) => branchBodies(argument).some((body) => copyVerifiable(body)))
    )
}

/** A key is shown when the state resolved it and its literal text is in the rendered page. */
export function shownCopyKeys({ resolved, corpus }) {
    if (!Array.isArray(resolved) || typeof corpus !== 'string') throw new Error('Invalid copy evidence')
    const page = normalizeCopy(corpus)
    const shown = new Set()
    for (const entry of resolved) {
        if (!Array.isArray(entry) || entry.length !== 2) continue
        const [key, template] = entry
        if (isCopyKey(key) && typeof template === 'string' && copyVisible(template, page)) shown.add(key)
    }
    return [...shown].sort()
}

export function shownInCapture(capture) {
    const shown = new Map()
    for (const screen of capture?.screens ?? [])
        if (screen.status === 'captured' && Array.isArray(screen.copy))
            for (const key of screen.copy) shown.set(key, [...(shown.get(key) ?? []), screen.id])
    return shown
}

/** Every app copy key, the states that show it, and the keys no captured state shows. */
export function copyCoverage(capture, catalogue) {
    if (capture?.copyRecording !== 'recorded') throw new Error('Capture has no shown-copy recording')
    const shown = shownInCapture(capture)
    const keys = [...catalogue.keys()].sort()
    const neverShown = keys.filter((key) => !shown.has(key))
    return {
        schema: 1,
        commit: capture.commit,
        locale: capture.locale,
        complete: capture.complete === true,
        total: keys.length,
        shown: keys.length - neverShown.length,
        unverifiable: keys.filter((key) => !copyVerifiable(catalogue.get(key))).length,
        neverShown: neverShown.map((key) => ({ key, text: catalogue.get(key) })),
        shownBy: Object.fromEntries(keys.filter((key) => shown.has(key)).map((key) => [key, shown.get(key)])),
    }
}

export function changedCopyKeys(before, after) {
    return [...after.keys()].filter((key) => before.get(key) !== after.get(key)).sort()
}

export function parseCopyBaseline(input) {
    if (!input || input.schema !== 1 || !input.keys || typeof input.keys !== 'object' || Array.isArray(input.keys))
        throw new Error('Invalid copy coverage baseline')
    const baseline = new Map()
    for (const [key, reason] of Object.entries(input.keys)) {
        if (!isCopyKey(key) || typeof reason !== 'string' || !reason.trim() || reason.length > 300)
            throw new Error(`Invalid copy coverage baseline entry: ${key}`)
        baseline.set(key, reason)
    }
    return baseline
}

export function hasCopyException(body) {
    if (typeof body !== 'string') return false
    return [...body.matchAll(exceptionLine)].some((match) => {
        const reason = match[1].trim()
        return !!reason && !/^<[^>]+>$|^(?:tbd|todo)$/i.test(reason)
    })
}

const listed = (keys, limit = 12) =>
    `${keys.slice(0, limit).join(', ')}${keys.length > limit ? ` and ${keys.length - limit} more` : ''}`

/**
 * PR copy check. reports: [{ locale, before, after }] captures; catalogues: { [locale]: { before, after } }
 * key→text maps; baseline: { before, after } key→reason maps (before may be null when the file is new).
 */
export function evaluateCopyGate({ event, supported, reports, catalogues, baseline, exception }) {
    const result = { unshownChanged: [], newGaps: [], stale: [], grown: [], lost: [] }
    if (event !== 'pull_request') return { ok: true, reason: 'No PR copy check for integration runs.', ...result }
    if (!supported) return { ok: true, reason: 'This PR’s capture harness predates shown-copy recording.', ...result }
    if (!Array.isArray(reports) || !reports.length || !baseline?.after)
        return { ok: false, reason: 'Copy check needs captures and the copy baseline.', ...result }
    const unrecorded = reports.filter(({ after }) => after?.copyRecording !== 'recorded').map(({ locale }) => locale)
    if (unrecorded.length)
        return {
            ok: false,
            reason: `Shown-copy recording is unavailable for ${unrecorded.join(', ')}: scripts/screens/prepare.mjs could not patch src/i18n/app/IntlCore.tsx.`,
            ...result,
        }
    const excepted = hasCopyException(exception)
    for (const { locale, before, after } of reports) {
        const catalogue = catalogues?.[locale]
        if (!catalogue?.after) return { ok: false, reason: `Copy catalogue missing for ${locale}.`, ...result }
        const shownAfter = shownInCapture(after)
        const scoped = !!after.scope
        if (catalogue.before)
            for (const key of changedCopyKeys(catalogue.before, catalogue.after))
                if (!shownAfter.has(key)) result.unshownChanged.push(locale === 'en' ? key : `${key} (${locale})`)
        if (scoped && before?.copyRecording === 'recorded') {
            const shownBefore = shownInCapture(before)
            for (const key of shownBefore.keys())
                if (catalogue.after.has(key) && !shownAfter.has(key) && !baseline.after.has(key))
                    result.lost.push(locale === 'en' ? key : `${key} (${locale})`)
        }
        if (locale === 'en' && !scoped) {
            for (const key of baseline.after.keys())
                if (shownAfter.has(key) || !catalogue.after.has(key)) result.stale.push(key)
            if (after.complete === true)
                for (const key of catalogue.after.keys())
                    if (!shownAfter.has(key) && !baseline.after.has(key)) result.newGaps.push(key)
        }
    }
    if (baseline.before) for (const key of baseline.after.keys()) if (!baseline.before.has(key)) result.grown.push(key)
    for (const list of Object.values(result)) list.sort()
    const problems = []
    if (result.unshownChanged.length && !excepted)
        problems.push(
            `${result.unshownChanged.length} changed copy key(s) appear in no captured state: ${listed(result.unshownChanged)}.`
        )
    if (result.lost.length && !excepted)
        problems.push(`${result.lost.length} copy key(s) are no longer shown by these states: ${listed(result.lost)}.`)
    if (result.newGaps.length)
        problems.push(
            `${result.newGaps.length} copy key(s) are shown by no state and missing from scripts/screens/copy-coverage-baseline.json: ${listed(result.newGaps)}.`
        )
    if (result.stale.length)
        problems.push(
            `${result.stale.length} baseline entr${result.stale.length === 1 ? 'y is' : 'ies are'} now shown or deleted; remove from scripts/screens/copy-coverage-baseline.json: ${listed(result.stale)}.`
        )
    if (result.grown.length && !excepted)
        problems.push(
            `scripts/screens/copy-coverage-baseline.json grew by ${result.grown.length} key(s) (${listed(result.grown)}) without a “${COPY_EXCEPTION_PREFIX} <reason>” line.`
        )
    if (!problems.length)
        return {
            ok: true,
            reason:
                excepted && (result.unshownChanged.length || result.lost.length || result.grown.length)
                    ? 'Unshown copy accepted by the explicit copy exception.'
                    : 'Every changed copy key is shown by a captured state.',
            ...result,
        }
    return {
        ok: false,
        reason: `${problems.join(' ')} Add a capture state that shows the copy, or add the keys to the baseline with “${COPY_EXCEPTION_PREFIX} <reason>” on its own line in the PR description.`,
        ...result,
    }
}
