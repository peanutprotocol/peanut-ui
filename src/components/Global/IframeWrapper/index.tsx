import { useEffect, useState } from 'react'
import Modal from '../Modal'

type IframeWrapperProps = {
    src: string
    visible: boolean
    onClose: () => void
}

const IframeWrapper = ({
    src,
    visible,
    onClose,
}: IframeWrapperProps) => {
    const [areYouSure, setAreYouSure] = useState(false)
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

    const areYouSurePromptRow = (
        <div className='flex flex-col text-center sm:text-left sm:flex-row justify-between sm:items-center gap-4 p-2 sm:p-0 w-full'>
            <p className="text-sm ml-1">Are you sure ? your KYC progress will be lost.</p>
            <div className="flex flex-row items-center gap-2">
                <button className='btn-stroke w-full' onClick={() => {
                    setAreYouSure(false)
                }}>Cancel</button>
                <button className='btn-purple w-full' onClick={() => {
                    onClose()
                    setAreYouSure(false)
                }}>Close</button>
            </div>
        </div>
    )

    return (
        <Modal
            visible={visible}
            onClose={() => {
                setAreYouSure(true)
            }}
            classWrap="h-full w-full sm:min-w-[600px] border-none"
            classOverlay="bg-black bg-opacity-50"
            video={false}
            /**
             * Making sure the Iframe showing on top of the Crisp Chat widget
             * which has z-index of 1000000
             */
            className="z-[1000001]"
            classButtonClose="hidden"
        >
            <div className="flex flex-col h-full gap-2 p-0 sm:p-2">
                <div className="w-full sm:hidden">
                    {areYouSure ? areYouSurePromptRow : <button className="btn-purple w-full rounded-none" onClick={() => {
                        setAreYouSure(true)
                    }}>
                        CLOSE
                    </button>}
                </div>
                <div className="overflow-hidden h-full">
                    <iframe
                        src={src}
                        allow="camera;"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        className="rounded-md"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
                    />
                </div>
                <div className="hidden sm:flex flex-row w-full items-center">
                    {areYouSure ? areYouSurePromptRow : <button className="btn-purple w-full" onClick={() => {
                        setAreYouSure(true)
                    }}>
                        Close
                    </button>}
                </div>
            </div>
        </Modal>
    )
}

export default IframeWrapper
