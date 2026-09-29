'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Loading from '@/components/Global/Loading'

/**
 * A retired route that still arrives from outside the app: push and email deep
 * links already delivered, shared links and native builds. It replaces itself
 * with `to` and keeps the query (`?open=residence`, `?step=…&provider=…`).
 *
 * The redirect runs on the client because the native static export cannot
 * render a server redirect that reads searchParams.
 */
export default function RouteAlias({ to }: { to: string }) {
    const router = useRouter()
    useEffect(() => {
        // The whole query is forwarded untouched, so there is no param for nuqs to type.
        router.replace(`${to}${window.location.search}`)
    }, [router, to])
    // A page-level wait, so the page loader, centred — not the 16px inline spinner.
    return (
        <PageStack>
            <PageStack.Center>
                <Loading variant="mascot" />
            </PageStack.Center>
        </PageStack>
    )
}
