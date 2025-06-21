import { useEffect, useState } from 'react'
import Modal from '../Modal'

export type IFrameWrapperProps = {
    src: string
    visible: boolean
    onClose: () => void
    closeConfirmMessage?: string
}

const IframeWrapper = ({ src, visible, onClose, closeConfirmMessage }: IFrameWrapperProps) => {
    const enableConfirmationPrompt = closeConfirmMessage !== undefined
    const [showCloseConfirmMessage, setShowCloseConfirmMessage] = useState(false)

    // Reset showCloseConfirmMessage when visibility changes or src changes
    useEffect(() => {
        if (!visible || src === '') {
            setShowCloseConfirmMessage(false)
        }
    }, [visible, src])

    // track completed event from iframe and close the modal
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.name === 'complete' && event.data?.metadata?.status === 'completed') {
                onClose()
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [onClose])

    return (
        <Modal
            visible={visible}
            onClose={() => {
                if (!enableConfirmationPrompt) {
                    onClose()
                    return
                }
                if (src.includes('tos')) {
                    onClose()
                    return
                }
                setShowCloseConfirmMessage(true)
            }}
            classWrap="h-full w-full !max-w-none sm:!max-w-[600px] border-none sm:m-auto m-0"
            classOverlay="bg-black bg-opacity-50"
            video={false}
            className="z-[1000001] !p-0 md:!p-6"
            classButtonClose="hidden"
            hideOverlay={false}
        >
            <div className="flex h-full flex-col gap-2 p-0">
                <div className="w-full flex-shrink-0">
                    {showCloseConfirmMessage ? (
                        <div className="flex w-full flex-col justify-between gap-3 border-b border-n-1 p-4 md:h-14 md:flex-row md:items-center">
                            <p className="text-sm">{closeConfirmMessage}</p>
                            <div className="flex flex-row items-center gap-2">
                                <button
                                    className="btn-stroke h-10"
                                    onClick={() => {
                                        setShowCloseConfirmMessage(false)
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-purple h-10"
                                    onClick={() => {
                                        onClose()
                                        setShowCloseConfirmMessage(false)
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            className="btn-purple h-14 w-full rounded-none border-b border-n-1"
                            onClick={() => {
                                // only show confirmation for kyc step, otherwise close immediately
                                if (enableConfirmationPrompt && !src.includes('tos')) {
                                    setShowCloseConfirmMessage(true)
                                } else {
                                    onClose()
                                }
                            }}
                        >
                            CLOSE
                        </button>
                    )}
                </div>
                <div className="h-full w-full flex-grow overflow-scroll">
                    <iframe
                        src={src}
                        allow="camera;"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        className="rounded-md"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
                    />
                </div>
            </div>
        </Modal>
    )
}

export default IframeWrapper
