import Divider from '@/components/0_Bruddle/Divider'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'

interface QRBottomDrawerProps {
    url: string
    collapsedTitle: string
    expandedTitle: string
    text: string
    buttonText: string
    className?: string
}

// module scope: a new array each render makes vaul's snap-sync effect refire
// and re-apply the transform transition on every parent re-render
const snapPoints = [0.75, 1]

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
                <DrawerContent
                    className={`min-h-[200px] touch-none p-5 ${className || ''}`}
                    scrollAreaClassName={activeSnapPoint === snapPoints[0] ? 'touch-none' : undefined}
                >
                    <DrawerTitle className="space-y-2 mb-8">
                        <h2 className="text-lg font-bold">
                            {activeSnapPoint === snapPoints[0] ? collapsedTitle : expandedTitle}
                        </h2>
                    </DrawerTitle>
                    {/* pb-1 = the button's 4px offset shadow; without it the drawer's
                        overflow-auto scroll wrapper clips the shadow at the bottom */}
                    <div className="pb-1">
                        <QRCodeWrapper url={url} />
                        <div className="text-gray-500 mx-auto mt-4 w-full p-2 text-center text-base">{text}</div>
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
