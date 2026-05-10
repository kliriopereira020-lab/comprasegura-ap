const axios = require('axios');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método não permitido" };
  }

  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;

  try {
    const { query } = JSON.parse(event.body);

    const params = {
      app_key: APP_KEY,
      format: 'json',
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      v: '2.0',
      keywords: query,
      page_size: '20'
    };

    // Gerar a assinatura (Sign)
    const sortedKeys = Object.keys(params).sort();
    let signString = APP_SECRET;
    for (const key of sortedKeys) {
      signString += key + params[key];
    }
    signString += APP_SECRET;

    const sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
    params.sign = sign;

    // URL ALTERNATIVA (Mais estável para evitar o 404)
    const url = `https://gw.api.alibaba.com/router/rest`;

    const response = await axios.get(url, { params });

    // Verificação de erro da própria API do AliExpress
    if (response.data.error_response) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: "Erro na API AliExpress", 
          detail: response.data.error_response.msg || "Chave ou Assinatura inválida" 
        })
      };
    }

    const searchResponse = response.data.aliexpress_affiliate_product_query_response;

    if (searchResponse && searchResponse.resp_result.result_count > 0) {
      const products = searchResponse.resp_result.result.products.product.map((p, i) => ({
        id: i,
        vendedor: p.shop_info.shop_name,
        titulo: p.product_title,
        preco_min: p.target_sale_price,
        link: p.promotion_link
      }));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultados: products })
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ resultados: [], error: "Nenhum produto encontrado" })
      };
    }

  } catch (error) {
    console.error("Erro detalhado:", error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Erro interno no servidor", 
        detail: error.message 
      })
    };
  }
};
