const axios = require('axios');
const crypto = require('crypto');

exports.handler = async (event) => {
  // Ignora chamadas que não sejam POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Verifica se as chaves existem no Netlify antes de começar
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;

  if (!APP_KEY || !APP_SECRET) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Chaves de API não configuradas no Netlify" }) 
    };
  }

  try {
    const { query } = JSON.parse(event.body);
    const method = 'aliexpress.affiliate.product.query';
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const params = {
      app_key: APP_KEY,
      format: 'json',
      method: method,
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: query,
      page_size: '20'
    };

    // Assinatura Digital
    const sortedKeys = Object.keys(params).sort();
    let signString = APP_SECRET;
    for (const key of sortedKeys) {
      signString += key + params[key];
    }
    signString += APP_SECRET;

    const sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();

    // Chamada oficial
    const response = await axios.get('https://gw.api.alibaba.com/router/rest', {
      params: { ...params, sign }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultados: response.data.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [] })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Falha na conexão", detail: error.message })
    };
  }
};
