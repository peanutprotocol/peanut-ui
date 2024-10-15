const os = require('os')

/**
 * Utility function to log the local IP address of the machine to test on mobile devices
 */
function logLocalIPAddress() {
    const interfaces = os.networkInterfaces()

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`Connect to local app @ IP: https://${iface.address}`)
            }
        }
    }
}
