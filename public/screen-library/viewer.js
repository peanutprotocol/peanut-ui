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
const asset = (name) => {
    if (!/^[a-f0-9]{64}\.(png|webp)$/.test(name || '')) return null
    const preview = !offline && report?.previewUrls?.[name]
    if (
        typeof preview === 'string' &&
        /^https:\/\/imagedelivery\.net\/[\w-]+\/peanut-screen-[a-f0-9]{64}\/[\w-]+$/.test(preview)
    )
        return preview
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
    active
const unavailable = (s) => !s || s.status !== 'captured'
function zoom(row, mode = 'side') {
    active = row
    $('zoom-title').textContent = row.name
    $('zoom-images').replaceChildren()
    $('slider-label').hidden = mode !== 'overlay'
    const before = row.before,
        after = row.after
    if (mode === 'difference') {
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
        status = $('status').value
    const filtered = rows.filter(
        (r) =>
            (!q || `${r.name} ${r.id} ${r.flow}`.toLowerCase().includes(q)) &&
            (!flow || flow === r.flow) &&
            (!status || (status === 'differences' ? r.status !== 'unchanged' : status === r.status))
    )
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
        const pair = el('div', undefined, `pair${report.type === 'capture' ? ' single' : ''}`)
        for (const [label, s] of report.type === 'capture'
            ? [['Screen', row.after]]
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
                b.onclick = () => zoom(row)
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
    $('empty-kicker').textContent = unpublished
        ? 'SCREEN LIBRARY · COMING TO LIFE'
        : 'SCREEN LIBRARY · TEMPORARILY UNAVAILABLE'
    $('empty-title').textContent = unpublished ? 'Your gallery is almost here.' : 'The gallery needs a moment.'
    $('empty-message').textContent = unpublished
        ? 'Screenshots are generated in the background and will appear here after the first capture is published.'
        : 'We could not load the library right now. Check again in a moment and your gallery will be here when it is ready.'
    $('empty-status').textContent = unpublished ? 'No published captures yet' : 'Temporary loading issue'
    $('coverage').hidden = true
    $('screen-filters').hidden = true
    $('route-coverage').hidden = true
    $('versions').hidden = true
    $('screens').hidden = true
    $('empty-state').hidden = false
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
        $('coverage').textContent = `${index.length} published versions`
        $('screen-filters').hidden = true
        $('route-coverage').hidden = true
        for (const v of index) {
            if (!/^[a-z0-9/-]+$/.test(v.path)) continue
            const a = el('a', `${v.date} · ${v.label}${v.complete ? '' : ' · Incomplete'}`, 'version')
            a.href = `/screens/${v.path}/`
            $('versions').append(a)
        }
        return
    }
    let reportPath = path
    if (path === 'latest') reportPath = (await loadJSON('/screen-data/latest.json')).path
    if (!offline && !/^[a-z0-9/-]+$/.test(reportPath)) throw new Error('Invalid report path')
    report = offline ? window.SCREEN_REPORT : await loadJSON(`/screen-data/reports/${reportPath}/manifest.json`)
    if (!report || report.schema !== 1) throw new Error('Unsupported report')
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
    $('title').textContent = report.type === 'capture' ? 'The screen library.' : 'See what changed.'
    $('description').textContent = before?.reconstruction
        ? 'Reconstructed historical code compared with dev. All account data is synthetic.'
        : 'App-owned mobile screens and states. Fixed English mobile viewport and synthetic account data.'
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
        $('status').value = ''
        render()
        document.getElementById(location.hash.slice(1))?.scrollIntoView()
    }
}
for (const name of ['search', 'flow', 'status']) $(name).addEventListener('input', render)
$('close').onclick = () => $('zoom').close()
$('side').onclick = () => zoom(active, 'side')
$('overlay').onclick = () => zoom(active, 'overlay')
$('difference').onclick = () => zoom(active, 'difference')
$('slider').oninput = () => {
    const n = $('zoom-images').querySelector('.overlay img+img')
    if (n) n.style.clipPath = `inset(0 ${100 - Number($('slider').value)}% 0 0)`
}
$('empty-retry').onclick = () => location.reload()
start().catch((e) => showEmptyState(e.status === 404 ? 'unpublished' : 'error'))
