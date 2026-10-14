/* Screenshot votes share the verified comments session. No optimistic writes. */
'use strict'
window.ScreenVoting = {
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
            for (const [value, label, icon] of [
                [1, 'up', '👍'],
                [-1, 'down', '👎'],
            ]) {
                const control = element('button'),
                    count = element('span', '—')
                control.type = 'button'
                control.dataset.vote = value
                control.setAttribute('aria-label', `Thumbs ${label}, ${scope.side} screenshot`)
                control.setAttribute('aria-pressed', 'false')
                control.disabled = true
                count.dataset.voteCount = label
                const glyph = element('span', icon)
                glyph.setAttribute('aria-hidden', 'true')
                control.append(glyph, count)
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
            widget.refresh = element('button', '↻')
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
