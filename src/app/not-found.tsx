'use client'

import { Button } from '@/components/0_Bruddle/Button'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { SUPPORT_EMAIL } from '@/constants/crisp'
import { RAGDOLL_ENABLED } from '@/constants/ragdoll.consts'
import { useModalsContextOptional } from '@/context/ModalsContext'
import dynamic from 'next/dynamic'

// Same dynamic-import + kill-switch pattern as the rewards easter egg. When
// RAGDOLL_ENABLED is false the chunk + p2-es never ship; the play area just
// stays empty (pink). See ragdoll.consts.ts.
const PeanutRagdoll = RAGDOLL_ENABLED ? dynamic(() => import('@/components/PeanutRagdoll'), { ssr: false }) : null

export default function NotFound() {
    // Localized marketing misses intentionally render without AppFlowProviders.
    // Keep their 404 page provider-free; app routes still get the support drawer.
    const modals = useModalsContextOptional()
    const supportHref = `mailto:${SUPPORT_EMAIL}`

    // Send only the pathname — query + hash can carry magic-link tokens,
    // OAuth callback secrets, or signed-share params that we don't want
    // landing in Crisp chat logs.
    const openSupport = () =>
        modals?.openSupportWithMessage(
            `Hey! I hit a 404 — can you help?${typeof window !== 'undefined' ? `\n\nPath: ${window.location.pathname}` : ''}`
        )

    return (
        <>
            <div className="flex min-h-dvh flex-col md:h-dvh md:flex-row">
                <div
                    aria-hidden="true"
                    className="relative h-[55dvh] w-full overflow-hidden bg-action-primary md:h-full md:w-7/12"
                >
                    {PeanutRagdoll && <PeanutRagdoll />}
                </div>

                <div className="flex flex-grow flex-col justify-center overflow-y-auto bg-background-default px-6 py-8 md:px-12">
                    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
                        <div className="flex flex-col gap-3">
                            <h1 className="text-heading-m">Hmm, we can&apos;t find that page.</h1>
                            <p className="text-body-m text-foreground-secondary">
                                If we&apos;ve sent you here, please{' '}
                                {modals ? (
                                    <button
                                        type="button"
                                        onClick={openSupport}
                                        className="text-foreground-primary underline"
                                    >
                                        let support know
                                    </button>
                                ) : (
                                    <a href={supportHref} className="text-foreground-primary underline">
                                        let support know
                                    </a>
                                )}{' '}
                                so we can fix it.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3">
                            {/* link-mode Button with plainAnchor: server-renders a real
                                <a href="/">, so a 404 recovers even when the client bundle
                                never hydrates, and the plain href also forces the full page
                                load that avoids the historical React error 310 from
                                hook-count mismatch between this route and the (mobile-ui) tree. */}
                            <Button href="/" plainAnchor className="w-full">
                                Take me home
                            </Button>
                            {modals ? (
                                <Button variant="stroke" className="w-full" onClick={openSupport}>
                                    Contact support
                                </Button>
                            ) : (
                                <Button variant="stroke" href={supportHref} className="w-full">
                                    Contact support
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {modals && <SupportDrawer />}
        </>
    )
}
