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
}

const QRBottomDrawer = ({ url, collapsedTitle, expandedTitle, text, buttonText }: QRBottomDrawerProps) => {
    const contentRef = useRef<HTMLDivElement>(null)

    const snapPoints = [0.75, 1] // 75%, 100% of screen height
    const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(snapPoints[0]) // Start with the smallest snap point

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
            >
                <DrawerContent className="min-h-[200px] p-5">
                    <DrawerTitle className="mb-8 space-y-2">
                        <h2 className="text-lg font-bold">
                            {activeSnapPoint === snapPoints[0] ? collapsedTitle : expandedTitle}
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
