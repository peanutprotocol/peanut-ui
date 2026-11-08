'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import NavHeader from '@/components/Global/NavHeader'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { API_ERROR_CODES } from '@/services/api-error'
import { useTranslations } from 'next-intl'

type StandaloneErrorKind = 'card' | 'card-recovery' | 'claim' | 'send' | 'withdraw' | 'wallet-recovery'

const noop = () => {}

/** Mount the app's error card with the failed route's presentation and inert controls. */
export function StandaloneErrorSurface({ kind }: { kind: StandaloneErrorKind }) {
    const tCommon = useTranslations('common')
    const tCard = useTranslations('card')
    const tCardRecovery = useTranslations('card.recovery')
    const tClaim = useTranslations('claim')
    const tNav = useTranslations('navigation')
    const tWithdraw = useTranslations('withdraw')
    const tWalletRecovery = useTranslations('walletRecovery')
    const toFriendlyError = useFriendlyError()
    const errorId = `standalone-error-${kind}`

    if (kind === 'card') {
        return (
            <PageContainer>
                <div
                    className="flex min-h-inherit w-full flex-col items-center justify-center gap-4 p-4"
                    data-testid={errorId}
                >
                    <CenteredStatusCard title={tCommon('cardCouldNotLoad')} description={tCard('page.loadFailed')}>
                        <Button onClick={noop} variant="primary" shadowSize="4">
                            {tCommon('retry')}
                        </Button>
                    </CenteredStatusCard>
                </div>
            </PageContainer>
        )
    }

    if (kind === 'card-recovery' || kind === 'claim') {
        const isClaim = kind === 'claim'
        return (
            <PageStack>
                {isClaim ? (
                    <NavHeader icon="cancel" title={tClaim('receive')} onPrev={noop} />
                ) : (
                    <NavHeader title={tCardRecovery('navTitle')} onPrev={noop} />
                )}
                <PageStack.Center className={isClaim ? 'gap-4' : undefined} data-testid={errorId}>
                    <CenteredStatusCard
                        title={tCommon(isClaim ? 'claimCouldNotComplete' : 'cardRecoveryUnavailable')}
                        description={
                            <Callout priority="error" hideIcon className="bg-transparent p-0">
                                {isClaim
                                    ? toFriendlyError({ code: API_ERROR_CODES.CHAIN_INFRA_UNAVAILABLE })
                                    : tCardRecovery('previewFailed')}
                            </Callout>
                        }
                    >
                        {isClaim && (
                            <>
                                <Button shadowSize="4" className="w-full" onClick={noop}>
                                    {tCommon('tryAgain')}
                                </Button>
                                <div className="mt-2 flex justify-center">
                                    <LinkButton onClick={noop}>{tClaim('backToHome')}</LinkButton>
                                </div>
                            </>
                        )}
                    </CenteredStatusCard>
                </PageStack.Center>
            </PageStack>
        )
    }

    if (kind === 'wallet-recovery') {
        return (
            <div className="flex min-h-dvh flex-col pt-safe-top pb-safe-bottom">
                <div className="flex flex-1 flex-col justify-center gap-6 px-4 py-6" data-testid={errorId}>
                    <CenteredStatusCard
                        title={tWalletRecovery('walletUnavailable.title')}
                        description={tWalletRecovery('walletUnavailable.description')}
                    />
                    <Button variant="primary" shadowSize="4" className="mt-4 w-full" onClick={noop}>
                        {tCommon('contactSupport')}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-inherit flex-col gap-8">
            <NavHeader title={tNav(kind === 'send' ? 'send' : 'withdraw')} onPrev={noop} />
            <div className="my-auto space-y-4 flex h-full flex-col justify-center" data-testid={errorId}>
                <CenteredStatusCard
                    title={tCommon(kind === 'send' ? 'sendCouldNotComplete' : 'withdrawalCouldNotComplete')}
                    description={tWithdraw('errors.unexpected')}
                >
                    <Button onClick={noop} variant="primary">
                        {tCommon('tryAgain')}
                    </Button>
                    <LinkButton onClick={noop} className="self-center">
                        {tCommon('contactSupport')}
                    </LinkButton>
                </CenteredStatusCard>
            </div>
        </div>
    )
}
