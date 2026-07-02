'use client'
import type { FC } from 'react'
import Image from 'next/image'
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

const COPY: Record<Variant, { title: string; body: string }> = {
    pending: {
        title: 'Setting up your card…',
        body: 'Hang tight while we finish setting up your card. This usually takes a few seconds.',
    },
    'manual-review': {
        title: 'Manual review needed',
        body: "We need to do a manual review of your submission. This usually takes 1-2 days and we'll let you know when it's ready.",
    },
    'requires-info': {
        title: 'We need more information',
        body: 'Our team will help you finish your card application — message support to continue.',
    },
    'requires-support': {
        title: 'Something went wrong on our side',
        body: "We hit a snag while processing your card application. Our team needs to take a look — message support and we'll get you sorted.",
    },
    rejected: {
        // The specific reason (when known) renders above via `reasonMessage`;
        // this body stays reassuring — a declined card doesn't touch the rest
        // of the account, so point the user back to what still works.
        title: "We couldn't issue you a card",
        body: 'You can still use Peanut freely to deposit, withdraw, and pay with crypto.',
    },
}

/** Variants where support is the only path forward — these render the CTA. */
const SUPPORT_VARIANTS: ReadonlySet<Variant> = new Set(['requires-info', 'requires-support', 'rejected'])

const ApplicationStatusScreen: FC<Props> = ({ variant, reasonMessage, onContactSupport, onPrev }) => {
    const copy = COPY[variant]
    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Add card" onPrev={onPrev} />
            <div className="my-auto flex flex-col items-center gap-6 text-center">
                {variant === 'pending' && <Loading />}
                {(variant === 'rejected' || variant === 'requires-support') && (
                    <Image
                        src={PeanutCrying.src}
                        unoptimized
                        alt="Peanutman crying 😭"
                        width={128}
                        height={128}
                        className="select-none"
                        priority
                    />
                )}
                <div className="flex flex-col gap-3">
                    <h1 className="text-2xl font-extrabold text-n-1">{copy.title}</h1>
                    {reasonMessage && <p className="text-grey-1">{reasonMessage}</p>}
                    <p className="text-grey-1">{copy.body}</p>
                </div>
                {SUPPORT_VARIANTS.has(variant) && onContactSupport && (
                    <button type="button" onClick={onContactSupport} className="text-black underline">
                        Contact support
                    </button>
                )}
            </div>
        </div>
    )
}

export default ApplicationStatusScreen
