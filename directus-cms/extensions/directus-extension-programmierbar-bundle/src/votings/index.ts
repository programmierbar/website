import { defineEndpoint } from '@directus/extensions-sdk';

export default defineEndpoint((router) => {
	router.get('/', (_req, res) =>
		res.status(200).send('This is the voting api endpoint!')
	);
});
