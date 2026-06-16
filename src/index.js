export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 🔥 ВСЕГДА ЛОВИМ ЗАПРОС СНАЧАЛА
    console.log('======================');
    console.log('🔥 ENTRY HIT');
    console.log('URL:', request.url);
    console.log('METHOD:', request.method);
    console.log('PATH:', url.pathname);
    console.log('======================');

    // GET check
    
    if (request.method === 'GET') {
      return new Response('Webhook works', { status: 200 });
    }

    // POST webhook (ВАЖНО: убрал жесткое равенство пути на время диагностики)
    if (request.method === 'POST') {
      try {
        console.log('📥 NEW WEBHOOK');

        const contentType = request.headers.get('content-type');
        console.log('Content-Type:', contentType);

        const rawBody = await request.text();
        console.log('RAW BODY:', rawBody);

        const params = new URLSearchParams(rawBody);

        console.log('========== PARSED FIELDS ==========');

        for (const [key, value] of params.entries()) {
          console.log(`${key} = ${value}`);
        }

        console.log('========== END ==========');

        // проверка: есть ли вообще lead
        const leadId = params.get('leads[update][0][id]');
        console.log('Lead ID:', leadId);

        return new Response('OK', { status: 200 });

      } catch (error) {
        console.log('❌ ERROR');
        console.log(error?.stack || error?.message);
        return new Response('ERROR', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
