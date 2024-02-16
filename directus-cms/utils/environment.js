const environment = {
  isProduction: function() {
    return process.env.ENVIRONMENT === 'production';
  }
}

module.exports = { environment };
