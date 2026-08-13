'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { trackStoreClick } from '@/utils/migration.utils'
import type { LandingStrings } from './landingStrings'

/** Scroll distance before the bar comes up. */
const SHOW_AFTER_PX = 300

/** Distance from the document bottom where the footer takes over. */
const BOTTOM_GUARD_PX = 100

/** The bar is `md:hidden`, so above this width it listens to nothing. */
const MOBILE_QUERY = '(max-width: 767px)'

/**
 * Beats that repeat the CTAs of this bar mark themselves with this attribute,
 * and the bar steps aside while any of them is on screen. An attribute, not a
 * list of ids: WorksToday mounts late (it sits inside a Suspense boundary) and
 * a renamed id would drop out of a list without anyone noticing.
 */
export const OWN_CTA_ATTRIBUTE = 'data-own-cta'

export function StickyMobileCTA({ strings }: { strings: LandingStrings }) {
    const [isMobile, setIsMobile] = useState(false)
    const [scrolledPast, setScrolledPast] = useState(false)
    const [atBottom, setAtBottom] = useState(false)
    const [ownCtaOnScreen, setOwnCtaOnScreen] = useState(false)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const rafId = useRef(0)
    const lastScrolledPast = useRef(false)

    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    // app-locale translation, same as the hero's migration CTA
    const tMigration = useTranslations('migration')
    const isPhone = deviceType !== DeviceType.WEB
    const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'
    // pwa-sunset: phones get the store deep-link instead of the signup door pair
    const showStoreCta = migrationOn && isPhone
    const showDoor = !showStoreCta && !underMaintenanceConfig.disableCardBeat

    useEffect(() => {
        const query = window.matchMedia(MOBILE_QUERY)
        const apply = () => setIsMobile(query.matches)
        apply()
        query.addEventListener('change', apply)
        return () => query.removeEventListener('change', apply)
    }, [])

    useEffect(() => {
        if (!isMobile) return

        const check = () => {
            const next = window.scrollY >= SHOW_AFTER_PX
            if (next !== lastScrolledPast.current) {
                lastScrolledPast.current = next
                setScrolledPast(next)
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
    }, [isMobile])

    // The sentinel sits at the end of the page, so it comes into view exactly
    // when the old `document.body.scrollHeight` read said "near the bottom" —
    // without measuring the layout on every scroll frame.
    useEffect(() => {
        if (!isMobile) return
        const sentinel = sentinelRef.current
        if (!sentinel) return

        const observer = new IntersectionObserver(([entry]) => setAtBottom(entry.isIntersecting), {
            rootMargin: `0px 0px ${BOTTOM_GUARD_PX}px 0px`,
        })
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [isMobile])

    useEffect(() => {
        if (!isMobile) return

        const onScreen = new Set<Element>()
        const observed = new Set<Element>()
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) onScreen.add(entry.target)
                else onScreen.delete(entry.target)
            }
            setOwnCtaOnScreen(onScreen.size > 0)
        })

        // re-run on every DOM change so sections that mount after this effect
        // (Suspense, kill switches) still get observed
        const sync = () => {
            for (const section of document.querySelectorAll(`[${OWN_CTA_ATTRIBUTE}]`)) {
                if (observed.has(section)) continue
                observed.add(section)
                observer.observe(section)
            }
        }
        sync()

        const mutations = new MutationObserver(sync)
        mutations.observe(document.body, { childList: true, subtree: true })
        return () => {
            mutations.disconnect()
            observer.disconnect()
        }
    }, [isMobile])

    return (
        <>
            <div ref={sentinelRef} aria-hidden className="h-px w-full" />
            <AnimatePresence>
                {isMobile && scrolledPast && !atBottom && !ownCtaOnScreen && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex items-center gap-2 border-t-2 border-n-1 bg-white px-4 py-3 md:hidden"
                    >
                        {showStoreCta ? (
                            <a
                                href={STORE_URL[store]}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackStoreClick(store, MIGRATION_SURFACES.LANDING_HERO)}
                                className="pointer-events-auto flex-1"
                            >
                                <Button
                                    variant="purple"
                                    shadowSize="4"
                                    icon={store === 'ios' ? 'apple-logo' : 'google-play'}
                                    className="w-full px-2 py-3 text-base font-extrabold"
                                >
                                    {tMigration('downloadNow')}
                                </Button>
                            </a>
                        ) : (
                            <>
                                <Link
                                    href="/setup"
                                    className={`pointer-events-auto ${showDoor ? 'flex-[58]' : 'flex-1'}`}
                                >
                                    <Button
                                        variant="purple"
                                        shadowSize="4"
                                        className="w-full px-2 py-3 text-base font-extrabold"
                                    >
                                        {strings.signUpNow}
                                    </Button>
                                </Link>
                                {showDoor && (
                                    <Link href="/shhhhh" className="pointer-events-auto flex-[42]">
                                        <Button
                                            variant="stroke"
                                            shadowSize="4"
                                            className="w-full whitespace-nowrap px-2 py-3 text-sm font-extrabold"
                                        >
                                            {strings.tryTheDoor}
                                        </Button>
                                    </Link>
                                )}
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
