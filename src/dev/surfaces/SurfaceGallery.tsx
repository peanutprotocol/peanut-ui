'use client'

/** The /dev/surfaces body. Loaded only behind DEV_TOOLS_ENABLED — see the route. */

import { parseAsString, useQueryState } from 'nuqs'
import Link from 'next/link'
import { useEffect } from 'react'
import DevPageShell from '@/app/(mobile-ui)/dev/_components/DevPageShell'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Callout } from '@/components/0_Bruddle/Callout'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { OPTION_SURFACES, SURFACES, SURFACE_IDS } from '@/dev/surfaces/registry'
import { useModalsContext } from '@/context/ModalsContext'

function SurfaceHost({ id }: { id: string }) {
    const surface = SURFACES[id]
    const { setIsSignInModalOpen, setIsSupportModalOpen, setIsQRScannerOpen } = useModalsContext()

    // The context-driven surfaces have no visible prop — the provider holds
    // their open flag, so the harness flips it on mount instead.
    useEffect(() => {
        if (surface?.modalsContextFlag === 'qrScanner') setIsQRScannerOpen(true)
        if (surface?.modalsContextFlag === 'signIn') setIsSignInModalOpen(true)
        if (surface?.modalsContextFlag === 'support') setIsSupportModalOpen(true)
    }, [surface, setIsSignInModalOpen, setIsSupportModalOpen, setIsQRScannerOpen])

    const option = OPTION_SURFACES[id]
    if (option) return <>{option.render()}</>
    if (!surface)
        return (
            <Callout priority="error" className="m-4">
                Unknown surface: {id}
            </Callout>
        )
    if (surface.blocked) {
        return (
            <div className="p-4">
                <EmptyState icon="ban" title="Not capturable" description={surface.blocked} />
            </div>
        )
    }
    return <>{surface.render?.()}</>
}

export default function SurfaceGallery() {
    const [id] = useQueryState('s', parseAsString)

    if (!id) {
        return (
            <DevPageShell
                title="Surface gallery"
                description="Open a production surface directly for visual review."
                width="prose"
            >
                {SURFACE_IDS.map((surfaceId) => (
                    <Link key={surfaceId} href={`/dev/surfaces?s=${surfaceId}`}>
                        <ListItem
                            leading={<IconBubble icon="docs" size="s" color="gray" />}
                            title={SURFACES[surfaceId].name}
                            body={surfaceId}
                            chevron
                        />
                    </Link>
                ))}
            </DevPageShell>
        )
    }

    return <SurfaceHost id={id} />
}
