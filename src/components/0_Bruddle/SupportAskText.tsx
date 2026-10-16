'use client'

import { useContext } from 'react'
import { CONTACT_SUPPORT_PHRASE, SupportAskContext } from './supportAsk.utils'

/**
 * Message text that can ask the user to contact support. Inside an error
 * Callout that offers support, the words that ask ("Contact support") become
 * the support link, so the callout shows one "Contact support", not the text
 * plus a second link under it. Anywhere else it renders the plain text.
 * An inline link underlines its own words (design.md, links).
 */
export function SupportAskText({ text }: { text: string }) {
    const openSupport = useContext(SupportAskContext)
    const match = openSupport ? CONTACT_SUPPORT_PHRASE.exec(text) : null
    if (!openSupport || !match) return <>{text}</>
    const end = match.index + match[0].length
    return (
        <>
            {text.slice(0, match.index)}
            <button
                type="button"
                data-support-ask
                onClick={openSupport}
                className="relative rounded text-start underline after:absolute after:inset-x-0 after:-inset-y-3 focus-visible:outline-2 focus-visible:outline-action-focus"
            >
                {match[0]}
            </button>
            {text.slice(end)}
        </>
    )
}
