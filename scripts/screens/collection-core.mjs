import { captureProfile } from './capture-profiles.mjs'

const ID = /^[a-z0-9][a-z0-9-]{0,119}$/
const ASSET = /^[a-f0-9]{64}\.(?:png|webp)$/
const SHA = /^[a-f0-9]{40}$/
export const COLLECTION_LOCALES = ['en', 'es-419', 'es-AR', 'pt-BR']

function capturePresentation(capture) {
    if (capture.device === undefined) return null
    if (
        typeof capture.profile !== 'string' ||
        !Number.isInteger(capture.width) ||
        !Number.isInteger(capture.height) ||
        !capture.device ||
        typeof capture.device !== 'object'
    )
        throw new Error('Invalid collection capture presentation')
    const size = `${capture.width}x${capture.height}`
    let expected
    try {
        expected = captureProfile(size)
    } catch {
        throw new Error('Invalid collection capture presentation')
    }
    if (!capture.profile.endsWith(size) || JSON.stringify(capture.device) !== JSON.stringify(expected.device))
        throw new Error('Invalid collection capture presentation')
    return {
        profile: size,
        width: capture.width,
        height: capture.height,
        device: expected.device,
    }
}

function requiredText(value, label, maxLength) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength)
        throw new Error(`Invalid ${label}`)
    return value.trim()
}

function optionalText(value, label, maxLength) {
    if (value === undefined || value === null || value === '') return undefined
    return requiredText(value, label, maxLength)
}

export function normalizeCollectionSpec(input) {
    if (!input || typeof input !== 'object') throw new Error('Invalid collection request')
    const locales = input.locales?.length ? [...new Set(input.locales)] : ['en']
    if (locales.some((locale) => !COLLECTION_LOCALES.includes(locale))) throw new Error('Invalid collection locale')
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 200)
        throw new Error('A collection needs 1-200 screens')
    const seen = new Set()
    const items = input.items.map((item) => {
        if (!item || typeof item !== 'object' || !ID.test(item.id ?? '') || seen.has(item.id))
            throw new Error('Invalid or duplicate collection screen ID')
        seen.add(item.id)
        return {
            id: item.id,
            ...(optionalText(item.note, 'collection note', 1000) ? { note: item.note.trim() } : {}),
        }
    })
    return {
        title: requiredText(input.title, 'collection title', 120),
        ...(optionalText(input.description, 'collection description', 2000)
            ? { description: input.description.trim() }
            : {}),
        locales,
        items,
        captureMissing: input.captureMissing === true,
    }
}

export function collectionId(title, now = new Date(), entropy = crypto.randomUUID()) {
    const slug = title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48)
    const suffix = String(entropy)
        .toLowerCase()
        .replace(/[^a-f0-9]/g, '')
        .slice(0, 10)
    if (!suffix) throw new Error('Invalid collection entropy')
    return `${slug || 'screens'}-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${suffix}`
}

function validatePublishedCapture(report, locale) {
    if (
        report?.schema !== 1 ||
        report.type !== 'capture' ||
        report.locale !== locale ||
        !SHA.test(report.commit ?? '') ||
        !Array.isArray(report.screens)
    )
        throw new Error(`Invalid ${locale} source report`)
    return report
}

export function composeCollection({ id, spec: input, reports, reportPaths = {}, createdAt, createdBy }) {
    if (!ID.test(id ?? '')) throw new Error('Invalid collection ID')
    const spec = normalizeCollectionSpec(input)
    const timestamp = new Date(createdAt ?? Date.now())
    if (Number.isNaN(timestamp.getTime())) throw new Error('Invalid collection timestamp')
    const captures = Object.fromEntries(
        spec.locales.map((locale) => [locale, validatePublishedCapture(reports?.[locale], locale)])
    )
    const presentations = spec.locales.map((locale) => capturePresentation(captures[locale]))
    if (presentations.some((presentation) => JSON.stringify(presentation) !== JSON.stringify(presentations[0])))
        throw new Error('Collection capture presentations differ')
    const presentation = presentations[0]
    const indexes = Object.fromEntries(
        Object.entries(captures).map(([locale, capture]) => [locale, new Map(capture.screens.map((s) => [s.id, s]))])
    )
    const items = spec.items.map((requested, order) => {
        const candidate = spec.locales.map((locale) => indexes[locale].get(requested.id)).find(Boolean)
        const variants = Object.fromEntries(
            spec.locales.map((locale) => {
                const screen = indexes[locale].get(requested.id)
                if (screen?.status === 'captured' && ASSET.test(screen.image ?? ''))
                    return [
                        locale,
                        {
                            status: 'captured',
                            image: screen.image,
                            thumbnail: ASSET.test(screen.thumbnail ?? '') ? screen.thumbnail : screen.image,
                            commit: captures[locale].commit,
                        },
                    ]
                return [
                    locale,
                    {
                        status: 'missing',
                        reason: screen?.reason || 'This screen has not been captured in this locale yet.',
                        commit: captures[locale].commit,
                    },
                ]
            })
        )
        return {
            id: requested.id,
            order,
            name: optionalText(candidate?.name, 'screen name', 200) ?? requested.id,
            flow: optionalText(candidate?.flow, 'screen flow', 120) ?? 'Selected screens',
            kind: candidate?.kind === 'component' ? 'component' : 'route',
            ...(requested.note ? { note: requested.note } : {}),
            variants,
        }
    })
    const missing = items.flatMap((item) =>
        spec.locales
            .filter((locale) => item.variants[locale].status !== 'captured')
            .map((locale) => ({ id: item.id, locale }))
    )
    return {
        schema: 1,
        type: 'collection',
        id,
        title: spec.title,
        ...(spec.description ? { description: spec.description } : {}),
        createdAt: timestamp.toISOString(),
        ...(createdBy ? { createdBy: requiredText(createdBy, 'collection creator', 320) } : {}),
        locales: spec.locales,
        ...(presentation ?? {}),
        source: Object.fromEntries(
            spec.locales.map((locale) => [
                locale,
                {
                    commit: captures[locale].commit,
                    ...(reportPaths[locale]
                        ? { reportPath: requiredText(reportPaths[locale], 'report path', 500) }
                        : {}),
                },
            ])
        ),
        items,
        missing,
        complete: missing.length === 0,
        capture: { status: missing.length ? 'not-requested' : 'not-needed' },
    }
}

export function validateCollection(input) {
    if (input?.schema !== 1 || input.type !== 'collection' || !ID.test(input.id ?? ''))
        throw new Error('Unsupported collection schema')
    const spec = normalizeCollectionSpec({
        title: input.title,
        description: input.description,
        locales: input.locales,
        items: input.items,
    })
    if (!Array.isArray(input.items) || input.items.length !== spec.items.length)
        throw new Error('Invalid collection items')
    const items = input.items.map((item, order) => {
        if (item.order !== order) throw new Error('Invalid collection order')
        const variants = Object.fromEntries(
            spec.locales.map((locale) => {
                const variant = item.variants?.[locale]
                if (!variant || !['captured', 'missing'].includes(variant.status) || !SHA.test(variant.commit ?? ''))
                    throw new Error('Invalid collection variant')
                if (
                    variant.status === 'captured' &&
                    (!ASSET.test(variant.image ?? '') || !ASSET.test(variant.thumbnail ?? ''))
                )
                    throw new Error('Invalid collection asset')
                return [locale, variant]
            })
        )
        return {
            id: item.id,
            order,
            name: requiredText(item.name, 'screen name', 200),
            flow: requiredText(item.flow, 'screen flow', 120),
            kind: item.kind === 'component' ? 'component' : 'route',
            ...(optionalText(item.note, 'collection note', 1000) ? { note: item.note.trim() } : {}),
            variants,
        }
    })
    const missing = items.flatMap((item) =>
        spec.locales
            .filter((locale) => item.variants[locale].status !== 'captured')
            .map((locale) => ({ id: item.id, locale }))
    )
    const presentation = capturePresentation(input)
    return {
        ...input,
        title: spec.title,
        ...(spec.description ? { description: spec.description } : {}),
        locales: spec.locales,
        ...(presentation ?? {}),
        items,
        missing,
        complete: missing.length === 0,
    }
}

export function missingByLocale(collection) {
    const result = {}
    for (const { id, locale } of validateCollection(collection).missing) (result[locale] ??= []).push(id)
    return result
}
