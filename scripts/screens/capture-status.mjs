export function captureExitCode(results) {
    return results.some((result) => result.status === 'captured') ? 0 : 1
}
