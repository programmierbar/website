import InterfaceComponent from './presentation-publishable.vue';

// Inspired by: https://github.com/directus/directus/tree/main/app/src/interfaces/presentation-notice

export default {
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
  //preview: PreviewSVG,
};
