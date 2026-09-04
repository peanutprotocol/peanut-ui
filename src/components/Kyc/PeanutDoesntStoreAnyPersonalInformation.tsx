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
            className={twMerge('flex items-center gap-2 text-[11px] text-foreground-secondary', className)}
        >
            <Icon name="info" className="h-3 w-3 shrink-0" />
            <span className="underline underline-offset-2">{t('doesntStoreDocuments')}</span>
        </DocsLink>
    )
}
