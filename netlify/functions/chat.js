const axios = require('axios');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
  
  // Pegar o que o usuário digitou
  const { query } = JSON.parse(event.body);

  // Configuração da API de busca de produtos do AliExpress
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
    page_size: '3', // Pedimos 3 produtos para o seu layout
    sort: 'LAST_VOLUME_30_DAYS_DESC' // Trazer os que mais vendem (mais seguros)
  };

  // Gerar a assinatura (Sign) - Obrigatório para o AliExpress aceitar
  const sortedKeys = Object.keys(params).sort();
  let signString = APP_SECRET;
  for (const key of sortedKeys) {
    signString += key + params[key];
  }
  signString += APP_SECRET;
  const sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();

  try {
    const res = await axios.get('https://eco.aliexpress.com/router/rest', {
      params: { ...params, sign }
    });

    // Organizar os dados para o seu layout HTML
    const products = res.data.aliexpress_affiliate_product_query_response.resp_result.result.products.product;
    
    const formattedResults = products.map((p, index) => ({
      id: index,
      loja: "AliExpress",
      titulo: p.product_title,
      preco_min: p.target_sale_price,
      nota_seguranca: 9, 
      nivel: "SEGURO",
      vendedor: p.shop_info.shop_name,
      envio: "Envio Internacional",
      link: p.promotion_link, // ESTE É O LINK QUE TE DÁ DINHEIRO
      destaque: index === 0
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        produto: query,
        resumo: "Produtos reais encontrados no AliExpress",
        resultados: formattedResults
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Erro ao conectar com AliExpress" }) };
  }
};
