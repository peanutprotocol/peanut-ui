import BottomDrawer from '@/components/Global/BottomDrawer'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import Divider from '@/components/0_Bruddle/Divider'
import ShareButton from '@/components/Global/ShareButton'
import { useState } from 'react'

interface QRBottomDrawerProps {
    url: string
    collapsedTitle: string
    expandedTitle: string
    text: string
    buttonText: string
}

const QRBottomDrawer = ({ url, collapsedTitle, expandedTitle, text, buttonText }: QRBottomDrawerProps) => {
    const [title, setTitle] = useState<string>(collapsedTitle)
    return (
        <BottomDrawer
            initialPosition="collapsed"
            handleTitle={title}
            collapsedHeight={24}
            halfHeight={60}
            expandedHeight={90}
            isOpen={true}
            onPositionChange={(position) => {
                if (position === 'collapsed') {
                    setTitle(collapsedTitle)
                } else {
                    setTitle(expandedTitle)
                }
            }}
        >
            <div>
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
