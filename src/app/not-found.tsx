'use client'

import { Button } from '@/components/0_Bruddle/Button'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { RAGDOLL_ENABLED } from '@/constants/ragdoll.consts'
import { useModalsContext } from '@/context/ModalsContext'
import dynamic from 'next/dynamic'

// Same dynamic-import + kill-switch pattern as the rewards easter egg. When
// RAGDOLL_ENABLED is false the chunk + p2-es never ship; the play area just
// stays empty (pink). See ragdoll.consts.ts.
const PeanutRagdoll = RAGDOLL_ENABLED ? dynamic(() => import('@/components/PeanutRagdoll'), { ssr: false }) : null

export default function NotFound() {
    const { openSupportWithMessage } = useModalsContext()

    const openSupport = () =>
        openSupportWithMessage(
            `Hey! I hit a 404 — can you help?${typeof window !== 'undefined' ? `\n\nURL: ${window.location.href}` : ''}`
        )

    return (
        <>
            <div className="flex min-h-[100dvh] flex-col md:h-[100dvh] md:flex-row">
                <div className="relative h-[55dvh] w-full overflow-hidden bg-purple-1 md:h-full md:w-7/12">
                    {PeanutRagdoll && <PeanutRagdoll />}
                </div>

                <div className="flex flex-grow flex-col justify-center overflow-y-auto bg-white px-6 py-8 md:px-12">
                    <div className="mx-auto w-full max-w-md space-y-8">
                        <div className="space-y-3">
                            <h1 className="text-3xl font-extrabold">Hmm, we can&apos;t find that page.</h1>
                            <p className="text-base text-grey-1">
                                If we&apos;ve sent you here, please{' '}
                                <button type="button" onClick={openSupport} className="text-black underline">
                                    let support know
                                </button>{' '}
                                so we can fix it.
                            </p>
                        </div>
                        <div className="space-y-3">
                            {/* Raw <a> instead of <Link>: forces a full page load when leaving the
                                404, avoiding the historical React error #310 from hook-count
                                mismatch between this route and the (mobile-ui) tree. */}
                            <a href="/" className="btn btn-purple shadow-4 block w-full text-center">
                                Take me home
                            </a>
                            <Button variant="stroke" onClick={openSupport}>
                                Contact support
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            <SupportDrawer />
        </>
    )
}
