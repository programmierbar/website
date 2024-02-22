export default eventHandler(function (context) {
    const incomingPath = context.path
    const toMatch = '/.well-known/webfinger'

    if (!incomingPath.startsWith(toMatch)) {
        return
    }

    const externalHost = 'https://social.programmier.bar'
    const redirectUrl = `${externalHost}${incomingPath}`

    // Set the response status and location header for redirection
    // And end the response to complete the redirection
    context.node.res.writeHead(302, {
        Location: redirectUrl,
    })
    context.node.res.end()
})
