import { render, screen } from '@testing-library/react'
import CreatorContestPage from '../page'

describe('CreatorContestPage', () => {
    it('embeds the contest with the required iframe permissions', () => {
        render(<CreatorContestPage />)

        const iframe = screen.getByTitle('Peanut Creator Contest')
        expect(iframe).toHaveAttribute('src', 'https://peanut-contest.vercel.app/')
        expect(iframe).toHaveAttribute('allow', 'storage-access *')
        expect(iframe).toHaveAttribute(
            'sandbox',
            'allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-storage-access-by-user-activation'
        )
        expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    })
})
