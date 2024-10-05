import { useEffect } from 'react'
import Modal from '../Modal'

const IframeWrapper = ({
    src,
    style,
    visible,
    onClose,
}: {
    src: string
    style?: React.CSSProperties
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
            <div className="flex flex-col gap-2 p-2 sm:p-5">
                <div className="overflow-hidden rounded-sm border border-black">
                    <iframe
                        src={src}
                        allow="camera;"
                        style={style}
                        className="rounded-md border border-black"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
                    />
                </div>
                <div className="w-full">
                    <button className="btn-purple w-full" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    )
}

export default IframeWrapper
