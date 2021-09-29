module.exports = {
  settings: {
    parser: {
      enabled: true,
      multipart: true,
      includeUnparsed: true,
      formLimit: 200 * 1024 * 1024,
      jsonLimit: 200 * 1024 * 1024,
      textLimit: 200 * 1024 * 1024,
      formidable: {
        maxFileSize: 200 * 1024 * 1024, // Defaults to 200 MB
      },
    },
  },
};
