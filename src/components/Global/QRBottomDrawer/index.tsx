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
                // 500ms window where vaul ignores all drags. dismissible={false} prevents it.
                // vaul 1.1.2 note: a fast down-flick at the first snap then hits a benign
                // out-of-bounds snap index inside vaul. re-test that path on a vaul upgrade.
                dismissible={false}
            >
                {/* modal={false} turns off vaul's scroll prevention. without touch-none the
                    browser claims the swipe as a scroll, fires pointercancel, and the drawer
                    needs two swipes. scrollAreaClassName repeats it on the inner scroll
                    wrapper — the outer class stops governing touches once content overflows
                    that wrapper (small viewports, large OS text). */}
                <DrawerContent
                    className={`min-h-[200px] touch-none p-5 ${className || ''}`}
                    scrollAreaClassName="touch-none"
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
