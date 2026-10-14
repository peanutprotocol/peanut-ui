/* Trusted viewer: report strings are always text, never HTML or executable URLs. */
'use strict'
const $ = (id) => document.getElementById(id)
const el = (tag, value, className) => {
    const n = document.createElement(tag)
    if (value !== undefined) n.textContent = value
    if (className) n.className = className
    return n
}
const offline = location.protocol === 'file:'
const assetBase = offline ? './assets/' : '/screen-data/assets/'
const LOCALE_LABELS = {
    en: 'English',
    'es-419': 'Español',
    'es-AR': 'Español (Argentina)',
    'pt-BR': 'Português (Brasil)',
}
const LOCALE_CODES = {
    en: 'EN',
    'es-419': 'ES-419',
    'es-AR': 'ES-AR',
    'pt-BR': 'PT-BR',
}
const localeLabel = (locale) => LOCALE_LABELS[locale] ?? locale ?? 'English'
const localeCode = (locale) => LOCALE_CODES[locale] ?? locale ?? 'EN'
const SOURCE_LABELS = { synthetic: 'App states', nutcracker: 'Real journeys' }
const LEGACY_DEVICE_PROFILES = {
    '393x852': { platform: 'iphone', label: 'iPhone' },
    '440x956': { platform: 'iphone', label: 'iPhone Pro Max' },
    '360x800': { platform: 'android', label: 'Android' },
    '320x712': { platform: 'android', label: 'Android small' },
}
const VISUAL_CHANGE_STATUSES = new Set(['changed', 'added', 'new', 'removed'])
// Older immutable reports used any nonzero pixel count as a change. Apply the
// same two-decimal threshold as core.mjs before filtering or counting their rows.
const normalizeComparison = (comparison) => ({
    ...comparison,
    screens: comparison.screens.map((row) => {
        // Old immutable reports marked the whole pair unavailable when only the baseline lacked a harness.
        if (
            row.status === 'unavailable' &&
            row.before?.status === 'unavailable' &&
            row.after?.status === 'captured' &&
            row.after.image
        )
            return { ...row, status: 'new' }
        if (
            row.status === 'changed' &&
            Number.isFinite(row.percent) &&
            row.percent >= 0 &&
            Number(row.percent.toFixed(2)) === 0
        )
            return { ...row, status: 'unchanged', belowThreshold: true, diff: undefined }
        return row
    }),
})
const explicitNonvisualStatus = (status) =>
    Boolean(status) && status !== 'differences' && !VISUAL_CHANGE_STATUSES.has(status)
const entrySource = (entry) => entry?.source ?? 'synthetic'
const entryBranch = (entry) => {
    const channel = entry.path.split('/')[1] ?? ''
    if (/^compare-main-\d{4}-\d{2}-\d{2}$/.test(channel) && (!entry.branch || entry.branch === channel)) return 'main'
    if (entry.branch) return entry.branch
    if (channel === 'main' || channel === 'compare-main' || channel.startsWith('main-')) return 'main'
    if (channel === 'dev' || channel === 'compare-dev' || channel.startsWith('dev-')) return 'dev'
    return channel
}
const entryProfile = (entry) => entry?.profile ?? '393x852'
const localeSlugs = new Set(['en', 'es-419', 'es-ar', 'pt-br'])
const withoutLocale = (path) =>
    path
        .split('/')
        .filter((segment) => !localeSlugs.has(segment))
        .join('/')
const sortLocales = (locales) =>
    [...new Set(locales)].sort((a, b) => {
        if (a === 'en') return -1
        if (b === 'en') return 1
        return a.localeCompare(b)
    })
const formatCaptureDate = (value) => {
    const date = new Date(value ?? '')
    return Number.isNaN(date.getTime())
        ? ''
        : new Intl.DateTimeFormat('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
          }).format(date)
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const parseIsoDate = (value) => {
    if (!ISO_DATE.test(value ?? '')) return null
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}
const isoDate = (date) => date.toISOString().slice(0, 10)
const shortDateParts = (value) => {
    const date = parseIsoDate(value)
    return date ? { day: String(date.getUTCDate()), month: MONTHS[date.getUTCMonth()] } : { day: value, month: '' }
}
// History reads published observations only; gaps never establish product absence.
function historyTimestamp(value) {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
    )
        return null
    if (!parseIsoDate(value.slice(0, 10))) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}
function screenHistoryDate(value, now = new Date()) {
    const date = historyTimestamp(value)
    return date
        ? {
              day: String(date.getUTCDate()),
              month: MONTHS[date.getUTCMonth()],
              year: date.getUTCFullYear() === now.getUTCFullYear() ? '' : String(date.getUTCFullYear()),
          }
        : { day: '?', month: 'Unknown', year: '' }
}
function historyReportPath(path) {
    return (
        typeof path === 'string' &&
        path.length <= 300 &&
        /^\d{4}-\d{2}-\d{2}\/(?:(?:dev|main)-[a-f0-9]{40}|(?:dev|main|compare-dev|compare-main|pr-[1-9][0-9]*|compare-main-\d{4}-\d{2}-\d{2})\/(?:[a-z]{2}(?:-[a-z0-9]{2,3})?\/)?(?:\d{3,4}x\d{3,4}\/)?[a-f0-9]{40})(?:\/run-[0-9]+-[0-9]+)?$/.test(
            path
        ) &&
        !!parseIsoDate(path.slice(0, 10))
    )
}
function screenHistoryScope(entry, manifest) {
    if (typeof entry?.path !== 'string' || !/^[a-z0-9/-]+$/.test(entry.path) || !parseIsoDate(entry.path.slice(0, 10)))
        return null
    if (manifest && !['capture', 'comparison'].includes(manifest.type)) return null
    const channel = entry.path.split('/')[1]
    const canonical = /^(?:compare-)?(dev|main)(?:-[a-f0-9]{40})?$/.exec(channel)
    const mainDaily = /^compare-main-(\d{4}-\d{2}-\d{2})$/.exec(channel)
    const scopeChannel =
        canonical?.[1] ??
        (mainDaily && parseIsoDate(mainDaily[1]) ? 'main' : /^pr-[1-9][0-9]*$/.test(channel) ? channel : null)
    if (!scopeChannel) return null
    const capture = manifest?.type === 'comparison' ? manifest.after : manifest
    const source = entry.source ?? manifest?.source ?? 'synthetic'
    if (source !== 'synthetic') return null
    const profileOf = (value) =>
        value?.width && value?.height
            ? `${value.width}x${value.height}`
            : /(\d{3,4}x\d{3,4})$/.exec(value?.profile ?? '')?.[1]
    const locale = entry.locale ?? capture?.locale ?? manifest?.locale ?? 'en'
    const profile = entry.profile ?? profileOf(capture) ?? '393x852'
    if (
        [manifest, capture].some(
            (value) =>
                value &&
                ((value.source !== undefined && value.source !== source) ||
                    (value.locale !== undefined && value.locale !== locale) ||
                    (profileOf(value) !== undefined && profileOf(value) !== profile))
        )
    )
        return null
    return { source, channel: scopeChannel, locale, profile }
}
function sameHistoryScope(a, b) {
    return !!a && !!b && ['source', 'channel', 'locale', 'profile'].every((key) => a[key] === b[key])
}
function historyEntryOrder(a, b) {
    const leftPath = typeof a?.path === 'string' ? a.path : ''
    const rightPath = typeof b?.path === 'string' ? b.path : ''
    return (
        String(b?.date ?? rightPath.slice(0, 10)).localeCompare(String(a?.date ?? leftPath.slice(0, 10))) ||
        (Number(b?.sequence) || 0) - (Number(a?.sequence) || 0) ||
        (Number(b?.attempt) || 0) - (Number(a?.attempt) || 0) ||
        leftPath.localeCompare(rightPath)
    )
}
function screenHistoryEntries(index, scope) {
    const seen = new Set()
    return (Array.isArray(index) ? index : [])
        .filter((entry) => historyReportPath(entry?.path) && sameHistoryScope(screenHistoryScope(entry), scope))
        .slice()
        .sort(historyEntryOrder)
        .filter((entry) => {
            if (seen.has(entry.path)) return false
            seen.add(entry.path)
            return true
        })
}
function buildScreenHistory(records, { id, scope } = {}) {
    const versions = [],
        gaps = []
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(id)) return { versions, gaps }
    const matching = (Array.isArray(records) ? records : []).filter(
        (record) =>
            record && historyReportPath(record.entry?.path) && sameHistoryScope(screenHistoryScope(record.entry), scope)
    )
    const time = ({ entry, report: manifest }) =>
        (
            historyTimestamp((manifest?.type === 'comparison' ? manifest.after : manifest)?.capturedAt) ??
            historyTimestamp(entry.date ?? entry.path.slice(0, 10))
        )?.getTime() ?? 0
    // A paired library and comparison describe the same after observation.
    // Process the comparison first so its trusted hint is considered before emission.
    matching.sort(
        (a, b) =>
            time(a) - time(b) ||
            Number(b.report?.type === 'comparison') - Number(a.report?.type === 'comparison') ||
            -historyEntryOrder(a.entry, b.entry)
    )
    let observed
    let initialRecord = true
    const snapshots = new Set()
    const observe = (screen, capture, entry, row, baseline = false) => {
        const gap = (reason) => gaps.push({ reportPath: entry.path, reason })
        if (capture && !sameHistoryScope(screenHistoryScope(entry, capture), scope)) {
            gap('Comparison baseline conflicts with history context')
            return
        }
        if (!screen) {
            gap('Screen not present in this capture')
            return
        }
        if (!['captured', 'absent'].includes(screen.status)) {
            gap(screen.reason || `Capture ${screen.status || 'unknown'}`)
            return
        }
        if (screen.status === 'captured' && !asset(screen.image)) {
            gap('Invalid or missing screenshot asset')
            return
        }
        const captured = historyTimestamp(capture?.capturedAt)
        const date = captured
            ? capture.capturedAt
            : historyTimestamp(entry.date ?? entry.path.slice(0, 10))
              ? (entry.date ?? entry.path.slice(0, 10))
              : null
        const visual = screen.status === 'absent' ? null : screen.image
        const snapshot = `${capture?.commit ?? entry.commit ?? entry.path}|${date}|${screen.status}|${visual}`
        if (snapshots.has(snapshot)) return
        snapshots.add(snapshot)
        const tiny =
            row &&
            (row.belowThreshold === true ||
                (Number.isFinite(row.percent) && row.percent >= 0 && Number(row.percent.toFixed(2)) === 0))
        const trustedNoise =
            tiny &&
            observed?.image &&
            row.before?.status === 'captured' &&
            row.before.image === observed.image &&
            visual !== null
        const previous = versions.at(-1)
        if ((!previous || visual !== previous.image) && !trustedNoise)
            versions.push({
                image: visual,
                status: screen.status,
                capturedAt: date,
                timeKnown: !!captured,
                commit: capture?.commit ?? entry.commit ?? '',
                reportPath: entry.path,
                name: screen.name ?? row?.name ?? id,
                baseline,
                device: capture,
            })
        observed = { image: visual }
    }
    for (const { entry, report: manifest } of matching) {
        const initial = initialRecord
        initialRecord = false
        if (
            manifest?.schema !== 1 ||
            !['capture', 'comparison'].includes(manifest?.type) ||
            !Array.isArray(manifest.screens)
        ) {
            gaps.push({ reportPath: entry.path, reason: 'Unsupported or malformed capture' })
            continue
        }
        if (!sameHistoryScope(screenHistoryScope(entry, manifest), scope)) {
            gaps.push({
                reportPath: entry.path,
                reason: 'Capture source, locale or viewport conflicts with publication context',
            })
            continue
        }
        if (manifest.type === 'comparison') {
            const row = manifest.screens.find((screen) => screen?.id === id)
            if (initial && row?.before) observe(row.before, manifest.before, entry, null, true)
            observe(row?.after, manifest.after, entry, row)
        } else
            observe(
                manifest.screens.find((screen) => screen?.id === id),
                manifest,
                entry
            )
    }
    return { versions, gaps }
}
function historyAbortError() {
    return new DOMException('History request cancelled', 'AbortError')
}
// Abort and timeout settle even when a reader ignores its AbortSignal.
async function historyRead(load, path, signal) {
    if (signal?.aborted) throw historyAbortError()
    const controller = new AbortController()
    let timer, abort
    const boundary = new Promise((_, reject) => {
        abort = () => {
            controller.abort()
            reject(historyAbortError())
        }
        signal?.addEventListener('abort', abort, { once: true })
        timer = setTimeout(() => {
            controller.abort()
            reject(new Error('History read timed out after 8 seconds'))
        }, 8000)
    })
    try {
        return await Promise.race([Promise.resolve().then(() => load(path, { signal: controller.signal })), boundary])
    } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
    }
}
async function loadScreenHistoryPage(entries, { offset = 0, load, signal, onProgress } = {}) {
    if (signal?.aborted) throw historyAbortError()
    const start = Number.isSafeInteger(offset) && offset >= 0 ? Math.min(offset, entries.length) : 0
    const end = Math.min(start + 12, entries.length)
    const records = [],
        failures = []
    let cursor = start,
        completed = 0
    await Promise.all(
        Array.from({ length: Math.min(4, end - start) }, async () => {
            while (cursor < end) {
                if (signal?.aborted) throw historyAbortError()
                const entry = entries[cursor++]
                try {
                    if (!historyReportPath(entry?.path)) throw new Error('Invalid immutable report path')
                    const manifest = await historyRead(load, `/screen-data/reports/${entry.path}/manifest.json`, signal)
                    if (signal?.aborted) throw historyAbortError()
                    records.push({ entry, report: manifest })
                } catch (error) {
                    if (signal?.aborted) throw historyAbortError()
                    failures.push({ entry, error })
                }
                completed++
                onProgress?.({
                    completed,
                    total: end - start,
                    scanned: start + completed,
                    remaining: entries.length - end,
                })
            }
        })
    )
    records.sort((a, b) => historyEntryOrder(a.entry, b.entry))
    failures.sort((a, b) => historyEntryOrder(a.entry, b.entry))
    return { records, failures, nextOffset: end, done: end >= entries.length }
}
function dateTile(value) {
    const parts = screenHistoryDate(value)
    const button = el('button', undefined, `date-tile${parts.year ? ' has-year' : ''}`)
    button.type = 'button'
    button.append(el('strong', parts.day), el('span', parts.month))
    if (parts.year) button.append(el('span', parts.year, 'tile-year'))
    return button
}

const versionDetails = (entry) => {
    const channel = entry.path.split('/')[1] ?? ''
    const pathPr = /^pr-([1-9][0-9]*)$/.exec(channel)
    const prNumber =
        Number.isSafeInteger(entry.prNumber) && entry.prNumber > 0 ? entry.prNumber : Number(pathPr?.[1]) || null
    const branch = entryBranch(entry)
    const changedScreens =
        Number.isSafeInteger(entry.changedScreens) && entry.changedScreens >= 0 ? entry.changedScreens : null
    const kind =
        entrySource(entry) === 'nutcracker'
            ? 'Real journey'
            : entry.reportType === 'capture' || channel === 'dev' || channel === 'main'
              ? 'Full library'
              : 'Changed screens'
    return { branch, prNumber, changedScreens, kind }
}
const asset = (name) => {
    if (!/^[a-f0-9]{64}\.(png|webp)$/.test(name || '')) return null
    return assetBase + name
}
const image = (name, alt, options) => {
    const n = el('img')
    const url = asset(name, options)
    if (url) n.src = url
    n.alt = alt
    n.loading = 'lazy'
    return n
}
let rows = [],
    report,
    reportTitle = '',
    activeComparison,
    active,
    activeMode = 'screen',
    viewMode = 'all',
    showVariations = true,
    indexEntries = [],
    reportLocaleEntries = [],
    reportSourceEntries = [],
    filteredRows = [],
    renderedCount = 0
let historyState = null
let historyGeneration = 0
let currentReportPath = ''
function historyEligible(row) {
    return (
        !offline &&
        !!row &&
        /^[a-z0-9][a-z0-9-]{0,119}$/.test(row.id ?? '') &&
        !!screenHistoryScope(
            indexEntries.find((entry) => entry.path === currentReportPath) ?? { path: currentReportPath },
            report
        )
    )
}
function closeScreenHistory(updateUrl = true) {
    const old = historyState
    historyGeneration++
    old?.controller.abort()
    historyState = null
    if ($('screen-history')) $('screen-history').hidden = true
    document.body.classList.remove('history-open')
    document.title = `${$('title').textContent} · Peanut Screen library`
    if (updateUrl && !offline && typeof history.replaceState === 'function')
        history.replaceState(null, '', shareableHref(location.pathname, { history: '' }))
    if (old) document.getElementById(old.id)?.querySelector('button')?.focus?.()
}
async function openScreenHistory(row, push = true) {
    if (!$('screen-history')) return
    closeScreenHistory(false)
    const scope = screenHistoryScope(
        indexEntries.find((entry) => entry.path === currentReportPath) ?? { path: currentReportPath },
        report
    )
    const state = {
        id: row.id,
        row,
        scope,
        generation: ++historyGeneration,
        controller: new AbortController(),
        entries: [],
        records: new Map(),
        failures: new Map(),
        offset: 0,
        indexed: false,
        loading: false,
        selected: null,
        mode: 'side',
        versions: [],
        gaps: [],
    }
    historyState = state
    if ($('zoom').open) $('zoom').close()
    document.body.classList.add('history-open')
    $('screen-history').hidden = false
    $('history-title').textContent = row.name
    $('history-context').textContent = scope
        ? `${scope.channel} · ${localeLabel(scope.locale)} · ${scope.profile.replace('x', ' × ')} · App states`
        : 'History is unavailable for this report context.'
    document.title = `${row.name} history · Peanut Screen library`
    const href = shareableHref(location.pathname, { history: row.id })
    if (push && typeof history.pushState === 'function') history.pushState(null, '', href)
    else if (!offline && typeof history.replaceState === 'function') history.replaceState(null, '', href)
    $('history-close').focus?.()
    if (!historyEligible(row)) {
        $('history-status').textContent = offline
            ? 'History is unavailable in offline reports. Open the published report to browse real history.'
            : 'History is available for published app-state reports only.'
        $('history-grid').replaceChildren()
        $('history-detail').hidden = true
        $('history-load-more').hidden = true
        $('history-retry').hidden = true
        return
    }
    await loadHistory(state)
}
function historyCurrent(state) {
    return historyState === state && state.generation === historyGeneration && !state.controller.signal.aborted
}
function mergeHistoryReads(state, result) {
    for (const record of result.records) {
        state.records.set(record.entry.path, record)
        state.failures.delete(record.entry.path)
    }
    for (const failure of result.failures) {
        // Move attempted failures to the tail so persistent failures cannot starve
        // the next retry page. Successful immutable reads remain in place.
        state.failures.delete(failure.entry.path)
        state.failures.set(failure.entry.path, failure)
    }
}
function renderHistoryAvailability() {
    const message = $('history-unavailable')
    if (!message) return
    const supported = !offline && !!screenHistoryScope({ path: currentReportPath }, report)
    message.hidden = supported
    message.textContent = offline
        ? 'History is unavailable in offline reports. Open the published app-state report to browse real history.'
        : report?.type === 'journeys'
          ? 'Screen history is unavailable for real journey runs. Browse a published app-state report to see visual history.'
          : report?.type === 'collection'
            ? 'Screen history is unavailable for curated collections. Open a published app-state report to browse its history.'
            : 'Screen history is available for published main, dev and exact PR app-state reports.'
}
async function loadHistory(state, retry = false) {
    if (!historyCurrent(state) || state.loading) return
    state.loading = true
    state.error = ''
    renderHistory(state)
    try {
        if (!state.indexed) {
            const index = await historyRead(loadJSON, '/screen-data/index.json', state.controller.signal)
            if (!historyCurrent(state)) return
            if (!Array.isArray(index)) throw new Error('Unsupported history index')
            state.entries = screenHistoryEntries(index, state.scope)
            state.indexed = true
        }
        const entries = retry ? [...state.failures.values()].map(({ entry }) => entry) : state.entries
        const result = await loadScreenHistoryPage(entries, {
            offset: retry ? 0 : state.offset,
            load: loadJSON,
            signal: state.controller.signal,
            onProgress: ({ completed, total }) => {
                if (historyCurrent(state))
                    $('history-status').textContent =
                        `Loading ${completed} of ${total} reports · ${state.offset} of ${state.entries.length} scanned`
            },
        })
        if (!historyCurrent(state)) return
        mergeHistoryReads(state, result)
        if (!retry) state.offset = result.nextOffset
        if (result.failures.some(({ error }) => error.authRequired)) {
            state.controller.abort()
            showAuthGate()
            return
        }
    } catch (error) {
        if (!historyCurrent(state) || error.name === 'AbortError') return
        if (error.authRequired) {
            state.controller.abort()
            showAuthGate()
            return
        }
        state.error = error.message || 'History could not be loaded'
    } finally {
        if (historyCurrent(state)) {
            state.loading = false
            renderHistory(state)
        }
    }
}
function historyVersionKey(version) {
    return `${version.reportPath}|${version.commit}|${version.image}|${version.baseline}`
}
function renderHistory(state) {
    const model = buildScreenHistory([...state.records.values()], { id: state.id, scope: state.scope })
    state.versions = model.versions
    state.gaps = model.gaps
    const remaining = state.entries.length - state.offset
    const gaps = state.gaps.length + state.failures.size
    $('history-status').textContent = state.loading
        ? 'Loading real capture history…'
        : state.error
          ? `History incomplete: ${state.error}. Retry to continue.`
          : `${state.offset} of ${state.entries.length} reports scanned · ${state.versions.length} visual ${state.versions.length === 1 ? 'version' : 'versions'} · ${gaps} ${gaps === 1 ? 'gap' : 'gaps'} · ${remaining ? `${remaining} reports remaining` : gaps ? 'Scan complete; history has gaps' : 'History complete'}`
    $('history-load-more').hidden = !remaining || !state.indexed
    $('history-load-more').disabled = state.loading
    $('history-load-more').textContent = `Load older history (${remaining} reports remaining)`
    $('history-retry').hidden = !state.error && !state.failures.size
    $('history-retry').disabled = state.loading
    $('history-retry').textContent = state.failures.size
        ? `Retry next ${Math.min(12, state.failures.size)} of ${state.failures.size} failed reports`
        : 'Retry history index'
    $('history-grid').replaceChildren()
    if (!state.versions.length)
        $('history-grid').append(
            el(
                'p',
                state.loading
                    ? 'Looking for captured versions…'
                    : gaps
                      ? 'No captured versions available in the scanned reports. Review the gaps below.'
                      : remaining
                        ? 'No visual versions in this page. Load older history to continue.'
                        : 'No captured history is available for this screen.'
            )
        )
    const selected =
        state.versions.find((version) => historyVersionKey(version) === state.selected) ?? state.versions.at(-1)
    state.selected = selected ? historyVersionKey(selected) : null
    state.versions.forEach((version, index) => {
        const item = el('article', undefined, 'history-version')
        const chosen = historyVersionKey(version) === state.selected
        item.dataset.current = String(chosen)
        const track = el('div', undefined, 'history-track')
        const tile = dateTile(version.capturedAt)
        if (chosen) tile.classList.add('active')
        tile.setAttribute('aria-pressed', String(chosen))
        const dateLabel = formatCaptureDate(version.capturedAt) || 'Unknown date'
        const provenance = version.timeKnown ? 'Capture date' : 'Publication date; capture time unknown'
        const label = version.baseline
            ? 'Initial comparison baseline'
            : index === 0
              ? 'First available captured version'
              : version.status === 'absent'
                ? 'Screen removed'
                : `Visual version ${index + 1}`
        tile.setAttribute('aria-label', `${label}, ${dateLabel}. ${provenance}. Compare with previous visual version`)
        const choose = (selector) => {
            state.selected = historyVersionKey(version)
            renderHistory(state)
            $('history-grid').querySelector(`[data-current="true"] ${selector}`)?.focus?.()
        }
        tile.onclick = () => choose('.date-tile')
        track.append(tile)
        const thumbnail = el('button', undefined, 'history-thumbnail')
        thumbnail.type = 'button'
        thumbnail.setAttribute('aria-label', `Inspect ${label}, ${dateLabel}`)
        thumbnail.setAttribute('aria-pressed', String(chosen))
        thumbnail.onclick = () => choose('.history-thumbnail')
        thumbnail.append(
            version.image
                ? phonePreview(image(version.image, version.name), '')
                : el('div', 'Confirmed absence in this revision', 'missing')
        )
        const reportLink = el('a', (version.commit || 'Report').slice(0, 8), 'history-report-link')
        reportLink.href = shareableHref(`/screens/${version.reportPath}/`, { history: '' }, `#${state.id}`)
        item.append(track, thumbnail, el('h3', label), el('p', provenance, 'history-meta'), reportLink)
        $('history-grid').append(item)
    })
    const gapList = $('history-gaps')
    gapList.replaceChildren()
    for (const gap of [
        ...state.gaps,
        ...[...state.failures.values()].map(({ entry, error }) => ({ reportPath: entry.path, reason: error.message })),
    ]) {
        const item = el('li', undefined)
        item.append(el('span', `${gap.reportPath}: ${gap.reason}`))
        gapList.append(item)
    }
    $('history-gap-details').hidden = !gaps
    $('history-gap-summary').textContent = `${gaps} ${gaps === 1 ? 'gap' : 'gaps'} in capture history`
    renderHistoryDetail(state)
}
function historyFrame(version, label) {
    if (!version.image) return el('div', 'Confirmed absence in this revision', 'missing')
    return phonePreview(image(version.image, version.name), label)
}
function renderHistoryDetail(state) {
    const index = state.versions.findIndex((version) => historyVersionKey(version) === state.selected)
    const version = state.versions[index],
        previous = state.versions[index - 1]
    $('history-detail').hidden = !version
    if (!version) return
    $('history-detail-title').textContent = previous
        ? `Visual version ${index + 1} compared with previous version`
        : version.baseline
          ? 'Initial comparison baseline'
          : 'First available captured version'
    $('history-detail-note').textContent =
        state.offset < state.entries.length
            ? 'Older reports remain unscanned; the preceding version may change as history loads.'
            : state.gaps.length || state.failures.size
              ? 'Capture history has gaps. These are the available visual versions.'
              : 'Consecutive identical captures and trusted pixel noise are omitted.'
    const pair = !!previous && !!version.image && !!previous.image
    const mode = !previous ? 'single' : state.mode === 'overlay' && !pair ? 'side' : state.mode
    for (const name of ['side', 'overlay', 'single']) {
        const button = $(`history-${name}`)
        button.hidden = name === 'overlay' ? !pair : name === 'side' ? !previous : false
        button.setAttribute('aria-pressed', String(name === mode))
    }
    $('history-slider-label').hidden = !pair || mode !== 'overlay'
    const images = $('history-images')
    images.replaceChildren()
    images.className = previous && mode === 'side' ? 'history-images pair' : 'history-images single'
    if (pair && mode === 'overlay') {
        const overlay = el('div', undefined, 'overlay')
        overlay.append(
            image(previous.image, 'Previous visual version'),
            image(version.image, 'Selected visual version')
        )
        images.append(phonePreview(overlay, 'Previous / selected version'))
        $('history-slider').value = '50'
    } else if (previous && mode !== 'single')
        images.append(
            historyFrame(previous, 'Previous visual version'),
            historyFrame(version, 'Selected visual version')
        )
    else images.append(historyFrame(version, 'Selected visual version'))
}
if ($('history-close')) $('history-close').onclick = () => closeScreenHistory()
if ($('history-load-more')) $('history-load-more').onclick = () => historyState && loadHistory(historyState)
if ($('history-retry'))
    $('history-retry').onclick = () =>
        historyState && loadHistory(historyState, historyState.indexed && historyState.failures.size > 0)
for (const mode of ['side', 'overlay', 'single'])
    if ($(`history-${mode}`))
        $(`history-${mode}`).onclick = () => {
            if (historyState) {
                historyState.mode = mode
                renderHistoryDetail(historyState)
            }
        }
if ($('history-slider'))
    $('history-slider').oninput = () => {
        const after = $('history-images').querySelector('.overlay img+img')
        if (after) after.style.clipPath = `inset(0 ${100 - Number($('history-slider').value)}% 0 0)`
    }
if ($('screen-history'))
    $('screen-history').addEventListener('keydown', (event) => {
        if (!historyState) return
        if (event.key === 'Escape') {
            event.preventDefault()
            closeScreenHistory()
        }
        if (event.target !== $('history-slider') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            const state = historyState
            const index = state.versions.findIndex((version) => historyVersionKey(version) === state.selected)
            const next = state.versions[index + (event.key === 'ArrowLeft' ? -1 : 1)]
            if (next) {
                event.preventDefault()
                state.selected = historyVersionKey(next)
                renderHistory(state)
                $('history-grid').querySelector('[data-current="true"] .date-tile')?.focus?.()
            }
        }
    })
if (typeof window.addEventListener === 'function') {
    window.addEventListener('popstate', () => {
        const id = requestedFilter('history')
        if (!id) closeScreenHistory(false)
        else if (historyState?.id !== id) {
            const row = rows.find((candidate) => candidate.id === id)
            if (row) openScreenHistory(row, false)
            else closeScreenHistory(false)
        }
    })
    window.addEventListener('pagehide', () => historyState?.controller.abort())
}

const PAGE_SIZE = 24
const unavailable = (s) => !s || !s.image
const newScreen = (row) => ['added', 'new'].includes(row.status) && unavailable(row.before) && !unavailable(row.after)
function newScreenPlaceholder(row) {
    const placeholder = el('div', undefined, 'missing new-screen')
    placeholder.append(el('strong', 'New screen'), el('span', 'No before screenshot'))
    if (row.before?.reason) placeholder.title = row.before.reason
    return placeholder
}
const comparisonMode = () => report?.type === 'comparison' || (report?.type === 'collection' && !!activeComparison)
const availableScreen = (row) =>
    [row?.after, row?.before].find((screen) => !unavailable(screen)) ??
    (report?.type === 'collection' ? row?.after : undefined)
const collectionRows = (collection, locale, comparison) =>
    collection.items.map((item) => {
        if (comparison) {
            const matched = comparison.screens.find((screen) => screen.id === item.id)
            return {
                ...item,
                ...(matched ?? { status: 'unavailable', before: null, after: null }),
                order: item.order,
                ...(item.note ? { note: item.note } : {}),
            }
        }
        const variant = item.variants?.[locale]
        const screen = {
            status: variant?.status === 'captured' ? 'captured' : 'unavailable',
            image: variant?.image,
            thumbnail: variant?.thumbnail,
            reason: variant?.reason,
        }
        return { ...item, status: screen.status, after: screen }
    })
const requestedCollectionLocale = (collection) => {
    const requested = requestedFilter('locale')
    return collection.locales.includes(requested) ? requested : collection.locales[0]
}
const orderRows = (values) =>
    [...values].sort((left, right) => {
        const leftOrder = Number.isSafeInteger(left.order) ? left.order : Number.MAX_SAFE_INTEGER
        const rightOrder = Number.isSafeInteger(right.order) ? right.order : Number.MAX_SAFE_INTEGER
        return leftOrder - rightOrder
    })
const legacyVariationPageIds = new Set([
    'p02-backup-lose-phone',
    'p03-backup-change-phone',
    'p04-backup-export-keys',
    'p35-home-ctas',
    'p36-add-money-bank-list',
    'p37-add-money-crypto',
    'p38-kyc-action-required',
    'p39-language',
    'p40-withdraw',
    'p41-home-add-drawer',
    'p42-home-send-drawer',
    'p57-qr-code',
    'p59-receipt',
    'p68-invite',
    'p71-accounts-held',
    'p72-accounts-held-open',
    'p73-token-selector-drawer',
    'p74-network-selector-drawer',
    'p75-residence-country-dropdown',
    'p76-exchange-currency-dropdown',
    'p77-base-select-dropdown',
])
function isDefaultScreen(row) {
    if (Object.hasOwn(row, 'defaultScreen')) return row.defaultScreen === true
    // Older immutable reports have no classification. Only known page IDs
    // qualify; interaction names and unknown IDs remain variations.
    return (
        /^p\d+-[a-z0-9-]+$/.test(row.id) &&
        !legacyVariationPageIds.has(row.id) &&
        !/(?:modal|drawer|toggle|fixture)/i.test(row.id)
    )
}
const requestedFilter = (name) => new URLSearchParams(location.search ?? '').get(name) ?? ''
function shareableParams(overrides = {}) {
    const params = new URLSearchParams()
    const source = overrides.source ?? $('source').value
    const locale = overrides.locale ?? $('locale').value
    const profile = overrides.profile ?? $('profile').value
    if (source) params.set('source', source)
    if (locale) params.set('locale', locale)
    if (!report && source === 'synthetic' && profile && profile !== '393x852') params.set('profile', profile)
    if (!report) {
        const branch = overrides.branch ?? $('branch').value
        if (source === 'synthetic' && branch) params.set('branch', branch)
        const date = overrides.date ?? $('date-strip').dataset.selectedDate
        if (parseIsoDate(date)) params.set('date', date)
    }
    if (report) {
        if (activeComparison) params.set('compare', requestedFilter('compare'))
        const query = overrides.q ?? $('search').value.trim()
        const flow = overrides.flow ?? $('flow').value
        const status = overrides.status ?? $('status').value
        if (query) params.set('q', query)
        if (flow) params.set('flow', flow)
        if (status) params.set('status', status)
        if (report.type === 'comparison') {
            params.set('view', overrides.view ?? viewMode)
            if ((overrides.scope ?? (showVariations ? 'all' : 'default')) === 'default') params.set('scope', 'default')
        }
    }
    const historyId = overrides.history ?? historyState?.id ?? requestedFilter('history')
    if (/^[a-z0-9][a-z0-9-]{0,119}$/.test(historyId)) params.set('history', historyId)
    return params
}
function shareableHref(pathname = location.pathname, overrides, hash = location.hash ?? '') {
    const query = shareableParams(overrides).toString()
    return `${pathname}${query ? `?${query}` : ''}${hash}`
}
function syncShareableUrl() {
    if (!offline && typeof history !== 'undefined' && typeof history.replaceState === 'function')
        history.replaceState(null, '', shareableHref())
}
function previewDevice() {
    const capture = activeComparison?.after ?? (report?.type === 'comparison' ? report.after : report)
    const profile = `${capture?.profile ?? report?.profile ?? ''}`.toLowerCase()
    const profileSize = /(\d{3,4})x(\d{3,4})/.exec(profile)
    const width = Number(capture?.width ?? report?.width ?? profileSize?.[1] ?? 393)
    const height = Number(capture?.height ?? report?.height ?? profileSize?.[2] ?? 852)
    const preset = LEGACY_DEVICE_PROFILES[`${width}x${height}`]
    const declared = capture?.device
    const platform =
        declared?.platform === 'android'
            ? 'android'
            : declared?.platform === 'ios'
              ? 'iphone'
              : (preset?.platform ?? (profile.includes('android') ? 'android' : 'neutral'))
    const safeArea = declared?.safeArea
    const verified =
        ['ios', 'android'].includes(declared?.platform) &&
        ['dynamic-island', 'punch-hole'].includes(declared?.cutout) &&
        ['top', 'right', 'bottom', 'left'].every(
            (edge) => Number.isInteger(safeArea?.[edge]) && safeArea[edge] >= 0 && safeArea[edge] < height
        )
    return {
        width,
        height,
        platform,
        label: verified ? declared.label : preset ? `${preset.label} viewport` : 'Viewport',
        cutout: verified ? declared.cutout : 'none',
        safeArea: verified ? safeArea : null,
        verified,
    }
}
function phonePreview(content, label) {
    const device = previewDevice()
    const preview = el('figure', undefined, 'device-preview')
    const frame = el(
        'div',
        undefined,
        `device-frame ${device.platform} ${device.verified ? `device-safe device-${device.cutout}` : 'device-legacy'}`
    )
    frame.style.aspectRatio = `${device.width} / ${device.height}`
    frame.setAttribute(
        'aria-label',
        `${device.label} preview at ${device.width} by ${device.height}${device.verified ? ', safe areas simulated in capture' : ', legacy capture without safe-area simulation'}`
    )
    if (device.safeArea) frame.dataset.safeArea = Object.values(device.safeArea).join(',')
    const screen = el('div', undefined, 'device-screen')
    screen.append(content)
    frame.append(
        el('span', undefined, 'device-button device-button-top'),
        el('span', undefined, 'device-button device-button-bottom'),
        screen,
        el('span', undefined, 'device-camera'),
        el('span', undefined, 'device-home')
    )
    preview.append(frame, el('figcaption', label, 'device-label'))
    return preview
}
function activePreviewIndex() {
    const exact = filteredRows.indexOf(active)
    return exact >= 0 ? exact : filteredRows.findIndex((row) => row.id === active?.id)
}
function updatePreviewPosition() {
    const index = activePreviewIndex()
    const device = previewDevice()
    $('zoom-position').textContent =
        `${index + 1} of ${filteredRows.length} · ${device.label} · ${device.width} × ${device.height}`
    const onlyOne = filteredRows.length <= 1
    $('zoom-prev').disabled = onlyOne
    $('zoom-next').disabled = onlyOne
}
function zoom(row, mode = 'side') {
    active = row
    const single = mode === 'screen' || !comparisonMode() || (report?.type === 'comparison' && viewMode === 'all')
    if (single) mode = 'screen'
    activeMode = mode
    const historyButton = $('zoom-history')
    if (historyButton) {
        historyButton.hidden = !historyEligible(row)
        historyButton.onclick = () => openScreenHistory(row)
    }
    $('zoom-title').textContent = row.name
    $('zoom-images').replaceChildren()
    $('slider-label').hidden = mode !== 'overlay'
    $('zoom-controls').hidden = single
    $('side').hidden = single
    $('overlay').hidden = single
    $('difference').hidden = single
    for (const name of ['side', 'overlay', 'difference']) $(name).setAttribute('aria-pressed', String(name === mode))
    const before = row.before,
        after = row.after
    if (mode === 'screen') {
        const screen = availableScreen(row)
        if (screen?.image)
            $('zoom-images').append(phonePreview(image(screen.image, row.name, { preview: false }), 'Screen'))
        else $('zoom-images').append(el('p', screen?.reason ?? 'No screenshot available.'))
    } else if (mode === 'difference') {
        if (row.diff)
            $('zoom-images').append(phonePreview(image(row.diff, 'Pixel difference', { preview: false }), 'Difference'))
        else $('zoom-images').append(el('p', 'No pixel difference image available.'))
    } else if (mode === 'overlay' && !unavailable(before) && !unavailable(after)) {
        const n = el('div', undefined, 'overlay')
        n.append(image(before.image, 'Before', { preview: false }), image(after.image, 'After', { preview: false }))
        $('zoom-images').append(phonePreview(n, 'Before / after'))
        $('slider').value = '50'
    } else {
        for (const [label, s] of [
            ['Before', before],
            ['After', after],
        ])
            if (s?.image) $('zoom-images').append(phonePreview(image(s.image, label, { preview: false }), label))
            else if (label === 'Before' && newScreen(row)) {
                const fig = el('figure', undefined, 'device-preview new-screen-shot')
                fig.append(newScreenPlaceholder(row), el('figcaption', label))
                $('zoom-images').append(fig)
            }
    }
    updatePreviewPosition()
    if (!$('zoom').open) {
        $('zoom').showModal()
        $('close').focus?.()
    }
}
function navigatePreview(direction) {
    if (filteredRows.length <= 1) return
    const index = activePreviewIndex()
    const next = (Math.max(0, index) + direction + filteredRows.length) % filteredRows.length
    zoom(filteredRows[next], activeMode)
}
function filteredScreenRows() {
    const q = $('search').value.toLowerCase(),
        flow = $('flow').value,
        status = $('status').value,
        changedMode = report?.type === 'comparison' && viewMode === 'changed' && !explicitNonvisualStatus(status)
    return rows.filter(
        (r) =>
            (report?.type === 'collection' || availableScreen(r)) &&
            (report?.type !== 'comparison' || showVariations || isDefaultScreen(r)) &&
            (!q || `${r.name} ${r.id} ${r.flow}`.toLowerCase().includes(q)) &&
            (!flow || flow === r.flow) &&
            (!changedMode || VISUAL_CHANGE_STATUSES.has(r.status)) &&
            (!status || (status === 'differences' ? VISUAL_CHANGE_STATUSES.has(r.status) : status === r.status))
    )
}
function renderTile(row) {
    const tile = el('article', undefined, 'tile')
    tile.id = row.id
    const head = el('div', undefined, 'tile-head')
    const detail =
        report.type === 'journeys'
            ? `${row.flow} · ${row.route} · ${row.trustTier}`
            : [row.flow, row.journey, row.kind === 'component' ? 'Isolated component' : 'App route']
                  .filter(Boolean)
                  .join(' · ')
    head.append(
        el('span', row.status === 'new' ? 'New screen' : row.status, `tag ${row.status}`),
        el('h2', row.name),
        el('div', detail, 'meta')
    )
    if (row.note) head.append(el('p', row.note, 'collection-note'))
    tile.append(head)
    const showSingle = !comparisonMode() || (report.type === 'comparison' && viewMode === 'all')
    const pair = el('div', undefined, `pair${showSingle ? ' single' : ''}`)
    for (const [label, s] of showSingle
        ? [['Screen', availableScreen(row)]]
        : [
              ['Before', row.before],
              ['After', row.after],
          ]) {
        const fig = el('figure', undefined, `shot${label === 'Before' && newScreen(row) ? ' new-screen-shot' : ''}`)
        fig.append(el('figcaption', label))
        if (!unavailable(s)) {
            const b = el('button')
            b.setAttribute('aria-label', `Enlarge ${row.name}, ${label}`)
            b.append(image(s.image, row.name))
            b.onclick = () => zoom(row, showSingle ? 'screen' : 'side')
            fig.append(b)
        } else
            fig.append(
                label === 'Before' && newScreen(row)
                    ? newScreenPlaceholder(row)
                    : el('div', s?.reason ?? 'Not in this version', 'missing')
            )
        pair.append(fig)
    }
    tile.append(pair)
    const foot = el('div', undefined, 'tile-foot')
    const link = el('a', 'Link to screen')
    link.href = `#${row.id}`
    foot.append(link)
    if (historyEligible(row)) {
        const button = el('button', 'History', 'history-link')
        button.type = 'button'
        button.setAttribute('aria-label', `View history for ${row.name}`)
        button.onclick = () => openScreenHistory(row)
        foot.append(button)
    }
    if (row.belowThreshold)
        foot.append(
            el(
                'span',
                Number.isInteger(row.pixels) && row.pixels > 0
                    ? `${row.pixels} pixels below change threshold`
                    : 'Below change threshold'
            )
        )
    else if (row.percent !== undefined) foot.append(el('span', `${row.percent.toFixed(2)}% pixels changed`))
    tile.append(foot)
    return tile
}
function appendNextPage() {
    if (renderedCount >= filteredRows.length) {
        $('screen-load-more').hidden = true
        return
    }
    const next = filteredRows.slice(renderedCount, renderedCount + PAGE_SIZE)
    $('screens').append(...next.map(renderTile))
    renderedCount += next.length
    $('screen-load-more').hidden = renderedCount >= filteredRows.length
}
function render() {
    const changedMode = report?.type === 'comparison' && viewMode === 'changed'
    if (report?.type === 'comparison')
        $('title').textContent = reportTitle || (changedMode ? 'See what changed.' : 'Every screen.')
    document.title = `${$('title').textContent} · Peanut Screen library`
    filteredRows = filteredScreenRows()
    renderedCount = 0
    $('screens').className =
        report?.type === 'journeys' ? 'all-screens journey-screens' : changedMode ? 'changed-screens' : 'all-screens'
    $('screens').replaceChildren()
    if (!filteredRows.length) {
        $('screens').append(
            el('p', changedMode ? 'No visual changes match these filters.' : 'No screens match these filters.')
        )
        $('screen-load-more').hidden = true
        return
    }
    appendNextPage()
}
async function loadJSON(url, { signal } = {}) {
    const read = async (path, { signal: readSignal }) => {
        const r = await fetch(path, {
            ...(offline ? {} : { redirect: 'manual', cache: 'no-store' }),
            signal: readSignal,
        })
        if (r.type === 'opaqueredirect' || r.status === 0 || r.status === 401 || r.status === 403) {
            const error = new Error('Authentication required')
            error.authRequired = true
            throw error
        }
        if (!r.ok) {
            const error = new Error(`Report unavailable (${r.status})`)
            error.status = r.status
            throw error
        }
        return r.json()
    }
    return read(url, { signal })
}
function showAuthGate() {
    if ($('screen-history')) $('screen-history').hidden = true
    const returnPath = `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`
    $('google-sign-in').href = `/screen-data/auth/continue?return=${encodeURIComponent(returnPath)}`
    document.body?.classList?.add('auth-required')
    $('auth-preview').hidden = false
    $('auth-gate').hidden = false
    $('coverage').textContent = 'Private product library'
    $('filters-row').hidden = true
    $('date-filter').hidden = true
    $('view-mode-row').hidden = true
    $('versions').hidden = true
    $('screens').hidden = true
    $('screen-load-more').hidden = true
}
function showEmptyState(kind = 'unpublished') {
    const unpublished = kind === 'unpublished'
    const reportNotFound = kind === 'report-not-found'
    $('empty-kicker').textContent = unpublished
        ? 'SCREEN LIBRARY · COMING TO LIFE'
        : reportNotFound
          ? 'SCREEN LIBRARY · REPORT NOT FOUND'
          : 'SCREEN LIBRARY · TEMPORARILY UNAVAILABLE'
    $('empty-title').textContent = unpublished
        ? 'Your gallery is almost here.'
        : reportNotFound
          ? 'That report is not available.'
          : 'The gallery needs a moment.'
    $('empty-message').textContent = unpublished
        ? 'Screenshots are generated in the background and will appear here after the first capture is published.'
        : reportNotFound
          ? 'This screen-library link does not point to a published report. Return to the gallery to choose an available version.'
          : 'We could not load the library right now. Check again in a moment and your gallery will be here when it is ready.'
    $('empty-status').textContent = unpublished
        ? 'No published captures yet'
        : reportNotFound
          ? 'Published report not found'
          : 'Temporary loading issue'
    $('coverage').hidden = true
    $('filters-row').hidden = true
    $('date-filter').hidden = true
    $('view-mode-row').hidden = true
    $('dashboard-filters').hidden = true
    $('screen-filters').hidden = true
    $('versions').hidden = true
    $('screens').hidden = true
    $('screen-load-more').hidden = true
    $('empty-state').hidden = false
}
function normalizeIndex(index) {
    return (Array.isArray(index) ? index : [])
        .filter((entry) => entry && typeof entry === 'object' && typeof entry.path === 'string')
        .map((entry) => ({ ...entry, locale: entry.locale ?? 'en', source: entrySource(entry) }))
}
function populateSource(entries, selected) {
    const sources = [...new Set(entries.map(entrySource))].sort((a, b) => {
        if (a === 'synthetic') return -1
        if (b === 'synthetic') return 1
        return a.localeCompare(b)
    })
    $('source-control').hidden = sources.length <= 1
    $('source').replaceChildren(
        ...sources.map((value) => {
            const option = el('option', SOURCE_LABELS[value] ?? value)
            option.value = value
            return option
        })
    )
    const value = sources.includes(selected) ? selected : sources.includes('synthetic') ? 'synthetic' : sources[0]
    $('source').value = value ?? ''
    return value
}
function populateLocale(entries, selected) {
    const locales = sortLocales(entries.map((entry) => entry.locale))
    $('locale').replaceChildren(
        ...locales.map((value) => {
            const option = el('option', localeCode(value))
            option.value = value
            return option
        })
    )
    const value = locales.includes(selected) ? selected : locales.includes('en') ? 'en' : locales[0]
    $('locale').value = value ?? ''
    return value
}
function populateProfile(entries, selected, source) {
    const profiles = ['393x852', '440x956', '360x800', '320x712'].filter((profile) =>
        entries.some((entry) => entryProfile(entry) === profile)
    )
    $('profile-control').hidden = source !== 'synthetic' || profiles.length <= 1
    $('profile').replaceChildren(
        ...profiles.map((value) => {
            const option = el('option', value.replace('x', ' × '))
            option.value = value
            return option
        })
    )
    const value = profiles.includes(selected) ? selected : profiles.includes('393x852') ? '393x852' : profiles[0]
    $('profile').value = value ?? ''
    return value
}
function updateDateNavigation() {
    const strip = $('date-strip')
    const scrollLeft = Number(strip.scrollLeft) || 0
    const maxScroll = Math.max(0, (Number(strip.scrollWidth) || 0) - (Number(strip.clientWidth) || 0))
    $('date-prev').hidden = scrollLeft <= 1
    $('date-next').hidden = maxScroll <= 1 || scrollLeft >= maxScroll - 1
}
function scheduleDateNavigationUpdate() {
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(updateDateNavigation)
    else updateDateNavigation()
}
function scrollDateStrip(direction) {
    const strip = $('date-strip')
    const distance = Math.max(70, (Number(strip.clientWidth) || 0) - 70)
    if (typeof strip.scrollBy === 'function') strip.scrollBy({ left: direction * distance })
    else strip.scrollLeft = Math.max(0, (Number(strip.scrollLeft) || 0) + direction * distance)
    scheduleDateNavigationUpdate()
}
function renderDateStrip(availableEntries) {
    const availableDates = new Set(availableEntries.map((entry) => entry.date).filter((date) => parseIsoDate(date)))
    const catalogueDates = indexEntries.map((entry) => entry.date).filter((date) => parseIsoDate(date))
    const latest = catalogueDates.sort().at(-1)
    let selected =
        'selectedDate' in $('date-strip').dataset ? $('date-strip').dataset.selectedDate : requestedFilter('date')
    if (!availableDates.has(selected)) selected = ''
    $('date-strip').dataset.selectedDate = selected

    const all = el('button', 'All', `date-tile date-tile-all${selected ? '' : ' active'}`)
    all.type = 'button'
    all.setAttribute('aria-pressed', String(!selected))
    all.onclick = () => {
        $('date-strip').dataset.selectedDate = ''
        renderLanding()
    }
    const buttons = [all]
    const end = parseIsoDate(latest)
    if (end) {
        const earliest = parseIsoDate(catalogueDates[0])
        const thirtyDaysAgo = new Date(end)
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29)
        const start = earliest && earliest > thirtyDaysAgo ? earliest : thirtyDaysAgo
        for (let cursor = new Date(end); cursor >= start; cursor.setUTCDate(cursor.getUTCDate() - 1)) {
            const date = isoDate(cursor)
            const available = availableDates.has(date)
            const button = dateTile(date)
            button.className += `${available ? '' : ' unavailable'}${selected === date ? ' active' : ''}`
            button.type = 'button'
            button.disabled = !available
            button.setAttribute(
                'aria-label',
                available ? `Show captures from ${formatCaptureDate(date)}` : `${formatCaptureDate(date)} — no captures`
            )
            button.setAttribute('aria-pressed', String(selected === date))
            if (available)
                button.onclick = () => {
                    $('date-strip').dataset.selectedDate = date
                    renderLanding()
                }
            buttons.push(button)
        }
    }
    $('date-strip').replaceChildren(...buttons)
    scheduleDateNavigationUpdate()
    return selected
}
function renderLanding() {
    const selectedSource = populateSource(indexEntries, $('source').value || requestedFilter('source'))
    $('branch-control').hidden = selectedSource !== 'synthetic'
    const branch = $('branch').dataset.initialized ? $('branch').value : requestedFilter('branch')
    $('branch').value = ['dev', 'main'].includes(branch) ? branch : ''
    $('branch').dataset.initialized = 'true'
    const sourceEntries = indexEntries.filter(
        (entry) =>
            entrySource(entry) === selectedSource &&
            (selectedSource !== 'synthetic' || !$('branch').value || entryBranch(entry) === $('branch').value)
    )
    const selectedProfile = populateProfile(
        sourceEntries,
        $('profile').value || requestedFilter('profile'),
        selectedSource
    )
    const profileEntries =
        selectedSource === 'synthetic'
            ? sourceEntries.filter((entry) => entryProfile(entry) === selectedProfile)
            : sourceEntries
    const current = $('locale').value
    const selected = populateLocale(profileEntries, current || requestedFilter('locale'))
    const localeEntries = profileEntries.filter((entry) => entry.locale === selected)
    const selectedDate = renderDateStrip(localeEntries)
    const visible = localeEntries.filter((entry) => !selectedDate || entry.date === selectedDate)
    const real = selectedSource === 'nutcracker'
    $('title').textContent = real ? 'Real backend journeys.' : 'Every screen. Every change.'
    $('description').textContent = real
        ? 'Screens captured while Nutcracker drives the real Peanut backend and provider sandboxes.'
        : 'Browse app states and compare versions of Peanut.'
    $('coverage').textContent =
        `${visible.length} published ${localeLabel(selected)} ${real ? 'Nutcracker' : `${selectedProfile.replace('x', ' × ')} app-state`} ${visible.length === 1 ? 'run' : 'runs'}${selectedDate ? ` on ${formatCaptureDate(selectedDate)}` : ''}`
    $('versions').replaceChildren()
    const grouped = new Map()
    for (const entry of visible) {
        if (!parseIsoDate(entry.date) || !/^[a-z0-9/-]+$/.test(entry.path)) continue
        if (!grouped.has(entry.date)) grouped.set(entry.date, [])
        grouped.get(entry.date).push(entry)
    }
    for (const date of [...grouped.keys()].sort().reverse()) {
        const group = el('section', undefined, 'version-group')
        const heading = el('h2', formatCaptureDate(date), 'version-date')
        const grid = el('div', undefined, 'version-grid')
        for (const v of grouped.get(date)) {
            const details = versionDetails(v)
            const a = el('a', undefined, 'version')
            a.href = shareableHref(`/screens/${v.path}/`, { source: selectedSource, locale: selected, date: '' }, '')
            const top = el('div', undefined, 'version-top')
            top.append(
                el('span', formatCaptureDate(v.date), 'version-card-date'),
                el(
                    'span',
                    `${details.kind}${selectedSource === 'synthetic' && details.kind === 'Full library' ? ` · ${entryProfile(v).replace('x', ' × ')}` : ''}`,
                    'version-kind'
                )
            )
            const branch = el('strong', details.branch || 'Unknown branch', 'version-branch')
            const meta = el('div', undefined, 'version-meta')
            if (details.prNumber) meta.append(el('span', `PR #${details.prNumber}`, 'version-pr'))
            if (v.scope?.mode === 'targeted')
                meta.append(el('span', v.scopeComplete ? 'Targeted' : 'Targeted · incomplete', 'version-incomplete'))
            else if (!v.complete) meta.append(el('span', 'Incomplete', 'version-incomplete'))
            const count = el('div', undefined, 'version-count')
            count.append(
                el('strong', details.changedScreens === null ? '—' : String(details.changedScreens)),
                el('span', details.changedScreens === 1 ? 'screen changed' : 'screens changed')
            )
            const arrow = el('span', 'Open →', 'version-open')
            a.append(top, branch, meta, count, arrow)
            grid.append(a)
        }
        group.append(heading, grid)
        $('versions').append(group)
    }
    syncShareableUrl()
}
function renderCoverage() {
    const counts = rows.reduce((a, r) => {
        a[r.status] = (a[r.status] || 0) + 1
        return a
    }, {})
    $('coverage').textContent = `${
        report.type === 'collection'
            ? activeComparison
                ? 'Curated before/after comparison'
                : report.complete
                  ? 'Complete curated collection'
                  : 'Collection capture in progress'
            : report.type === 'journeys'
              ? report.complete
                  ? 'Complete Nutcracker run'
                  : 'Incomplete Nutcracker run'
              : report.scope?.mode === 'targeted'
                ? `${report.scopeComplete ? 'Complete targeted review' : 'Incomplete targeted review'} — ${[...new Set(rows.map((row) => row.flow))].join(', ')}; other flows were not captured`
                : report.complete
                  ? 'Complete capture'
                  : 'Incomplete capture — review gaps and failures'
    } · ${rows.length} ${report.type === 'journeys' || report.type === 'collection' ? 'screenshots' : 'states'} · ${Object.entries(
        counts
    )
        .map(([s, n]) => `${n} ${s === 'new' ? 'new screens' : s}`)
        .join(' · ')}`
}
async function configureReportLocales(reportPath) {
    $('branch-control').hidden = true
    if (report.type === 'collection') {
        reportLocaleEntries = (activeComparison ? [activeComparison.locale] : report.locales).map((locale) => ({
            locale,
        }))
        reportSourceEntries = []
        populateLocale(
            reportLocaleEntries,
            activeComparison?.locale || $('locale').value || requestedCollectionLocale(report)
        )
        $('source-control').hidden = true
        $('profile-control').hidden = true
        $('dashboard-filters').hidden = reportLocaleEntries.length <= 1
        $('date-filter').hidden = true
        return
    }
    if (offline) {
        reportLocaleEntries = []
        reportSourceEntries = []
        $('dashboard-filters').hidden = true
        $('profile-control').hidden = true
        $('date-filter').hidden = true
        return
    }
    try {
        indexEntries = normalizeIndex(await loadJSON('/screen-data/index.json'))
    } catch {
        indexEntries = []
    }
    const currentSource = report.source ?? 'synthetic'
    reportSourceEntries = indexEntries.filter((entry) => entrySource(entry) === currentSource)
    if (!reportSourceEntries.some((entry) => entry.path === reportPath))
        reportSourceEntries.push({ path: reportPath, locale: report.locale ?? 'en', source: currentSource })
    populateSource([...indexEntries, ...reportSourceEntries], currentSource)
    $('profile-control').hidden = true
    const basePath = withoutLocale(reportPath)
    reportLocaleEntries = reportSourceEntries.filter((entry) => withoutLocale(entry.path) === basePath)
    const currentLocale = report.locale ?? 'en'
    if (!reportLocaleEntries.some((entry) => entry.locale === currentLocale))
        reportLocaleEntries.push({ path: reportPath, locale: currentLocale })
    populateLocale(reportLocaleEntries, currentLocale)
    $('dashboard-filters').hidden = reportLocaleEntries.length === 0
    $('date-filter').hidden = true
}
async function start() {
    if (offline) document.querySelector('.brand').href = './index.html'
    // The worker publishes both the root and nested copies of index.html.
    const pathname = location.pathname
    const isHostedIndex =
        pathname === '/' ||
        pathname === '/index.html' ||
        pathname === '/screen-library' ||
        pathname === '/screen-library/' ||
        pathname === '/screen-library/index.html'
    const collectionMatch = /^\/collections\/([a-z0-9][a-z0-9-]{0,119})\/?$/.exec(pathname)
    const path = isHostedIndex ? '' : pathname.replace(/^\/screens\/?/, '').replace(/\/$/, '')
    if (!offline && !path) {
        const index = await loadJSON('/screen-data/index.json')
        if (!index.length) {
            showEmptyState()
            return
        }
        indexEntries = normalizeIndex(index)
        if (!indexEntries.length) {
            showEmptyState()
            return
        }
        $('dashboard-filters').hidden = false
        $('date-filter').hidden = false
        $('screen-filters').hidden = true
        $('filters-row').hidden = false
        $('view-mode-row').hidden = true
        renderLanding()
        return
    }
    let reportPath = path
    if (path === 'latest') reportPath = (await loadJSON('/screen-data/latest.json')).path
    currentReportPath = reportPath
    if (!offline && !collectionMatch && !/^[a-z0-9/-]+$/.test(reportPath)) throw new Error('Invalid report path')
    report = offline
        ? window.SCREEN_REPORT
        : collectionMatch
          ? await loadJSON(`/screen-data/collections/${collectionMatch[1]}/manifest.json`)
          : await loadJSON(`/screen-data/reports/${reportPath}/manifest.json`)
    if (!report || report.schema !== 1 || !['capture', 'comparison', 'journeys', 'collection'].includes(report.type))
        throw new Error('Unsupported report')
    const comparisonPath = collectionMatch ? requestedFilter('compare') : ''
    activeComparison = undefined
    if (comparisonPath) {
        if (
            !/^\d{4}-\d{2}-\d{2}\/(?:compare-dev|compare-main|pr-[1-9][0-9]*|compare-main-\d{4}-\d{2}-\d{2})\/(?:en|es-419|es-ar|pt-br)\/[a-f0-9]{40}(?:\/run-[0-9]+-[0-9]+)?$/.test(
                comparisonPath
            )
        )
            throw new Error('Invalid comparison path')
        const comparison = await loadJSON(`/screen-data/reports/${comparisonPath}/manifest.json`)
        if (
            report.type !== 'collection' ||
            comparison?.schema !== 1 ||
            comparison.type !== 'comparison' ||
            !report.locales.includes(comparison.locale) ||
            !Array.isArray(comparison.screens)
        )
            throw new Error('Unsupported comparison for this collection')
        activeComparison = normalizeComparison(comparison)
    }
    if (report.type === 'comparison') report = normalizeComparison(report)
    $('dashboard-filters').hidden = true
    $('date-filter').hidden = true
    $('filters-row').hidden = false
    $('view-mode-row').hidden = report.type !== 'comparison'
    rows = orderRows(
        report.type === 'collection'
            ? collectionRows(report, activeComparison?.locale ?? requestedCollectionLocale(report), activeComparison)
            : report.type !== 'comparison'
              ? report.screens.map((s) => ({
                    ...s,
                    after: s,
                    status: s.status,
                }))
              : report.screens
    )
    const before = activeComparison?.before ?? report.before,
        after = activeComparison?.after ?? (report.type === 'comparison' ? report.after : report)
    viewMode = report.type === 'comparison' ? 'changed' : 'all'
    showVariations = report.type !== 'comparison' || requestedFilter('scope') !== 'default'
    $('view-mode').checked = viewMode === 'all'
    $('variations-mode').checked = showVariations
    $('title').textContent =
        report.type === 'collection'
            ? report.title
            : report.type === 'journeys'
              ? 'Real backend journeys.'
              : report.type === 'capture'
                ? 'The screen library.'
                : 'See what changed.'
    const captureDate = formatCaptureDate(after?.capturedAt ?? report.capturedAt ?? report.createdAt)
    $('description').replaceChildren()
    if (report.type === 'collection' && report.description) $('description').append(el('span', report.description), ' ')
    $('description').append(captureDate ? el('strong', captureDate) : el('span', ''))
    $('footer').textContent =
        report.type === 'collection'
            ? `${localeLabel(activeComparison?.locale ?? requestedCollectionLocale(report))} · ${activeComparison ? 'Curated before/after comparison' : 'Curated collection'} · Synthetic app states`
            : report.type === 'journeys'
              ? `${localeLabel(report.locale)} · ${report.width} × ${report.height} viewport · Nutcracker sandbox backend`
              : `${localeLabel(report.locale)} · ${after.width} × ${after.height} viewport · Synthetic data`
    if (report.type === 'collection') {
        if (activeComparison) {
            for (const [label, capture] of [
                ['Before', before],
                ['After', after],
            ]) {
                const n = el('div')
                n.append(
                    el('strong', `${label} ${capture?.commit ?? 'unknown revision'}`),
                    el('div', capture?.capturedAt ?? '')
                )
                $('provenance').append(n)
            }
        } else
            for (const locale of report.locales) {
                const source = report.source?.[locale]
                const n = el('div')
                n.append(
                    el('strong', `${localeLabel(locale)} · ${source?.commit ?? 'capture pending'}`),
                    el('div', source?.reportPath ?? 'On-demand capture')
                )
                $('provenance').append(n)
            }
    } else if (report.type === 'journeys') {
        const n = el('div')
        n.append(
            el('strong', `Nutcracker ${report.commit}`),
            el('div', report.capturedAt),
            el('div', report.environment),
            el('div', `UI ${report.uiCommit}`),
            el('div', `API ${report.apiCommit}`)
        )
        $('provenance').append(n)
    } else {
        for (const [label, m] of [
            ['Before', before],
            ['After', after],
        ])
            if (m) {
                const n = el('div')
                n.append(
                    el('strong', `${label} ${m.commit}`),
                    el('div', m.capturedAt),
                    el('div', m.environment),
                    el('div', `Content ${m.contentCommit}`),
                    el('div', `Harness ${m.harness} · Fixtures ${m.fixtures} · ${m.adapter}`)
                )
                $('provenance').append(n)
            }
    }
    renderCoverage()
    for (const f of [...new Set(rows.map((r) => r.flow))].sort()) {
        const o = el('option', f)
        o.value = f
        $('flow').append(o)
    }
    await configureReportLocales(reportPath)
    renderHistoryAvailability()
    if (!offline && ['capture', 'comparison'].includes(report.type)) {
        const entry = indexEntries.find((candidate) => candidate.path === reportPath) ?? { path: reportPath }
        const { branch, prNumber } = versionDetails(entry)
        const namedBranch = branch && !/^pr-[1-9][0-9]*$/.test(branch) ? branch : ''
        const branchTitle = namedBranch === 'main' ? 'Main' : namedBranch === 'dev' ? 'Dev' : namedBranch
        reportTitle = prNumber ? `PR #${prNumber}` : branchTitle
        if (reportTitle) $('title').textContent = reportTitle
        if (prNumber && namedBranch) {
            $('description').replaceChildren(el('strong', namedBranch))
            if (captureDate) $('description').append(' · ', el('span', captureDate))
        }
    }
    const requestedView = requestedFilter('view')
    if (report.type === 'comparison' && ['all', 'changed'].includes(requestedView)) viewMode = requestedView
    $('view-mode').checked = viewMode === 'all'
    $('search').value = requestedFilter('q').slice(0, 200)
    const requestedFlow = requestedFilter('flow')
    $('flow').value = rows.some((row) => row.flow === requestedFlow) ? requestedFlow : ''
    const requestedStatus = requestedFilter('status')
    const reportHasStatus =
        rows.some((row) => row.status === requestedStatus) ||
        (report.type === 'comparison' && requestedStatus === 'differences')
    $('status').value = reportHasStatus
        ? requestedStatus
        : report.type === 'comparison' && viewMode === 'changed'
          ? 'differences'
          : ''
    if (report.type === 'comparison' && viewMode === 'changed' && explicitNonvisualStatus($('status').value)) {
        viewMode = 'all'
        $('view-mode').checked = true
    }
    render()
    if (location.hash) {
        viewMode = 'all'
        showVariations = true
        $('view-mode').checked = true
        $('variations-mode').checked = true
        $('status').value = ''
        render()
        while (!document.getElementById(location.hash.slice(1)) && renderedCount < filteredRows.length) appendNextPage()
        document.getElementById(location.hash.slice(1))?.scrollIntoView()
    }
    syncShareableUrl()
    const historyRow = rows.find((row) => row.id === requestedFilter('history'))
    if (historyRow) await openScreenHistory(historyRow, false)
}
for (const name of ['search', 'flow'])
    $(name).addEventListener('input', () => {
        render()
        syncShareableUrl()
    })
$('status').addEventListener('input', () => {
    if (report?.type === 'comparison' && viewMode === 'changed' && explicitNonvisualStatus($('status').value)) {
        viewMode = 'all'
        $('view-mode').checked = true
    }
    render()
    syncShareableUrl()
})
$('locale').addEventListener('change', () => {
    if (report?.type === 'collection') {
        rows = collectionRows(report, $('locale').value)
        renderCoverage()
        $('footer').textContent = `${localeLabel($('locale').value)} · Curated collection · Synthetic app states`
        $('flow').replaceChildren(el('option', 'All flows'))
        $('flow').children[0].value = ''
        for (const flow of [...new Set(rows.map((row) => row.flow))].sort()) {
            const option = el('option', flow)
            option.value = flow
            $('flow').append(option)
        }
        $('status').value = ''
        render()
        syncShareableUrl()
        return
    }
    if (report && reportLocaleEntries.length) {
        const entry = reportLocaleEntries.find((candidate) => candidate.locale === $('locale').value)
        if (entry && /^[a-z0-9/-]+$/.test(entry.path) && !offline) {
            location.href = shareableHref(`/screens/${entry.path}/`, { locale: entry.locale }, '')
            return
        }
    }
    renderLanding()
})
$('source').addEventListener('change', () => {
    if (report && indexEntries.length) {
        const candidates = indexEntries.filter((entry) => entrySource(entry) === $('source').value)
        const entry = candidates.find((candidate) => candidate.locale === (report.locale ?? 'en')) ?? candidates[0]
        if (entry && /^[a-z0-9/-]+$/.test(entry.path) && !offline) {
            location.href = shareableHref(
                `/screens/${entry.path}/`,
                {
                    source: entrySource(entry),
                    locale: entry.locale,
                    status: '',
                },
                ''
            )
            return
        }
    }
    renderLanding()
})
$('profile').addEventListener('change', renderLanding)
$('branch').addEventListener('change', renderLanding)
$('view-mode').addEventListener('change', () => {
    viewMode = $('view-mode').checked ? 'all' : 'changed'
    $('status').value = viewMode === 'changed' ? 'differences' : ''
    render()
    syncShareableUrl()
})
$('variations-mode').addEventListener('change', () => {
    showVariations = $('variations-mode').checked
    render()
    syncShareableUrl()
})
$('close').onclick = () => $('zoom').close()
$('side').onclick = () => zoom(active, 'side')
$('overlay').onclick = () => zoom(active, 'overlay')
$('difference').onclick = () => zoom(active, 'difference')
$('zoom-prev').onclick = () => navigatePreview(-1)
$('zoom-next').onclick = () => navigatePreview(1)
$('zoom').addEventListener('keydown', (event) => {
    if (!$('zoom').open) return
    if (event.key === 'Escape') {
        event.preventDefault()
        $('zoom').close()
    } else if (event.target !== $('slider') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        navigatePreview(event.key === 'ArrowLeft' ? -1 : 1)
    }
})
$('date-prev').onclick = () => scrollDateStrip(-1)
$('date-next').onclick = () => scrollDateStrip(1)
$('date-strip').addEventListener('scroll', updateDateNavigation)
if (typeof window.addEventListener === 'function') window.addEventListener('resize', scheduleDateNavigationUpdate)
$('slider').oninput = () => {
    const n = $('zoom-images').querySelector('.overlay img+img')
    if (n) n.style.clipPath = `inset(0 ${100 - Number($('slider').value)}% 0 0)`
}
$('empty-retry').onclick = () => location.reload()
if (typeof window.IntersectionObserver === 'function') {
    new window.IntersectionObserver(
        (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) appendNextPage()
        },
        { rootMargin: '600px 0px' }
    ).observe($('screen-load-more'))
}
start().catch((e) => {
    if (e.authRequired) {
        showAuthGate()
        return
    }
    const pathname = location.pathname
    const isHostedIndex =
        pathname === '/' ||
        pathname === '/index.html' ||
        pathname === '/screen-library' ||
        pathname === '/screen-library/' ||
        pathname === '/screen-library/index.html'
    showEmptyState(e.status === 404 ? (isHostedIndex ? 'unpublished' : 'report-not-found') : 'error')
})
