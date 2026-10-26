'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import type { IconName } from '@/components/Global/Icons/Icon'

interface DocumentRequestStateProps {
    /** Defaults to "One more document needed"; a check on the provider's own page names itself. */
    title?: string
    /** What the provider asked for, in its words ("We need a valid proof of address document."). */
    reason?: React.ReactNode
    /** What the document unlocks, when the screen says it ("…to finish your card application."). */
    body?: string | null
    ctaLabel: string
    /** null when the CTA opens the provider's page rather than an upload. */
    ctaIcon?: IconName | null
    onCta: () => void
    ctaLoading?: boolean
    ctaTestId?: string
    reasonTestId?: string
    error?: string | null
    onContactSupport?: () => void
}

/**
 * The one look for "a provider needs one more document", wherever the user meets
 * it: the Card tab and Add money (bank and local transfers). A request is a step
 * to take, not a failure, so it carries the yellow action icon, never the red one.
 */
export function DocumentRequestState({
    title,
    reason,
    body,
    ctaLabel,
    ctaIcon = 'upload-cloud',
    onCta,
    ctaLoading = false,
    ctaTestId,
    reasonTestId,
    error,
    onContactSupport,
}: DocumentRequestStateProps) {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
    return (
        <div className="flex flex-col items-center gap-6 text-center" data-testid="document-request">
            <IconBubble icon="user-id" size="l" color="yellow" />
            <div className="flex flex-col gap-3">
                <h1 className="text-heading-s text-foreground-primary">{title ?? t('documentRequest.title')}</h1>
                {reason && (
                    <div className="text-foreground-secondary" data-testid={reasonTestId}>
                        {reason}
                    </div>
                )}
                {body && <p className="text-foreground-secondary">{body}</p>}
            </div>
            <Button
                variant="primary"
                shadowSize="4"
                className="h-11 w-full"
                icon={ctaIcon ?? undefined}
                loading={ctaLoading}
                disabled={ctaLoading}
                onClick={onCta}
                data-testid={ctaTestId}
            >
                {ctaLabel}
            </Button>
            {error && (
                <p role="alert" className="text-body-s text-foreground-error">
                    {error}
                </p>
            )}
            {onContactSupport && <LinkButton onClick={onContactSupport}>{tCommon('contactSupport')}</LinkButton>}
        </div>
    )
}
