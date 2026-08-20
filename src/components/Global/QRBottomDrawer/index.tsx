import Divider from '@/components/0_Bruddle/Divider'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'
import { QR_DRAWER_EXPANDED_PX, QR_DRAWER_PEEK_PX } from '@/constants/qr-drawer.consts'

interface QRBottomDrawerProps {
    url: string
    collapsedTitle: string
    expandedTitle: string
    text: string
    buttonText: string
    className?: string
}

/*
 * Fractional snap points made the collapsed height depend on the viewport AND
 * the locale: vaul applies `windowHeight - snap * windowHeight` to a
 * content-sized drawer, so the visible peek came out as
 * `contentHeight - 0.25 * windowHeight` — 212px on a 932px screen in English,
 * 309px on a 640px screen in pt-BR, whose "let others scan this" line wraps to
 * two. A px snap on a viewport-height drawer is the same number everywhere.
 *
 * Only the COLLAPSED point has to be deterministic — it is what the paste
 * actions are anchored to. The expanded point is sized to the content so the
 * sheet still reads as a panel; it is safe to keep it that small because the
 * scroll area below is capped to the same window, so a longer translation or a
 * larger font-size setting scrolls instead of being clipped.
 *
 * module scope: a new array each render makes vaul's snap-sync effect refire
 * and re-apply the transform transition on every parent re-render
 */
const snapPoints = [`${QR_DRAWER_PEEK_PX}px`, `${QR_DRAWER_EXPANDED_PX}px`]

const QRBottomDrawer = ({ url, collapsedTitle, expandedTitle, text, buttonText, className }: QRBottomDrawerProps) => {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
    const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(snapPoints[0])

    const handleSnapPointChange = (snapPoint: number | string | null) => {
        setActiveSnapPoint(snapPoint)
    }

    return (
        <>
            <Drawer
                open={true}
                snapPoints={snapPoints}
                activeSnapPoint={activeSnapPoint}
                setActiveSnapPoint={handleSnapPointChange}
                modal={false}
                // drag-down at the first snap point otherwise calls vaul's closeDrawer().
                // that collides with the forced open={true}: close/reopen flicker, then a
                // 500ms window where vaul ignores all drags. with dismissible={false} vaul
                // ignores drag-down at the collapsed snap — the drawer does not move.
                // vaul 1.1.2 note: releasing that drag hits a benign out-of-bounds snap
                // index inside vaul. re-test that path on a vaul upgrade.
                dismissible={false}
            >
                {/* modal={false} turns off vaul's scroll prevention. without touch-none the
                    browser claims a swipe as a scroll, fires pointercancel, and the drawer
                    needs two swipes. the touch-action walk stops at the shared overflow-auto
                    wrapper (even when nothing overflows), so the outer class only covers the
                    drag handle area. content touches need the wrapper's own copy, applied
                    only while collapsed so overflowing content can scroll at full snap. */}
                {/* mt-0 + full height (twMerge drops the wrapper's mt-24): vaul resolves a
                    snap point as `window.innerHeight - snapPoint`, so the drawer has to be
                    exactly innerHeight tall for a px snap to equal the visible height.
                    It must be dvh, NOT h-full: a percentage height on a fixed element
                    resolves against the initial containing block, which on a mobile browser
                    with a retractable toolbar is the LARGE viewport — taller than
                    innerHeight — and the peek would grow by the toolbar's height, putting
                    the drawer back over the paste link. dvh tracks innerHeight. h-screen
                    (100vh) is the fallback for iOS 15.0–15.3 WebViews, which predate dvh —
                    without a valid height the drawer translates entirely off-screen. Inside
                    a WebView there is no retractable toolbar, so there vh == dvh exactly.

                    The scroll area is capped to the expanded window instead of the shared
                    80vh: 3.625rem is the drag-handle block above it (p-5 top + my-4 + the
                    handle), and being rem-based it grows with the reader's font size, so
                    the scroll region lands on the bottom of the viewport at any setting.
                    Without this, content taller than the window is simply cut off — the
                    80vh cap is never reached, so nothing scrolls. The 520px is
                    QR_DRAWER_EXPANDED_PX, spelled out because Tailwind only emits an
                    arbitrary value it can read literally in the source. */}
                <DrawerContent
                    className={`mt-0 h-screen touch-none p-5 supports-[height:100dvh]:h-[100dvh] ${className || ''}`}
                    scrollAreaClassName={`max-h-[calc(520px-3.625rem)] ${activeSnapPoint === snapPoints[0] ? 'touch-none' : ''}`}
                >
                    <DrawerTitle className="mb-8 space-y-2">
                        <h2 className="text-lg font-bold">
                            {activeSnapPoint === snapPoints[0] ? collapsedTitle : expandedTitle}
                        </h2>
                    </DrawerTitle>
                    <div>
                        <QRCodeWrapper url={url} />
                        <div className="mx-auto mt-4 w-full p-2 text-center text-base text-gray-500">{text}</div>
                        <Divider className="text-gray-500" text={tCommon('or')} />
                        <ShareButton url={url} title={t('qrBottomDrawer.shareTitle')}>
                            {buttonText}
                        </ShareButton>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}

export default QRBottomDrawer
