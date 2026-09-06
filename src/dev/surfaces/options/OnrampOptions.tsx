'use client'

/**
 * OnrampConfirmationModal — the four reworks, as real renders.
 *
 * Harness-only, same rule as PasskeyHelpOptions: real DS components and the
 * real catalog strings, so the options can be photographed and compared before
 * one is promoted into the component.
 */

import { useTranslations } from 'next-intl'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { Notification } from '@/components/0_Bruddle/Notification'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'

const MINI = 'text-label-m uppercase tracking-wide text-foreground-secondary'
const AMOUNT = '250.00'
const CURRENCY = '€'

function useOnrampCopy() {
    const t = useTranslations('addMoney.confirmationModal')
    const bold = { b: (chunks: React.ReactNode) => <b>{chunks}</b> }
    return {
        t,
        willSee: [t('bankDetailsItem'), t('referenceCodeItem')],
        mustDo: [
            t.rich('sendExactly', { currency: CURRENCY, amount: AMOUNT, ...bold }),
            t('copyReferenceCode'),
            t('pasteReference'),
        ],
    }
}

function Shell({ children }: { children: React.ReactNode }) {
    const t = useTranslations('addMoney.confirmationModal')
    const tCommon = useTranslations('common')
    return (
        <Drawer open>
            <DrawerContent>
                <div className="flex flex-col items-center px-4 pt-1 pb-6 text-center">
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="alert" color="yellow" />
                        <DrawerTitle>{t('title')}</DrawerTitle>
                    </div>
                    {children}
                    <div className="mt-4 w-full" data-vaul-no-drag>
                        <SlideToConfirm label={tCommon('slideToProceed')} onConfirm={() => {}} />
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

/** A — the raw headings fold into each Notification's own title. */
export function OnrampA() {
    const { t, willSee, mustDo } = useOnrampCopy()
    return (
        <Shell>
            <div className="flex w-full flex-col gap-4 text-left">
                <Notification priority="helper" hideIcon className="w-full" title={t('nextStep')} items={willSee} />
                <Notification priority="info" className="w-full" title={t('youMust')} items={mustDo} />
                <Notification priority="error" title={t('mismatchTitle')}>
                    {t('mismatchDescription')}
                </Notification>
            </div>
        </Shell>
    )
}

/** B — one numbered sequence, one warning. */
export function OnrampB() {
    const { t, willSee, mustDo } = useOnrampCopy()
    return (
        <Shell>
            <div className="flex w-full flex-col gap-4 text-left">
                <NumberedList items={[...willSee, ...mustDo]} />
                <Notification priority="error" title={t('mismatchTitle')}>
                    {t('mismatchDescription')}
                </Notification>
            </div>
        </Shell>
    )
}

/** C — grey mini-headers and plain text; one Notification for the real risk. */
export function OnrampC() {
    const { t, willSee, mustDo } = useOnrampCopy()
    return (
        <Shell>
            <div className="flex w-full flex-col gap-4 text-left">
                <div className="flex flex-col gap-1">
                    <h2 className={MINI}>{t('nextStep')}</h2>
                    {willSee.map((item, i) => (
                        <p key={i} className="text-body-s text-foreground-primary">
                            {item}
                        </p>
                    ))}
                </div>
                <div className="flex flex-col gap-1">
                    <h2 className={MINI}>{t('youMust')}</h2>
                    {mustDo.map((item, i) => (
                        <p key={i} className="text-body-s text-foreground-primary">
                            {item}
                        </p>
                    ))}
                </div>
                <Notification priority="error" title={t('mismatchTitle')}>
                    {t('mismatchDescription')}
                </Notification>
            </div>
        </Shell>
    )
}

/** D — the warning and the slide; instructions one tap away. */
export function OnrampD() {
    const { t } = useOnrampCopy()
    return (
        <Shell>
            <div className="flex w-full flex-col gap-4 text-left">
                <Notification priority="error" title={t('mismatchTitle')}>
                    {t('mismatchDescription')}
                </Notification>
                {/* placeholder label: the real copy would need its own catalog key */}
                <LinkButton href="#">See full instructions</LinkButton>
            </div>
        </Shell>
    )
}
