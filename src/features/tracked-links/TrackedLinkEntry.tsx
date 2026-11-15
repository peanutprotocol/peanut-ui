'use client'

import { useEffect } from 'react'
import { enterGoPage } from './bootstrap'

/** A creator page's attribution: the same entry /app runs for this handoff, before any tap. */
export default function TrackedLinkEntry({ handoff }: { handoff: string }) {
    useEffect(() => {
        const doc = document as Document & { prerendering?: boolean }
        const start = () => void enterGoPage(new URLSearchParams(handoff.split('?')[1])).catch(() => {})
        // A prerendered page has no visitor yet: count it once it is shown.
        if (!doc.prerendering) return start()
        doc.addEventListener('prerenderingchange', start, { once: true })
        return () => doc.removeEventListener('prerenderingchange', start)
    }, [handoff])
    return null
}
