import { useTranslations } from 'next-intl'
import DocsLink from '@/components/Global/DocsLink'
import { DOCUMENTS_HELP_HREF } from '@/constants/kyc.consts'

/** The documents fact as one sentence, for the provider line under a KYC entry point's button. */
export const DocumentsNotStored = () => {
    const t = useTranslations('kyc')
    return t.rich('documentsNotStored', {
        link: (chunks) => (
            <DocsLink href={DOCUMENTS_HELP_HREF} className="underline underline-offset-2">
                {chunks}
            </DocsLink>
        ),
    })
}
