module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  admin: {
    auth: {
      secret: env('ADMIN_JWT_SECRET', '81ba1aeed15054538dfa1820eb154af7'),
    },
  },
  cron: { enabled: true },
});
