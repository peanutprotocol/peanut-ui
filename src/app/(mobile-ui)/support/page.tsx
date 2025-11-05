'use client'

import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispProxyUrl } from '@/hooks/useCrispProxyUrl'
import { CrispIframe } from '@/components/Global/CrispIframe'

const SupportPage = () => {
    const userData = useCrispUserData()
    const crispProxyUrl = useCrispProxyUrl(userData)

    return (
        <div className="relative h-full w-full md:max-w-[90%] md:pl-24">
            <CrispIframe crispProxyUrl={crispProxyUrl} />
        </div>
    )
}

export default SupportPage
