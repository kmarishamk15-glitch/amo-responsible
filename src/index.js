export default {
    async fetch(request, env, ctx) {

        const url = new URL(request.url);

        if (request.method === 'GET') {
            return new Response('Webhook works', { status: 200 });
        }

        if (request.method === 'POST' && url.pathname === '/webhook') {

            try {

                console.log('======================');
                console.log('📥 NEW WEBHOOK');
                console.log('======================');

                console.log(
                    'Content-Type:',
                    request.headers.get('content-type')
                );

                const rawBody = await request.text();

                console.log('========== ALL FIELDS ==========');

                const params = new URLSearchParams(rawBody);

                for (const [key, value] of params.entries()) {
                    console.log(`${key} = ${value}`);
                }

                console.log('========== END ==========');

                return new Response('OK', { status: 200 });

            } catch (error) {

                console.log('❌ ERROR');
                console.log(error.stack || error.message);

                return new Response('ERROR', { status: 500 });
            }
        }

        return new Response('Not Found', { status: 404 });
    }
};
