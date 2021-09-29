'use strict';

const _ = require('lodash');
const { GoogleAuth } = require('google-auth-library');

module.exports = {
  /**
   * Creates a new file entry for files uploaded by the client.
   *
   * @returns The added file data.
   */
  async create({ fileInfo }, { user } = {}) {
    // Create file data object
    const fileData = {
      alternativeText: '',
      caption: '',
      provider: 'google-cloud-storage',
      width: null,
      height: null,
      ...fileInfo,
    };

    // Add file entry
    return this.add(fileData, user);
  },

  /**
   * Request a Cloud Storage accesss token for upload files via client.
   *
   * @returns Stringified object with access token.
   */
  async cloudStorageToken() {
    // Create Google auth with  default credentials
    const googleAuth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/devstorage.read_write',
      clientOptions: {
        lifetime: 60 * 5, // 5 minutes
      },
    });

    // Request Cloud Storage access token
    const accessToken = await googleAuth.getAccessToken();

    // Return access token
    return JSON.stringify({ token: accessToken });
  },

  /**
   * Overwrite: Disable the creation of the thumbnail format.
   */
  async uploadFileAndPersist(fileData, { user } = {}) {
    const config = strapi.plugins.upload.config;

    const { getDimensions, /*generateThumbnail,*/ generateResponsiveFormats } =
      strapi.plugins.upload.services['image-manipulation'];

    await strapi.plugins.upload.provider.upload(fileData);

    // const thumbnailFile = await generateThumbnail(fileData);
    // if (thumbnailFile) {
    //   await strapi.plugins.upload.provider.upload(thumbnailFile);
    //   delete thumbnailFile.buffer;
    //   _.set(fileData, 'formats.thumbnail', thumbnailFile);
    // }

    const formats = await generateResponsiveFormats(fileData);
    if (Array.isArray(formats) && formats.length > 0) {
      for (const format of formats) {
        if (!format) continue;

        const { key, file } = format;

        await strapi.plugins.upload.provider.upload(file);
        delete file.buffer;

        _.set(fileData, ['formats', key], file);
      }
    }

    const { width, height } = await getDimensions(fileData.buffer);

    delete fileData.buffer;

    _.assign(fileData, {
      provider: config.provider,
      width,
      height,
    });

    return this.add(fileData, { user });
  },

  /**
   * Overwrite: Disable the creation of the thumbnail format.
   */
  async replace(id, { data, file }, { user } = {}) {
    const config = strapi.plugins.upload.config;

    const { getDimensions, /*generateThumbnail,*/ generateResponsiveFormats } =
      strapi.plugins.upload.services['image-manipulation'];

    const dbFile = await this.fetch({ id });

    if (!dbFile) {
      throw strapi.errors.notFound('file not found');
    }

    const { fileInfo } = data;
    const fileData = await this.enhanceFile(file, fileInfo);

    // keep a constant hash
    _.assign(fileData, {
      hash: dbFile.hash,
      ext: dbFile.ext,
    });

    // execute delete function of the provider
    if (dbFile.provider === config.provider) {
      await strapi.plugins.upload.provider.delete(dbFile);

      if (dbFile.formats) {
        await Promise.all(
          Object.keys(dbFile.formats).map((key) => {
            return strapi.plugins.upload.provider.delete(dbFile.formats[key]);
          })
        );
      }
    }

    await strapi.plugins.upload.provider.upload(fileData);

    // clear old formats
    _.set(fileData, 'formats', {});

    // const thumbnailFile = await generateThumbnail(fileData);
    // if (thumbnailFile) {
    //   await strapi.plugins.upload.provider.upload(thumbnailFile);
    //   delete thumbnailFile.buffer;
    //   _.set(fileData, 'formats.thumbnail', thumbnailFile);
    // }

    const formats = await generateResponsiveFormats(fileData);
    if (Array.isArray(formats) && formats.length > 0) {
      for (const format of formats) {
        if (!format) continue;

        const { key, file } = format;

        await strapi.plugins.upload.provider.upload(file);
        delete file.buffer;

        _.set(fileData, ['formats', key], file);
      }
    }

    const { width, height } = await getDimensions(fileData.buffer);
    delete fileData.buffer;

    _.assign(fileData, {
      provider: config.provider,
      width,
      height,
    });

    return this.update({ id }, fileData, { user });
  },
};
