'use client'

import { useCrispIframeReady } from '@/hooks/useCrispIframeReady'
import PeanutLoading from '../PeanutLoading'
import { Button } from '@/components/0_Bruddle'

interface CrispIframeProps {
    crispProxyUrl: string
    enabled?: boolean
}

/**
 * Shared Crisp iframe component with loading and error states
 * DRY component used by both SupportDrawer and SupportPage
 */
export const CrispIframe = ({ crispProxyUrl, enabled = true }: CrispIframeProps) => {
    const { isReady, hasError, retry } = useCrispIframeReady(enabled)

    return (
        <>
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
                            <a href="mailto:support@peanut.me" className="text-purple-1 underline">
                                support@peanut.me
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
        </>
    )
}
