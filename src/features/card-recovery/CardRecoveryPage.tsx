'use client'

import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
import { useSafeBack } from '@/hooks/useSafeBack'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { getExplorerUrl } from '@/utils/general.utils'
import { Row } from './components/Row'
import { useCardRecoveryFlow } from './useCardRecoveryFlow'
import { formatCents, shorten } from './utils'

/**
 * Card collateral recovery flow.
 *
 * For the deleted-Rain-user case: a user's collateral USDC is sitting on-chain
 * in the Rain coordinator's proxy, but Rain's balance endpoint won't return it
 * because their Rain user record was deleted. The normal /withdraw flow can't
 * see the balance, so we have a dedicated recovery endpoint pair on the
 * backend that reads the on-chain balance directly and asks Rain for a
 * signature for that exact amount, paid to the user's own smart wallet.
 *
 * This page wires that flow: preview → confirm → kernel-sign EIP-712 →
 * submit. The destination address is decided by the backend and shown here
 * for transparency; the FE cannot influence it.
 *
 * Not linked from anywhere in the main app — accessed by URL only. It's safe
 * to share the URL with a user who needs to recover funds: the JWT cookie is
 * the only auth, the recipient is server-locked, and the signing step still
 * requires the user's passkey.
 */
export function CardRecoveryPage() {
    const t = useTranslations('card.recovery')
    const onBack = useSafeBack('/home')
    const { step, preview, error, txHash, recoveredCents, handleRecover } = useCardRecoveryFlow()

    if (!preview && !error) return <Loading variant="mascot" />

    return (
        <PageStack>
            <NavHeader title={t('navTitle')} onPrev={onBack} />
            <PageStack.Center>
                {error && <Notification priority="error">{error}</Notification>}

                {step === 'done' && txHash ? (
                    <Card className="flex flex-col gap-3 p-6">
                        <h2 className="text-heading-card">{t('doneTitle')}</h2>
                        <p className="text-body-s text-foreground-secondary">
                            {t('doneBody', { amount: `$${formatCents(recoveredCents ?? preview!.amountCents)}` })}
                        </p>
                        <LinkButton
                            href={`${getExplorerUrl(String(PEANUT_WALLET_CHAIN.id)) ?? ''}/tx/${txHash}`}
                            external
                            className="self-start"
                        >
                            {t('viewTransaction')}
                        </LinkButton>
                    </Card>
                ) : (
                    preview && (
                        <>
                            <Card className="flex flex-col gap-3 p-6">
                                <h2 className="text-heading-card">
                                    {preview.hasRecoverableCard ? t('title') : t('noCardOnFile')}
                                </h2>
                                <p className="text-body-s text-foreground-secondary">{t('description')}</p>

                                <Row label={t('recoverable')} value={`$${formatCents(preview.amountCents)} USDC`} />
                                <Row label={t('destination')} value={shorten(preview.recipient)} />
                                {BigInt(preview.dustWei) > 0n && (
                                    <Row label={t('dust')} value={`${preview.dustWei} wei (< $0.01)`} />
                                )}
                                <Row
                                    label={t('autoBalance')}
                                    value={preview.autoBalanceEnabled ? t('autoBalanceOn') : t('autoBalanceOff')}
                                />
                            </Card>

                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="w-full"
                                disabled={
                                    step === 'signing' ||
                                    step === 'submitting' ||
                                    BigInt(preview.amountCents) <= 0n ||
                                    !preview.hasRecoverableCard
                                }
                                loading={step === 'signing' || step === 'submitting'}
                                onClick={handleRecover}
                            >
                                {step === 'signing'
                                    ? t('signWithPasskey')
                                    : step === 'submitting'
                                      ? t('submitting')
                                      : t('cta')}
                            </Button>
                        </>
                    )
                )}
            </PageStack.Center>
        </PageStack>
    )
}
