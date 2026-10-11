'use client'

import { useEffect, useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentRequestFlow } from '@/hooks/useDocumentRequestFlow'
import { selectHomeTasks } from '@/utils/bridge-tasks.utils'
import type { ZoneSurfaceProps } from '../../types'

/**
 * A future-dated document request before its final week: a small card with
 * no close button, so it can never be hidden before its due date. In the
 * final week Home moves it to the large task card (verification-due).
 */
export default function DocumentRequestCard(_: ZoneSurfaceProps) {
    const t = useTranslations('home.pendingTasks')
    const format = useFormatter()
    const toast = useToast()
    const { nextActions, rails } = useCapabilities()
    const documentRequest = useMemo(() => selectHomeTasks(nextActions, rails ?? []).documentSlide, [nextActions, rails])
    const documentFlow = useDocumentRequestFlow()

    // the card has no room for an inline error, so a failed start is a toast: never a tap that does nothing
    const startError = documentFlow.error
    useEffect(() => {
        if (startError) toast.error(startError)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per failed start
    }, [startError])

    if (!documentRequest) return null
    const due = documentRequest.effectiveDate ? new Date(documentRequest.effectiveDate) : null
    const deadline =
        due && !Number.isNaN(due.getTime())
            ? // date-only string: format in UTC, or Americas time zones show the day before
              format.dateTime(due, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
            : null

    return (
        <>
            <CarouselCTA
                title={t('documentTitle')}
                description={deadline ? t('documentDueBy', { deadline }) : t('documentDescription')}
                concept="verification"
                onClick={() => {
                    if (!documentFlow.isLoading) documentFlow.start(documentRequest)
                }}
                iconSize={16}
            />
            {documentFlow.modals}
        </>
    )
}
