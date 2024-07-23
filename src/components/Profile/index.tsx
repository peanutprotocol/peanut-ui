'use client'
import Icon from '../Global/Icon'

import { createAvatar } from '@dicebear/core'
import { avataaarsNeutral } from '@dicebear/collection'
import MoreInfo from '../Global/MoreInfo'

export const Profile = () => {
    const avatar = createAvatar(avataaarsNeutral, {
        seed: 'test',
    })

    const svg = avatar.toDataUri()

    return (
        <div className="flex h-full w-full flex-row flex-col items-center justify-start gap-4 px-4">
            <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row ">
                <div className="flex w-full flex-col items-center justify-center gap-2 sm:w-max sm:flex-row">
                    <img src={svg} className="h-16 w-16 rounded-md" />
                    <div className="flex flex-col items-center justify-center gap-1 sm:items-start">
                        <span className="text-h4">
                            Borgiii
                            {/* <Icon name={'check'} /> */}
                        </span>
                        {true && <span className="text-h8 underline">click to KYC</span>}
                    </div>
                </div>
                <div className="flex w-full flex-col items-start justify-center gap-2 rounded-md border border-n-1 bg-background px-4 py-2 text-h7">
                    <span className="text-h5">3400 points</span>
                    <span className="flex items-center justify-center gap-1">
                        <Icon name={'arrow-up-right'} />
                        Boost 2.0X
                        <MoreInfo text="More info boost" />
                    </span>
                    <span className="flex items-center justify-center gap-1">
                        <Icon name={'heart'} />
                        Invites 69 <MoreInfo text="More info invites" />
                    </span>
                    <span className="flex items-center justify-center gap-1">
                        <Icon name={'peanut'} />
                        7 day streak <MoreInfo text="More info streak" />
                    </span>
                </div>
                {/* <div>balance</div> */}
            </div>
            {/* <div>table</div> */}
        </div>
    )
}
