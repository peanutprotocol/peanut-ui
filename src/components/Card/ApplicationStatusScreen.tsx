'use client'
import type { FC } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { PeanutCrying } from '@/assets/mascot'
import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'

type Variant = 'pending' | 'manual-review' | 'requires-info' | 'requires-support' | 'rejected'

interface Props {
    variant: Variant
    /** Display-ready reason from the capabilities read-model
     *  (`rail.reason.userMessage`) — rendered above the generic body so the
     *  user sees what specifically is missing. Provider-neutral by contract. */
    reasonMessage?: string
    onContactSupport?: () => void
    onPrev?: () => void
}

// The rejected variant's `reasonMessage` (when known) renders above its body;
// the body itself stays reassuring — a declined card doesn't touch the rest of
// the account, so it points the user back to what still works.
const COPY_KEYS = {
    pending: { title: 'status.pendingTitle', body: 'status.pendingBody' },
    'manual-review': { title: 'status.manualReviewTitle', body: 'status.manualReviewBody' },
    'requires-info': { title: 'status.requiresInfoTitle', body: 'status.requiresInfoBody' },
    'requires-support': { title: 'status.requiresSupportTitle', body: 'status.requiresSupportBody' },
    rejected: { title: 'status.rejectedTitle', body: 'status.rejectedBody' },
} as const satisfies Record<Variant, { title: string; body: string }>

/** Variants where support is the only path forward — these render the CTA. */
const SUPPORT_VARIANTS: ReadonlySet<Variant> = new Set(['requires-info', 'requires-support', 'rejected'])

const ApplicationStatusScreen: FC<Props> = ({ variant, reasonMessage, onContactSupport, onPrev }) => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const copyKeys = COPY_KEYS[variant]
    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title={t('navAddCard')} onPrev={onPrev} />
            <div className="my-auto flex flex-col items-center gap-6 text-center">
                {variant === 'pending' && <Loading />}
                {(variant === 'rejected' || variant === 'requires-support') && (
                    <Image
                        src={PeanutCrying.src}
                        unoptimized
                        alt={t('status.mascotAlt')}
                        width={128}
                        height={128}
                        className="select-none"
                        priority
                    />
                )}
                <div className="flex flex-col gap-3">
                    <h1 className="text-2xl font-extrabold text-n-1">{t(copyKeys.title)}</h1>
                    {reasonMessage && <p className="text-grey-1">{reasonMessage}</p>}
                    <p className="text-grey-1">{t(copyKeys.body)}</p>
                </div>
                {SUPPORT_VARIANTS.has(variant) && onContactSupport && (
                    <button type="button" onClick={onContactSupport} className="text-black underline">
                        {tCommon('contactSupport')}
                    </button>
                )}
            </div>
        </div>
    )
}

export default ApplicationStatusScreen
