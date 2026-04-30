'use client'
import type { FC } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'

type Variant = 'pending' | 'manual-review' | 'rejected'

interface Props {
    variant: Variant
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
    rejected: {
        title: "We couldn't verify your identity",
        body: "Your card application wasn't approved. This might be because of incomplete documents, information mismatch, or regional restrictions.",
    },
}

const ApplicationStatusScreen: FC<Props> = ({ variant, onContactSupport, onPrev }) => {
    const copy = COPY[variant]
    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Add card" onPrev={onPrev} />
            <div className="my-auto flex flex-col items-center gap-6 text-center">
                {variant === 'pending' && <Loading />}
                {/* TODO: drop the new crying-peanut illustration here for the
                    rejected variant — the previous `peanutman-sad.svg` was the
                    older illustration style and was deleted with this change. */}
                <div className="flex flex-col gap-3">
                    <h1 className="text-2xl font-extrabold text-n-1">{copy.title}</h1>
                    <p className="text-grey-1">{copy.body}</p>
                </div>
                {variant === 'rejected' && onContactSupport && (
                    <button type="button" onClick={onContactSupport} className="text-black underline">
                        Contact support
                    </button>
                )}
            </div>
        </div>
    )
}

export default ApplicationStatusScreen
