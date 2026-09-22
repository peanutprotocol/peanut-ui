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
const VISUAL_CHANGE_STATUSES = new Set(['changed', 'added', 'removed'])
const explicitNonvisualStatus = (status) =>
    Boolean(status) && status !== 'differences' && !VISUAL_CHANGE_STATUSES.has(status)
const entrySource = (entry) => entry?.source ?? 'synthetic'
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
const versionDetails = (entry) => {
    const channel = entry.path.split('/')[1] ?? ''
    const pathPr = /^pr-([1-9][0-9]*)$/.exec(channel)
    const prNumber =
        Number.isSafeInteger(entry.prNumber) && entry.prNumber > 0 ? entry.prNumber : Number(pathPr?.[1]) || null
    const branch = entry.branch || (channel.startsWith('dev') ? 'dev' : channel.startsWith('main') ? 'main' : channel)
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
    activeComparison,
    active,
    viewMode = 'all',
    indexEntries = [],
    reportLocaleEntries = [],
    reportSourceEntries = [],
    filteredRows = [],
    renderedCount = 0
const PAGE_SIZE = 24
const unavailable = (s) => !s || !s.image
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
const requestedFilter = (name) => new URLSearchParams(location.search ?? '').get(name) ?? ''
function shareableParams(overrides = {}) {
    const params = new URLSearchParams()
    const source = overrides.source ?? $('source').value
    const locale = overrides.locale ?? $('locale').value
    if (source) params.set('source', source)
    if (locale) params.set('locale', locale)
    if (!report) {
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
        if (report.type === 'comparison') params.set('view', overrides.view ?? viewMode)
    }
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
function zoom(row, mode = 'side') {
    active = row
    const single = mode === 'screen' || !comparisonMode() || (report?.type === 'comparison' && viewMode === 'all')
    if (single) mode = 'screen'
    $('zoom-title').textContent = row.name
    $('zoom-images').replaceChildren()
    $('slider-label').hidden = mode !== 'overlay'
    $('side').hidden = single
    $('overlay').hidden = single
    $('difference').hidden = single
    const before = row.before,
        after = row.after
    if (mode === 'screen') {
        const screen = availableScreen(row)
        if (screen?.image) $('zoom-images').append(image(screen.image, row.name, { preview: false }))
        else $('zoom-images').append(el('p', screen?.reason ?? 'No screenshot available.'))
    } else if (mode === 'difference') {
        if (row.diff) $('zoom-images').append(image(row.diff, 'Pixel difference', { preview: false }))
        else $('zoom-images').append(el('p', 'No pixel difference image available.'))
    } else if (mode === 'overlay' && !unavailable(before) && !unavailable(after)) {
        const n = el('div', undefined, 'overlay')
        n.append(image(before.image, 'Before', { preview: false }), image(after.image, 'After', { preview: false }))
        $('zoom-images').append(n)
        $('slider').value = '50'
    } else {
        for (const [label, s] of [
            ['Before', before],
            ['After', after],
        ])
            if (s?.image) $('zoom-images').append(image(s.image, label, { preview: false }))
    }
    if (!$('zoom').open) $('zoom').showModal()
}
function filteredScreenRows() {
    const q = $('search').value.toLowerCase(),
        flow = $('flow').value,
        status = $('status').value,
        changedMode = report?.type === 'comparison' && viewMode === 'changed' && !explicitNonvisualStatus(status)
    return rows.filter(
        (r) =>
            (report?.type === 'collection' || availableScreen(r)) &&
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
    head.append(el('span', row.status, `tag ${row.status}`), el('h2', row.name), el('div', detail, 'meta'))
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
        const fig = el('figure', undefined, 'shot')
        fig.append(el('figcaption', label))
        if (!unavailable(s)) {
            const b = el('button')
            b.setAttribute('aria-label', `Enlarge ${row.name}, ${label}`)
            b.append(image(s.image, row.name))
            b.onclick = () => zoom(row, showSingle ? 'screen' : 'side')
            fig.append(b)
        } else fig.append(el('div', s?.reason ?? 'Not in this version', 'missing'))
        pair.append(fig)
    }
    tile.append(pair)
    const foot = el('div', undefined, 'tile-foot')
    const link = el('a', 'Link to screen')
    link.href = `#${row.id}`
    foot.append(link)
    if (row.percent !== undefined) foot.append(el('span', `${row.percent.toFixed(2)}% pixels changed`))
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
    if (report?.type === 'comparison') $('title').textContent = changedMode ? 'See what changed.' : 'Every screen.'
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
async function loadJSON(url) {
    const r = await fetch(url, offline ? undefined : { redirect: 'manual', cache: 'no-store' })
    if (r.type === 'opaqueredirect' || r.status === 0) {
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
function showAuthGate() {
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
            const button = el(
                'button',
                undefined,
                `date-tile${available ? '' : ' unavailable'}${selected === date ? ' active' : ''}`
            )
            const label = shortDateParts(date)
            button.append(el('strong', label.day), el('span', label.month))
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
    const sourceEntries = indexEntries.filter((entry) => entrySource(entry) === selectedSource)
    const current = $('locale').value
    const selected = populateLocale(sourceEntries, current || requestedFilter('locale'))
    const localeEntries = sourceEntries.filter((entry) => entry.locale === selected)
    const selectedDate = renderDateStrip(localeEntries)
    const visible = localeEntries.filter((entry) => !selectedDate || entry.date === selectedDate)
    const real = selectedSource === 'nutcracker'
    $('title').textContent = real ? 'Real backend journeys.' : 'Every screen. Every change.'
    $('description').textContent = real
        ? 'Screens captured while Nutcracker drives the real Peanut backend and provider sandboxes.'
        : 'Browse app states and compare versions of Peanut.'
    $('coverage').textContent =
        `${visible.length} published ${localeLabel(selected)} ${real ? 'Nutcracker' : 'app-state'} ${visible.length === 1 ? 'run' : 'runs'}${selectedDate ? ` on ${formatCaptureDate(selectedDate)}` : ''}`
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
                el('span', details.kind, 'version-kind')
            )
            const branch = el('strong', details.branch || 'Unknown branch', 'version-branch')
            const meta = el('div', undefined, 'version-meta')
            if (details.prNumber) meta.append(el('span', `PR #${details.prNumber}`, 'version-pr'))
            if (!v.complete) meta.append(el('span', 'Incomplete', 'version-incomplete'))
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
              : report.complete
                ? 'Complete capture'
                : 'Incomplete capture — review gaps and failures'
    } · ${rows.length} ${report.type === 'journeys' || report.type === 'collection' ? 'screenshots' : 'states'} · ${Object.entries(
        counts
    )
        .map(([s, n]) => `${n} ${s}`)
        .join(' · ')}`
}
async function configureReportLocales(reportPath) {
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
        $('dashboard-filters').hidden = reportLocaleEntries.length <= 1
        $('date-filter').hidden = true
        return
    }
    if (offline) {
        reportLocaleEntries = []
        reportSourceEntries = []
        $('dashboard-filters').hidden = true
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
            !/^\d{4}-\d{2}-\d{2}\/(?:compare-dev|pr-[1-9][0-9]*|compare-main-\d{4}-\d{2}-\d{2})\/(?:en|es-419|es-ar|pt-br)\/[a-f0-9]{40}(?:\/run-[0-9]+-[0-9]+)?$/.test(
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
        activeComparison = comparison
    }
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
    $('view-mode').checked = viewMode === 'all'
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
              : `${localeLabel(report.locale)} · 393 × 852 · Synthetic data`
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
        $('view-mode').checked = true
        $('status').value = ''
        render()
        while (!document.getElementById(location.hash.slice(1)) && renderedCount < filteredRows.length) appendNextPage()
        document.getElementById(location.hash.slice(1))?.scrollIntoView()
    }
    syncShareableUrl()
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
$('view-mode').addEventListener('change', () => {
    viewMode = $('view-mode').checked ? 'all' : 'changed'
    $('status').value = viewMode === 'changed' ? 'differences' : ''
    render()
    syncShareableUrl()
})
$('close').onclick = () => $('zoom').close()
$('side').onclick = () => zoom(active, 'side')
$('overlay').onclick = () => zoom(active, 'overlay')
$('difference').onclick = () => zoom(active, 'difference')
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
