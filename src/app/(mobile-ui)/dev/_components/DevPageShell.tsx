'use client'

import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'
import { twMerge } from '@/utils/tw'

/**
 * The shell every /dev page sits in.
 *
 * Two things it exists to fix, both structural:
 *  - The (mobile-ui) layout strips all padding for /dev routes (`isDev && 'p-0 pb-0'`)
 *    and stops constraining the width, so each page had to re-invent its own padding —
 *    and several forgot, rendering flush against the viewport edge.
 *  - NavHeader hides both its back button and its title on `md:`, so no dev page had a
 *    visible heading on desktop, which is where these tools are actually used.
 *
 * Dev pages are also flex children of a `justify-start` row: without `w-full` they
 * shrink to content width (why the leaderboard rendered in a ~800px gutter).
 */
export default function DevPageShell({
    title,
    description,
    backHref = '/dev',
    actions,
    width = 'wide',
    className,
    children,
}: {
    title: string
    description?: React.ReactNode
    /** Where the back affordance points. Defaults to the dev-tools index. */
    backHref?: string
    /** Right-aligned header controls (view toggles, filters). */
    actions?: React.ReactNode
    /** `prose` caps the body at a readable column; `wide` fills the viewport. */
    width?: 'wide' | 'prose'
    className?: string
    children: React.ReactNode
}) {
    return (
        <div className={twMerge('flex w-full min-w-0 flex-col gap-6 px-4 py-4 md:px-8 md:py-6', className)}>
            <PageStack gap="6">
                <header className="flex w-full flex-col gap-2">
                    <div className="md:hidden">
                        <NavHeader href={backHref} hideLabel />
                    </div>
                    <LinkButton href={backHref} className="hidden w-max md:inline-flex">
                        {backHref === '/dev' ? 'dev tools' : 'back'}
                    </LinkButton>
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                        <TitleBlock
                            className="max-w-3xl min-w-0"
                            title={<h1>{title}</h1>}
                            description={description}
                            size="m"
                        />
                        {actions}
                    </div>
                </header>

                <div className={twMerge('flex w-full min-w-0 flex-col gap-8', width === 'prose' && 'max-w-3xl')}>
                    {children}
                </div>
            </PageStack>
        </div>
    )
}
