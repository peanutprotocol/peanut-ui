export function captureExitCode(results) {
    return results.some((result) => result.status === 'failed') ? 1 : 0
}
