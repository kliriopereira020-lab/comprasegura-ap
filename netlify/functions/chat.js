const axios = require('axios');
const crypto = require('crypto');

exports.handler = async (event) => {
  // Configurações de Segurança
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metodo não permitido" };
  }

  // Pegar as chaves que você salvou no Netlify
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
  
  try {
    const { query } = JSON.parse(event.body);
    
    // Configuração para a API do AliExpress
    const method = 'aliexpress.affiliate.product.query';
    const timestamp = new Date().toISOString().replace(/[-:T]/g, ' ').split('.')[0].trim();
    
    const params = {
      app_key: APP_KEY,
      format: 'json',
      method: method,
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: query,
      page_size: '10'
    };

    // Gerar a Assinatura (O segredo para o AliExpress aceitar)
    const sortedKeys = Object.keys(params).sort();
    let signString = APP_SECRET;
    for (const key of sortedKeys) {
      signString += key + params[key];
    }
    signString += APP_SECRET;
    
    const sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();

    // Chamada Real para o AliExpress
    const response = await axios.get('https://eco.aliexpress.com/router/rest', {
      params: { ...params, sign }
    });

    const data = response.data;
    
    // Verificar se o AliExpress devolveu produtos
    const respResult = data.aliexpress_affiliate_product_query_response?.resp_result;
    
    if (respResult && respResult.result_count > 0) {
      const products = respResult.result.products.product;

      const formattedResults = products.map((p, index) => ({
        id: index,
        loja: "AliExpress",
        titulo: p.product_title,
        preco_min: p.target_sale_price,
        vendedor: p.shop_info.shop_name,
        link: p.promotion_link, // LINK DE AFILIADO (DINHEIRO)
        destaque: index === 0
      }));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultados: formattedResults })
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ resultados: [], aviso: "Nenhum produto encontrado" })
      };
    }

  } catch (error) {
    console.error("Erro na Function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro na conexão com AliExpress", details: error.message })
    };
  }
};
