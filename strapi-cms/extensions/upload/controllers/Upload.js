'use strict';

const { sanitizeEntity } = require('strapi-utils');
const { yup, formatYupErrors } = require('strapi-utils');

/**
 * Checks if user is allowed to create a new file
 */
const checkCreatePermission = (ctx, adminAndAuthIsRequired = false) => {
  // Destructur is authenticated admin
  const { state: { userAbility, isAuthenticatedAdmin } = {} } = ctx;

  // Throw error if authentication is required and user is not an admin
  if (adminAndAuthIsRequired && !isAuthenticatedAdmin) {
    throw strapi.errors.forbidden();
  }

  // Check if user is authenticated admin
  if (isAuthenticatedAdmin) {
    // Create permission manager
    const pm = strapi.admin.services.permission.createPermissionsManager({
      ability: userAbility,
      action: 'plugins::upload.assets.create',
      model: 'plugins::upload.file',
    });

    // Check if user have create permission
    if (!pm.isAllowed) {
      throw strapi.errors.forbidden();
    }
  }
};

module.exports = {
  /**
   * Creates a new file entry for files uploaded by the client.
   */
  async create(ctx) {
    // Destructur body from contex
    const {
      state: { user },
      request: { body },
    } = ctx;

    // Check if user is allowed to create a new file
    checkCreatePermission(ctx);

    // Create yup schema
    const schema = yup.object({
      name: yup.string().required(),
      hash: yup.string().required(),
      ext: yup.string().required(),
      mime: yup.string().required(),
      size: yup.number().positive().required(),
      url: yup.string().url().required(),
    });

    // Parse incoming date with yup
    const fileInfo = await schema
      .validate(body.fileInfo, { abortEarly: false })
      .catch((err) => {
        throw strapi.errors.badRequest('ValidationError', {
          errors: formatYupErrors(err),
        });
      });

    // Create file entry
    const uploadService = strapi.plugins.upload.services.upload;
    const file = await uploadService.create({ fileInfo }, { user });

    // Send response to client
    const model = strapi.getModel('file', 'upload');
    ctx.body = sanitizeEntity(file, { model });
  },

  /**
   * Request a Cloud Storage accesss token for upload files via client.
   */
  async cloudStorageToken(ctx) {
    // Check if user is allowed to create a new file
    checkCreatePermission(ctx, true);

    // Get Cloud Storage access token
    const uploadService = strapi.plugins.upload.services.upload;
    const data = await uploadService.cloudStorageToken();

    // Send response to client
    ctx.body = data;
  },
};
