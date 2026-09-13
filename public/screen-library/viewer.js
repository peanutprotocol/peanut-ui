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
const previewUrlPattern =
    /^https:\/\/imagedelivery\.net\/[\w-]+\/(?:peanut-screen-[a-f0-9]{64}|ps-[a-f0-9]{29})\/[\w-]+$/
const LOCALE_LABELS = {
    en: 'English',
    'es-419': 'Español',
    'es-AR': 'Español (Argentina)',
    'pt-BR': 'Português (Brasil)',
}
const localeLabel = (locale) => LOCALE_LABELS[locale] ?? locale ?? 'English'
const asset = (name) => {
    if (!/^[a-f0-9]{64}\.(png|webp)$/.test(name || '')) return null
    const preview = !offline && report?.previewUrls?.[name]
    if (typeof preview === 'string' && previewUrlPattern.test(preview)) return preview
    return assetBase + name
}
const image = (name, alt) => {
    const n = el('img')
    const url = asset(name)
    if (url) n.src = url
    n.alt = alt
    n.loading = 'lazy'
    return n
}
let rows = [],
    report,
    active,
    viewMode = 'all',
    indexEntries = []
const unavailable = (s) => !s || s.status !== 'captured'
function zoom(row, mode = 'side') {
    active = row
    const single = mode === 'screen' || (report?.type === 'comparison' && viewMode === 'all')
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
        const screen = after ?? before
        if (screen?.image) $('zoom-images').append(image(screen.image, row.name))
        else $('zoom-images').append(el('p', screen?.reason ?? 'No screenshot available.'))
    } else if (mode === 'difference') {
        if (row.diff) $('zoom-images').append(image(row.diff, 'Pixel difference'))
        else $('zoom-images').append(el('p', 'No pixel difference image available.'))
    } else if (mode === 'overlay' && !unavailable(before) && !unavailable(after)) {
        const n = el('div', undefined, 'overlay')
        n.append(image(before.image, 'Before'), image(after.image, 'After'))
        $('zoom-images').append(n)
        $('slider').value = '50'
    } else {
        for (const [label, s] of [
            ['Before', before],
            ['After', after],
        ])
            if (s?.image) $('zoom-images').append(image(s.image, label))
    }
    if (!$('zoom').open) $('zoom').showModal()
}
function render() {
    const q = $('search').value.toLowerCase(),
        flow = $('flow').value,
        status = $('status').value,
        changedMode = report?.type === 'comparison' && viewMode === 'changed'
    const filtered = rows.filter(
        (r) =>
            (!q || `${r.name} ${r.id} ${r.flow}`.toLowerCase().includes(q)) &&
            (!flow || flow === r.flow) &&
            (!changedMode || r.status !== 'unchanged') &&
            (!status || (status === 'differences' ? r.status !== 'unchanged' : status === r.status))
    )
    if (report?.type === 'comparison') $('title').textContent = changedMode ? 'See what changed.' : 'Every screen.'
    $('screens').replaceChildren()
    for (const row of filtered) {
        const tile = el('article', undefined, 'tile')
        tile.id = row.id
        const head = el('div', undefined, 'tile-head')
        head.append(
            el('span', row.status, `tag ${row.status}`),
            el('h2', row.name),
            el('div', `${row.flow} · ${row.kind === 'component' ? 'Isolated component' : 'App route'}`, 'meta')
        )
        tile.append(head)
        const showSingle = report.type === 'capture' || viewMode === 'all'
        const pair = el('div', undefined, `pair${showSingle ? ' single' : ''}`)
        for (const [label, s] of showSingle
            ? [['Screen', row.after ?? row.before]]
            : [
                  ['Before', row.before],
                  ['After', row.after],
              ]) {
            const fig = el('figure', undefined, 'shot')
            fig.append(el('figcaption', label))
            if (!unavailable(s)) {
                const b = el('button')
                b.setAttribute('aria-label', `Enlarge ${row.name}, ${label}`)
                b.append(image(s.thumbnail || s.image, row.name))
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
        $('screens').append(tile)
    }
    if (!filtered.length) $('screens').append(el('p', 'No screens match these filters.'))
}
async function loadJSON(url) {
    const r = await fetch(url)
    if (!r.ok) {
        const error = new Error(`Report unavailable (${r.status})`)
        error.status = r.status
        throw error
    }
    return r.json()
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
    $('dashboard-filters').hidden = true
    $('screen-filters').hidden = true
    $('route-coverage').hidden = true
    $('versions').hidden = true
    $('screens').hidden = true
    $('empty-state').hidden = false
}
function renderLanding() {
    const current = $('locale').value
    const requested = new URLSearchParams(location.search ?? '').get('locale')
    const locales = [...new Set(indexEntries.map((entry) => entry.locale))].sort((a, b) => {
        if (a === 'en') return -1
        if (b === 'en') return 1
        return a.localeCompare(b)
    })
    $('locale').replaceChildren(
        ...locales.map((value) => {
            const option = el('option', localeLabel(value))
            option.value = value
            return option
        })
    )
    const selected = locales.includes(current)
        ? current
        : locales.includes(requested)
          ? requested
          : locales.includes('en')
            ? 'en'
            : locales[0]
    $('locale').value = selected
    const visible = indexEntries.filter((entry) => entry.locale === selected)
    $('coverage').textContent =
        `${visible.length} published ${localeLabel(selected)} ${visible.length === 1 ? 'version' : 'versions'}`
    $('versions').replaceChildren()
    for (const v of visible) {
        if (!/^[a-z0-9/-]+$/.test(v.path)) continue
        const a = el('a', `${v.date} · ${v.label}${v.complete ? '' : ' · Incomplete'}`, 'version')
        a.href = `/screens/${v.path}/`
        $('versions').append(a)
    }
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
    const path = isHostedIndex ? '' : pathname.replace(/^\/screens\/?/, '').replace(/\/$/, '')
    if (!offline && !path) {
        const index = await loadJSON('/screen-data/index.json')
        if (!index.length) {
            showEmptyState()
            return
        }
        indexEntries = index
            .filter((entry) => entry && typeof entry === 'object' && typeof entry.path === 'string')
            .map((entry) => ({ ...entry, locale: entry.locale ?? 'en' }))
        if (!indexEntries.length) {
            showEmptyState()
            return
        }
        $('dashboard-filters').hidden = false
        $('screen-filters').hidden = true
        $('route-coverage').hidden = true
        renderLanding()
        return
    }
    let reportPath = path
    if (path === 'latest') reportPath = (await loadJSON('/screen-data/latest.json')).path
    if (!offline && !/^[a-z0-9/-]+$/.test(reportPath)) throw new Error('Invalid report path')
    report = offline ? window.SCREEN_REPORT : await loadJSON(`/screen-data/reports/${reportPath}/manifest.json`)
    if (!report || report.schema !== 1) throw new Error('Unsupported report')
    $('dashboard-filters').hidden = true
    rows =
        report.type === 'capture'
            ? report.screens.map((s) => ({
                  ...s,
                  after: s,
                  status: s.status,
              }))
            : report.screens
    const before = report.before,
        after = report.type === 'capture' ? report : report.after
    viewMode = report.type === 'capture' ? 'all' : 'changed'
    $('view-mode').value = viewMode
    $('view-mode-control').hidden = report.type === 'capture'
    $('title').textContent = report.type === 'capture' ? 'The screen library.' : 'See what changed.'
    $('description').textContent = before?.reconstruction
        ? 'Reconstructed historical code compared with dev. All account data is synthetic.'
        : `App-owned mobile screens and states. ${localeLabel(report.locale)} mobile viewport and synthetic account data.`
    $('footer').textContent = `App-owned mobile UI · ${localeLabel(report.locale)} · 393 × 852 · Synthetic data`
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
    for (const [label, capture] of [
        ['Before', before],
        ['After', after],
    ])
        if (capture) {
            const section = el('section')
            section.append(el('h3', label))
            for (const entry of capture.inventory ?? [])
                section.append(el('p', `${entry.route} · ${entry.status}${entry.reason ? ' · ' + entry.reason : ''}`))
            $('route-inventory').append(section)
        }
    const counts = rows.reduce((a, r) => {
        a[r.status] = (a[r.status] || 0) + 1
        return a
    }, {})
    $('coverage').textContent =
        `${report.complete ? 'Complete capture' : 'Incomplete capture — review gaps and failures'} · ${rows.length} states · ${Object.entries(
            counts
        )
            .map(([s, n]) => `${n} ${s}`)
            .join(' · ')}`
    for (const f of [...new Set(rows.map((r) => r.flow))].sort()) {
        const o = el('option', f)
        o.value = f
        $('flow').append(o)
    }
    if (report.type === 'comparison') $('status').value = 'differences'
    if (!offline) {
        $('download').href = `/screen-data/reports/${reportPath}/offline.tar.gz`
        $('download').hidden = false
    }
    render()
    if (location.hash) {
        viewMode = 'all'
        $('view-mode').value = 'all'
        $('status').value = ''
        render()
        document.getElementById(location.hash.slice(1))?.scrollIntoView()
    }
}
for (const name of ['search', 'flow', 'status']) $(name).addEventListener('input', render)
$('locale').addEventListener('change', renderLanding)
$('view-mode').addEventListener('change', () => {
    viewMode = $('view-mode').value
    $('status').value = viewMode === 'changed' ? 'differences' : ''
    render()
})
$('close').onclick = () => $('zoom').close()
$('side').onclick = () => zoom(active, 'side')
$('overlay').onclick = () => zoom(active, 'overlay')
$('difference').onclick = () => zoom(active, 'difference')
$('slider').oninput = () => {
    const n = $('zoom-images').querySelector('.overlay img+img')
    if (n) n.style.clipPath = `inset(0 ${100 - Number($('slider').value)}% 0 0)`
}
$('empty-retry').onclick = () => location.reload()
start().catch((e) => {
    const pathname = location.pathname
    const isHostedIndex =
        pathname === '/' ||
        pathname === '/index.html' ||
        pathname === '/screen-library' ||
        pathname === '/screen-library/' ||
        pathname === '/screen-library/index.html'
    showEmptyState(e.status === 404 ? (isHostedIndex ? 'unpublished' : 'report-not-found') : 'error')
})
