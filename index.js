require('dotenv').config();

const express = require('express');
const axios = require('axios');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/*
========================================
🔧 НАСТРОЙКА: Правила переходов
========================================

Формат правила:
{
    from: { 
        pipeline: ID_воронки_ОТКУДА, 
        status: ID_этапа_ИЛИ_МАССИВ_ЭТАПОВ 
    },
    to: { 
        pipeline: ID_воронки_КУДА, 
        status: ID_этапа_ИЛИ_МАССИВ_ЭТАПОВ 
    }
}

Поддерживается:
• Одно число: status: 76699590
• Массив чисел: status: [76699590, 76699591, 76699592]
• Звёздочка: status: "*" (любой этап)
*/

const TRANSITIONS = [
    // 🔹 Пример 1: Конкретный переход (один этап → один этап)
   // {
       // from: { pipeline: 8704562, status: 76699590 },
       // to:   { pipeline: 8704562, status: 76699591 }
    //},

    // 🔹 Пример 2: МНОГО этапов "ОТКУДА" → один этап "КУДА"
    // Сработает, если сделка ушла с ЛЮБОГО из указанных этапов
    {
        from: { 
            pipeline: 5240944, 
            status: 47069740// ← Массив этапов через запятую
        },
        to: { 
            pipeline: 5276629, 
            status: [ 47054479, 53410254, 53410254, 53780378, 53410258, 143] // ← Конкретный этап назначения
        }
    },

    // 🔹 Пример 3: Один этап "ОТКУДА" → МНОГО этапов "КУДА"
    // {
    //     from: { pipeline: 8704562, status: 76699590 },
    //     to:   { pipeline: 8704562, status: [76699591, 76699593, 76699599] }
    // },

    // 🔹 Пример 4: МНОГО → МНОГО
    // {
    //     from: { pipeline: 8704562, status: [100, 101, 102] },
    //     to:   { pipeline: 8704562, status: [200, 201, 202] }
    // },

    // 🔹 Пример 5: Звёздочка + массив
    // {
    //     from: { pipeline: 8704562, status: "*" },  // Любой этап
    //     to:   { pipeline: 8704562, status: [76699591, 76699592] }  // Только в эти
    // }
];

/*
========================================
🔍 Функция: Проверка значения (число, массив или "*")
========================================
*/
function matchesValue(configValue, actualValue) {
    // Звёздочка = подходит всё
    if (configValue === "*") return true;
    
    // Массив = проверяем, есть ли значение в списке
    if (Array.isArray(configValue)) return configValue.includes(actualValue);
    
    // Число = точное совпадение
    return configValue === actualValue;
}

/*
========================================
🔍 Функция: Проверка, соответствует ли переход правилу
========================================
*/
function isTransitionAllowed(oldPipeline, oldStatus, newPipeline, newStatus) {
    for (const rule of TRANSITIONS) {
        const fromPipelineMatch = matchesValue(rule.from.pipeline, oldPipeline);
        const fromStatusMatch = matchesValue(rule.from.status, oldStatus);
        const toPipelineMatch = matchesValue(rule.to.pipeline, newPipeline);
        const toStatusMatch = matchesValue(rule.to.status, newStatus);
        
        if (fromPipelineMatch && fromStatusMatch && toPipelineMatch && toStatusMatch) {
            return true; // Нашли подходящее правило
        }
    }
    return false; // Ни одно правило не подошло
}

/*
========================================
🌐 ПРОВЕРКА РАБОТОСПОСОБНОСТИ
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
        console.log('Event type:', req.body.leads?.status ? 'STATUS_CHANGE' : 'UNKNOWN');

        /*
        🔑 Слушаем ТОЛЬКО смену этапа
        */
        const lead = req.body.leads?.status?.[0];

        if (!lead) {
            console.log('⏭️ Not a status change event, ignoring');
            return res.sendStatus(200);
        }

        /*
        Извлекаем данные
        */
        const leadId = Number(lead.id);
        const oldPipelineId = Number(lead.pipeline_id);
        const oldStatusId = Number(lead.old_status_id);
        const newPipelineId = Number(lead.pipeline_id);
        const newStatusId = Number(lead.status_id);

        const userId = Number(
            lead.modified_user_id || 
            lead.modified_by || 
            lead.updated_by
        );

        const currentResponsible = Number(lead.responsible_user_id);

        console.log(`📊 Deal ${leadId}: ${oldPipelineId}:${oldStatusId} → ${newPipelineId}:${newStatusId} | By: ${userId}`);

        /*
        Проверка 1: Соответствует ли переход настроенным правилам?
        */
        if (!isTransitionAllowed(oldPipelineId, oldStatusId, newPipelineId, newStatusId)) {
            console.log('🚫 Transition does not match any rule');
            return res.sendStatus(200);
        }
        console.log('✅ Transition matches configured rule');

        /*
        Проверка 2: Этап действительно изменился?
        */
        if (!oldStatusId || newStatusId === oldStatusId) {
            console.log('⏭️ Status did not change, ignoring');
            return res.sendStatus(200);
        }

        /*
        Проверка 3: Есть ли пользователь?
        */
        if (!userId) {
            console.log('⏭️ No user ID found, ignoring');
            return res.sendStatus(200);
        }

        /*
        Проверка 4: Защита от зацикливания
        */
        if (currentResponsible === userId) {
            console.log('⏭️ Responsible already correct, skipping');
            return res.sendStatus(200);
        }

        /*
        🎯 ВСЁ ОК — меняем ответственного
        */
        console.log(`✅ Updating responsible: ${currentResponsible} → ${userId}`);

        await axios.patch(
            `https://${process.env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
            { responsible_user_id: userId },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.AMO_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('✅ Responsible updated successfully');
        return res.sendStatus(200);

    } catch (error) {
        console.log('❌ ERROR:', error.message);
        if (error.response?.data) console.log('API Error:', JSON.stringify(error.response.data));
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
});
