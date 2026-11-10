'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PostalCodeField } from '@/features/paperwork-verification/components/PostalCodeField'
import { apiFetch } from '@/utils/api-fetch'

const path = '/users/kyc/bridge-postal-code'
type State = 'loading' | 'editing' | 'unavailable' | 'temporary' | 'saving' | 'queued'

export function BridgePostalCorrectionModal({
    visible,
    onClose,
    onSupport,
    onQueued,
}: {
    visible: boolean
    onClose: () => void
    onSupport: () => void
    onQueued: () => void
}) {
    const t = useTranslations('depositAccounts.postalCorrection')
    const common = useTranslations('common')
    const labels = useTranslations('kyc.paperworkVerification.labels')
    const [state, setState] = useState<State>('loading')
    const [country, setCountry] = useState('')
    const [revision, setRevision] = useState('')
    const [postCode, setPostCode] = useState('')
    const [invalid, setInvalid] = useState(false)
    const generation = useRef(0)
    const pending = useRef(false)

    const load = async () => {
        const request = ++generation.current
        setState('loading')
        try {
            const response = await apiFetch(path, { method: 'GET', redactTelemetry: true })
            if (request !== generation.current) return
            if (!response.ok) {
                setState(response.status === 503 ? 'temporary' : 'unavailable')
                return
            }
            const body = (await response.json()) as { country?: unknown; revision?: unknown }
            if (request !== generation.current) return
            if (
                typeof body.country !== 'string' ||
                !/^[A-Z]{2}$/.test(body.country) ||
                typeof body.revision !== 'string' ||
                !/^[a-f0-9]{64}$/i.test(body.revision)
            ) {
                setState('unavailable')
                return
            }
            setCountry(body.country)
            setRevision(body.revision)
            setState('editing')
        } catch {
            if (request === generation.current) setState('temporary')
        }
    }
    useEffect(() => {
        if (visible) {
            setPostCode('')
            setInvalid(false)
            void load()
        }
        return () => {
            generation.current += 1
            pending.current = false
        }
    }, [visible])

    const save = async () => {
        if (pending.current) return
        if (!postCode.trim() || postCode.length > 32) {
            setInvalid(true)
            return
        }
        pending.current = true
        const request = generation.current
        setState('saving')
        try {
            const response = await apiFetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postCode, revision }),
                redactTelemetry: true,
            })
            if (request !== generation.current) return
            if (response.status === 422) {
                setInvalid(true)
                setState('editing')
                return
            }
            if (response.status === 404 || response.status === 409) {
                setState('unavailable')
                return
            }
            if (!response.ok) {
                setState('temporary')
                return
            }
            const body = (await response.json()) as { status?: unknown }
            if (request !== generation.current) return
            if (body.status !== 'queued') {
                setState('temporary')
                return
            }
            setState('queued')
        } catch {
            if (request === generation.current) setState('temporary')
        } finally {
            if (request === generation.current) pending.current = false
        }
    }
    const editing = state === 'editing'
    return (
        <ActionModal
            visible={visible}
            data-testid={`bridge-postal-correction-${state}`}
            onClose={() => {
                if (state === 'queued') onQueued()
                onClose()
            }}
            title={state === 'queued' ? t('queuedTitle') : t('title')}
            description={state === 'queued' ? t('queuedBody') : t('description')}
            tone={state === 'queued' ? 'success' : 'info'}
            content={
                editing ? (
                    <>
                        <p>{t('country', { country })}</p>
                        <PostalCodeField
                            label={labels('postCode')}
                            value={postCode}
                            required
                            error={invalid ? t('invalid') : null}
                            onChange={(value) => {
                                setPostCode(value)
                                setInvalid(false)
                            }}
                        />
                    </>
                ) : state === 'loading' || state === 'saving' ? (
                    <div role="status">{common('loading')}</div>
                ) : state === 'temporary' || state === 'unavailable' ? (
                    <Callout priority="error">{t(state === 'temporary' ? 'temporary' : 'unavailable')}</Callout>
                ) : undefined
            }
            ctas={
                state === 'editing'
                    ? [{ text: t('save'), onClick: () => void save(), 'data-testid': 'bridge-postal-correction-save' }]
                    : state === 'temporary'
                      ? [{ text: common('retry'), onClick: () => void load() }]
                      : state === 'unavailable'
                        ? [{ text: common('contactSupport'), onClick: onSupport }]
                        : state === 'queued'
                          ? [
                                {
                                    text: common('done'),
                                    onClick: () => {
                                        onQueued()
                                        onClose()
                                    },
                                },
                            ]
                          : undefined
            }
            tertiaryCta={
                state !== 'queued' && state !== 'loading' && state !== 'unavailable'
                    ? { text: common('contactSupport'), onClick: onSupport }
                    : undefined
            }
        />
    )
}
