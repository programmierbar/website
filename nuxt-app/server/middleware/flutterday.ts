export default eventHandler(function (event) {
    const toMatch = 'flutterday.programmier.bar'
    const requestHost = event.headers.get('host') || ''

    if (!requestHost.startsWith(toMatch)) {
        return
    }

    const host = 'https://programmier.bar'
    const path = '/konferenzen/flutter-day-2024'

    const redirectUrl = `${host}${path}`

    // Set the response status and location header for redirection
    // And end the response to complete the redirection
    event.node.res.writeHead(302, {
        Location: redirectUrl,
    })

    event.node.res.end()
})
