'use client'

/** The /dev/surfaces body. Loaded only behind DEV_TOOLS_ENABLED — see the route. */

import { parseAsString, useQueryState } from 'nuqs'
import Link from 'next/link'
import { useEffect } from 'react'
import { OPTION_SURFACES, SURFACES, SURFACE_IDS } from '@/dev/surfaces/registry'
import { useModalsContext } from '@/context/ModalsContext'

function SurfaceHost({ id }: { id: string }) {
    const surface = SURFACES[id]
    const { setIsSignInModalOpen, setIsSupportModalOpen, setIsIosPwaInstallModalOpen } = useModalsContext()

    // The context-driven surfaces have no visible prop — the provider holds
    // their open flag, so the harness flips it on mount instead.
    useEffect(() => {
        if (surface?.modalsContextFlag === 'signIn') setIsSignInModalOpen(true)
        if (surface?.modalsContextFlag === 'support') setIsSupportModalOpen(true)
        if (surface?.modalsContextFlag === 'iosPwaInstall') setIsIosPwaInstallModalOpen(true)
    }, [surface, setIsSignInModalOpen, setIsSupportModalOpen, setIsIosPwaInstallModalOpen])

    const option = OPTION_SURFACES[id]
    if (option) return <>{option.render()}</>
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

export default function SurfaceGallery() {
    const [id] = useQueryState('s', parseAsString)

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
