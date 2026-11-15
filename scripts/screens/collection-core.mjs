import { captureProfile } from './capture-profiles.mjs'

const ID = /^[a-z0-9][a-z0-9-]{0,119}$/
const ASSET = /^[a-f0-9]{64}\.(?:png|webp)$/
const SHA = /^[a-f0-9]{40}$/
export const COMPARISON_REPORT_PATH =
    /^\d{4}-\d{2}-\d{2}\/(?:compare-dev|compare-main|pr-[1-9][0-9]*|compare-main-\d{4}-\d{2}-\d{2})\/(?:en|es-419|es-ar|pt-br)\/[a-f0-9]{40}(?:\/run-[0-9]+-[0-9]+)?$/
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
    return normalizeSelectionSpec(input, false)
}

function normalizeSelectionSpec(input, flowPage) {
    if (!input || typeof input !== 'object') throw new Error('Invalid collection request')
    const locales = input.locales?.length ? [...new Set(input.locales)] : ['en']
    if (locales.some((locale) => !COLLECTION_LOCALES.includes(locale))) throw new Error('Invalid collection locale')
    if (!Array.isArray(input.items) || !input.items.length || (!flowPage && input.items.length > 200))
        throw new Error(flowPage ? 'A flow page needs at least one screen' : 'A collection needs 1-200 screens')
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

export const FLOW_PAGE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/

function onlyFields(input, fields, label) {
    if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).some((key) => !fields.includes(key))
    )
        throw new Error(`Unsupported ${label} field`)
}

function normalizeSections(input) {
    if (!Array.isArray(input) || !input.length) throw new Error('A flow page needs at least one section')
    return input.map((section) => {
        onlyFields(section, ['title', 'flows'], 'section')
        return { title: requiredText(section.title, 'section title', 120), flows: normalizeFlows(section.flows) }
    })
}

function normalizeFlows(input) {
    if (!Array.isArray(input) || input.length < 1) throw new Error('A flow page needs at least one titled flow')
    return input.map((flow) => {
        onlyFields(flow, ['title', 'items'], 'flow')
        const title = requiredText(flow?.title, 'flow title', 120)
        if (!Array.isArray(flow.items) || !flow.items.length) throw new Error('Each flow needs at least one screen')
        return {
            title,
            items: flow.items.map((item) => {
                onlyFields(item, ['id', 'note'], 'flow screen')
                if (typeof item?.id !== 'string' || !ID.test(item.id)) throw new Error('Invalid flow screen ID')
                const note = optionalText(item.note, 'flow note', 1000)
                return { id: item.id, ...(note ? { note } : {}) }
            }),
        }
    })
}

export function normalizeFlowPageSpec(input) {
    onlyFields(
        input,
        ['title', 'description', 'locales', 'flows', 'sections', 'compareWith', 'requestId'],
        'flow page request'
    )
    if ((input.flows !== undefined) === (input.sections !== undefined))
        throw new Error('Invalid flow page: provide exactly one of flows or sections')
    const sections = input.sections === undefined ? undefined : normalizeSections(input.sections)
    const flows = sections ? sections.flatMap((section) => section.flows) : normalizeFlows(input.flows)
    if (input.compareWith !== undefined && input.compareWith !== 'main') throw new Error('Invalid comparison base')
    const compareWith = input.compareWith ?? (sections ? 'main' : undefined)
    const requestId = input.requestId
    if (requestId !== undefined && (typeof requestId !== 'string' || !FLOW_PAGE_REQUEST_ID.test(requestId)))
        throw new Error('Invalid flow page request ID')
    if (
        input.locales !== undefined &&
        (!Array.isArray(input.locales) || !input.locales.length || input.locales.length > COLLECTION_LOCALES.length)
    )
        throw new Error('Invalid flow page locales')
    const ids = new Set(flows.flatMap((flow) => flow.items.map((item) => item.id)))
    const spec = normalizeSelectionSpec(
        {
            title: input.title,
            description: input.description,
            locales: input.locales,
            items: Array.from(ids, (id) => ({ id })),
        },
        true
    )
    return { ...spec, flows, ...(sections ? { sections } : {}), ...(compareWith ? { compareWith } : {}), requestId }
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

function publishedFlowScreenName(name) {
    if (typeof name !== 'string' || !name.trim()) throw new Error('Invalid screen name')
    return name
}

export function composeCollection({
    id,
    spec: input,
    reports,
    reportPaths = {},
    createdAt,
    createdBy,
    flows,
    sections,
    compareWith,
    comparisons,
}) {
    if (!ID.test(id ?? '')) throw new Error('Invalid collection ID')
    const spec = normalizeSelectionSpec(input, flows !== undefined)
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
            name:
                flows && candidate?.name != null && candidate.name !== ''
                    ? publishedFlowScreenName(candidate.name)
                    : (optionalText(candidate?.name, 'screen name', 200) ?? requested.id),
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
        ...(flows ? { flows } : {}),
        ...(sections ? { sections } : {}),
        ...(compareWith ? { compareWith, comparisons } : {}),
        missing,
        complete: missing.length === 0,
        capture: { status: missing.length ? 'not-requested' : 'not-needed' },
    }
}

export function validateCollection(input) {
    if (input?.schema !== 1 || input.type !== 'collection' || !ID.test(input.id ?? ''))
        throw new Error('Unsupported collection schema')
    const flows = input.flows === undefined ? undefined : normalizeFlows(input.flows)
    const sections = input.sections === undefined ? undefined : normalizeSections(input.sections)
    if (sections && (!flows || JSON.stringify(flows) !== JSON.stringify(sections.flatMap((section) => section.flows))))
        throw new Error('Invalid section flow references')
    if (sections && input.complete !== true) throw new Error('Invalid incomplete section flow page')
    if (sections && input.compareWith !== 'main') throw new Error('Invalid section comparison base')
    if (input.compareWith !== undefined || input.comparisons !== undefined) {
        if (
            !flows ||
            input.compareWith !== 'main' ||
            !input.comparisons ||
            typeof input.comparisons !== 'object' ||
            Array.isArray(input.comparisons)
        )
            throw new Error('Invalid collection comparisons')
        const locales = new Set(input.locales)
        if (
            Object.keys(input.comparisons).length !== locales.size ||
            Object.keys(input.comparisons).some((locale) => !locales.has(locale))
        )
            throw new Error('Invalid collection comparison locales')
        for (const locale of locales) {
            const pin = input.comparisons[locale]
            onlyFields(pin, ['path', 'baseBranch', 'beforeCommit', 'afterCommit'], 'comparison')
            if (
                pin.baseBranch !== 'main' ||
                !COMPARISON_REPORT_PATH.test(pin.path ?? '') ||
                !SHA.test(pin.beforeCommit ?? '') ||
                !SHA.test(pin.afterCommit ?? '') ||
                pin.path.split('/')[2] !== locale.toLowerCase() ||
                pin.path.split('/')[3] !== pin.afterCommit ||
                input.source?.[locale]?.commit !== pin.afterCommit ||
                input.items?.some((item) => item.variants?.[locale]?.commit !== pin.afterCommit)
            )
                throw new Error('Invalid collection comparison pin')
        }
    }
    const spec = normalizeSelectionSpec(input, flows !== undefined)
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
            name: flows ? publishedFlowScreenName(item.name) : requiredText(item.name, 'screen name', 200),
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
    if (flows) {
        const referenced = new Set(flows.flatMap((flow) => flow.items.map((item) => item.id)))
        if (missing.length || referenced.size !== items.length || items.some((item) => !referenced.has(item.id)))
            throw new Error('Invalid flow page asset references')
    }
    const presentation = capturePresentation(input)
    return {
        ...input,
        title: spec.title,
        ...(spec.description ? { description: spec.description } : {}),
        locales: spec.locales,
        ...(presentation ?? {}),
        items,
        ...(flows ? { flows } : {}),
        ...(sections ? { sections } : {}),
        missing,
        complete: missing.length === 0,
    }
}

export function missingByLocale(collection) {
    const result = {}
    for (const { id, locale } of validateCollection(collection).missing) (result[locale] ??= []).push(id)
    return result
}
