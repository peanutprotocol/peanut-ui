/* Screenshot votes share the verified comments session. No optimistic writes. */
'use strict'
window.ScreenVoting = {
    // Lucide icon paths, ISC License. Copyright (c) 2026 Lucide Icons and Contributors.
    // Permission to use, copy, modify, and/or distribute this software for any
    // purpose with or without fee is hereby granted, provided that the above
    // copyright notice and this permission notice appear in all copies.
    // THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
    // WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
    // MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
    // ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
    // WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
    // ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
    // OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
    icon(name) {
        const paths = {
            up: [
                'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z',
                'M7 10v12',
            ],
            down: [
                'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z',
                'M17 14V2',
            ],
            refresh: [
                'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
                'M21 3v5h-5',
                'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
                'M8 16H3v5',
            ],
            message: [
                'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719',
            ],
        }
        const ns = 'http://www.w3.org/2000/svg'
        const svg = document.createElementNS(ns, 'svg')
        for (const [key, value] of Object.entries({
            viewBox: '0 0 24 24',
            width: 14,
            height: 14,
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 1.8,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'aria-hidden': 'true',
            focusable: 'false',
        }))
            svg.setAttribute(key, value)
        for (const d of paths[name]) {
            const path = document.createElementNS(ns, 'path')
            path.setAttribute('d', d)
            svg.append(path)
        }
        return svg
    },
    create({ api, authenticate, getUser, getEpoch }) {
        const fields = ['reportPath', 'screenId', 'locale', 'profile', 'image', 'side']
        const widgets = new Set(),
            states = new Map(),
            intents = new Map()
        let timer,
            generation = 0,
            sequence = 0
        const canonical = (scope) => Object.fromEntries(fields.map((field) => [field, scope[field]]))
        const keyOf = (scope) => JSON.stringify(fields.map((field) => scope[field]))
        const element = (tag, text) => {
            const n = document.createElement(tag)
            if (text !== undefined) n.textContent = text
            return n
        }
        function connected() {
            for (const widget of widgets) if (!widget.root.isConnected) widgets.delete(widget)
            return [...widgets]
        }
        function paint() {
            const actor = getUser()?.id
            for (const widget of connected()) {
                const state = states.get(widget.key),
                    intent = intents.get(widget.key)
                const valid =
                    state?.actor === actor && actor && Number.isInteger(state.up) && Number.isInteger(state.down)
                const pending = intent?.actor === actor ? intent : undefined
                for (const [value, control, count] of widget.controls) {
                    control.setAttribute('aria-pressed', String(Boolean(valid && state.mine === value)))
                    control.disabled = !valid || Boolean(pending)
                    count.textContent = valid ? String(value === 1 ? state.up : state.down) : '—'
                }
                widget.status.textContent = pending?.busy ? 'Saving…' : pending?.error || state?.error || ''
                widget.retry.hidden = !pending?.error || pending.conflict
                widget.refresh.disabled = Boolean(pending?.busy || state?.loading)
            }
        }
        function schedule() {
            clearTimeout(timer)
            timer = setTimeout(() => load(), 40)
        }
        async function load(force = false, reconcileKey) {
            const captured = generation,
                actor = getUser()?.id,
                epoch = getEpoch(),
                seq = ++sequence
            if (!actor) return
            const scopes = new Map()
            for (const widget of connected()) {
                const state = states.get(widget.key)
                if (force || !state || state.actor !== actor || state.error) scopes.set(widget.key, widget.scope)
            }
            const batches = []
            let batch = []
            for (const scope of scopes.values()) {
                const candidate = [...batch, scope]
                if (
                    batch.length &&
                    (candidate.length > 100 ||
                        new TextEncoder().encode(JSON.stringify({ scopes: candidate })).length > 30000)
                ) {
                    batches.push(batch)
                    batch = []
                }
                batch.push(scope)
            }
            if (batch.length) batches.push(batch)
            for (const scopes of batches) {
                for (const scope of scopes) {
                    const key = keyOf(scope)
                    states.set(key, { ...states.get(key), actor, loading: true, sequence: seq })
                }
                paint()
                try {
                    const data = await api('/votes/summary', { method: 'POST', body: JSON.stringify({ scopes }) })
                    if (captured !== generation || epoch !== getEpoch() || actor !== getUser()?.id) return
                    for (const vote of data.votes) {
                        if (states.get(vote.key)?.sequence !== seq) continue
                        states.set(vote.key, { ...vote, actor })
                        const intent = intents.get(vote.key)
                        if (
                            vote.key === reconcileKey &&
                            intent &&
                            !intent.busy &&
                            (intent.conflict || vote.version > intent.body.version)
                        )
                            intents.delete(vote.key)
                    }
                } catch {
                    if (captured !== generation || epoch !== getEpoch() || actor !== getUser()?.id) return
                    for (const scope of scopes) {
                        const key = keyOf(scope)
                        if (states.get(key)?.sequence === seq)
                            states.set(key, { actor, error: 'Votes unavailable. Refresh to retry.' })
                    }
                }
                paint()
            }
        }
        async function save(widget, value, retry = false) {
            let intent = intents.get(widget.key)
            if (intent?.busy) return
            if (!retry) {
                const actor = getUser()?.id,
                    state = states.get(widget.key)
                if (!actor || state?.actor !== actor || intent) return
                intent = {
                    actor,
                    body: {
                        actorId: actor,
                        scope: widget.scope,
                        value: state.mine === value ? 0 : value,
                        version: state.version,
                        requestId: crypto.randomUUID(),
                    },
                }
                intents.set(widget.key, intent)
            }
            if (!intent) return
            intent.busy = true
            intent.error = ''
            paint()
            try {
                const user = await authenticate()
                if (intents.get(widget.key) !== intent || user.id !== intent.actor) return
                const epoch = getEpoch(),
                    captured = generation
                await api('/votes', { method: 'POST', body: JSON.stringify(intent.body) })
                if (
                    captured !== generation ||
                    epoch !== getEpoch() ||
                    getUser()?.id !== intent.actor ||
                    intents.get(widget.key) !== intent
                )
                    return
                intents.delete(widget.key)
                states.delete(widget.key)
                await load()
            } catch (error) {
                if (intents.get(widget.key) !== intent) return
                intent.conflict =
                    error.status === 409 || error.status === 403 || error.status === 400 || error.status === 404
                intent.error =
                    error.status === 409
                        ? 'Vote changed. Refresh before voting again.'
                        : error.status === 401
                          ? 'Sign in, then retry your vote.'
                          : error.status === 403
                            ? 'Voting is not permitted for your account.'
                            : 'Vote not confirmed. Retry or refresh.'
            } finally {
                intent.busy = false
                paint()
            }
        }
        function mount(input) {
            const scope = canonical(input),
                key = keyOf(scope)
            const root = element('span')
            root.className = 'screen-votes'
            root.dataset.voteScope = key
            root.setAttribute('role', 'group')
            root.setAttribute('aria-label', `${scope.side === 'before' ? 'Before' : 'After'} screenshot votes`)
            const widget = { root, scope, key, controls: [] }
            for (const [value, label] of [
                [1, 'up'],
                [-1, 'down'],
            ]) {
                const control = element('button'),
                    count = element('span', '—')
                control.type = 'button'
                control.dataset.vote = value
                control.setAttribute('aria-label', `Thumbs ${label}, ${scope.side} screenshot`)
                control.setAttribute('aria-pressed', 'false')
                control.disabled = true
                count.dataset.voteCount = label
                control.append(window.ScreenVoting.icon(label), count)
                control.onclick = () => save(widget, value)
                root.append(control)
                widget.controls.push([value, control, count])
            }
            widget.status = element('span')
            widget.status.dataset.voteStatus = ''
            widget.status.setAttribute('role', 'status')
            widget.retry = element('button', 'Retry')
            widget.retry.type = 'button'
            widget.retry.dataset.voteRetry = ''
            widget.retry.hidden = true
            widget.retry.onclick = () => save(widget, undefined, true)
            widget.refresh = element('button')
            widget.refresh.append(window.ScreenVoting.icon('refresh'))
            widget.refresh.type = 'button'
            widget.refresh.dataset.voteRefresh = ''
            widget.refresh.setAttribute('aria-label', `Refresh votes, ${scope.side} screenshot`)
            widget.refresh.onclick = async () => {
                try {
                    await authenticate()
                    await load(true, key)
                } catch {
                    paint()
                }
            }
            root.append(widget.refresh, widget.status, widget.retry)
            widgets.add(widget)
            queueMicrotask(paint)
            schedule()
            return root
        }
        function reset({ forgetPending = false } = {}) {
            generation++
            states.clear()
            if (forgetPending) intents.clear()
            paint()
            schedule()
        }
        return { mount, reset, refresh: schedule }
    },
}
