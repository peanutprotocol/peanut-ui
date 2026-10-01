import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { STATEMENT_FORMATS } from './statementDownload.utils'

/** The statement file format, held in the URL (`?format=csv`). PDF is the
 *  default, so a URL without `format` means PDF. */
export function useStatementFormat() {
    const [format, setFormat] = useQueryState(
        'format',
        parseAsStringLiteral(STATEMENT_FORMATS).withDefault('pdf').withOptions({ history: 'replace', shallow: true })
    )
    return { format, setFormat }
}
