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

    if (request.method === "GET") {
      return new Response("Webhook works");
    }

    if (request.method !== "POST") {
      return new Response("OK");
    }

    try {
      const rawBody = await request.text();
      const params = new URLSearchParams(rawBody);

      console.log("======================");
      console.log("📥 WEBHOOK RECEIVED");
      console.log("Has leads[status][0][id]:", params.has("leads[status][0][id]"));
      console.log("Has leads[update][0][id]:", params.has("leads[update][0][id]"));
      console.log("======================");

      // 🔴 ВАЖНО: Работаем ТОЛЬКО с событиями смены этапа
      // leads[status][0] = смена этапа
      // leads[update][0] = обновление полей (игнорируем!)
      
      if (!params.has("leads[status][0][id]")) {
        console.log("⏭️ NOT A STATUS CHANGE - IGNORING (this is manual update)");
        return new Response("OK");
      }

      const leadId = Number(params.get("leads[status][0][id]"));
      const oldPipelineId = Number(params.get("leads[status][0][old_pipeline_id]")) || 5240944;
      const oldStatusId = Number(params.get("leads[status][0][old_status_id]"));
      const newPipelineId = Number(params.get("leads[status][0][pipeline_id]"));
      const newStatusId = Number(params.get("leads[status][0][status_id]"));
      const responsibleId = Number(params.get("leads[status][0][responsible_user_id]"));
      const modifiedUserId = Number(params.get("leads[status][0][modified_user_id]"));

      console.log("📊 LEAD DATA:");
      console.log("Lead ID:", leadId);
      console.log("FROM: Pipeline", oldPipelineId, "Status", oldStatusId);
      console.log("TO: Pipeline", newPipelineId, "Status", newStatusId);
      console.log("Modified by:", modifiedUserId);
      console.log("Current responsible:", responsibleId);

      // Проверяем, что этап реально изменился
      if (!oldStatusId || oldStatusId === newStatusId) {
        console.log("⏭️ Status did not change - ignoring");
        return new Response("OK");
      }

      // Ищем подходящее правило
      const matchedRule = RULES.find(rule => {
        const fromMatches = 
          rule.from.pipeline === oldPipelineId && 
          rule.from.status === oldStatusId;
        
        const toMatches = 
          rule.to.pipeline === newPipelineId && 
          rule.to.status.includes(newStatusId);

        return fromMatches && toMatches;
      });

      if (!matchedRule) {
        console.log("⏭️ No matching rule - ignoring");
        console.log("Checked FROM:", oldPipelineId, oldStatusId);
        console.log("Checked TO:", newPipelineId, newStatusId);
        return new Response("OK");
      }

      console.log("✅ RULE MATCHED!");

      // Если modified_user_id = 0 или отсутствует, не меняем
      if (!modifiedUserId || modifiedUserId === 0) {
        console.log("⏭️ No modified user - ignoring (manual change allowed)");
        return new Response("OK");
      }

      // Если ответственный уже тот, кто передвинул - не меняем
      if (responsibleId === modifiedUserId) {
        console.log("⏭️ Responsible already correct");
        return new Response("OK");
      }

      // МЕНЯЕМ ответственного на того, кто передвинул сделку
      console.log(`🔄 CHANGE RESPONSIBLE: ${responsibleId} → ${modifiedUserId}`);

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
            responsible_user_id: modifiedUserId
          })
        }
      );

      if (!updateRes.ok) {
        console.log("❌ UPDATE ERROR:", await updateRes.text());
        return new Response("ERROR", { status: 500 });
      }

      console.log("✅ SUCCESS! Responsible updated");
      return new Response("OK");

    } catch (e) {
      console.log("💥 CRASH:", e.stack || e.message);
      return new Response("ERROR", { status: 500 });
    }
  }
};
