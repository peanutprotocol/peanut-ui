'use client'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import ShareButton from '@/components/Global/ShareButton'
import { useTranslations } from 'next-intl'

interface CreateRequestLinkCtaProps {
    requestId: string | null
    generatedLink: string | null
    isCreatingLink: boolean
    isUpdatingRequest: boolean
    tokenValue: string
    onGenerate: () => void
}

/**
 * Create/share call to action for the request-link screen: the create button
 * before a request exists, then a loading placeholder, then the share button.
 */
export const CreateRequestLinkCta = ({
    requestId,
    generatedLink,
    isCreatingLink,
    isUpdatingRequest,
    tokenValue,
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

            {/* the share button waits for the link itself, not just the request id:
                it shares what create produced, it never creates */}
            {requestId &&
                (isCreatingLink || isUpdatingRequest || !generatedLink ? (
                    <Button disabled={true} shadowSize="4">
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {tLoading('loading')}
                        </div>
                    </Button>
                ) : (
                    <ShareButton url={generatedLink}>
                        {!tokenValue || !parseFloat(tokenValue) || parseFloat(tokenValue) === 0
                            ? t('shareOpenRequest')
                            : t('shareAmountRequest', { amount: tokenValue })}
                    </ShareButton>
                ))}
        </>
    )
}
