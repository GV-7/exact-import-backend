
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

let accessToken = '';
let refreshToken = process.env.EXACT_REFRESH_TOKEN;

/**
 * Vernieuwt het Exact Online access token met het refresh token.
 */
async function refreshExactToken() {
  if (!refreshToken) {
    throw new Error('EXACT_REFRESH_TOKEN ontbreekt in .env');
  }

  const data = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_id: process.env.EXACT_CLIENT_ID,
    client_secret: process.env.EXACT_CLIENT_SECRET,
  });

  const response = await axios.post(
    'https://start.exactonline.nl/api/oauth2/token',
    data.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  accessToken = response.data.access_token;
  refreshToken = response.data.refresh_token || refreshToken;
  console.log('Exact access token vernieuwd');
}

/**
 * Helper om ervoor te zorgen dat we een geldig token hebben.
 */
async function ensureAccessToken() {
  if (!accessToken) {
    await refreshExactToken();
  }
}

/**
 * Zoekt op basis van debiteurnummer (Code) de debiteur in Exact en geeft de GUID terug.
 */
async function findAccountGuidByDebtorCode(debtorCode) {
  if (!debtorCode) {
    throw new Error('customer.debtorCode ontbreekt in klantgegevens');
  }

  const division = process.env.EXACT_DIVISION;
  if (!division) {
    throw new Error('EXACT_DIVISION ontbreekt in .env');
  }

  const filter = encodeURIComponent(`Code eq '${debtorCode}'`);
  const url = `https://start.exactonline.nl/api/v1/${division}/crm/Accounts?$filter=${filter}`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  const results = response.data && response.data.d && response.data.d.results;
  if (!results || results.length === 0) {
    throw new Error(`Geen debiteur gevonden in Exact voor Code: ${debtorCode}`);
  }

  const account = results[0];
  console.log(`Debiteur gevonden voor Code ${debtorCode}: GUID ${account.ID}`);
  return account.ID;
}

/**
 * Zet de order uit de GPT om naar Exact Online SalesOrder payload.
 */
function buildExactOrderPayload(order, accountGuid) {
  if (!order || !order.order || !order.order.lines) {
    throw new Error('Order-data ontbreekt of is ongeldig');
  }

  const division = process.env.EXACT_DIVISION;
  if (!division) {
    throw new Error('EXACT_DIVISION ontbreekt in .env');
  }

  const orderNumber = order.order.orderNumber || 'GPT-ORDER';
  const orderDate = order.order.date || new Date().toISOString().substring(0, 10);

  const lines = order.order.lines.map((line, index) => {
    if (!line.itemCode) {
      throw new Error(`itemCode ontbreekt in regel ${index + 1}`);
    }

    return {
      Item: line.itemCode,
      Description: line.description || '',
      Quantity: line.quantity || 1,
      UnitPrice: line.price || 0
    };
  });

  return {
    OrderDate: orderDate,
    Description: `Order ${orderNumber}`,
    OrderedBy: accountGuid,
    SalesOrderLines: lines
  };
}

/**
 * Endpoint dat door de Custom GPT aangeroepen wordt.
 * Verwacht JSON met customer + order structuur, incl. customer.debtorCode.
 */
app.post('/api/orders/exact', async (req, res) => {
  try {
    const order = req.body;
    console.log('Order ontvangen van GPT:', JSON.stringify(order, null, 2));

    await ensureAccessToken();

    const debtorCode = order?.customer?.debtorCode;
    const accountGuid = await findAccountGuidByDebtorCode(debtorCode);

    const division = process.env.EXACT_DIVISION;
    const payload = buildExactOrderPayload(order, accountGuid);

    const url = `https://start.exactonline.nl/api/v1/${division}/salesorder/SalesOrders`;

    const exactResponse = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Order succesvol naar Exact verzonden');
    return res.status(200).json({
      success: true,
      message: 'Order succesvol naar Exact verstuurd',
      exactResponse: exactResponse.data
    });
  } catch (error) {
    console.error('Fout bij verwerken order:', error.response?.data || error.message);

    // Als token verlopen is, één keer opnieuw proberen
    if (error.response && error.response.status === 401) {
      try {
        await refreshExactToken();
        return res.status(500).json({
          success: false,
          message: 'Token vernieuwd, probeer de order opnieuw te sturen.'
        });
      } catch (innerErr) {
        console.error('Fout bij vernieuwen token:', innerErr.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Fout bij versturen order naar Exact',
      error: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Exact Import backend draait op poort ${PORT}`);
});
