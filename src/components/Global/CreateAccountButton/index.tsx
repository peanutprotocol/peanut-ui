'use client'

import { LOGO, WORDMARK } from '@/assets/brand'
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
                                  <Image src={LOGO} alt="Peanut Logo" className="size-5" />
                                  <Image src={WORDMARK} alt="Peanut Logo" className="h-3 w-auto" />
                              </div>
                          ),
                      })}
            </Button>
            {storeHandoffModal}
        </>
    )
}

export default CreateAccountButton
