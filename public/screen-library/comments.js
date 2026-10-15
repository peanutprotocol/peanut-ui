/* Private screen discussions. All user content is rendered as literal text. */
'use strict'
window.ScreenComments = {
    create({ feed, panel, dialog, onNavigate }) {
        const node = (tag, text, cls) => {
            const n = document.createElement(tag)
            if (text !== undefined) n.textContent = text
            if (cls) n.className = cls
            return n
        }
        const button = (text, action, cls) => {
            const b = node('button', text, cls)
            b.type = 'button'
            b.onclick = action
            return b
        }
        const key = (scope) =>
            JSON.stringify([scope.reportPath, scope.screenId, scope.locale, scope.profile, scope.image, scope.side])
        const query = (value) =>
            new URLSearchParams(Object.entries(value).filter(([, v]) => v !== null && v !== undefined)).toString()
        const time = (value) => {
            const date = new Date(value)
            return Number.isNaN(date.getTime())
                ? ''
                : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        }
        let user,
            draftActor,
            epoch = 0,
            authSequence = 0,
            authPending,
            feedSequence = 0,
            panelSequence = 0
        let context = {},
            current,
            alternatives = [],
            opened = false,
            threads = [],
            nextScreen
        let feedItems = [],
            nextFeed,
            feedBusy = false,
            countTimer
        const drafts = new Map(),
            badges = new Set(),
            counts = new Map(),
            expanded = new Set()
        const voting = window.ScreenVoting?.create({ api, authenticate, getUser: () => user, getEpoch: () => epoch })
        function requireLogin() {
            const pendingForms = [...panel.querySelectorAll('.comment-composer')]
            user = undefined
            epoch++
            voting?.reset()
            feedSequence++
            panelSequence++
            counts.clear()
            feedItems = []
            threads = []
            feedBusy = false
            feed.replaceChildren(
                node('h2', 'Latest comments'),
                node('p', 'Sign in to view and add comments.', 'comment-notice')
            )
            const a = node('a', 'Sign in')
            a.href = `/screen-data/auth/continue?return=${encodeURIComponent(location.pathname + location.search + location.hash)}`
            a.target = '_blank'
            a.rel = 'noopener'
            feed.append(a)
            if (opened) {
                panel.replaceChildren(node('p', 'Sign in, then retry. Your drafts are kept.', 'comment-notice'))
                const login = a.cloneNode(true)
                panel.append(login, ...pendingForms)
            }
            for (const b of badges) b.countElement.textContent = '—'
        }
        async function api(path, options = {}) {
            const requestEpoch = epoch
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 8000)
            try {
                const response = await fetch(`/screen-data/comments${path}`, {
                    credentials: 'same-origin',
                    redirect: 'manual',
                    signal: controller.signal,
                    ...options,
                    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
                })
                const isJSON = (response.headers.get('content-type') || '').includes('application/json')
                if (
                    response.status === 401 ||
                    response.type === 'opaqueredirect' ||
                    (!isJSON && response.status < 500)
                ) {
                    if (requestEpoch === epoch) requireLogin()
                    throw Object.assign(new Error('Your session expired. Sign in, then retry.'), { status: 401 })
                }
                const data = isJSON ? await response.json() : {}
                if (!response.ok)
                    throw Object.assign(
                        new Error(
                            response.status === 409
                                ? 'This discussion changed. Reload it before saving; your draft is kept.'
                                : response.status === 403
                                  ? 'This action is not permitted for your account.'
                                  : response.status >= 500
                                    ? 'Comments are temporarily unavailable. Retry in a moment.'
                                    : data.error || 'Unable to save this comment.'
                        ),
                        { status: response.status }
                    )
                return data
            } catch (error) {
                if (error.status) throw error
                throw new Error('Connection interrupted. Your draft is kept; retry to confirm it was saved.')
            } finally {
                clearTimeout(timer)
            }
        }
        function authenticate() {
            const sequence = ++authSequence
            const pending = (async () => {
                const { user: next } = await api('/me')
                if (sequence !== authSequence) return authPending
                if (user?.id !== next.id) {
                    const changedActor = draftActor && draftActor !== next.id
                    epoch++
                    panelSequence++
                    feedSequence++
                    if (changedActor) drafts.clear()
                    draftActor = next.id
                    expanded.clear()
                    counts.clear()
                    threads = []
                    feedItems = []
                    feedBusy = false
                    user = next
                    voting?.reset({ forgetPending: Boolean(changedActor) })
                    if (changedActor) {
                        feed.replaceChildren(
                            node('h2', 'Latest comments'),
                            node('p', 'Loading comments…', 'comment-notice')
                        )
                        if (opened)
                            panel.replaceChildren(node('p', 'Loading discussion for your account…', 'comment-notice'))
                        for (const b of badges) b.countElement.textContent = '—'
                    }
                }
                return next
            })()
            authPending = pending
            return pending
        }
        function notice(container, message, retry) {
            const n = node('div', undefined, 'comment-notice')
            n.setAttribute('role', 'status')
            n.append(node('span', message))
            if (retry) n.append(button('Retry', retry))
            container.append(n)
            return n
        }
        async function loadFeed(append = false) {
            if (!user || feedBusy) return
            const seq = ++feedSequence,
                actor = epoch
            feedBusy = true
            if (!append) {
                feedItems = []
                nextFeed = undefined
                feed.replaceChildren(node('h2', 'Latest comments'), node('p', 'Loading comments…', 'comment-notice'))
            }
            try {
                const data = await api(
                    '/feed?' + query({ pr: context.prNumber, limit: 30, cursor: append ? nextFeed : undefined })
                )
                if (seq !== feedSequence || actor !== epoch) return
                feedItems.push(...data.items)
                nextFeed = data.nextCursor
                renderFeed()
            } catch (error) {
                if (actor === epoch) {
                    if (!append) feed.replaceChildren(node('h2', 'Latest comments'))
                    notice(feed, error.message, () => loadFeed(append))
                }
            } finally {
                if (seq === feedSequence) feedBusy = false
            }
        }
        function renderFeed() {
            feed.replaceChildren(node('div', undefined, 'comment-feed-heading'))
            const refresh = button(
                '',
                () => {
                    loadFeed()
                    voting?.refresh(true)
                },
                'comment-refresh'
            )
            const icon = window.ScreenVoting?.icon?.('refresh')
            if (icon) refresh.append(icon)
            else refresh.textContent = 'Refresh'
            feed.firstChild.append(node('h2', 'Latest comments'), refresh)
            feed.firstChild.lastChild.setAttribute('aria-label', 'Refresh comments and votes')
            if (!feedItems.length) notice(feed, 'No comments yet. Start a discussion on a screen.')
            for (const item of feedItems) {
                const b = button('', () => onNavigate(item.scope, item.threadId), 'comment-feed-item')
                b.dataset.commentId = item.id
                b.dataset.threadId = item.threadId
                const avatar = node('span', (item.author.name || '?').slice(0, 1).toUpperCase(), 'comment-avatar')
                avatar.setAttribute('aria-hidden', 'true')
                const content = node('span', undefined, 'comment-feed-content')
                const meta = node('span', undefined, 'comment-meta')
                meta.append(node('strong', item.author.name), node('time', time(item.createdAt)))
                const body = node('span', item.body, 'comment-feed-excerpt')
                body.dataset.commentBody = ''
                content.append(
                    meta,
                    body,
                    node(
                        'span',
                        `${item.scope.name || item.scope.screenId} · ${item.scope.locale} · ${item.scope.side}${item.resolved ? ' · Resolved' : ''}`,
                        'comment-location'
                    )
                )
                b.append(avatar, content)
                feed.append(b)
            }
            if (nextFeed) feed.append(button('More comments', () => loadFeed(true), 'comment-more'))
        }
        function scheduleCounts() {
            clearTimeout(countTimer)
            countTimer = setTimeout(loadCounts, 40)
        }
        async function loadCounts() {
            for (const entry of badges) if (!entry.element.isConnected) badges.delete(entry)
            if (!user) return
            const pending = [...badges].filter((b) => !counts.has(key(b.scope)))
            const unique = [...new Map(pending.map((b) => [key(b.scope), b.scope])).values()]
            const actor = epoch
            for (let i = 0; i < unique.length; i += 100) {
                const scopes = unique.slice(i, i + 100)
                try {
                    const data = await api('/counts', { method: 'POST', body: JSON.stringify({ scopes }) })
                    if (actor !== epoch) return
                    data.counts.forEach((value, index) => counts.set(key(scopes[index]), value.count))
                } catch {
                    if (actor !== epoch) return
                }
            }
            for (const b of badges) {
                const count = counts.get(key(b.scope))
                b.countElement.textContent = count === undefined ? '—' : count
                b.countElement.hidden = !count
                b.element.classList.toggle('has-comments', count > 0)
                b.element.setAttribute(
                    'aria-label',
                    `${count === undefined ? 'View' : count} comments, ${b.scope.side}`
                )
            }
        }
        function badge(scope, onOpen) {
            const b = button('', onOpen, 'comment-count')
            const cached = counts.get(key(scope))
            const countElement = node('span', cached ?? '—')
            countElement.hidden = !cached
            b.classList.toggle('has-comments', cached > 0)
            const icon = window.ScreenVoting?.icon?.('message')
            if (icon) b.append(icon)
            b.append(countElement)
            b.dataset.commentSide = scope.side
            b.setAttribute('aria-label', `View comments, ${scope.side}`)
            badges.add({ element: b, countElement, scope })
            scheduleCounts()
            return b
        }
        function heading() {
            const head = node('div', undefined, 'comment-panel-heading')
            head.append(node('h3', 'Comments'), button('×', close, 'comment-hide'))
            head.lastChild.setAttribute('aria-label', 'Hide comments')
            panel.append(head)
            panel.append(
                node(
                    'p',
                    `${current.name || current.screenId} · ${current.locale} · ${current.side}`,
                    'comment-location'
                )
            )
            if (alternatives.length > 1) {
                const tabs = node('div', undefined, 'comment-tabs')
                for (const scope of alternatives) {
                    const tab = button(scope.side === 'before' ? 'Before' : 'After', () =>
                        open(scope, undefined, alternatives)
                    )
                    tab.setAttribute('aria-pressed', String(key(scope) === key(current)))
                    tabs.append(tab)
                }
                panel.append(tabs)
            }
        }
        function composer(container, label, submitText, draftId, initialBody, save, cancel) {
            const owner = user.id
            const mapKey = `${user.id}:${key(current)}:${draftId}`
            let draft = drafts.get(mapKey)
            if (!draft) {
                draft = { body: initialBody || '' }
                drafts.set(mapKey, draft)
            }
            const form = node('form', undefined, 'comment-composer')
            const field = node('textarea')
            field.setAttribute('aria-label', label)
            field.placeholder = label
            field.value = draft.body
            field.rows = 2
            const status = node('p', '', 'comment-form-status')
            status.setAttribute('role', 'status')
            const actions = node('div', undefined, 'comment-form-actions')
            const submit = node('button', submitText)
            submit.type = 'submit'
            actions.append(node('span', 'Plain text · 4,000 characters'), submit)
            if (cancel)
                actions.append(
                    button('Cancel edit', () => {
                        drafts.delete(mapKey)
                        cancel()
                    })
                )
            field.oninput = () => {
                draft.body = field.value
                draft.requestId = undefined
                status.textContent = ''
            }
            form.append(field, actions, status)
            container.append(form)
            let busy = false
            form.onsubmit = async (event) => {
                event.preventDefault()
                if (busy) return
                if ((user && user.id !== owner) || form.isConnected === false) return
                draft.body = field.value
                if (!draft.body.trim() || [...draft.body].length > 4000) {
                    status.textContent = 'Enter a comment of 1–4,000 characters.'
                    return
                }
                const actor = owner,
                    scope = current
                busy = true
                submit.disabled = true
                field.readOnly = true
                status.textContent = 'Saving…'
                try {
                    const verified = await authenticate()
                    if (verified?.id !== actor || key(scope) !== key(current))
                        throw new Error('Account or screen changed. Reopen the discussion to continue.')
                    draft.requestId ||= crypto.randomUUID()
                    const submittedBody = draft.body,
                        submittedId = draft.requestId,
                        submittedPanel = panelSequence
                    await save(submittedBody, submittedId)
                    if (user?.id !== actor) return
                    const unchangedDraft =
                        drafts.get(mapKey) === draft && draft.body === submittedBody && draft.requestId === submittedId
                    if (unchangedDraft) drafts.delete(mapKey)
                    if (draftId.startsWith('reply:')) expanded.delete(draftId.slice(6))
                    counts.delete(key(scope))
                    if (unchangedDraft && submittedPanel === panelSequence) await loadPanel()
                    scheduleCounts()
                    await loadFeed()
                } catch (error) {
                    status.textContent = error.message
                    if (error.status === 409) status.append(button('Reload discussion', () => loadPanel()))
                } finally {
                    busy = false
                    submit.disabled = false
                    field.readOnly = false
                }
            }
            return form
        }
        function message(container, comment, thread) {
            const article = node('article', undefined, 'comment-message')
            article.dataset.commentId = comment.id
            const meta = node('div', undefined, 'comment-meta')
            meta.append(
                node('strong', comment.author.name),
                node('time', time(comment.createdAt) + (comment.editedAt ? ' · edited' : ''))
            )
            const body = node('p', comment.body, 'comment-body')
            body.dataset.commentBody = ''
            article.append(meta, body)
            if (comment.author.id === user?.id) {
                article.append(
                    button(
                        'Edit',
                        () => {
                            if (article.querySelector('form')) return
                            body.hidden = true
                            composer(
                                article,
                                'Edit comment',
                                'Save changes',
                                `edit:${comment.id}`,
                                comment.body,
                                (value, requestId) =>
                                    api(`/comments/${comment.id}`, {
                                        method: 'PATCH',
                                        body: JSON.stringify({ body: value, version: comment.version, requestId }),
                                    }),
                                () => {
                                    body.hidden = false
                                    article.querySelector('form')?.remove()
                                }
                            )
                        },
                        'comment-action'
                    )
                )
            }
            container.append(article)
        }
        async function replies(container, thread, cursor, append = false) {
            const seq = panelSequence,
                actor = epoch
            if (!append) container.replaceChildren(node('p', 'Loading replies…', 'comment-notice'))
            try {
                const data = await api(`/threads/${thread.id}?` + query({ limit: 30, cursor }))
                if (seq !== panelSequence || actor !== epoch) return
                if (!append) container.replaceChildren()
                for (const comment of data.replies) message(container, comment, thread)
                if (data.nextCursor)
                    container.append(
                        button(
                            'More replies',
                            (event) => {
                                event.currentTarget.remove()
                                replies(container, thread, data.nextCursor, true)
                            },
                            'comment-more'
                        )
                    )
            } catch (error) {
                if (seq === panelSequence && actor === epoch)
                    notice(container, error.message, () => replies(container, thread, cursor, append))
            }
        }
        function renderThread(thread) {
            const n = node('section', undefined, `comment-thread${thread.resolved ? ' is-resolved' : ''}`)
            n.dataset.threadId = thread.id
            if (thread.resolved) n.append(node('span', '✓ Resolved', 'comment-resolved'))
            message(n, thread.comment, thread)
            const actions = node('div', undefined, 'comment-thread-actions')
            const replySlot = node('div', undefined, 'comment-replies')
            const formSlot = node('div')
            actions.append(
                button(
                    'Reply',
                    () => {
                        if (formSlot.firstChild) {
                            formSlot.querySelector('textarea')?.focus()
                            return
                        }
                        expanded.add(thread.id)
                        replies(replySlot, thread)
                        const form = composer(
                            formSlot,
                            'Reply',
                            'Post reply',
                            `reply:${thread.id}`,
                            '',
                            (body, requestId) =>
                                api(`/threads/${thread.id}/replies`, {
                                    method: 'POST',
                                    body: JSON.stringify({ body, requestId }),
                                })
                        )
                        form.querySelector('textarea').focus()
                    },
                    'comment-action'
                )
            )
            const resolveButton = button(
                thread.resolved ? 'Reopen thread' : 'Resolve thread',
                async () => {
                    resolveButton.disabled = true
                    const actor = user?.id
                    const draftKey = `resolve:${thread.id}:${thread.version}:${!thread.resolved}`
                    let requestId = drafts.get(draftKey)
                    if (!requestId) {
                        requestId = crypto.randomUUID()
                        drafts.set(draftKey, requestId)
                    }
                    try {
                        const next = await authenticate()
                        if (next.id !== actor) throw new Error('Your account changed. Reload the discussion.')
                        await api(`/threads/${thread.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ resolved: !thread.resolved, version: thread.version, requestId }),
                        })
                        drafts.delete(draftKey)
                        await loadPanel()
                        await loadFeed()
                    } catch (error) {
                        notice(n, error.message, () => loadPanel())
                    } finally {
                        resolveButton.disabled = false
                    }
                },
                'comment-action'
            )
            actions.append(resolveButton)
            if (thread.replyCount)
                actions.append(
                    button(
                        `${thread.replyCount} ${thread.replyCount === 1 ? 'reply' : 'replies'}`,
                        () => {
                            if (expanded.has(thread.id)) {
                                expanded.delete(thread.id)
                                replySlot.replaceChildren()
                            } else {
                                expanded.add(thread.id)
                                replies(replySlot, thread)
                            }
                        },
                        'comment-action'
                    )
                )
            n.append(actions, replySlot, formSlot)
            if (expanded.has(thread.id)) replies(replySlot, thread)
            return n
        }
        function renderPanel() {
            panel.replaceChildren()
            heading()
            const list = node('div', undefined, 'comment-thread-list')
            for (const thread of threads) list.append(renderThread(thread))
            if (!threads.length) notice(list, 'No discussion on this version yet.')
            if (nextScreen) list.append(button('More threads', () => loadPanel(true), 'comment-more'))
            panel.append(list)
            if (user)
                composer(panel, 'Add a comment', 'Post comment', 'new', '', (body, requestId) =>
                    api('/threads', { method: 'POST', body: JSON.stringify({ scope: current, body, requestId }) })
                )
        }
        async function loadPanel(append = false, focusThread) {
            if (!opened || !user) return
            const seq = ++panelSequence,
                actor = epoch,
                scope = current
            if (!append) {
                panel.replaceChildren()
                heading()
                notice(panel, 'Loading discussion…')
                threads = []
                nextScreen = undefined
            }
            try {
                const data = await api(
                    '/screen?' + query({ ...scope, limit: 20, cursor: append ? nextScreen : undefined })
                )
                if (seq !== panelSequence || actor !== epoch || key(current) !== key(scope)) return
                threads.push(...data.threads)
                nextScreen = data.nextCursor
                if (focusThread && !threads.some((t) => t.id === focusThread)) {
                    const detail = await api(`/threads/${focusThread}`)
                    if (seq !== panelSequence || actor !== epoch) return
                    if (key(detail.thread.scope) === key(current)) threads.unshift(detail.thread)
                }
                renderPanel()
                if (focusThread) {
                    const target = [...panel.querySelectorAll('[data-thread-id]')].find(
                        (n) => n.dataset.threadId === focusThread
                    )
                    target?.scrollIntoView({ block: 'nearest' })
                    target?.classList.add('comment-highlight')
                }
            } catch (error) {
                if (seq === panelSequence && actor === epoch)
                    notice(panel, error.message, () => loadPanel(append, focusThread))
            }
        }
        async function open(scope, threadId, scopes = [scope]) {
            current = scope
            alternatives = scopes
            opened = true
            panel.hidden = false
            dialog.classList.add('comments-open')
            if (!user) {
                try {
                    await authenticate()
                } catch (error) {
                    panel.replaceChildren()
                    heading()
                    notice(panel, error.message)
                    return
                }
            }
            await loadPanel(false, threadId)
        }
        function close() {
            opened = false
            panelSequence++
            panel.hidden = true
            dialog.classList.remove('comments-open')
        }
        async function setContext(next = {}) {
            context = next
            try {
                await authenticate()
                await loadFeed()
                scheduleCounts()
                voting?.refresh()
            } catch (error) {
                if (error.status !== 401) {
                    feed.replaceChildren(node('h2', 'Latest comments'))
                    notice(feed, error.message, () => setContext(context))
                }
            }
        }
        window.addEventListener('focus', async () => {
            const previous = user?.id
            try {
                await authenticate()
                await loadFeed()
                scheduleCounts()
                voting?.refresh(true)
                if (opened && user?.id !== previous) await loadPanel()
            } catch (error) {
                if (error.status !== 401) {
                    feed.replaceChildren(node('h2', 'Latest comments'))
                    notice(feed, error.message, () => setContext(context))
                }
            }
        })
        async function navigateThread(id) {
            try {
                if (!user) await authenticate()
                const sequence = panelSequence,
                    actor = epoch
                const data = await api(`/threads/${id}`)
                if (sequence !== panelSequence || actor !== epoch) return
                onNavigate(data.thread.scope, id)
            } catch (error) {
                notice(feed, error.message, () => navigateThread(id))
            }
        }
        return {
            setContext,
            badge,
            open,
            close,
            navigateThread,
            voteControls: (scope) => voting?.mount(scope),
            isOpen: () => opened,
            current: () => current,
        }
    },
}
