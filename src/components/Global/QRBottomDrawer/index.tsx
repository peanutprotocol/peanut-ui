import Divider from '@/components/0_Bruddle/Divider'
import BottomDrawer from '@/components/Global/BottomDrawer'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import { useDynamicHeight } from '@/hooks/ui/useDynamicHeight'
import { useRef, useState } from 'react'

interface QRBottomDrawerProps {
    url: string
    collapsedTitle: string
    expandedTitle: string
    text: string
    buttonText: string
}

const QRBottomDrawer = ({ url, collapsedTitle, expandedTitle, text, buttonText }: QRBottomDrawerProps) => {
    const [title, setTitle] = useState<string>(collapsedTitle)
    const contentRef = useRef<HTMLDivElement>(null)
    const drawerHeightVh = useDynamicHeight(contentRef, { maxHeightVh: 90, minHeightVh: 10, extraVhOffset: 5 })
    const currentExpandedHeight = drawerHeightVh ?? 80
    const currentHalfHeight = Math.min(60, drawerHeightVh ?? 60)
    return (
        <BottomDrawer
            initialPosition="collapsed"
            handleTitle={title}
            collapsedHeight={24}
            halfHeight={currentHalfHeight}
            expandedHeight={currentExpandedHeight}
            isOpen={true}
            onPositionChange={(position) => {
                if (position === 'collapsed') {
                    setTitle(collapsedTitle)
                } else {
                    setTitle(expandedTitle)
                }
            }}
        >
            <div ref={contentRef}>
                <QRCodeWrapper url={url} />
                <div className="mx-auto mt-4 w-full p-2 text-center text-base text-gray-500">{text}</div>
                <Divider className="text-gray-500" text="or" />
                <ShareButton url={url} title="Share your profile">
                    {buttonText}
                </ShareButton>
            </div>
        </BottomDrawer>
    )
}

export default QRBottomDrawer
