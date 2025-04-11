// middleware/machineAuth.js
const config = require('../server/config');

module.exports = function machineAuth(req, res, next) {
  const apiKey = req.body.apiKey || req.headers['x-api-key'];

  if (!apiKey || apiKey !== config.auth.machineKey) {
    return res.status(403).json({
      error: 'Unauthorized',
      message: 'Invalid API Key',
    });
  }

  next();
};
