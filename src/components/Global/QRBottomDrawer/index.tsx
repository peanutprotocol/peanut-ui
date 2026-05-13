import Divider from '@/components/0_Bruddle/Divider'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { useRef, useState } from 'react'
import { Drawer, DrawerContent, DrawerTitle } from '../Drawer'

interface QRBottomDrawerProps {
    url: string
    collapsedTitle: string
    expandedTitle: string
    text: string
    buttonText: string
    className?: string
}

const QRBottomDrawer = ({ url, collapsedTitle, expandedTitle, text, buttonText, className }: QRBottomDrawerProps) => {
    const contentRef = useRef<HTMLDivElement>(null)

    // Three snap points so drag-down at the medium state transitions to a peek
    // (just the title) instead of being hard-blocked. dismissible={false} keeps
    // the drawer from ever closing on drag.
    const snapPoints = [0.15, 0.75, 1] // 15% peek, 75% medium, 100% full
    const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(snapPoints[1]) // Start in the medium state

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
                dismissible={false}
            >
                <DrawerContent className={`min-h-[200px] p-5 ${className || ''}`}>
                    <DrawerTitle className="mb-8 space-y-2">
                        <h2 className="text-lg font-bold">
                            {activeSnapPoint === snapPoints[snapPoints.length - 1] ? expandedTitle : collapsedTitle}
                        </h2>
                    </DrawerTitle>
                    <div ref={contentRef}>
                        <QRCodeWrapper url={url} />
                        <div className="mx-auto mt-4 w-full p-2 text-center text-base text-gray-500">{text}</div>
                        <Divider className="text-gray-500" text="or" />
                        <ShareButton url={url} title="Share your profile">
                            {buttonText}
                        </ShareButton>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}

export default QRBottomDrawer
