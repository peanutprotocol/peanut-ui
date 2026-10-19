/** Patched into IntlCore by prepare.mjs; the presence of this marker is how a capture knows copy was recorded. */
export const COPY_RECORDER_MARKER = '/* screen-capture-copy-v1 */'

/** Browser init script: wraps a message catalogue so every resolved message is recorded with its template. */
export function installCopyRecorder() {
    const resolved = new Map()
    const proxies = new WeakMap()
    const wrap = (target, prefix) => {
        const cached = proxies.get(target)
        if (cached) return cached
        // A copy as the proxy target keeps the invariants satisfiable when a bundler freezes JSON modules.
        const proxy = new Proxy(
            { ...target },
            {
                get(_shadow, property) {
                    const value = target[property]
                    if (typeof property !== 'string' || !Object.prototype.hasOwnProperty.call(target, property))
                        return value
                    const path = prefix ? `${prefix}.${property}` : property
                    if (typeof value === 'string') {
                        if (!resolved.has(path)) resolved.set(path, value)
                        return value
                    }
                    return value && typeof value === 'object' && !Array.isArray(value) ? wrap(value, path) : value
                },
            }
        )
        proxies.set(target, proxy)
        return proxy
    }
    Object.defineProperty(window, '__screenCaptureCopy', {
        value: (messages) => (messages && typeof messages === 'object' ? wrap(messages, '') : messages),
        configurable: true,
    })
    Object.defineProperty(window, '__screenCaptureResolvedCopy', { value: resolved, configurable: true })
}

/** Browser function: the resolved messages plus every piece of text a person can see or hear on the page. */
export function collectCopyEvidence() {
    const resolved = window.__screenCaptureResolvedCopy
    const parts = [document.title, document.body?.innerText ?? '']
    for (const element of document.querySelectorAll('[placeholder],[aria-label],[title],[alt],input,textarea')) {
        for (const attribute of ['placeholder', 'aria-label', 'title', 'alt']) {
            const value = element.getAttribute(attribute)
            if (value) parts.push(value)
        }
        if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.value)
            parts.push(element.value)
    }
    return {
        recorded: resolved instanceof Map,
        resolved: resolved ? [...resolved.entries()] : [],
        corpus: parts.join('\n'),
    }
}
