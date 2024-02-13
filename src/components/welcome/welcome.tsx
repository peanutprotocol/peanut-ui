'use client'

import * as utils from '@/utils'
import * as welcomePages from './components'

export function welcomePage() {
    const isMantleUrl = utils.isMantleInUrl()

    return !isMantleUrl ? <welcomePages.WelcomeMantle /> : <welcomePages.Welcome />
}
