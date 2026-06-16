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

                // Читаем тело ТОЛЬКО ОДИН РАЗ
                const contentType = request.headers.get('content-type') || '';
                let body;
                
                if (contentType.includes('application/json')) {
                    body = await request.json();
                } else if (contentType.includes('multipart/form-data') || 
                           contentType.includes('application/x-www-form-urlencoded')) {
                    const formData = await request.formData();
                    const leadsData = formData.get('leads');
                    body = leadsData ? JSON.parse(leadsData) : {};
                } else {
                    // Попробуем как текст
                    const text = await request.text();
                    try {
                        body = JSON.parse(text);
                    } catch {
                        const urlEncoded = new URLSearchParams(text);
                        const leadsStr = urlEncoded.get('leads');
                        body = leadsStr ? JSON.parse(leadsStr) : {};
                    }
                }

                console.log(JSON.stringify(body, null, 2));

                /*
                Берем ТОЛЬКО событие смены этапа
                */
                const lead = body.leads?.status?.[0];

                /*
                Не смена этапа? Игнорируем
                */
                if (!lead) {
                    console.log('⏭️ Not a status event');
                    return new Response('OK', { status: 200 });
                }

                /*
                Данные сделки
                */
                const leadId = Number(lead.id);
                const pipelineId = Number(lead.pipeline_id);
                const newStatusId = Number(lead.status_id);
                const oldStatusId = Number(lead.old_status_id);
                const oldPipelineId = Number(lead.old_pipeline_id || 5240944);

                /*
                Кто передвинул сделку
                */
                const userId = Number(
                    lead.modified_user_id ||
                    lead.modified_by ||
                    lead.updated_by
                );

                /*
                Текущий ответственный
                */
                const currentResponsible = Number(lead.responsible_user_id);

                console.log('Lead ID:', leadId);
                console.log('Old Pipeline:', oldPipelineId);
                console.log('Old Status:', oldStatusId);
                console.log('New Pipeline:', pipelineId);
                console.log('New Status:', newStatusId);
                console.log('User ID:', userId);

                /*
                Проверяем: этап реально изменился?
                */
                if (!oldStatusId) {
                    console.log('⏭️ No old status');
                    return new Response('OK', { status: 200 });
                }

                if (oldStatusId === newStatusId) {
                    console.log('⏭️ Same status');
                    return new Response('OK', { status: 200 });
                }

                /*
                Ищем подходящее правило
                */
                const matchedRule = RULES.find(rule => {
                    const fromMatches =
                        rule.from.pipeline === oldPipelineId &&
                        rule.from.status === oldStatusId;

                    const toMatches =
                        rule.to.pipeline === pipelineId &&
                        rule.to.status.includes(newStatusId);

                    return fromMatches && toMatches;
                });

                /*
                Нет подходящего правила
                */
                if (!matchedRule) {
                    console.log('⏭️ No matching rule');
                    return new Response('OK', { status: 200 });
                }

                /*
                Нет пользователя?
                */
                if (!userId) {
                    console.log('⏭️ No user ID');
                    return new Response('OK', { status: 200 });
                }

                /*
                Уже нужный ответственный?
                */
                if (currentResponsible === userId) {
                    console.log('⏭️ Responsible already correct');
                    return new Response('OK', { status: 200 });
                }

                /*
                Меняем ответственного
                */
                console.log(`✅ Updating responsible: ${currentResponsible} → ${userId}`);

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
                console.log(error.message);
                return new Response('Internal Server Error', { status: 500 });
            }
        }

        // 404 для остальных запросов
        return new Response('Not Found', { status: 404 });
    }
};
