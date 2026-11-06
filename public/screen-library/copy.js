const $ = (id) => document.getElementById(id)
const PAGE = 200
const reportPath = /^\d{4}-\d{2}-\d{2}\/[a-z0-9-]+(?:\/[a-z0-9-]+)+$/

function el(tag, props = {}, ...children) {
    const node = document.createElement(tag)
    for (const [key, value] of Object.entries(props))
        if (key === 'class') node.className = value
        else if (key === 'text') node.textContent = value
        else node.setAttribute(key, value)
    for (const child of children.flat()) if (child !== null && child !== undefined) node.append(child)
    return node
}

async function loadJSON(path) {
    const response = await fetch(path, { redirect: 'manual', cache: 'no-store' })
    if (response.type === 'opaqueredirect' || [0, 401, 403].includes(response.status)) {
        const error = new Error('Sign in to the Screen library to see copy coverage.')
        error.authRequired = true
        throw error
    }
    if (!response.ok) {
        const error = new Error(`Copy coverage unavailable (${response.status})`)
        error.status = response.status
        throw error
    }
    return response.json()
}

const params = new URLSearchParams(location.search)
const state = {
    mode: params.get('mode') === 'shown' ? 'shown' : 'never',
    query: params.get('q') ?? '',
    namespace: params.get('ns') ?? '',
    newOnly: params.get('new') === '1',
    limit: PAGE,
}

function syncUrl() {
    const next = new URLSearchParams(location.search)
    for (const [key, value] of [
        ['mode', state.mode === 'shown' ? 'shown' : ''],
        ['q', state.query],
        ['ns', state.namespace],
        ['new', state.newOnly ? '1' : ''],
    ])
        value ? next.set(key, value) : next.delete(key)
    history.replaceState(null, '', `${location.pathname}${next.size ? `?${next}` : ''}`)
}

const namespaceOf = (key) => key.split('.')[0]
const plural = (count, one, many) => `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`

function render(coverage, path) {
    const newGaps = new Set(coverage.baseline?.newGaps ?? [])
    const shownRows = Object.entries(coverage.shownBy ?? {}).map(([key, states]) => ({ key, states }))
    const neverRows = coverage.neverShown.map(({ key, text }) => ({ key, text, gap: newGaps.has(key) }))
    const reportHref = `/screens/${path}/`
    const percent = coverage.total ? Math.round((coverage.shown / coverage.total) * 100) : 0

    $('copy-title').textContent = `${percent}% of app copy has a screenshot`
    $('copy-provenance').replaceChildren(
        `${coverage.locale} · ${coverage.commit.slice(0, 12)} · `,
        el('a', { href: reportHref, text: 'Open this capture' }),
        coverage.complete ? '' : ' · capture incomplete, so some states may be missing'
    )
    const stat = (value, label, attention = false) =>
        el(
            'div',
            { class: `copy-stat${attention && value ? ' attention' : ''}` },
            el('b', { text: value.toLocaleString('en-US') }),
            el('span', { text: label })
        )
    $('copy-stats').replaceChildren(
        stat(coverage.shown, `of ${coverage.total.toLocaleString('en-US')} messages shown`),
        stat(coverage.neverShown.length, 'never shown'),
        ...(coverage.baseline
            ? [
                  stat(coverage.baseline.newGaps.length, 'never shown and not in the baseline', true),
                  stat(coverage.baseline.stale.length, 'baseline entries now shown or deleted', true),
              ]
            : []),
        stat(coverage.unverifiable, 'placeholder-only, counted when rendered')
    )
    $('copy-stats').hidden = false
    $('copy-controls').hidden = false

    const namespaces = [...new Set([...neverRows, ...shownRows].map(({ key }) => namespaceOf(key)))].sort()
    if (state.namespace && !namespaces.includes(state.namespace)) state.namespace = ''
    $('copy-namespace').replaceChildren(
        el('option', { value: '', text: 'All namespaces' }),
        ...namespaces.map((namespace) => el('option', { value: namespace, text: namespace }))
    )
    $('copy-namespace').value = state.namespace
    $('copy-search').value = state.query
    $('copy-new-only').checked = state.newOnly

    const draw = () => {
        for (const button of document.querySelectorAll('.copy-modes button'))
            button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode))
        $('copy-new-only').closest('label').hidden = state.mode !== 'never' || !coverage.baseline
        const query = state.query.trim().toLocaleLowerCase()
        const rows = (state.mode === 'never' ? neverRows : shownRows).filter(
            (row) =>
                (!state.namespace || namespaceOf(row.key) === state.namespace) &&
                (state.mode !== 'never' || !state.newOnly || row.gap) &&
                (!query ||
                    row.key.toLocaleLowerCase().includes(query) ||
                    (row.text ?? '').toLocaleLowerCase().includes(query))
        )
        $('copy-count').textContent =
            state.mode === 'never'
                ? `${plural(rows.length, 'message', 'messages')} with no screenshot`
                : `${plural(rows.length, 'message', 'messages')} shown, with the states that show them`
        const groups = new Map()
        for (const row of rows.slice(0, state.limit))
            groups.set(namespaceOf(row.key), [...(groups.get(namespaceOf(row.key)) ?? []), row])
        const total = new Map()
        for (const row of rows) total.set(namespaceOf(row.key), (total.get(namespaceOf(row.key)) ?? 0) + 1)
        const list = [...groups].map(([namespace, items]) =>
            el(
                'section',
                { class: 'copy-group' },
                el('h2', {}, namespace, el('span', { text: plural(total.get(namespace), 'message', 'messages') })),
                items.map((row) =>
                    el(
                        'div',
                        { class: 'copy-row' },
                        el(
                            'div',
                            { class: 'copy-key' },
                            row.key,
                            row.gap ? el('span', { class: 'copy-badge', text: 'Not in baseline' }) : null
                        ),
                        state.mode === 'never'
                            ? el('div', { class: 'copy-text', text: row.text })
                            : el(
                                  'div',
                                  { class: 'copy-states' },
                                  row.states
                                      .slice(0, 6)
                                      .map((id) =>
                                          el('a', { href: `${reportHref}#${encodeURIComponent(id)}`, text: id })
                                      ),
                                  row.states.length > 6 ? el('span', { text: `+${row.states.length - 6} more` }) : null
                              )
                    )
                )
            )
        )
        if (!rows.length)
            list.push(
                el('p', {
                    text:
                        state.mode === 'never' && !query && !state.namespace && !state.newOnly
                            ? 'Every message appears in at least one screenshot.'
                            : 'No messages match these filters.',
                })
            )
        if (rows.length > state.limit) {
            const more = el('button', {
                type: 'button',
                text: `Show ${Math.min(PAGE, rows.length - state.limit)} more`,
            })
            more.addEventListener('click', () => {
                state.limit += PAGE
                draw()
            })
            list.push(el('p', { class: 'copy-more' }, more))
        }
        $('copy-list').replaceChildren(...list)
        syncUrl()
    }

    for (const button of document.querySelectorAll('.copy-modes button'))
        button.addEventListener('click', () => {
            state.mode = button.dataset.mode
            state.limit = PAGE
            draw()
        })
    $('copy-search').addEventListener('input', (event) => {
        state.query = event.target.value
        state.limit = PAGE
        draw()
    })
    $('copy-namespace').addEventListener('change', (event) => {
        state.namespace = event.target.value
        state.limit = PAGE
        draw()
    })
    $('copy-new-only').addEventListener('change', (event) => {
        state.newOnly = event.target.checked
        state.limit = PAGE
        draw()
    })
    $('copy-status').textContent = ''
    $('copy-status').hidden = true
    draw()
}

async function main() {
    try {
        const path = params.get('path') ?? (await loadJSON('/screen-data/latest.json')).path
        if (!reportPath.test(path ?? '')) throw new Error('This link does not name a published capture.')
        render(await loadJSON(`/screen-data/reports/${path}/copy-coverage.json`), path)
    } catch (error) {
        $('copy-status').replaceChildren(
            error.status === 404
                ? 'This capture has no copy coverage yet. Captures record shown copy from the first run after copy coverage shipped.'
                : error.message,
            ...(error.authRequired
                ? [
                      ' ',
                      el('a', {
                          href: `/screen-data/auth/continue?return=${encodeURIComponent(location.pathname + location.search)}`,
                          text: 'Sign in',
                      }),
                  ]
                : [])
        )
    }
}

main()
