'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { HandThumbsUp } from '@/assets'

/*
This page is just to let users know that their KYC was successful. Incase there's some issue with webosckets closing the modal, ideally this should not happen but added this as fallback guide
*/
export default function KycSuccessPage() {
    useEffect(() => {
        if (window.parent) {
            window.parent.postMessage({ source: 'peanut-kyc-success' }, '*')
        }
    }, [])

    return (
        <div className="flex h-screen min-h-full w-full flex-col items-center justify-center gap-4">
            <Image src={HandThumbsUp} alt="Peanut HandThumbsUp" className="size-34" />
            <div className="space-y-2">
                <p className="text-lg font-semibold">Verification successful!</p>
                <p className="text-sm text-gray-1">You can now close this window.</p>
            </div>
        </div>
    )
}
