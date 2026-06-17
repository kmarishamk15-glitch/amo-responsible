const RULES = [
  {
    from: {
      pipeline: 5240944,
      status: 47069740
    },
    to: {
      pipeline: 5276629,
      status: [47054479, 53410254, 53780378, 53410258, 143, 142]
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    console.log("======================");
    console.log("🔥 WORKER START");
    console.log("URL:", request.url);
    console.log("METHOD:", request.method);
    console.log("======================");

    if (request.method === "GET") {
      return new Response("Webhook works");
    }

    if (request.method !== "POST") {
      return new Response("OK");
    }

    try {
      console.log("📥 WEBHOOK RECEIVED");

      if (!env?.AMO_DOMAIN || !env?.AMO_TOKEN) {
        console.log("❌ ENV NOT SET");
        return new Response("ENV ERROR");
      }

      const rawBody = await request.text();
      const params = new URLSearchParams(rawBody);

      // Пробуем оба формата: leads[status][0] и leads[update][0]
      let leadId, oldPipelineId, oldStatusId, pipelineId, statusId, responsibleId, modifiedUserId;

      // Формат 1: leads[status][0] (событие смены этапа)
      if (params.has("leads[status][0][id]")) {
        console.log("📋 Event type: STATUS CHANGE");
        leadId = Number(params.get("leads[status][0][id]"));
        oldPipelineId = Number(params.get("leads[status][0][old_pipeline_id]")) || 5240944;
        oldStatusId = Number(params.get("leads[status][0][old_status_id]"));
        pipelineId = Number(params.get("leads[status][0][pipeline_id]"));
        statusId = Number(params.get("leads[status][0][status_id]"));
        responsibleId = Number(params.get("leads[status][0][responsible_user_id]"));
        modifiedUserId = Number(params.get("leads[status][0][modified_user_id]"));
      }
      // Формат 2: leads[update][0] (событие обновления)
      else if (params.has("leads[update][0][id]")) {
        console.log("📋 Event type: UPDATE");
        leadId = Number(params.get("leads[update][0][id]"));
        oldPipelineId = Number(params.get("leads[update][0][old_pipeline_id]")) || 5240944;
        oldStatusId = Number(params.get("leads[update][0][old_status_id]"));
        pipelineId = Number(params.get("leads[update][0][pipeline_id]"));
        statusId = Number(params.get("leads[update][0][status_id]"));
        responsibleId = Number(params.get("leads[update][0][responsible_user_id]"));
        modifiedUserId = Number(params.get("leads[update][0][modified_user_id]"));
      } else {
        console.log("❌ NO LEAD DATA");
        return new Response("OK");
      }

      console.log("Lead ID:", leadId);
      console.log("Old Pipeline:", oldPipelineId);
      console.log("Old Status:", oldStatusId);
      console.log("New Pipeline:", pipelineId);
      console.log("New Status:", statusId);
      console.log("Modified User ID:", modifiedUserId);
      console.log("Responsible User ID:", responsibleId);

      if (!leadId) {
        console.log("❌ NO LEAD ID");
        return new Response("OK");
      }

      // Ищем правило: ИЗ старой воронки/статуса В новую воронку/статус
      const rule = RULES.find(r =>
        r.from.pipeline === oldPipelineId &&
        r.from.status === oldStatusId &&
        r.to.pipeline === pipelineId &&
        r.to.status.includes(statusId)
      );

      if (!rule) {
        console.log("⏭️ NO RULE MATCH");
        return new Response("OK");
      }

      console.log("✅ RULE MATCHED!");

      // Новый ответственный = тот, кто передвинул сделку
      const newResponsible = modifiedUserId;

      if (!newResponsible) {
        console.log("❌ NO MODIFIED USER ID");
        return new Response("OK");
      }

      if (responsibleId === newResponsible) {
        console.log("⏭️ ALREADY CORRECT");
        return new Response("OK");
      }

      console.log(`✅ UPDATE RESPONSIBLE: ${responsibleId} → ${newResponsible}`);

      const updateRes = await fetch(
        `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${env.AMO_TOKEN}`,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            responsible_user_id: newResponsible
          })
        }
      );

      if (!updateRes.ok) {
        console.log("❌ UPDATE ERROR:", await updateRes.text());
      } else {
        console.log("✅ SUCCESS UPDATE");
      }

      return new Response("OK");

    } catch (e) {
      console.log("💥 CRASH:", e.stack || e.message);
      return new Response("ERROR");
    }
  }
};
