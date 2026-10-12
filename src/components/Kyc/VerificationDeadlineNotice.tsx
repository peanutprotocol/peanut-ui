import { useFormatter, useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'

interface VerificationDeadlineNoticeProps {
    /** ISO date (YYYY-MM-DD) the requirement becomes due. */
    effectiveDate: string
}

/**
 * Heads-up for a future-dated verification request on a bank rail that still
 * works. It never blocks the transfer on the same screen: until the date, the
 * rail is fully usable, and the request itself is started from the Home and
 * Accounts task cards.
 */
export default function VerificationDeadlineNotice({ effectiveDate }: VerificationDeadlineNoticeProps) {
    const t = useTranslations('kyc.advisory')
    const format = useFormatter()

    const parsed = new Date(effectiveDate)
    // Without a readable date there is nothing true to say here; the Home and
    // Accounts task cards still carry the request.
    if (Number.isNaN(parsed.getTime())) return null
    // A date-only string parses at UTC midnight. Format in UTC too, or Americas
    // time zones show the day before the deadline.
    const deadline = format.dateTime(parsed, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

    return (
        <Callout priority="info" title={t('title')} data-testid="verification-deadline-notice">
            {t('descriptionByDate', { deadline })}
        </Callout>
    )
}
