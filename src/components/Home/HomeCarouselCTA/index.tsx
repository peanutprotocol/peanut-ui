'use client'

import { useEffect } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import Carousel from '@/components/Global/Carousel'
import CarouselCTA from './CarouselCTA'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useHomeCarouselCTAs } from '@/hooks/useHomeCarouselCTAs'
import { useDocumentRequestFlow } from '@/hooks/useDocumentRequestFlow'
import type { NextAction } from '@/types/capabilities'
import { useQrIdentityCheck } from '@/features/payments/flows/qr-pay/useQrIdentityCheck'

/**
 * `documentRequest`: a future-dated document request before its final week
 * (selectHomeTasks). It leads the carousel as a small item and has no close
 * button, so a carousel dismissal can never hide it before its due
 * date; in the final week Home moves it to the large task card instead.
 */
const HomeCarouselCTA = ({ documentRequest }: { documentRequest?: NextAction }) => {
    // the "Unlock QR payments" slide starts the QR ID check in place
    const qrIdentityCheck = useQrIdentityCheck()
    const { carouselCTAs, dismissCTA } = useHomeCarouselCTAs({ onStartQrIdentityCheck: qrIdentityCheck.start })
    const documentFlow = useDocumentRequestFlow()
    const t = useTranslations('home.pendingTasks')
    const format = useFormatter()
    const toast = useToast()

    // The slide has no room for an inline error, so a failed start is a toast:
    // never a tap that does nothing.
    const startError = documentFlow.error
    useEffect(() => {
        if (startError) toast.error(startError)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per failed start
    }, [startError])

    const due = documentRequest?.effectiveDate ? new Date(documentRequest.effectiveDate) : null
    const deadline =
        due && !Number.isNaN(due.getTime())
            ? // date-only string: format in UTC, or Americas time zones show the day before
              format.dateTime(due, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
            : null

    const modals = (
        <>
            {documentFlow.modals}
            {qrIdentityCheck.modals}
        </>
    )

    if (carouselCTAs.length === 0 && !documentRequest) return modals

    return (
        <>
            <Carousel>
                {documentRequest && (
                    <CarouselCTA
                        key={`document-request:${documentRequest.key}`}
                        title={t('documentTitle')}
                        description={deadline ? t('documentDueBy', { deadline }) : t('documentDescription')}
                        concept="verification"
                        onClick={() => {
                            if (!documentFlow.isLoading) documentFlow.start(documentRequest)
                        }}
                        iconSize={16}
                    />
                )}
                {carouselCTAs.map((cta) => (
                    <CarouselCTA
                        key={cta.id}
                        title={cta.title}
                        description={cta.description}
                        icon={cta.icon as IconName | undefined}
                        concept={cta.concept}
                        onClose={() => {
                            cta.onClose?.()
                            dismissCTA(cta.id)
                        }}
                        onClick={cta.onClick}
                        logo={cta.logo}
                        mascotPose={cta.mascotPose}
                        iconContainerClassName={cta.iconContainerClassName}
                        secondaryIcon={cta.secondaryIcon}
                        iconSize={16}
                        logoSize={cta.logoSize}
                    />
                ))}
            </Carousel>
            {modals}
        </>
    )
}

export default HomeCarouselCTA
