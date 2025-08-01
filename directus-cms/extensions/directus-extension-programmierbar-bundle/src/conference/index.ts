/// <reference types="@directus/extensions/api.d.ts" />
import { defineEndpoint } from '@directus/extensions-sdk';

import type { SandboxEndpointRouter } from 'directus:api';

export default defineEndpoint(async (router: SandboxEndpointRouter, context) => {

    const logger = context.logger
    const ItemsService = context.services.ItemsService

    router.get('/:identifier', async (req, res) => {
        const conferenceIdentifier = req.params.identifier;
        let conference = null;
        let conferenceItemsService = null;

        try {
            conferenceItemsService = new ItemsService('conferences', {
                accountability: req.accountability,
                schema: await context.getSchema(),
                knex: context.database,
            })
        } catch (error: any) {
            logger.error('Could not initialize conference items service: ' + error.message + '.');
            res.status(500).send({})
            return;
        }

        try {
            const conferences = await conferenceItemsService.readByQuery({filter: {'_or': [{id: {'_eq': conferenceIdentifier}}, {slug: {'_eq': conferenceIdentifier}}]}, limit: 1});
            if (conferences.length > 0) {
                conference = conferences[0];
            } else {
                res.status(404).send({})
            }
        } catch (error: any) {
            logger.error('Could not fetch conference item: ' + error.message + '.');
            res.status(500).send({})
            return;
        }

        if (!conference) {
            logger.warn('Requested unknown conference: ' + conferenceIdentifier + '.');
            res.status(404).send({})
        }

        console.log(conference);

        res.send({conference: conference});
    });
});
