'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/0_Bruddle/Button'
import type { LandingStrings } from './landingStrings'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import DownloadAppLink from '@/components/Migration/DownloadAppLink'

export function StickyMobileCTA({ strings }: { strings: LandingStrings }) {
    const [visible, setVisible] = useState(false)
    // AnimatePresence used to keep the bar mounted while it animated out; this
    // does the same with a timer matched to `.sticky-cta-out` (250ms).
    const [exiting, setExiting] = useState(false)
    const hasShown = useRef(false)
    const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const rafId = useRef(0)
    const lastVisible = useRef(false)
    const migrationOn = useMigrationFlag()

    useEffect(() => {
        if (visible) {
            hasShown.current = true
            setExiting(false)
            clearTimeout(exitTimer.current)
            return
        }
        if (!hasShown.current) return
        setExiting(true)
        exitTimer.current = setTimeout(() => setExiting(false), 250)
        return () => clearTimeout(exitTimer.current)
    }, [visible])

    useEffect(() => {
        const check = () => {
            const next = window.scrollY >= 300

            if (next !== lastVisible.current) {
                lastVisible.current = next
                setVisible(next)
            }
        }

        const onScroll = () => {
            cancelAnimationFrame(rafId.current)
            rafId.current = requestAnimationFrame(check)
        }

        window.addEventListener('scroll', onScroll, { passive: true })
        check()
        return () => {
            window.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(rafId.current)
        }
    }, [])

    if (!visible && !exiting) return null

    return (
        <>
            {
                <div
                    data-testid="sticky-mobile-cta"
                    className={`pointer-events-none fixed right-0 bottom-0 left-0 z-50 border-t-2 border-border-default bg-white px-4 py-3 md:hidden ${
                        visible ? 'sticky-cta-in' : 'sticky-cta-out'
                    }`}
                >
                    {migrationOn ? (
                        <DownloadAppLink
                            surface={MIGRATION_SURFACES.LANDING_HERO}
                            variant="primary"
                            className="pointer-events-auto block"
                            buttonClassName="w-full uppercase"
                        />
                    ) : (
                        <Link prefetch={false} href="/setup" className="pointer-events-auto block">
                            <Button variant="primary" shadowSize="4" className="w-full">
                                {strings.signUpNow}
                            </Button>
                        </Link>
                    )}
                </div>
            }
        </>
    )
}
