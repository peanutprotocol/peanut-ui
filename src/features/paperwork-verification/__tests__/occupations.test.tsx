import { renderHook, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import type { AppLocale } from '@/i18n/app/config'
import en from '../occupations/en.json'
import es419 from '../occupations/es-419.json'
import esAR from '../occupations/es-AR.json'
import ptBR from '../occupations/pt-BR.json'
import { humanizeOccupation, useOccupationLabels } from '../occupations/labels'
import { searchOccupations, searchStems } from '../occupations/search'

const codes = Object.keys(en)

describe('job labels per locale', () => {
    it.each([
        ['es-419', es419],
        ['pt-BR', ptBR],
    ])('%s labels every one of the %s codes, each once', (_locale, labels) => {
        expect(Object.keys(labels).sort()).toEqual([...codes].sort())
        const values = Object.values(labels)
        expect(values.every((label) => label.trim().length > 0 && label.length <= 60)).toBe(true)
        expect(new Set(values).size).toBe(values.length)
    })

    it('es-AR holds only deltas over es-419', () => {
        for (const [code, label] of Object.entries(esAR)) {
            expect(codes).toContain(code)
            expect(label).not.toBe(es419[code as keyof typeof es419])
        }
    })

    const wrapper = (locale: AppLocale) =>
        function LocaleWrapper({ children }: { children: ReactNode }) {
            return (
                <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC">
                    {children}
                </NextIntlClientProvider>
            )
        }

    it('loads the user’s locale, es-AR over es-419', async () => {
        const [code, delta] = Object.entries(esAR)[0]
        const other = codes.find((c) => !(c in esAR))!
        const { result } = renderHook(() => useOccupationLabels(true), { wrapper: wrapper('es-AR') })
        await waitFor(() => expect(result.current).not.toBeNull())
        expect(result.current?.[code]).toBe(delta)
        expect(result.current?.[other]).toBe(es419[other as keyof typeof es419])
    })

    it('loads nothing until a job field asks', () => {
        const { result } = renderHook(() => useOccupationLabels(false), { wrapper: wrapper('pt-BR') })
        expect(result.current).toBeNull()
    })

    it('a code without a label still reads as words', () => {
        expect(humanizeOccupation('financial_analyst')).toBe('Financial analyst')
    })
})

describe('job search', () => {
    const labels: Record<string, string> = {
        registered_nurse: 'Enfermero',
        nurse_practitioner: 'Enfermero especializado',
        licensed_practical_nurse: 'Auxiliar de enfermería',
        lawyer: 'Abogado',
        accountant_and_auditor: 'Contador o auditor',
    }
    const search = (query: string) => searchOccupations(Object.keys(labels), (c) => labels[c], query, 'es-419')

    it('finds the masculine title from a feminine or plural query, ignoring accents', () => {
        expect(search('enfermera')).toEqual(['registered_nurse', 'nurse_practitioner', 'licensed_practical_nurse'])
        expect(search('abogadas')).toEqual(['lawyer'])
        expect(search('CONTADORA')).toEqual(['accountant_and_auditor'])
        expect(search('enfermeria')).toEqual(['licensed_practical_nurse'])
    })

    it('matches the English words of the code too', () => {
        expect(search('auditor')).toEqual(['accountant_and_auditor'])
        expect(search('nurse')).toEqual(['licensed_practical_nurse', 'registered_nurse', 'nurse_practitioner'])
    })

    it('puts titles that start with the query first', () => {
        expect(search('enfer')[0]).toBe('registered_nurse')
        expect(search('enfer').at(-1)).toBe('licensed_practical_nurse')
    })

    it('every word must match, and an empty query lists everything', () => {
        expect(search('enfermero abogado')).toEqual([])
        expect(search('  ')).toHaveLength(5)
    })

    it('stems only words long enough to keep their meaning', () => {
        expect(searchStems('bus taxi chefs enfermeras')).toEqual(['bus', 'taxi', 'chef', 'enfermer'])
    })
})
