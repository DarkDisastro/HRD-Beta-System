// middleware/authMiddleware.js
const config = require("../config");

function checkApiKey(req, res, next) {
  const keyFromHeader = req.headers['x-api-key'];
  const keyFromBody = req.body?.apiKey;
  const apiKey = keyFromBody || keyFromHeader;

  const validKeys = config.auth.acceptedApiKeys;

  if (!apiKey || !validKeys.includes(apiKey)) {
    if (config.debug) {
      console.warn("❌ Richiesta con chiave non autorizzata:", apiKey);
    }
    return res.status(403).json({
      error: "Unauthorized",
      message: "Invalid API Key"
    });
  }

  next();
}

module.exports = checkApiKey;
