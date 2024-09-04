import { useEffect } from 'react'
import Modal from '../Modal'

const IframeWrapper = ({
    src,
    style,
    modalTitle,
    visible,
    onClose,
}: {
    src: string
    style?: React.CSSProperties
    modalTitle?: string
    visible: boolean
    onClose: () => void
}) => {
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const expectedOrigin = window.location.origin

            if (event.origin === `${expectedOrigin}` && event.data === 'close-modal') {
                onClose()
            }
        }

        window.addEventListener('message', handleMessage)

        return () => {
            window.removeEventListener('message', handleMessage)
        }
    }, [onClose])

    return (
        <Modal
            visible={visible}
            onClose={onClose}
            classWrap="w-full max-w-2xl"
            classOverlay="bg-black bg-opacity-50"
            video={false}
            classButtonClose="hidden"
        >
            <iframe
                src={src}
                allow="camera;"
                style={style}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
            />
        </Modal>
    )
}

export default IframeWrapper
