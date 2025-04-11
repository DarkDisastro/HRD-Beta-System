# 🌿 Farming Server API - EurLind Edition

Questo server gestisce:
- ✅ Delivery degli oggetti da box centralizzato in Second Life
- 🔐 Autenticazione con API Key (Header `x-api-key`)
- 💰 Valuta interna: EurLind
- 📦 Tracciamento dei delivery (in `/database/deliveries.json`)

## 🚀 Deploy su Render
1. Vai su https://render.com
2. Crea un nuovo Web Service dal tuo repo GitHub
3. Imposta il root directory su `server`
4. Imposta il comando di avvio: `npm install && npm start`
5. Aggiungi una variabile ambiente: `API_KEY` con il valore che userai negli script LSL

## 🛠 Endpoint disponibili

### POST `/api/deliver`
Richiede la consegna di un oggetto.

**Header:** `x-api-key: TUACHIAVE`
```json
{
  "item": "nome_oggetto_nel_box",
  "avatar": "uuid_avatar_destinatario"
}
```

Risposta:
```json
{
  "status": "success",
  "message": "Delivering nome_oggetto_nel_box to uuid_avatar_destinatario"
}
```

I delivery sono tracciati in `database/deliveries.json`.

## 📦 Requisiti lato Second Life
Un box delivery su canale LSL in ascolto, oppure futura estensione via `llHTTPRequest`.

---
Built for HRD Roleplay System by ChatGPT 🤖