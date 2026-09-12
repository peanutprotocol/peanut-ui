export function captureExitCode(historical, results) {
    return !historical && results.some((result) => result.status === 'failed') ? 1 : 0
}
