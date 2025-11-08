import { PEANUTMAN_PFP } from '@/assets'
import PeanutLoading from '@/components/Global/PeanutLoading'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import QRCode from 'react-qr-code'
import { twMerge } from 'tailwind-merge'

interface QRCodeWrapperProps {
    url: string
    isLoading?: boolean
    disabled?: boolean
    isBlurred?: boolean
}

const QRCodeWrapper = ({ url, isLoading = false, disabled = false, isBlurred = false }: QRCodeWrapperProps) => {
    const [qrRendered, setQrRendered] = useState(false)

    // Mark QR as rendered after a short delay to ensure it's painted on iOS
    useEffect(() => {
        if (url && !isLoading) {
            const timer = setTimeout(() => {
                setQrRendered(true)
            }, 100) // Small delay to ensure QR code renders
            return () => clearTimeout(timer)
        } else {
            setQrRendered(false)
        }
    }, [url, isLoading])

    // Show loading if explicitly loading or if QR hasn't rendered yet or if URL is empty
    const showLoading = isLoading || !qrRendered || !url

    return (
        <div className="relative mx-auto h-auto w-full max-w-[160px]">
            {/* Container with black border and rounded corners */}
            <div
                className={twMerge(
                    'relative min-h-[160px] rounded border-2 border-black bg-white p-4',
                    (showLoading || disabled) && 'blur-sm'
                )}
            >
                {/* QR Code with white buffer */}
                {url && (
                    <div className={twMerge('relative', isBlurred && 'blur-[3px]')}>
                        <QRCode
                            value={url}
                            size={256}
                            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                            viewBox={`0 0 256 256`}
                            level="H" // Highest error correction level to allow for logo
                        />

                        {/* Centered Logo */}
                        <div className="absolute left-1/2 top-1/2 flex h-1/5 w-1/5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white p-0.5">
                            <Image
                                src={PEANUTMAN_PFP}
                                alt="profile image"
                                className="h-full w-full rounded-full object-contain"
                                width={48}
                                height={48}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Loading overlay */}
            {showLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <PeanutLoading />
                </div>
            )}
        </div>
    )
}

export default QRCodeWrapper
