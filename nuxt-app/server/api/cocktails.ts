import type { H3Event } from 'h3'

export default function (event: H3Event) {
    const data = {
        cocktails: [
            {
                name: 'Gin Tonic',
                ingredients: ['gin', 'tonic water', 'ice'],
                contains_alcohol: true,
                alcohol_free_variant_available: true,
            },
            {
                name: 'Ipanema',
                ingredients: ['ginger ale', 'juice', 'lime', 'brown sugar', 'ice'],
                contains_alcohol: false,
            },
            {
                name: 'Crodino Spritz',
                ingredients: ['crodino', 'orange', 'mint', 'ice'],
                contains_alcohol: false,
            },
        ],
    }

    event.node.res.setHeader('Content-Type', 'application/json')
    event.node.res.end(JSON.stringify(data))
}
