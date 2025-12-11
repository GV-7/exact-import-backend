
# Exact Import Backend

Kleine Node.js backend die orders van een Custom GPT ontvangt en doorstuurt naar Exact Online als SalesOrder.

## Benodigdheden

- Node.js (versie 18 of hoger aanbevolen)
- Exact Online account + API-toegang (Client ID, Client Secret, Refresh Token)
- Division code en klant GUID in Exact

## Installatie (voor je developer of technisch contact)

1. Repository clonen of bestanden downloaden.
2. Kopieer `.env.example` naar `.env` en vul alle waarden in.
3. Voer in de projectmap uit:

   ```bash
   npm install
   npm start
   ```

4. De server draait nu lokaal op `http://localhost:3000`.

## Endpoint voor de Custom GPT

- **POST** `/api/orders/exact`
- Body (voorbeeld):

```json
{
  "customer": {
    "name": "Jan Jansen",
    "email": "jan@example.com"
  },
  "order": {
    "orderNumber": "2025-0012",
    "date": "2025-03-20",
    "lines": [
      {
        "itemCode": "GUID-OF-ITEM-IN-EXACT",
        "description": "Productnaam",
        "quantity": 2,
        "price": 49.95
      }
    ]
  }
}
```

Deze backend zet de data om naar het SalesOrder-formaat van Exact Online en verstuurt de order via de REST API.
