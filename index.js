require('dotenv').config();

const express = require('express');
const axios = require('axios');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/*
========================================
🔧 НАСТРОЙКА: В каких воронках и этапах менять ответственного
========================================

Формат:
pipeline_id: [status_id_1, status_id_2, ...]

Пример:
8704562: [76699590, 76699591]  // Воронка "Продажи", этапы "Успешный отклик", "Договор"

"*" в списке этапов = разрешить ВСЕ этапы в этой воронке
*/

const ALLOWED = {

    8704562: [70510502, 76699590]

};

/*
========================================
🌐 ПРОВЕРКА РАБОТОСПОСОБНОСТИ (для amoCRM и браузера)
========================================
*/

app.get('/webhook', (req, res) => {
    res.status(200).send('Webhook works');
});

app.get('/', (req, res) => {
    res.status(200).send('AmoCRM Bot is running');
});

/*
========================================
📥 ОСНОВНОЙ ОБРАБОТЧИК ВЕБХУКА
========================================
*/

app.post('/webhook', async (req, res) => {
    try {
        console.log('======================');
        console.log('📥 NEW WEBHOOK RECEIVED');
        console.log('======================');
        console.log('Event type:', req.body.leads?.status ? 'STATUS_CHANGE' : req.body.leads?.update ? 'UPDATE' : 'UNKNOWN');
        console.log(JSON.stringify(req.body, null, 2));

        /*
        🔑 КЛЮЧЕВОЙ МОМЕНТ:
        Слушаем ТОЛЬКО событие смены этапа (leads.status)
        НЕ слушаем leads.update (любое изменение), чтобы не реагировать на ручную смену ответственного
        */
        const lead = req.body.leads?.status?.[0];

        if (!lead) {
            console.log('⏭️ Not a status change event, ignoring');
            return res.sendStatus(200);
        }

        /*
        Извлекаем данные из вебхука
        */
        const leadId = Number(lead.id);
        const pipelineId = Number(lead.pipeline_id);
        const statusId = Number(lead.status_id);
        const oldStatusId = Number(lead.old_status_id);

        // Кто инициировал смену этапа (в событии status это надёжно)
        const userId = Number(
            lead.modified_user_id || 
            lead.modified_by || 
            lead.updated_by
        );

        const currentResponsible = Number(lead.responsible_user_id);

        console.log('📊 Deal data:');
        console.log('  • Lead ID:', leadId);
        console.log('  • Pipeline ID:', pipelineId);
        console.log('  • New Status ID:', statusId);
        console.log('  • Old Status ID:', oldStatusId);
        console.log('  • Triggered by User ID:', userId);
        console.log('  • Current Responsible ID:', currentResponsible);

        /*
        Проверка 1: Воронка разрешена в настройках?
        */
        if (!ALLOWED[pipelineId]) {
            console.log(`🚫 Pipeline ${pipelineId} not in ALLOWED config`);
            return res.sendStatus(200);
        }

        /*
        Проверка 2: Этап разрешён в этой воронке?
        */
        const allowedStatuses = ALLOWED[pipelineId];
        const isStatusAllowed = allowedStatuses.includes('*') || allowedStatuses.includes(statusId);

        if (!isStatusAllowed) {
            console.log(`🚫 Status ${statusId} not allowed in pipeline ${pipelineId}`);
            return res.sendStatus(200);
        }

        /*
        Проверка 3: Этап действительно изменился?
        (защищает от ложных срабатываний при других обновлениях)
        */
        if (oldStatusId && statusId === oldStatusId) {
            console.log('⏭️ Status did not change (old === new), ignoring');
            return res.sendStatus(200);
        }

        /*
        Проверка 4: Есть ли пользователь, который сдвинул этап?
        */
        if (!userId) {
            console.log('⏭️ No user ID found in webhook, ignoring');
            return res.sendStatus(200);
        }

        /*
        Проверка 5: Ответственный уже тот, кто сдвинул этап?
        (защита от зацикливания)
        */
        if (currentResponsible === userId) {
            console.log('⏭️ Responsible already correct, skipping');
            return res.sendStatus(200);
        }

        /*
        🎯 ВСЁ ОК — меняем ответственного
        */
        console.log(`✅ Updating responsible for deal ${leadId}: ${currentResponsible} → ${userId}`);

        const response = await axios.patch(
            `https://${process.env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
            {
                responsible_user_id: userId
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.AMO_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('✅ PATCH successful:', response.status);
        console.log('✅ Responsible updated successfully');
        return res.sendStatus(200);

    } catch (error) {
        console.log('❌ ERROR in webhook handler:');
        
        if (error.response) {
            // Ошибка от amoCRM API
            console.log('  • Status:', error.response.status);
            console.log('  • Data:', error.response.data);
        } else if (error.request) {
            // Запрос ушёл, но нет ответа
            console.log('  • No response received:', error.request);
        } else {
            // Другая ошибка
            console.log('  • Message:', error.message);
        }

        return res.sendStatus(500);
    }
});

/*
========================================
🚀 ЗАПУСК СЕРВЕРА
========================================
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/webhook`);
});
