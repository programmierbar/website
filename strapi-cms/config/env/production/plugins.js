module.exports = {
  upload: {
    provider: 'google-cloud-storage',
    providerOptions: {
      bucketName: 'programmier-bar-strapi',
      publicFiles: true,
      uniform: false,
      basePath: '',
      cacheMaxAge: 1209600, // 14 days
    },
    breakpoints: {
      xs: 160,
      sm: 320,
      md: 640,
      lg: 1280,
      xl: 2560,
    },
  },
};
