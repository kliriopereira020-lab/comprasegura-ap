const axios = require('axios');
const crypto = require('crypto');

/**
 * FUNÇÃO PRINCIPAL: chat.js
 * Começa na Linha 1, sem espaços.
 */
exports.handler = async (event) => {
  // 1. Bloqueia métodos que não sejam POST (segurança)
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: "Método não permitido. Use POST." }) 
    };
  }

  // 2. Carrega as credenciais das variáveis de ambiente do Netlify
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;

  if (!APP_KEY || !APP_SECRET) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Configuração incompleta: Chaves API ausentes no painel Netlify." }) 
    };
  }

  try {
    // 3. Recebe os dados do formulário (pode ser link ou palavra-chave)
    const body = JSON.parse(event.body);
    const query = body.query || "";

    // 4. Configuração básica para a API do AliExpress
    const method = 'aliexpress.affiliate.product.query';
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const params = {
      app_key: APP_KEY,
      format: 'json',
      method: method,
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: query, // Aqui o motor busca o produto
      page_size: '20'
    };

    // 5. Geração da Assinatura Digital (O "segredo" para a API aceitar a chamada)
    const sortedKeys = Object.keys(params).sort();
    let signString = APP_SECRET;
    for (const key of sortedKeys) {
      signString += key + params[key];
    }
    signString += APP_SECRET;

    const sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();

    // 6. Faz a requisição para os servidores da Alibaba/AliExpress
    const response = await axios.get('https://gw.api.alibaba.com/router/rest', {
      params: { ...params, sign },
      timeout: 10000 // 10 segundos de limite para não ficar travado
    });

    // 7. Extrai os dados da resposta (com verificação de segurança para não dar erro se vier vazio)
    const apiData = response.data.aliexpress_affiliate_product_query_response;
    const products = apiData?.resp_result?.result?.products?.product || [];

    // 8. Retorno Sucesso
    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // Permite que o seu site acesse a função
      },
      body: JSON.stringify({ 
        total_encontrado: products.length,
        resultados: products 
      })
    };

  } catch (error) {
    // 9. Tratamento de Erros (Log detalhado para sabermos o que falhou)
    console.error("Erro na Função Chat:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Falha ao processar requisição", 
        detail: error.message 
      })
    };
  }
};
