
# Exact Import Backend (met debiteur-lookup)

Node.js backend die orders van een Custom GPT ontvangt en doorstuurt naar Exact Online als SalesOrder.
De debiteur wordt bepaald op basis van het debiteurnummer (customer.debtorCode -> veld Code in Exact).

## Benodigdheden

- Node.js (versie 18 of hoger aanbevolen)
- Exact Online account + API-toegang (Client ID, Client Secret, Refresh Token)
- Division code in Exact

## Data die de Custom GPT moet sturen

Voorbeeld-body naar `/api/orders/exact`:

```json
{
  "customer": {
    "name": "DA Herenhof",
    "email": "info@daherenhof.nl",
    "debtorCode": "12345"
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

De backend:
- Zoekt in Exact Online de debiteur met `Code == debtorCode`
- Gebruikt de gevonden GUID als `OrderedBy`
- Maakt een SalesOrder aan in de opgegeven division.
