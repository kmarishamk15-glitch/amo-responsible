/*
========================================
🔧 ПРАВИЛА ПЕРЕХОДОВ
========================================
*/

const RULES = [
    {
        from: {
            pipeline: 5240944,
            status: 47069740
        },
        to: {
            pipeline: 5276629,
            status: [
                47054479,
                53410254,
                53780378,
                53410258,
                143,
                142
            ]
        }
    },
    {
        from: {
            pipeline: 5240944,
            status: 47069740
        },
        to: {
            pipeline: 5240944,
            status: [143]
        }
    }
];

/*
========================================
🌐 ОБРАБОТЧИК ЗАПРОСОВ (Cloudflare Workers)
========================================
*/

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // GET запросы (проверка работы)
        if (request.method === 'GET') {
            if (url.pathname === '/webhook') {
                return new Response('Webhook works', { status: 200 });
            }
            if (url.pathname === '/') {
                return new Response('AmoCRM Bot is running', { status: 200 });
            }
        }

        // POST webhook
        if (request.method === 'POST' && url.pathname === '/webhook') {
            try {
                console.log('======================');
                console.log('📥 NEW WEBHOOK');
                console.log('======================');

                // Читаем тело запроса
                const rawBody = await request.text();
                console.log('Content-Type:', request.headers.get('content-type'));

                // Парсим URL-encoded данные
                const params = new URLSearchParams(rawBody);
                
                // Извлекаем данные сделки из leads[update][0]
                const leadId = Number(params.get('leads[update][0][id]'));
                const pipelineId = Number(params.get('leads[update][0][pipeline_id]'));
                const newStatusId = Number(params.get('leads[update][0][status_id]'));
                const oldStatusId = Number(params.get('leads[update][0][old_status_id]'));
                const responsibleUserId = Number(params.get('leads[update][0][responsible_user_id]'));
                const modifiedUserId = Number(params.get('leads[update][0][modified_user_id]'));

                // old_pipeline_id не всегда приходит, используем fallback
                const oldPipelineId = Number(params.get('leads[update][0][old_pipeline_id]')) || 5240944;

                console.log('Lead ID:', leadId);
                console.log('Old Pipeline:', oldPipelineId);
                console.log('Old Status:', oldStatusId);
                console.log('New Pipeline:', pipelineId);
                console.log('New Status:', newStatusId);
                console.log('Modified User ID:', modifiedUserId);
                console.log('Responsible User ID:', responsibleUserId);

                // Если modified_user_id = 0, получаем через API
                let userId = modifiedUserId;
                
                if (!userId || userId === 0) {
                    console.log('⚠️ modified_user_id is 0, fetching from API...');
                    
                    const leadResponse = await fetch(
                        `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=last_modified_by`,
                        {
                            headers: {
                                'Authorization': `Bearer ${env.AMO_TOKEN}`,
                                'Accept': 'application/json'
                            }
                        }
                    );

                    if (leadResponse.ok) {
                        const leadData = await leadResponse.json();
                        userId = leadData.last_modified_by || leadData.modified_by || 0;
                        console.log('✅ Got user ID from API:', userId);
                    } else {
                        console.log('❌ Failed to fetch lead from API');
                    }
                }

                // Проверяем, что этап реально изменился
                if (!oldStatusId) {
                    console.log('⏭️ No old status');
                    return new Response('OK', { status: 200 });
                }

                if (oldStatusId === newStatusId) {
                    console.log('⏭️ Same status');
                    return new Response('OK', { status: 200 });
                }

                // Ищем подходящее правило
                const matchedRule = RULES.find(rule => {
                    const fromMatches =
                        rule.from.pipeline === oldPipelineId &&
                        rule.from.status === oldStatusId;

                    const toMatches =
                        rule.to.pipeline === pipelineId &&
                        rule.to.status.includes(newStatusId);

                    return fromMatches && toMatches;
                });

                if (!matchedRule) {
                    console.log('⏭️ No matching rule');
                    return new Response('OK', { status: 200 });
                }

                if (!userId) {
                    console.log('⏭️ No user ID');
                    return new Response('OK', { status: 200 });
                }

                if (responsibleUserId === userId) {
                    console.log('⏭️ Responsible already correct');
                    return new Response('OK', { status: 200 });
                }

                // Меняем ответственного
                console.log(`✅ Updating responsible: ${responsibleUserId} → ${userId}`);

                const response = await fetch(
                    `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${env.AMO_TOKEN}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            responsible_user_id: userId
                        })
                    }
                );

                if (!response.ok) {
                    const errorData = await response.text();
                    console.log('❌ API Error:', errorData);
                    throw new Error(`API error: ${response.status}`);
                }

                console.log('✅ Responsible updated');
                return new Response('OK', { status: 200 });

            } catch (error) {
                console.log('❌ ERROR');
                console.log(error.stack || error.message);
                return new Response('Internal Server Error', { status: 500 });
            }
        }

        return new Response('Not Found', { status: 404 });
    }
};
