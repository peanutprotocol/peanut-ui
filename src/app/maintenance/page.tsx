'use client'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { RAGDOLL_ENABLED } from '@/constants/ragdoll.consts'
import dynamic from 'next/dynamic'

// Same dynamic-import + kill-switch pattern as the 404. When RAGDOLL_ENABLED is
// false the chunk + p2-es never ship and the play area just stays empty (pink).
// See ragdoll.consts.ts.
const PeanutRagdoll = RAGDOLL_ENABLED ? dynamic(() => import('@/components/PeanutRagdoll'), { ssr: false }) : null

const MaintenancePage = () => {
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-6">
            {/* The canvas sizes itself to this box, so the height has to be
                definite — h-screen above gives the column one, but the box needs
                its own. 250px matches the mascot it replaces. */}
            <div aria-hidden="true" className="size-[250px] overflow-hidden rounded-sm border border-border-default">
                {PeanutRagdoll && <PeanutRagdoll />}
            </div>
            <h1 className="text-3xl font-bold text-black">We&apos;re doing some maintenance.</h1>
            <p className="max-w-md text-center text-lg text-foreground-secondary">
                We&apos;ve taken the app offline to fix something. Check back in a few minutes — we&apos;ll have it
                running again as soon as we can.
            </p>

            <LinkButton href="/support">Contact support</LinkButton>
        </div>
    )
}

export default MaintenancePage
