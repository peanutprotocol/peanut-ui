import { useEffect } from 'react'
import Modal from '../Modal'

const IframeWrapper = ({
    src,
    title,
    style,
    modalTitle,
    visible,
    onClose,
}: {
    src: string
    title: string
    style?: React.CSSProperties
    modalTitle?: string
    visible: boolean
    onClose: () => void
}) => {
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const expectedOrigin = window.location.origin

            if (event.origin === `${expectedOrigin}` && event.data === 'close-modal') {
                // TODO: add specific route for closing iframe
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
            title={modalTitle || 'Iframe Modal'}
            classWrap="w-full max-w-4xl"
            classOverlay="bg-black bg-opacity-50"
            video={false}
        >
            <iframe
                src={src}
                title={title}
                style={style || { width: '100%', height: '500px', border: 'none' }}
                sandbox="allow-same-origin allow-scripts allow-forms"
            />
        </Modal>
    )
}

export default IframeWrapper
