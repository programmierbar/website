import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './presentation-publishable.vue';

export default defineInterface({
	id: 'publishable',
	name: 'Publishable',
	description: 'Indicates whether an item is ready to be published',
	icon: 'info',
	component: InterfaceComponent,
	types: ['alias'],
	localTypes: ['presentation'],
	group: 'presentation',
	hideLabel: true,
	options: null,
});
