const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

const app = express();

const API_KEY = config.auth.masterKey || (() => {
  const key = crypto.randomBytes(32).toString("hex");
  console.warn("⚠️  Nessuna API_KEY trovata nel config. Generata automaticamente (dev mode).");
  return key;
})();

// === Setup database directory ===
const dbPath = path.join(__dirname, "database");
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);

const usersPath = path.join(dbPath, "users.json");
if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, "[]");

const deliveriesPath = path.join(dbPath, "deliveries.json");
if (!fs.existsSync(deliveriesPath)) fs.writeFileSync(deliveriesPath, "[]");

const statsPath = path.join(dbPath, "stats.json");
if (!fs.existsSync(statsPath)) fs.writeFileSync(statsPath, "{}");

app.use(express.json());

app.use((req, res, next) => {
  if (config.debug) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// === Helper ===
function findUserBy(field, value) {
  const users = JSON.parse(fs.readFileSync(usersPath));
  return users.find(user => user[field] === value);
}

function saveUser(user) {
  const users = JSON.parse(fs.readFileSync(usersPath));
  users.push(user);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function updateUserBalance(apiKey, newBalance) {
  const users = JSON.parse(fs.readFileSync(usersPath));
  const index = users.findIndex(u => u.apiKey === apiKey);
  if (index >= 0) {
    users[index].balance = newBalance;
    users[index].lastLogin = new Date().toISOString();
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  }
}

// === Auth middleware ===
function auth(req, res, next) {
  const key = req.headers["x-api-key"] || req.query.key;
  if (key === API_KEY) {
    req.user = { role: "admin" };
    return next();
  }
  const user = findUserBy("apiKey", key);
  if (user) {
    req.user = user;
    return next();
  }
  res.status(403).json({ error: "Unauthorized", message: "Invalid API Key" });
}

// === Routes ===

app.get("/", (req, res) => {
  res.json({
    status: "running",
    service: `${config.meeter.currencyName} Delivery & Meeter API`,
    version: "1.1.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/register", (req, res) => {
  const { uuid } = req.query;
  if (!uuid) return res.status(400).json({ error: "Missing uuid" });
  if (findUserBy("avatar", uuid)) return res.status(409).json({ error: "Already registered" });

  const apiKey = crypto.randomBytes(32).toString("hex");
  const user = {
    avatar: uuid,
    name: "Unknown",
    apiKey,
    registeredAt: new Date().toISOString(),
    balance: config.meeter.registrationBonus,
    lastLogin: new Date().toISOString(),
  };
  saveUser(user);
  res.json({
    status: "success",
    message: "Account created",
    apiKey,
    balance: user.balance,
  });
});

app.get("/save", (req, res) => {
  const { uuid, key, stats } = req.query;
  if (!uuid || !key || !stats) {
    return res.status(400).json({ error: "Missing parameters", required: ["uuid", "key", "stats"] });
  }
  const user = findUserBy("avatar", uuid);
  if (!user || user.apiKey !== key) return res.status(403).json({ error: "Unauthorized" });

  const allStats = JSON.parse(fs.readFileSync(statsPath));
  allStats[uuid] = {
    stats: stats.split(",").map(parseFloat),
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(statsPath, JSON.stringify(allStats, null, 2));
  res.json({ status: "success", message: "Stats saved" });
});

// === API (POST) Registrazione
app.post("/api/register", (req, res) => {
  const { avatar, name } = req.body;
  if (!avatar) return res.status(400).json({ error: "Missing avatar" });
  if (findUserBy("avatar", avatar)) return res.status(409).json({ error: "Already registered" });

  const apiKey = crypto.randomBytes(32).toString("hex");
  const user = {
    avatar,
    name: name || "Unknown",
    apiKey,
    registeredAt: new Date().toISOString(),
    balance: config.meeter.registrationBonus,
    lastLogin: new Date().toISOString(),
  };
  saveUser(user);
  res.status(201).json({ apiKey, status: "success", initialBalance: user.balance });
});

// === API: Energia da generatore
app.post("/api/v1/machine/interact", (req, res) => {
  const { apiKey, avatarKey, energia } = req.body;

  if (!apiKey || !avatarKey || !energia) {
    return res.status(400).json({ error: "Missing required fields", required: ["apiKey", "avatarKey", "energia"] });
  }

  const user = findUserBy("avatar", avatarKey);
  if (!user || user.apiKey !== apiKey) {
    return res.status(403).json({ error: "Unauthorized or user not found" });
  }

  const energiaAggiunta = parseFloat(energia);
  if (isNaN(energiaAggiunta) || energiaAggiunta <= 0) {
    return res.status(400).json({ error: "Invalid energia value" });
  }

  const users = JSON.parse(fs.readFileSync(usersPath));
  const index = users.findIndex(u => u.avatar === avatarKey);
  if (index !== -1) {
    users[index].balance += energiaAggiunta;
    users[index].lastLogin = new Date().toISOString();
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    return res.status(200).json({ status: "success", balance: users[index].balance });
  }

  return res.status(500).json({ error: "Unable to update user balance" });
});

// === API: Deliver
app.post("/api/deliver", auth, (req, res) => {
  const { item, avatar } = req.body;
  if (!item || !avatar) return res.status(400).json({ error: "Missing parameters" });

  const delivery = {
    timestamp: new Date().toISOString(),
    item,
    avatar,
    apiKeyUsed: req.headers["x-api-key"] || req.query.key,
    processedBy: req.user.avatar || "system"
  };
  const deliveries = JSON.parse(fs.readFileSync(deliveriesPath));
  deliveries.push(delivery);
  fs.writeFileSync(deliveriesPath, JSON.stringify(deliveries, null, 2));
  res.json({ status: "success", message: `Delivering ${item} to ${avatar}` });
});

// === API: Spend
app.post("/api/spend", auth, (req, res) => {
  const { amount, reason } = req.body;
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const users = JSON.parse(fs.readFileSync(usersPath));
  const idx = users.findIndex(u => u.apiKey === req.user.apiKey);
  if (idx === -1 || users[idx].balance < amount) {
    return res.status(402).json({ error: "Insufficient balance", currentBalance: users[idx]?.balance });
  }

  users[idx].balance -= amount;
  users[idx].lastLogin = new Date().toISOString();
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.json({ status: "success", spent: amount, newBalance: users[idx].balance, reason: reason || "N/A" });
});

// === API: Check Balance
app.get("/api/balance", auth, (req, res) => {
  res.json({ avatar: req.user.avatar, balance: req.user.balance });
});

// === API: User Info
app.get("/api/user", auth, (req, res) => {
  res.json({
    avatar: req.user.avatar,
    name: req.user.name,
    balance: req.user.balance,
    registeredAt: req.user.registeredAt,
    lastLogin: req.user.lastLogin,
  });
});

// === Avvio server ===
app.listen(config.server.port, () => {
  console.log(`🚀 Server running on port ${config.server.port}`);
  console.log(`🔐 API Key: ${API_KEY.substring(0, 5)}...${API_KEY.slice(-5)}`);
  console.log(`📂 Database path: ${dbPath}`);
});
