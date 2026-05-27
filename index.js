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

СЮДА вставляем ID воронок и этапов,
где должна работать смена ответственного

Пример:

{
   pipeline_id: [status_id_1, status_id_2]
}

*/

const ALLOWED = {

    8704562: [70510502, 76699590]

};

app.post('/webhook', async (req, res) => {

    try {

        console.log(JSON.stringify(req.body, null, 2));

        const lead = req.body.leads?.status?.[0];

        if (!lead) {
            return res.sendStatus(200);
        }

        const leadId = lead.id;

        const pipelineId = Number(lead.pipeline_id);

        const statusId = Number(lead.status_id);

        const userId = lead.modified_user_id;

        console.log('Lead:', leadId);
        console.log('Pipeline:', pipelineId);
        console.log('Status:', statusId);
        console.log('User:', userId);

        // Проверяем разрешенные воронки
        if (!ALLOWED[pipelineId]) {

            console.log('Pipeline not allowed');

            return res.sendStatus(200);
        }

        // Проверяем разрешенные этапы
        if (!ALLOWED[pipelineId].includes(statusId)) {

            console.log('Status not allowed');

            return res.sendStatus(200);
        }

        // Меняем ответственного
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

        res.sendStatus(200);

    } catch (error) {

        console.error(
            error.response?.data || error.message
        );

        res.sendStatus(500);
    }
});

app.get('/', (req, res) => {

    res.send('Webhook server works');

});

app.listen(process.env.PORT || 3000, () => {

    console.log('Server started');

});
