'use client'

import PEANUT_LOGO_BLACK from '@/assets/logos/peanut-logo-dark.svg'
import { PEANUTMAN } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

interface CreateAccountButtonProps {
    /** Where the guest goes when the store hand-off is not active (flag off, native). */
    onClick: () => void
}

// The guest CTA on every success screen. During the migration a guest gets the app
// instead of web signup, so the hand-off lives here rather than at each call site.
const CreateAccountButton = ({ onClick }: CreateAccountButtonProps) => {
    const t = useTranslations('global')
    const tMigration = useTranslations('migration')
    const { interceptGuestCta, storeHandoffModal, handoffActive } = useGuestStoreHandoff()

    return (
        <>
            <Button
                onClick={() => {
                    if (interceptGuestCta()) return
                    onClick()
                }}
                shadowSize="4"
            >
                {handoffActive
                    ? tMigration('downloadPeanut')
                    : t.rich('createAccountButton.label', {
                          logo: () => (
                              <div className="flex items-center gap-1">
                                  <Image src={PEANUTMAN} alt="Peanut Logo" className="size-5" />
                                  <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                              </div>
                          ),
                      })}
            </Button>
            {storeHandoffModal}
        </>
    )
}

export default CreateAccountButton
