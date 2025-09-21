import InvitesPageLayout from '@/components/Invites/InvitesPageLayout'

import peanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { twMerge } from 'tailwind-merge'
import { Button } from '@/components/0_Bruddle'

export default function InvitePage() {
    return (
        <InvitesPageLayout image={peanutAnim.src}>
            <div
                className={twMerge(
                    'flex flex-grow flex-col justify-between overflow-hidden bg-white px-6 pb-8 pt-6 md:h-[100dvh] md:justify-center md:space-y-4',
                    'flex flex-col items-end justify-center gap-5 pt-8 '
                )}
            >
                <div className="mx-auto w-full md:max-w-xs">
                    <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-5">
                        <h1 className="text-xl font-extrabold">[user] invited you to Peanut</h1>
                        <p className="text-base font-medium">
                            Members-only access. Use this invite to open your wallet and start sending and receiving
                            money globally.
                        </p>
                        <Button shadowSize="4">Claim your spot</Button>

                        <button className="text-sm underline">Already have an account? Log in!</button>
                    </div>
                </div>
            </div>
        </InvitesPageLayout>
    )
}
