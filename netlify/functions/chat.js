const axios = require('axios');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;

  try {
    const { query } = JSON.parse(event.body);

    // Configurações exatas da API do AliExpress
    const method = 'aliexpress.affiliate.product.query';
    
    // O timestamp precisa estar neste formato exato: YYYY-MM-DD HH:mm:ss
    const date = new Date();
    const timestamp = date.toISOString().replace('T', ' ').substring(0, 19);

    const params = {
      app_key: APP_KEY,
      format: 'json',
      method: method,
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: query,
      page_size: '20',
      local_currency: 'USD' // Podes mudar para BRL se preferires
    };

    // GERAR A ASSINATURA (O "Sign" que o AliExpress exige)
    const sortedKeys = Object.keys(params).sort();
    let signString = APP_SECRET;
    for (const key of sortedKeys) {
      signString += key + params[key];
    }
    signString += APP_SECRET;

    const sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();

    // CHAMADA PARA O SERVIDOR DO ALIEXPRESS
    const response = await axios.get('https://eco.aliexpress.com/router/rest', {
      params: { ...params, sign }
    });

    // Pegar os produtos da resposta
    const resultResponse = response.data.aliexpress_affiliate_product_query_response || response.data.error_response;
    
    if (resultResponse.resp_result) {
      const products = resultResponse.resp_result.result.products.product;
      
      const formatted = products.map((p, index) => ({
        id: index,
        titulo: p.product_title,
        preco_min: p.target_sale_price,
        vendedor: p.shop_info.shop_name,
        link: p.promotion_link, // ESTE LINK É O QUE TE DÁ A COMISSÃO
        destaque: index === 0
      }));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultados: formatted })
      };
    } else {
      // Se der erro nas chaves lá no AliExpress
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Erro na API do AliExpress", detail: resultResponse })
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro interno", detail: error.message })
    };
  }
};
