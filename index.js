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
*/

const ALLOWED = {

    8704562: [70510502, 76699590]

};

/*
========================================
АНТИ-ЗАЦИКЛИВАНИЕ
========================================

Храним сделки, которые недавно обработали
*/

const recentUpdates = new Map();

/*
========================================
GET /webhook
========================================
*/

app.get('/webhook', (req, res) => {

    res.status(200).send('Webhook works');

});

/*
========================================
POST /webhook
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

            console.log('No lead');

            return res.sendStatus(200);
        }

        /*
        Данные
        */

        const leadId = Number(lead.id);

        const pipelineId = Number(lead.pipeline_id);

        const statusId = Number(lead.status_id);

        const userId = Number(
            lead.modified_user_id ||
            lead.modified_by ||
            lead.updated_by ||
            lead.created_user_id
        );

        console.log('Lead ID:', leadId);
        console.log('Pipeline ID:', pipelineId);
        console.log('Status ID:', statusId);
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
        Проверяем пользователя
        */

        if (!userId) {

            console.log('No user');

            return res.sendStatus(200);
        }

        /*
        Проверяем зацикливание
        */

        const lastUpdate = recentUpdates.get(leadId);

        if (lastUpdate && Date.now() - lastUpdate < 5000) {

            console.log('Loop prevented');

            return res.sendStatus(200);
        }

        /*
        Запоминаем обработку
        */

        recentUpdates.set(leadId, Date.now());

        /*
        Меняем ответственного
        */

        console.log('Updating responsible...');

        await axios.patch(
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

        console.log('Responsible updated');

        /*
        Удаляем запись через 10 секунд
        */

        setTimeout(() => {

            recentUpdates.delete(leadId);

        }, 10000);

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
ЗАПУСК
========================================
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server started on port ${PORT}`);

});
