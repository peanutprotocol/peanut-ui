'use client'

import { useEffect, useState } from 'react'
import type { HighlighterCore } from 'shiki'

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter() {
    if (!highlighterPromise) {
        highlighterPromise = import('shiki/bundle/web').then((shiki) =>
            shiki.createHighlighter({
                themes: ['github-light'],
                langs: ['tsx'],
            })
        )
    }
    return highlighterPromise
}

function escapeHtml(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function useHighlightedCode(code: string, lang = 'tsx') {
    const [html, setHtml] = useState(() => `<pre><code>${escapeHtml(code)}</code></pre>`)

    useEffect(() => {
        let cancelled = false
        getHighlighter().then((h) => {
            if (cancelled) return
            setHtml(h.codeToHtml(code, { lang, theme: 'github-light' }))
        })
        return () => {
            cancelled = true
        }
    }, [code, lang])

    return html
}
