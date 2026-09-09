import { useTranslations } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'
import DocsLink from '@/components/Global/DocsLink'
import { twMerge } from '@/utils/tw'

/** The help article whose "Your data and privacy" section is this claim in full. */
const DOCUMENTS_HELP_HREF = '/en/help/verification'

/**
 * The privacy footnote under every KYC entry point. The (i) is a link, not
 * decoration: an icon that looked tappable and did nothing was the complaint
 * (device test 2026-09-04), and the claim it makes — documents live with the
 * certified provider, Peanut keeps a reference id and a result — is exactly
 * what /help/verification spells out.
 */
export const PeanutDoesntStoreAnyPersonalInformation = ({ className }: { className?: string }) => {
    const t = useTranslations('kyc')

    return (
        <DocsLink
            href={DOCUMENTS_HELP_HREF}
            // min-h-11, not a pseudo-element hit area: an 11px footnote's own
            // line box is nowhere near the 44px floor, so the after:-inset
            // trick the Notification dismiss uses would have to guess at a
            // height it cannot know. The row centres its content, so the text
            // stays where it was and only the tappable box grows.
            className={twMerge(
                'flex min-h-11 items-center justify-center gap-2 rounded-sm text-[11px] text-foreground-secondary transition-opacity duration-instant focus-visible:outline-[3px] focus-visible:outline-action-focus active:opacity-60',
                className
            )}
        >
            <Icon name="info" className="h-3 w-3 shrink-0" />
            <span className="underline underline-offset-2">{t('doesntStoreDocuments')}</span>
        </DocsLink>
    )
}
