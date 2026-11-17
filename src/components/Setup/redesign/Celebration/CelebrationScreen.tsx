'use client'

import { useTranslations } from 'next-intl'
import Loading from '@/components/Global/Loading'
import { Icon } from '@/components/Global/Icons/Icon'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { useAuth } from '@/context/authContext'
import { StepTimeline } from '@/features/paperwork-verification/components/StepTimeline'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { twMerge } from '@/utils/tw'
import { CelebrationArt } from './CelebrationArt'
import { useCelebrationRedirect } from './useCelebrationRedirect'
import { useCelebrationVerifyInvite } from './useCelebrationVerifyInvite'

/**
 * 12 Celebration (step `advantage-control` after sign-up completes): full pink stage, the whistling peanut, the
 * account's name, and where the app goes next. It leaves on its own after 4.5 s. A sign-up that started from a
 * claim link says it goes back to the link (`claim-link`); the redirect itself is dev's. Contract P4 § 5.
 * A default sign-up may instead get the verify invite (`verify-invite`, signup v7): the same screen asks it to verify,
 * with the two ID-check steps the person acts on (Konrad's wording; Hugo dropped Review, addendum 2), "Verify now · 3 min" and a "Remind me later" link
 * to Home, and no wait.
 */
export function CelebrationScreen() {
    const t = useTranslations('setupRedesign.done')
    const tInvite = useTranslations('setupRedesign.verifyInvite')
    const tSteps = useTranslations('kyc.paperworkVerification.steps')
    const { signupCompleted, signupEntryFlow, username: draftUsername } = useSetupFlowContext()
    const { user } = useAuth()
    const invite = useCelebrationVerifyInvite(signupCompleted)
    useCelebrationRedirect(signupCompleted, invite.shown)

    if (!signupCompleted) return null
    const claim = signupEntryFlow === 'claim'
    const state = claim ? 'claim-link' : invite.shown ? 'verify-invite' : 'default'
    const username = user?.user.username || draftUsername

    return (
        <>
            <SetupScreen
                ground="pink"
                stage="full"
                artTop={104}
                smScale={0.67}
                // scale 1 on a standard phone, as the mock: the fit would shrink the art by the bottom safe area
                artBesideTitle
                chrome={{ back: false, dots: false, lang: false }}
                art={<CelebrationArt claim={claim} invite={invite.shown} />}
                footer={
                    invite.shown
                        ? {
                              primary: {
                                  label: tInvite('verifyNow'),
                                  loading: invite.starting,
                                  onClick: () => void invite.verify(),
                                  testId: 'setup-redesign-verify-now',
                              },
                              slot: (
                                  <LinkButton onClick={invite.later} disabled={invite.starting}>
                                      {tInvite('remindLater')}
                                  </LinkButton>
                              ),
                          }
                        : null
                }
                state={state}
                stageCopy={
                    invite.shown ? (
                        // the invite's footer holds the buttons: the copy ends 16 px above it
                        <div
                            className="absolute inset-x-6 bottom-[calc(100%-var(--sr-footer-top,100%)+1rem)] flex flex-col items-center text-center signup-sm:inset-x-5"
                            data-testid="setup-redesign-celebration"
                            data-setup-state={state}
                        >
                            <h1 className="text-heading-l text-balance signup-sm:text-heading-s">{tInvite('title')}</h1>
                            <p className="mt-1 text-body-m text-foreground-primary signup-sm:text-body-s">
                                {tInvite('sub')}
                            </p>
                            <StepTimeline
                                rows={[
                                    { key: 'questions', label: tInvite('stepQuestions'), state: 'current' },
                                    { key: 'photo', label: tInvite('stepPhoto'), state: 'next' },
                                ]}
                                doneLabel={tSteps('done')}
                                dense
                                className="mt-4 w-full signup-sm:mt-3"
                                testId="setup-redesign-verify-steps"
                            />
                        </div>
                    ) : (
                        // anchored to the bottom so a longer headline grows upward. The mock measures 40 px (80 px after a claim
                        // link) from the phone's bottom edge, home bar included; the shell ends above the bottom safe area.
                        <div
                            className={twMerge(
                                'pointer-events-none absolute inset-x-6 flex flex-col items-center text-center signup-sm:inset-x-5',
                                claim
                                    ? 'bottom-[max(0px,calc(5rem-var(--safe-bottom)))] signup-sm:bottom-10'
                                    : 'bottom-[max(0px,calc(2.5rem-var(--safe-bottom)))] signup-sm:bottom-4'
                            )}
                            data-testid="setup-redesign-celebration"
                            data-setup-state={state}
                        >
                            <h1 className="text-heading-l text-balance signup-sm:text-heading-s">
                                {t(claim ? 'claimTitle' : 'title')}
                            </h1>
                            {username && (
                                <span
                                    className={`text-label-l ${twMerge(
                                        'shadow-2 mt-2.5 inline-flex h-7 -rotate-3 items-center gap-1.5 rounded-sm border border-border-default bg-background-default px-2.5 signup-sm:mt-2',
                                        !claim && 'mt-4'
                                    )}`}
                                >
                                    <span className="flex size-5 items-center justify-center rounded-full bg-background-icon-bubble-green text-foreground-inverse">
                                        <Icon name="check" size={14} strokeWidth={3} />
                                    </span>
                                    {`@${username}`}
                                </span>
                            )}
                            <p
                                // ds text tokens stay outside twMerge: it reads them as colours and drops the size. Mock .sub: 16/26, 14/20 small
                                className={`text-body-m leading-[1.625rem] text-foreground-primary signup-sm:text-body-s signup-sm:leading-5 ${twMerge('mt-2.5 signup-sm:mt-2', !claim && 'mt-4')}`}
                            >
                                {t(claim ? 'claimSub' : 'sub')}
                            </p>
                            {/* a div, not a p: the spinner is a div, and a p cannot hold one */}
                            <div className="mt-4 flex h-9 items-center justify-center gap-2 text-body-s text-foreground-over-color-secondary signup-sm:mt-2.5">
                                <Loading className="size-4 flex-none" />
                                <span>{t(claim ? 'claimGoing' : 'going')}</span>
                            </div>
                        </div>
                    )
                }
            />
            {invite.modals}
            <SumsubKycModals flow={invite.kycFlow} />
        </>
    )
}
