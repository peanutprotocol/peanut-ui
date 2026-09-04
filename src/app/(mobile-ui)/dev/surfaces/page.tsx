'use client'

/**
 * One surface per page load, open, so the visual-shot harness can photograph
 * every modal and drawer in the content-taxonomy review without walking the
 * flows that normally open them. `/dev/surfaces?s=<id>`; no `s` lists the ids.
 *
 * Gated the same way as every other /dev route (the group layout 404s it off
 * peanut.me), and the registry is imported behind DEV_TOOLS_ENABLED so it never
 * reaches a production chunk.
 */

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect } from 'react'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'
import { SURFACES, SURFACE_IDS } from '@/dev/surfaces/registry'
import { useModalsContext } from '@/context/ModalsContext'

function SurfaceHost({ id }: { id: string }) {
    const surface = SURFACES[id]
    const { setIsSignInModalOpen, setIsSupportModalOpen, setIsIosPwaInstallModalOpen } = useModalsContext()

    // The three context-driven surfaces have no visible prop — the provider
    // holds their open flag, so the harness flips it on mount instead.
    useEffect(() => {
        if (surface?.modalsContextFlag === 'signIn') setIsSignInModalOpen(true)
        if (surface?.modalsContextFlag === 'support') setIsSupportModalOpen(true)
        if (surface?.modalsContextFlag === 'iosPwaInstall') setIsIosPwaInstallModalOpen(true)
    }, [surface, setIsSignInModalOpen, setIsSupportModalOpen, setIsIosPwaInstallModalOpen])

    if (!surface) return <p className="p-4 text-body-s">Unknown surface: {id}</p>
    if (surface.blocked) {
        return (
            <div className="flex min-h-dvh flex-col justify-center gap-2 p-6 text-left">
                <p className="text-label-m tracking-wide text-foreground-secondary uppercase">Not capturable</p>
                <p className="text-body-s text-foreground-primary">{surface.blocked}</p>
            </div>
        )
    }
    return <>{surface.render?.()}</>
}

export default function DevSurfacesPage() {
    const params = useSearchParams()
    const id = params.get('s')

    if (!DEV_TOOLS_ENABLED) return null

    if (!id) {
        return (
            <ul className="flex flex-col gap-1 p-4">
                {SURFACE_IDS.map((surfaceId) => (
                    <li key={surfaceId}>
                        <Link className="text-body-s underline" href={`/dev/surfaces?s=${surfaceId}`}>
                            {surfaceId} — {SURFACES[surfaceId].name}
                        </Link>
                    </li>
                ))}
            </ul>
        )
    }

    return <SurfaceHost id={id} />
}
