'use client'

import { type ReactNode } from 'react'
import { useAuth } from '@/context/authContext'
import { bridgeTermsDocuments } from '@/utils/bridge-terms.utils'

/**
 * `t.rich` renderers for the `<terms>` and `<privacy>` tags in the Bridge
 * terms prompts. The links open the documents for the user's verified
 * residence in a new tab (native: the in-app browser), so the prompt stays
 * open and reading a document accepts nothing.
 */
export function useBridgeTermsLinks() {
    const { user } = useAuth()
    const documents = bridgeTermsDocuments(user?.residence?.verified)

    return {
        terms: (chunks: ReactNode) => documentLink(documents.terms, chunks),
        privacy: (chunks: ReactNode) => documentLink(documents.privacy, chunks),
    }
}

function documentLink(href: string, chunks: ReactNode) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-foreground-primary underline">
            {chunks}
        </a>
    )
}
