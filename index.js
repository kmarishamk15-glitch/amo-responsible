app.post('/webhook', async (req, res) => {
    try {
        console.log('📥 NEW WEBHOOK');
        console.log(JSON.stringify(req.body, null, 2));

        const lead = req.body.leads?.status?.[0];

        if (!lead) {
            console.log('⏭️ Not a status event');
            return res.sendStatus(200);
        }

        const leadId = Number(lead.id);
        const pipelineId = Number(lead.pipeline_id);
        const newStatusId = Number(lead.status_id);
        const oldStatusId = Number(lead.old_status_id);

        const oldPipelineId = Number(lead.old_pipeline_id || pipelineId);

        const userId = Number(
            lead.modified_user_id ||
            lead.modified_by ||
            lead.updated_by
        );

        const currentResponsible = Number(lead.responsible_user_id);

        console.log({
            leadId,
            oldPipelineId,
            oldStatusId,
            pipelineId,
            newStatusId,
            userId,
            currentResponsible
        });

        if (!oldStatusId || oldStatusId === newStatusId) {
            console.log('⏭️ No real status change');
            return res.sendStatus(200);
        }

        const matchedRule = RULES.find(rule => {
            const fromOk =
                rule.from.pipeline === oldPipelineId &&
                rule.from.status === oldStatusId;

            const toOk =
                rule.to.pipeline === pipelineId &&
                rule.to.status.includes(newStatusId);

            return fromOk && toOk;
        });

        if (!matchedRule) {
            console.log('⏭️ No matching rule');
            return res.sendStatus(200);
        }

        if (!userId) {
            console.log('⏭️ No user ID');
            return res.sendStatus(200);
        }

        if (currentResponsible === userId) {
            console.log('⏭️ Already responsible');
            return res.sendStatus(200);
        }

        console.log(`✅ Changing responsible: ${currentResponsible} → ${userId}`);

        await axios.patch(
            `https://${process.env.AMO_SUBDOMAIN}/api/v4/leads`,
            [
                {
                    id: leadId,
                    responsible_user_id: userId
                }
            ],
            {
                headers: {
                    Authorization: `Bearer ${process.env.AMO_TOKEN}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            }
        );

        console.log('✅ Updated successfully');

        return res.sendStatus(200);

    } catch (error) {
        console.log('❌ ERROR');

        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else {
            console.log(error.message);
        }

        return res.sendStatus(500);
    }
});
