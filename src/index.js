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

      // 🔴 ВАЖНО: Работаем ТОЛЬКО с событиями смены этапа
      // leads[status][0] = смена этапа (как в старом коде)
      // leads[update][0] = обновление полей (ИГНОРИРУЕМ!)
      
      if (!params.has("leads[status][0][id]")) {
        console.log("⏭️ Not a status event - IGNORING");
        return new Response("OK");
      }

      console.log("📋 Event type: STATUS CHANGE");

      // Данные сделки (как в старом коде)
      const leadId = Number(params.get("leads[status][0][id]"));
      const pipelineId = Number(params.get("leads[status][0][pipeline_id]"));
      const newStatusId = Number(params.get("leads[status][0][status_id]"));
      const oldStatusId = Number(params.get("leads[status][0][old_status_id]"));
      const oldPipelineId = Number(params.get("leads[status][0][old_pipeline_id]")) || 5240944;
      
      const userId = Number(
        params.get("leads[status][0][modified_user_id]") ||
        params.get("leads[status][0][modified_by]") ||
        params.get("leads[status][0][updated_by]")
      );
      
      const currentResponsible = Number(params.get("leads[status][0][responsible_user_id]"));

      console.log("Lead ID:", leadId);
      console.log("Old Pipeline:", oldPipelineId);
      console.log("Old Status:", oldStatusId);
      console.log("New Pipeline:", pipelineId);
      console.log("New Status:", newStatusId);
      console.log("User ID:", userId);
      console.log("Current Responsible:", currentResponsible);

      // Проверяем: этап реально изменился?
      if (!oldStatusId) {
        console.log("⏭️ No old status");
        return new Response("OK");
      }

      if (oldStatusId === newStatusId) {
        console.log("⏭️ Same status");
        return new Response("OK");
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

      // Нет подходящего правила
      if (!matchedRule) {
        console.log("⏭️ No matching rule");
        return new Response("OK");
      }

      console.log("✅ RULE MATCHED!");

      // Нет пользователя?
      if (!userId) {
        console.log("⏭️ No user ID");
        return new Response("OK");
      }

      // Уже нужный ответственный?
      if (currentResponsible === userId) {
        console.log("⏭️ Responsible already correct");
        return new Response("OK");
      }

      // Меняем ответственного
      console.log(`✅ Updating responsible: ${currentResponsible} → ${userId}`);

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
            responsible_user_id: userId
          })
        }
      );

      if (!updateRes.ok) {
        console.log("❌ UPDATE ERROR:", await updateRes.text());
        return new Response("ERROR", { status: 500 });
      }

      console.log("✅ Responsible updated");
      return new Response("OK");

    } catch (e) {
      console.log("💥 CRASH:", e.stack || e.message);
      return new Response("ERROR", { status: 500 });
    }
  }
};
