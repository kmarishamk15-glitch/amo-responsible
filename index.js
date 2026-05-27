require('dotenv').config();

const express = require('express');
const axios = require('axios');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/*
========================================
НАСТРОЙКА ВОРОНОК И ЭТАПОВ
========================================

Формат:

pipeline_id: [
    status_id_1,
    status_id_2
]

Пример:

1111111: [
    2222222,
    3333333
]

Где:
1111111 — ID воронки
2222222 — ID этапа
3333333 — ID этапа
*/

const ALLOWED = {

    8704562: [70510502, 76699590]

};

/*
========================================
ПРОВЕРКА ДЛЯ AMOCRM
========================================
*/

app.get('/webhook', (req, res) => {

    res.status(200).send('Webhook works');

});

/*
========================================
ОСНОВНОЙ WEBHOOK
========================================
*/

app.post('/webhook', async (req, res) => {

    try {

        console.log('======================');
        console.log('NEW WEBHOOK');
        console.log('======================');

        console.log(JSON.stringify(req.body, null, 2));

        /*
        Получаем сделку
        */

        const lead =
            req.body.leads?.status?.[0] ||
            req.body.leads?.update?.[0];

        if (!lead) {

            console.log('No lead data');

            return res.sendStatus(200);
        }

        /*
        Получаем данные
        */

        const leadId = Number(lead.id);

        const pipelineId = Number(lead.pipeline_id);

        const statusId = Number(lead.status_id);

        const oldStatusId = Number(lead.old_status_id);

        const userId = Number(
            lead.modified_user_id ||
            lead.modified_by ||
            lead.updated_by ||
            lead.created_user_id ||
            lead.responsible_user_id
        );

        console.log('Lead ID:', leadId);
        console.log('Pipeline ID:', pipelineId);
        console.log('Status ID:', statusId);
        console.log('Old Status ID:', oldStatusId);
        console.log('User ID:', userId);

        /*
        Проверяем воронку
        */

        if (!ALLOWED[pipelineId]) {

            console.log('Pipeline not allowed');

            return res.sendStatus(200);
        }

        /*
        Проверяем этап
        */

        if (!ALLOWED[pipelineId].includes(statusId)) {

            console.log('Status not allowed');

            return res.sendStatus(200);
        }

        /*
        Проверяем, что этап реально изменился
        */

        if (statusId === oldStatusId) {

            console.log('Status did not change');

            return res.sendStatus(200);
        }

        /*
        Проверяем пользователя
        */

        if (!userId) {

            console.log('No user ID');

            return res.sendStatus(200);
        }

        /*
        Проверяем:
        ответственный уже такой?
        */

        if (Number(lead.responsible_user_id) === userId) {

            console.log('Responsible already correct');

            return res.sendStatus(200);
        }

        /*
        Меняем ответственного
        */

        console.log('Updating responsible user...');

        const response = await axios.patch(
            `https://${process.env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
            {
                responsible_user_id: userId
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.AMO_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('PATCH RESPONSE:');
        console.log(response.data);

        console.log('Responsible updated successfully');

        return res.sendStatus(200);

    } catch (error) {

        console.log('ERROR');

        if (error.response) {

            console.log(error.response.data);

        } else {

            console.log(error.message);

        }

        return res.sendStatus(500);
    }
});

/*
========================================
ГЛАВНАЯ СТРАНИЦА
========================================
*/

app.get('/', (req, res) => {

    res.send('AmoCRM webhook server works');

});

/*
========================================
ЗАПУСК СЕРВЕРА
========================================
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server started on port ${PORT}`);

});
