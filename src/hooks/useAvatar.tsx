import { identicon } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'

const useAvatar = (seed?: string) => {
    const avatar = createAvatar(identicon, {
        seed,
    })
    const svg = avatar.toDataUri()

    return {
        uri: svg,
    }
}

export default useAvatar
