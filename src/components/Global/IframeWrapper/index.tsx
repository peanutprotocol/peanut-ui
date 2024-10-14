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
            classWrap="w-full max-w-2xl border-none sm:border"
            classOverlay="bg-black bg-opacity-50"
            video={false}
            /**
             * Making sure the Iframe showing on top of the Crisp Chat widget
             * which has z-index of 1000000
             */
            className="z-[1000001]"
            classButtonClose="hidden"
        >
            <div className="flex flex-col gap-2 p-0 sm:p-5">
                <div className="w-full sm:hidden">
                    <button className="btn-purple w-full rounded-none" onClick={onClose}>
                        CLOSE
                    </button>
                </div>
                <div className="h-[550px] overflow-hidden rounded-sm sm:h-[500px] sm:border sm:border-black">
                    <iframe
                        src={src}
                        allow="camera;"
                        style={{ ...style, width: '100%', height: '100%', border: 'none' }}
                        className="rounded-md"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
                    />
                </div>
                <div className="hidden w-full sm:flex">
                    <button className="btn-purple w-full" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    )
}

export default IframeWrapper
