'use client'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import { useTranslations } from 'next-intl'

interface CreateRequestLinkCtaProps {
    requestId: string | null
    isCreatingLink: boolean
    isUpdatingRequest: boolean
    onGenerate: () => void
}

/**
 * Create call to action for the request-link screen. Once both the request and
 * link exist, the parent replaces this form with RequestCreatedView.
 */
export const CreateRequestLinkCta = ({
    requestId,
    isCreatingLink,
    isUpdatingRequest,
    onGenerate,
}: CreateRequestLinkCtaProps) => {
    const t = useTranslations('request')
    const tLoading = useTranslations('loadingStates')

    return (
        <>
            {!requestId && (
                <Button
                    loading={isCreatingLink || isUpdatingRequest}
                    disabled={isCreatingLink || isUpdatingRequest}
                    onClick={onGenerate}
                    shadowSize="4"
                >
                    {t('createRequest')}
                </Button>
            )}

            {requestId && (
                <Button disabled={true} shadowSize="4">
                    <div className="flex w-full flex-row items-center justify-center gap-2">
                        <Loading /> {tLoading('loading')}
                    </div>
                </Button>
            )}
        </>
    )
}
