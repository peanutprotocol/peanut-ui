'use client'

import Link from 'next/link'
import type { MouseEvent } from 'react'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { twMerge } from '@/utils/tw'
import { REQUEST_LINKS_CLIENT_SEES_EVENT } from './requestLinks.consts'
import type { RequestLinksAppLinkProps } from './requestLinks.types'

/**
 * The DS press, hover lift and sink live in REQUEST_LINKS_MOTION_CSS (.rl-link):
 * the piece lifts on a fine-pointer hover and sinks into its hard shadow on press.
 * A child marked .rl-lift carries the shadow that steps up and drops.
 */
const LINK = 'rl-link block cursor-pointer focus-visible:outline-[3px] focus-visible:outline-action-focus'

/** Scrolls to an in-page fold, then tells it the visitor arrived. Instant under reduced motion. */
function goToFold(event: MouseEvent, id: string) {
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let arrived = false
    const arrive = () => {
        if (arrived) return
        arrived = true
        window.removeEventListener('scrollend', arrive)
        window.dispatchEvent(new Event(REQUEST_LINKS_CLIENT_SEES_EVENT))
    }
    window.addEventListener('scrollend', arrive)
    // scrollend is missing on older Safari, and no scroll happens when the fold is already in place
    window.setTimeout(arrive, reduced ? 50 : 900)
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

/**
 * Makes a request link or a real app screen on the page clickable. By default it
 * leads where the CTA leads (signup), with the same PWA-sunset handling as
 * LandingAppLink. With `to`, it scrolls to that fold instead (a request link
 * opens what the client sees). It repeats a visible CTA or fold, so it stays
 * out of the tab order.
 */
export function RequestLinksAppLink({ children, className, to, sink = 'sm' }: RequestLinksAppLinkProps) {
    const migrationOn = useMigrationFlag()
    const interceptAppCta = useAppModal()
    if (to) {
        return (
            <a
                href={`#${to}`}
                tabIndex={-1}
                data-sink={sink}
                className={twMerge(LINK, className)}
                onClick={(event) => goToFold(event, to)}
            >
                {children}
            </a>
        )
    }
    return (
        <Link
            prefetch={false}
            href={migrationOn ? '/app' : STAR_LP_HREF.signup}
            tabIndex={-1}
            data-sink={sink}
            className={twMerge(LINK, className)}
            onClick={(event) => {
                if (interceptAppCta(MIGRATION_SURFACES.STAR_LP)) event.preventDefault()
            }}
        >
            {children}
        </Link>
    )
}
