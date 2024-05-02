'use client'
import CopyField from '@/components/Global/CopyField'
import Icon from '@/components/Global/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useState } from 'react'
import QRCode from 'react-qr-code'

const hashArray = ['0x1234567890', '0x0987654321', '0x1357924680']

export const CreateLinkSuccessView = () => {
    const [showHash, setShowHash] = useState(false)
    const share = async (url: string) => {
        try {
            await navigator.share({
                title: 'Peanut Protocol',
                text: 'Share your link!',
                url: 'https://peanut.to',
            })
        } catch (error: any) {
            console.log(error)
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Yay!</label>
            <QRCodeWrapper url="https://peanut.to" />
            <label className="text-h8 font-bold ">
                Scan the QR code above or send this link to your friends so they can claim their funds.
            </label>
            <div className="hidden w-full md:block">
                <CopyField text="https://peanut.to" />
            </div>
            <div
                className="w-full border border-n-1 px-2 py-1 text-h8 font-normal sm:hidden"
                onClick={() => {
                    share('https://peanut.to')
                }}
            >
                Share link
            </div>
            {/* <div className="flex w-full flex-col items-center justify-start gap-1">
                <div
                    className="flex w-full flex-row items-center justify-start gap-1"
                    onClick={() => {
                        setShowHash(!showHash)
                    }}
                >
                    <label>Transaction hash</label>
                    <Icon name="arrow-next" className={`${showHash ? 'rotate-90' : ''}`} />
                </div>
                {showHash &&
                    hashArray.map((hash) => (
                        <div className="flex w-full flex-col items-center justify-start gap-1" key={hash}>
                            <label className="text-h8 font-normal">{hash}</label>
                            <Icon name="copy" />
                        </div>
                    ))}
            </div> */}

            <div className="absolute bottom-0 -mb-0.5 flex h-20 w-[27rem] w-full    flex-row items-center justify-between border border-black border-n-1 bg-purple-3  px-4.5 dark:text-black">
                <div className="cursor-pointer border border-n-1 p-0 px-1">
                    <Icon name="email" className="-mt-0.5" />
                </div>
                <label className="text-sm font-bold">Subscribe to get notified when you link gets claimed!</label>
            </div>
        </div>
    )
}
