'use client'

import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispProxyUrl } from '@/hooks/useCrispProxyUrl'
import { useCrispIframeReady } from '@/hooks/useCrispIframeReady'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Button } from '@/components/0_Bruddle'

const SupportPage = () => {
    const userData = useCrispUserData()
    const crispProxyUrl = useCrispProxyUrl(userData)

    // Use shared hook with device-specific timeouts (3s desktop, 8s iOS)
    const { isReady, hasError, retry } = useCrispIframeReady()

    return (
        <div className="relative h-full w-full md:max-w-[90%] md:pl-24">
            {!isReady && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                    <PeanutLoading />
                </div>
            )}
            {hasError && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
                    <div className="space-y-2">
                        <p className="text-base font-semibold">Having trouble loading support chat</p>
                        <p className="text-sm text-grey-1">
                            Check your internet connection and try again. If the problem persists, you can email us at{' '}
                            <a href="mailto:hello@peanut.to" className="text-purple-1 underline">
                                hello@peanut.to
                            </a>
                        </p>
                    </div>
                    <Button onClick={retry} shadowSize="4" variant="purple" icon="retry" iconSize={16}>
                        Try again
                    </Button>
                </div>
            )}
            <iframe
                src={crispProxyUrl}
                className="h-full w-full"
                style={{
                    height: '100%',
                    width: '100%',
                    minHeight: '-webkit-fill-available',
                }}
                title="Support Chat"
            />
        </div>
    )
}

export default SupportPage
