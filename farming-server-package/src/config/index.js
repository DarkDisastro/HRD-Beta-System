module.exports = {
  server: {
    port: process.env.PORT || 3000,
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    apiPrefix: '/api/v1',
  },
  auth: {
    masterKey: process.env.API_KEY || 'fixed-machine-api-key-12345',
  },
  meeter: {
    currencyName: 'EurLind',
    registrationBonus: 100,
  },
  debug: true,
};