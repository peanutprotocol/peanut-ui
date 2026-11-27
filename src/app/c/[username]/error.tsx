'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { creatorInvitePath } from '@/features/creator-pages/invite-path'
import { captureException } from '@/utils/sentry-lazy'

/** A creator page that fails to render still reaches the creator's invite, as if they had no page. */
export default function CreatorPageError({ error }: { error: Error }) {
    const { username } = useParams<{ username: string }>()
    const href = creatorInvitePath(username.toLowerCase())

    useEffect(() => {
        console.error('creator page fell back to the invite', error)
        captureException(error)
        window.location.replace(href)
    }, [error, href])

    return (
        <main className="flex min-h-dvh items-center justify-center p-6">
            <a href={href} className="btn btn-primary">
                Continue to Peanut
            </a>
        </main>
    )
}
