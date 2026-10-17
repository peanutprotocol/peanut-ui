import type { CurrencyHistoryResponse } from '@/services/currency-accounts'

export function mergeCurrencyHistory(pages: CurrencyHistoryResponse[] | undefined) {
    const operations = new Map<string, CurrencyHistoryResponse['operations'][number]>()
    const entries = new Map<string, CurrencyHistoryResponse['entries'][number]>()
    for (const page of pages ?? []) {
        for (const operation of page.operations)
            if (!operations.has(operation.id)) operations.set(operation.id, operation)
        for (const entry of page.entries) if (!entries.has(entry.id)) entries.set(entry.id, entry)
    }
    return {
        operations: [...operations.values()],
        entries: [...entries.values()],
    }
}
