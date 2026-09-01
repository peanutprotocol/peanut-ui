import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import NetworkFeeRow from '@/components/Global/NetworkFeeRow'

describe('NetworkFeeRow', () => {
    it('shows the sponsored label for a zero cross-chain quote (the 1:1 account config)', () => {
        renderWithIntl(<NetworkFeeRow label="Network fee" feeUsd={0} isCrossChain />)
        expect(screen.getByText('Sponsored by Peanut!')).toBeInTheDocument()
    })

    it('shows a non-zero quote verbatim', () => {
        renderWithIntl(<NetworkFeeRow label="Network fee" feeUsd={0.51} isCrossChain />)
        expect(screen.getByText('$0.51')).toBeInTheDocument()
        expect(screen.queryByText('Sponsored by Peanut!')).not.toBeInTheDocument()
    })

    it('is sponsored on same-chain even if a stale fee is passed', () => {
        renderWithIntl(<NetworkFeeRow label="Network fee" feeUsd={0.51} isCrossChain={false} />)
        expect(screen.getByText('Sponsored by Peanut!')).toBeInTheDocument()
    })

    it('strikes through paymaster-covered gas next to the sponsored label', () => {
        renderWithIntl(<NetworkFeeRow label="Network fee" isCrossChain={false} sponsoredGasUsd={0.05} />)
        expect(screen.getByText('$ 0.05')).toHaveClass('line-through')
        expect(screen.getByText('Sponsored by Peanut!')).toBeInTheDocument()
    })

    it('shows a dash when estimation failed', () => {
        renderWithIntl(<NetworkFeeRow label="Network fee" isCrossChain estimationFailed />)
        expect(screen.getByText('-')).toBeInTheDocument()
    })
})
