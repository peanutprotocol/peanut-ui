'use client'

import { notFound } from 'next/navigation'
import { use } from 'react'
import { creatorPageFixture } from '@/features/creator-pages/creator-page-fixture'
import { CreatorPagePreviewContext } from '@/features/creator-pages/CreatorPageContext'
import { CREATOR_PAGE_EXPERIMENTS } from '@/features/creator-pages/experiments'

/** One variant from a fixture. The preview context switches the events and the cookie off. */
export default function CreatorPagePreview({ params }: { params: Promise<{ creator: string; variant: string }> }) {
    const { creator, variant } = use(params)
    const found = Object.hasOwn(CREATOR_PAGE_EXPERIMENTS, creator)
        ? CREATOR_PAGE_EXPERIMENTS[creator].variants.find(({ id }) => id === variant)
        : undefined
    if (!found) notFound()

    return (
        <CreatorPagePreviewContext.Provider value={true}>
            <found.Page {...creatorPageFixture(creator, variant)} />
        </CreatorPagePreviewContext.Provider>
    )
}
