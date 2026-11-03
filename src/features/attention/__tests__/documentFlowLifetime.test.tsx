import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import DocumentRequestCard from '../surfaces/zone/DocumentRequestCard'
let mockRequest: object | null = { key: 'document-1' }
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useFormatter: () => ({}) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
const mockFeatures = { document: { status: 'requires-info' } }
const mockSelectHomeTasks = jest.fn((_actions: unknown, _features: unknown) => ({ documentSlide: mockRequest }))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ nextActions: [], capabilities: { features: mockFeatures } }),
}))
jest.mock('@/utils/bridge-tasks.utils', () => ({
    selectHomeTasks: (actions: unknown, features: unknown) => mockSelectHomeTasks(actions, features),
}))
jest.mock('@/components/Home/HomeCarouselCTA/CarouselCTA', () => ({
    __esModule: true,
    default: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Start</button>,
}))
jest.mock('@/hooks/useDocumentRequestFlow', () => ({
    useDocumentRequestFlow: () => {
        const [open, setOpen] = require('react').useState(false)
        return {
            start: () => setOpen(true),
            error: null,
            isLoading: false,
            modals: open ? <div>Flow still completing</div> : null,
        }
    },
}))
test('flow modals survive removal of the submitted document request', () => {
    const props = {
        askId: 'verification-advisory',
        onActed: jest.fn(),
        onDismissed: jest.fn(),
        onSnoozed: jest.fn(),
    } as any
    const view = render(<DocumentRequestCard {...props} />)
    expect(mockSelectHomeTasks).toHaveBeenCalledWith([], mockFeatures)
    fireEvent.click(screen.getByText('Start'))
    expect(screen.getByText('Flow still completing')).toBeTruthy()
    mockRequest = null
    view.rerender(<DocumentRequestCard {...props} />)
    expect(screen.queryByText('Flow still completing')).not.toBeNull()
})

import { AttentionFlowHost } from '../surfaces/AttentionFlowHost'
jest.mock('@/features/payments/flows/qr-pay/useQrIdentityCheck', () => ({
    useQrIdentityCheck: () => {
        const [open, setOpen] = require('react').useState(false)
        return { start: () => setOpen(true), modals: open ? <div>QR flow completing</div> : null }
    },
}))
test('a flow hosted above the zone survives its launching card unmounting', () => {
    mockRequest = { key: 'document-2' }
    const props = {
        askId: 'verification-advisory',
        mode: 'ask',
        onActed: jest.fn(),
        onDismissed: jest.fn(),
        onSnoozed: jest.fn(),
    } as const
    const view = render(
        <AttentionFlowHost>
            <DocumentRequestCard {...props} />
        </AttentionFlowHost>
    )
    fireEvent.click(screen.getByText('Start'))
    expect(screen.getByText('Flow still completing')).toBeTruthy()
    view.rerender(
        <AttentionFlowHost>
            <div>Next card</div>
        </AttentionFlowHost>
    )
    expect(screen.getByText('Flow still completing')).toBeTruthy()
})

import { useAttentionFlows } from '../surfaces/AttentionFlowContext'
function QrStart() {
    const flows = useAttentionFlows()!
    return <button onClick={flows.qr.start}>Start QR</button>
}
test('QR completion UI survives replacing its launching card', () => {
    const view = render(
        <AttentionFlowHost>
            <QrStart />
        </AttentionFlowHost>
    )
    fireEvent.click(screen.getByText('Start QR'))
    expect(screen.getByText('QR flow completing')).toBeTruthy()
    view.rerender(
        <AttentionFlowHost>
            <div>Next card</div>
        </AttentionFlowHost>
    )
    expect(screen.getByText('QR flow completing')).toBeTruthy()
})
