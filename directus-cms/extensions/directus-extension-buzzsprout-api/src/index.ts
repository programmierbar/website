import { handlePodcastAction } from './handlers/handlePodcastAction'
import { handlePickOfTheDayAction } from './handlers/handlePickOfTheDayAction'
import { handleTagAction } from './handlers/handleTagAction'

const HOOK_NAME = 'buzzsproutApi';

export default ({ action }, {env, exceptions: { BaseException }, services}) => {

	const { logger, ItemsService } = services;

	/**
	 * It creates the podcast episode at Buzzsprout on
	 * newly created podcast items, if necessary.
	 */
	action('podcasts.items.create', ({ payload, ...metadata }, context) =>
		handlePodcastAction(HOOK_NAME, { payload, metadata, context }, {logger, ItemsService, BaseException, env})
	);

	/**
	 * It creates or updates the podcast episode at Buzzsprout
	 * on updated podcast items, if necessary.
	 */
	action('podcasts.items.update', ({ payload, ...metadata }, context) =>
		handlePodcastAction(HOOK_NAME, { payload, metadata, context }, {logger, ItemsService, BaseException, env})
	);

	/**
	 * It updates the podcast episode at Buzzsprout on newly
	 * created pick of the day items, if necessary.
	 */
	action('picks_of_the_day.items.create', ({ payload, ...metadata }, context) =>
		handlePickOfTheDayAction(HOOK_NAME, { payload, metadata, context }, {ItemsService, logger, BaseException})
	);

	/**
	 * It updates the podcast episode at Buzzsprout on
	 * updated pick of the day items, if necessary.
	 */
	action('picks_of_the_day.items.update', ({ payload, ...metadata }, context) =>
		handlePickOfTheDayAction(HOOK_NAME, { payload, metadata, context }, {ItemsService, logger, BaseException})
	);

	/**
	 * It updates the podcast episode at Buzzsprout
	 * on created tag items, if necessary.
	 */
	action('tags.items.create', ({ payload, ...metadata }, context) =>
		handleTagAction(HOOK_NAME, { payload, metadata, context }, {ItemsService, logger, BaseException})
	);

	/**
	 * It updates the podcast episode at Buzzsprout
	 * on updated tag items, if necessary.
	 */
	action('tags.items.update', ({ payload, ...metadata }, context) =>
		handleTagAction(HOOK_NAME, { payload, metadata, context }, {ItemsService, logger, BaseException})
	);
};
