'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { RAGDOLL_ENABLED } from '@/constants/ragdoll.consts'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

// Same dynamic-import + kill-switch pattern as the 404. When RAGDOLL_ENABLED is
// false the chunk + p2-es never ship and the play area just stays empty (pink).
// See ragdoll.consts.ts.
const PeanutRagdoll = RAGDOLL_ENABLED ? dynamic(() => import('@/components/PeanutRagdoll'), { ssr: false }) : null

const MaintenancePage = () => {
    const router = useRouter()
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-6">
            {/* The canvas sizes itself to this box, so the height has to be
                definite — h-screen above gives the column one, but the box needs
                its own. 250px matches the mascot it replaces. */}
            <div aria-hidden="true" className="size-[250px] overflow-hidden rounded-sm border border-n-1">
                {PeanutRagdoll && <PeanutRagdoll />}
            </div>
            <h1 className="text-3xl font-bold text-black">We&apos;re doing some maintenance.</h1>
            <p className="max-w-md text-center text-lg text-grey-1">
                We&apos;ve taken the app offline to fix something. Check back in a few minutes — we&apos;ll have it
                running again as soon as we can.
            </p>

            <Button
                variant="transparent"
                onClick={() => router.push('/support')}
                className="h-5 w-fit p-0 text-black underline underline-offset-2"
            >
                Contact support
            </Button>
        </div>
    )
}

export default MaintenancePage
