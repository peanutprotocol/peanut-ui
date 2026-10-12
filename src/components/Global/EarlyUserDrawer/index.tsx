'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import { AskShell } from '@/features/attention/AskShell'
import ShareButton from '../ShareButton'
import DocsLink from '@/components/Global/DocsLink'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { generateInviteCodeLink } from '@/utils/general.utils'
import { useAuth } from '@/context/authContext'
import { updateUserById } from '@/app/actions/users'
import type { AskSurfaceProps } from '@/features/attention/types'

/**
 * "Peanut is open to everyone": the one-time announcement for accounts that
 * predate open signup. Whether it shows is the attention manager's call (the
 * `early-user` ask reads the server's `showEarlyUserModal`); closing it
 * records `hasSeenEarlyUserModal` on the server.
 */
const EarlyUserDrawer = ({ onActed, presentation }: AskSurfaceProps) => {
    const t = useTranslations('global')
    const { user, fetchUser } = useAuth()
    const inviteLink = generateInviteCodeLink(user?.user.username ?? '').inviteLink
    const userId = user?.user.userId
    const [open, setOpen] = useState(true)

    const handleClose = async () => {
        if (!open) return
        setOpen(false)
        try {
            if (userId) await updateUserById({ userId, hasSeenEarlyUserModal: true })
            fetchUser()
        } catch (e) {
            // the local mark keeps it closed; the server flag is retried on the next close
            Sentry.captureException(e, { tags: { feature: 'attention', ask: 'early-user' } })
        }
        onActed()
    }

    return (
        <AskShell
            presentation={presentation}
            visible={open}
            onClose={() => void handleClose()}
            icon="user-plus"
            iconColor="brand"
            tone="peanut"
            title={t('earlyUserModal.title')}
            body={
                <div className="flex w-full flex-col items-center gap-4">
                    <p className="text-body-s text-foreground-secondary">{t('earlyUserModal.description')}</p>

                    <ShareButton url={inviteLink} title={t('earlyUserModal.shareSheetTitle')}>
                        {t('earlyUserModal.shareCta')}
                    </ShareButton>
                    {/* DocsLink keeps the locale + native behavior; the chrome is LinkButton's. */}
                    <DocsLink href="/en/help" className={LINK_BUTTON_CLASSES}>
                        {t('earlyUserModal.learnMore')}
                    </DocsLink>
                </div>
            }
        />
    )
}

export default EarlyUserDrawer
