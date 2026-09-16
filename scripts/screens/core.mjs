import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

export const hash = (data) => createHash('sha256').update(data).digest('hex')
const sha = /^[a-f0-9]{40}$/
const digest = /^[a-f0-9]{64}$/
const asset = /^[a-f0-9]{64}\.(png|webp)$/
const id = /^[a-z0-9][a-z0-9-]{0,119}$/
const supportedLocales = new Set(['en', 'es-419', 'es-AR', 'pt-BR'])
const routeOrigin = 'https://screen-library.invalid'
const assert = (ok, message) => {
    if (!ok) throw new Error(message)
}
const text = (value, max = 1000) => {
    assert(typeof value === 'string' && value.length <= max, 'Invalid text')
    return value
}
export function validateCapture(input) {
    assert(input?.schema === 1 && input.type === 'capture', 'Unsupported capture schema')
    assert(sha.test(input.commit) && sha.test(input.contentCommit), 'Invalid commit provenance')
    assert(digest.test(input.harness) && digest.test(input.fixtures), 'Missing harness/fixture identity')
    const captureLocale = input.locale ?? 'en'
    assert(supportedLocales.has(captureLocale), 'Invalid capture locale')
    assert(
        input.profile === `${captureLocale}-393x852` && input.width === 393 && input.height === 852,
        'Unsupported capture profile'
    )
    assert(
        Array.isArray(input.screens) && input.screens.length > 0 && input.screens.length <= 2000,
        'Invalid catalogue'
    )
    const seen = new Set()
    const screens = input.screens.map((s) => {
        assert(id.test(s.id) && !seen.has(s.id), 'Invalid/duplicate screen ID')
        seen.add(s.id)
        assert(['captured', 'failed', 'excluded', 'unavailable', 'absent'].includes(s.status), 'Invalid capture status')
        assert(['route', 'component'].includes(s.kind), 'Invalid screen kind')
        const out = { id: s.id, name: text(s.name), flow: text(s.flow), kind: s.kind, status: s.status }
        if (s.order !== undefined) {
            assert(Number.isInteger(s.order) && s.order >= 0 && s.order <= 1_000_000, 'Invalid screen order')
            out.order = s.order
        }
        if (s.journey !== undefined) out.journey = text(s.journey, 120)
        if (s.status === 'captured') {
            assert(
                asset.test(s.image) && s.image.endsWith('.png') && asset.test(s.thumbnail),
                'Invalid image reference'
            )
            out.image = s.image
            out.thumbnail = s.thumbnail
        } else out.reason = text(s.reason)
        return out
    })
    assert(Array.isArray(input.inventory ?? []) && (input.inventory ?? []).length <= 2000, 'Invalid route inventory')
    const inventory = (input.inventory ?? []).map((entry) => {
        if (entry.status === 'catalogued')
            assert(
                Array.isArray(entry.screens) &&
                    entry.screens.length > 0 &&
                    entry.screens.every((value) => seen.has(value)),
                'Inventory references missing screens'
            )
        else assert(typeof entry.reason === 'string' && entry.reason.trim().length > 0, 'Inventory needs a reason')
        assert(['catalogued', 'excluded', 'missing'].includes(entry.status), 'Invalid route inventory status')
        return {
            route: text(entry.route),
            status: entry.status,
            screens: (entry.screens ?? []).map((value) => text(value, 120)),
            ...(entry.reason ? { reason: text(entry.reason) } : {}),
        }
    })
    const adapterFiles = (input.adapterFiles ?? []).map((entry) => {
        assert(digest.test(entry.before) && digest.test(entry.after), 'Invalid adapter file digest')
        return { path: text(entry.path), before: entry.before, after: entry.after }
    })
    return {
        schema: 1,
        type: 'capture',
        commit: input.commit,
        publicBase: input.publicBase ? text(input.publicBase) : undefined,
        locale: captureLocale,
        contentCommit: input.contentCommit,
        harness: input.harness,
        fixtures: input.fixtures,
        environment: text(input.environment),
        adapter: text(input.adapter),
        capturedAt: text(input.capturedAt),
        reconstruction: !!input.reconstruction,
        profile: input.profile,
        width: input.width,
        height: input.height,
        screens,
        inventory,
        adapterFiles,
        complete:
            inventory.length > 0 &&
            inventory.every((entry) => entry.status !== 'missing') &&
            screens.some((s) => s.status === 'captured') &&
            screens.every((s) => ['captured', 'excluded', 'absent'].includes(s.status)),
    }
}
export function validateJourneys(input) {
    assert(
        input?.schema === 1 && input.type === 'journeys' && input.source === 'nutcracker',
        'Unsupported journey schema'
    )
    assert(
        sha.test(input.commit) && sha.test(input.uiCommit) && sha.test(input.apiCommit),
        'Invalid journey provenance'
    )
    const captureLocale = input.locale ?? 'en'
    assert(supportedLocales.has(captureLocale), 'Invalid journey locale')
    assert(
        typeof input.profile === 'string' &&
            input.profile.startsWith(`${captureLocale}-`) &&
            Number.isInteger(input.width) &&
            input.width >= 240 &&
            input.width <= 2000 &&
            Number.isInteger(input.height) &&
            input.height >= 240 &&
            input.height <= 2000,
        'Invalid journey capture profile'
    )
    assert(
        Array.isArray(input.screens) && input.screens.length > 0 && input.screens.length <= 2000,
        'Invalid journey catalogue'
    )
    const seen = new Set()
    const screens = input.screens.map((s) => {
        assert(id.test(s.id) && !seen.has(s.id), 'Invalid/duplicate journey ID')
        seen.add(s.id)
        assert(['passed', 'failed'].includes(s.status), 'Invalid journey status')
        assert(
            asset.test(s.image) && s.image.endsWith('.png') && asset.test(s.thumbnail) && s.thumbnail.endsWith('.webp'),
            'Invalid journey image'
        )
        let route
        try {
            route = new URL(s.route, routeOrigin)
        } catch {}
        assert(
            typeof s.route === 'string' &&
                s.route.length <= 1000 &&
                route?.origin === routeOrigin &&
                route.pathname === s.route,
            'Invalid journey route'
        )
        assert(['full-e2e', 'partial-e2e'].includes(s.trustTier), 'Invalid journey trust tier')
        return {
            id: s.id,
            name: text(s.name),
            flow: text(s.flow),
            kind: 'route',
            status: s.status,
            image: s.image,
            thumbnail: s.thumbnail,
            route: s.route,
            trustTier: s.trustTier,
            ...(s.status === 'failed' ? { reason: text(s.reason || 'Journey assertion failed') } : {}),
        }
    })
    const failedScreens = screens.filter((screen) => screen.status === 'failed').length
    assert(
        Number.isInteger(input.attemptedSteps) &&
            input.attemptedSteps >= screens.length &&
            input.attemptedSteps <= 10000 &&
            Number.isInteger(input.failedSteps) &&
            input.failedSteps >= failedScreens &&
            input.failedSteps <= input.attemptedSteps &&
            Number.isInteger(input.omittedFailedSteps) &&
            input.omittedFailedSteps === input.failedSteps - failedScreens,
        'Invalid journey run counts'
    )
    return {
        schema: 1,
        type: 'journeys',
        source: 'nutcracker',
        commit: input.commit,
        uiCommit: input.uiCommit,
        apiCommit: input.apiCommit,
        locale: captureLocale,
        environment: text(input.environment),
        capturedAt: text(input.capturedAt),
        profile: input.profile,
        width: input.width,
        height: input.height,
        attemptedSteps: input.attemptedSteps,
        failedSteps: input.failedSteps,
        omittedFailedSteps: input.omittedFailedSteps,
        screens,
        complete:
            input.complete === true &&
            input.failedSteps === 0 &&
            input.omittedFailedSteps === 0 &&
            screens.every((screen) => screen.status === 'passed'),
    }
}
export function sameEnvironment(a, b) {
    return ['harness', 'fixtures', 'environment', 'profile', 'locale', 'adapter', 'publicBase'].every(
        (k) => a[k] === b[k]
    )
}
export function verifyAsset(dir, name, { variableDimensions = false } = {}) {
    assert(asset.test(name), 'Unsafe asset name')
    const data = readFileSync(join(dir, name))
    assert(data.length < 8 * 1024 * 1024 && hash(data) === name.split('.')[0], 'Asset integrity failure')
    if (name.endsWith('.png')) {
        assert(data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid PNG')
        const width = data.readUInt32BE(16),
            height = data.readUInt32BE(20)
        assert(
            variableDimensions
                ? width >= 240 && width <= 2400 && height >= 240 && height <= 12000 && width * height <= 16_000_000
                : width === 393 && height === 852,
            'Unexpected PNG dimensions'
        )
        PNG.sync.read(data)
    } else {
        assert(data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP', 'Invalid WebP')
    }
    return data
}
export function storeAsset(dir, data, extension = 'png') {
    mkdirSync(dir, { recursive: true })
    const name = `${hash(data)}.${extension}`
    if (!existsSync(join(dir, name))) writeFileSync(join(dir, name), data)
    return name
}
export function compare(beforeInput, afterInput, assetsDir) {
    const before = validateCapture(beforeInput),
        after = validateCapture(afterInput)
    assert(
        sameEnvironment(before, after),
        'Capture environments differ; recapture both with the same harness, fixtures and renderer'
    )
    const left = new Map(before.screens.map((s) => [s.id, s])),
        right = new Map(after.screens.map((s) => [s.id, s]))
    const screenIds = [...new Set([...left.keys(), ...right.keys()])].sort((leftId, rightId) => {
        const leftScreen = right.get(leftId) ?? left.get(leftId)
        const rightScreen = right.get(rightId) ?? left.get(rightId)
        const leftOrder = Number.isInteger(leftScreen?.order) ? leftScreen.order : Number.MAX_SAFE_INTEGER
        const rightOrder = Number.isInteger(rightScreen?.order) ? rightScreen.order : Number.MAX_SAFE_INTEGER
        return leftOrder - rightOrder || leftId.localeCompare(rightId)
    })
    const screens = screenIds.map((id) => {
        const a = left.get(id),
            b = right.get(id),
            metadata = b ?? a
        const row = {
            id,
            name: metadata.name,
            flow: metadata.flow,
            kind: metadata.kind,
            ...(metadata.order !== undefined ? { order: metadata.order } : {}),
            ...(metadata.journey !== undefined ? { journey: metadata.journey } : {}),
            before: a,
            after: b,
        }
        if (a?.status === 'absent' && b?.status === 'captured') return { ...row, status: 'added' }
        if (b?.status === 'absent' && a?.status === 'captured') return { ...row, status: 'removed' }
        // Missing/failed capture is never proof of a product addition/removal.
        const gapStatuses = [a?.status, b?.status].filter((status) => status && status !== 'captured')
        if (gapStatuses.length) {
            const status = ['failed', 'unavailable', 'excluded', 'absent'].find((candidate) =>
                gapStatuses.includes(candidate)
            )
            return { ...row, status: status ?? 'unavailable' }
        }
        if (!a) return { ...row, status: before.complete ? 'added' : 'unavailable' }
        if (!b) return { ...row, status: after.complete ? 'removed' : 'unavailable' }
        const ad = verifyAsset(assetsDir, a.image),
            bd = verifyAsset(assetsDir, b.image)
        if (a.image === b.image) return { ...row, status: 'unchanged', pixels: 0, percent: 0 }
        const ap = PNG.sync.read(ad),
            bp = PNG.sync.read(bd),
            diff = new PNG({ width: 393, height: 852 })
        const pixels = pixelmatch(ap.data, bp.data, diff.data, 393, 852, { threshold: 0.1 })
        return {
            ...row,
            status: pixels ? 'changed' : 'unchanged',
            pixels,
            percent: (pixels / (393 * 852)) * 100,
            ...(pixels ? { diff: storeAsset(assetsDir, PNG.sync.write(diff)) } : {}),
        }
    })
    assert(before.locale === after.locale, 'Capture locales differ; compare the same locale')
    return {
        schema: 1,
        type: 'comparison',
        locale: before.locale,
        before,
        after,
        complete: before.complete && after.complete,
        screens,
    }
}
export function reviewRefs(base, head, git) {
    assert(sha.test(base) && sha.test(head), 'Expected immutable SHAs')
    return { before: git(['merge-base', base, head]).trim(), after: head }
}
export function mergeRefs(head, git) {
    assert(sha.test(head), 'Expected immutable SHA')
    return { before: git(['rev-parse', `${head}^1`]).trim(), after: head }
}

export function materializeCatalogue(catalogue, results) {
    const byId = new Map(results.map((s) => [s.id, s]))
    return catalogue.map(
        (s) =>
            byId.get(s.id) ?? {
                id: s.id,
                name: s.name,
                flow: s.flow,
                kind: s.kind,
                ...(s.order !== undefined ? { order: s.order } : {}),
                ...(s.journey !== undefined ? { journey: s.journey } : {}),
                status: 'unavailable',
                reason: 'Capture has not completed this state',
            }
    )
}
