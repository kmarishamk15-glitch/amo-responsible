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
  }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    console.log("🔥 ENTRY HIT", request.method, url.pathname);

    // только webhook
    if (request.method !== "POST" || !url.pathname.startsWith("/webhook")) {
      return new Response("OK");
    }

    try {
      const rawBody = await request.text();
      const params = new URLSearchParams(rawBody);

      const leadId = Number(params.get("leads[update][0][id]"));

      console.log("📥 Lead ID:", leadId);

      if (!leadId) {
        console.log("❌ no leadId");
        return new Response("OK");
      }

      // 🔥 ВСЕГДА БЕРЁМ АКТУАЛЬНЫЕ ДАННЫЕ ИЗ AMO
      const leadRes = await fetch(
        `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
        {
          headers: {
            Authorization: `Bearer ${env.AMO_TOKEN}`,
            Accept: "application/json"
          }
        }
      );

      if (!leadRes.ok) {
        console.log("❌ Amo API error:", await leadRes.text());
        return new Response("OK");
      }

      const lead = await leadRes.json();

      const pipelineId = lead.pipeline_id;
      const statusId = lead.status_id;
      const responsibleId = lead.responsible_user_id;

      console.log("📊 Lead data:", {
        pipelineId,
        statusId,
        responsibleId
      });

      // ищем правило
      const rule = RULES.find(r =>
        r.from.pipeline === pipelineId &&
        r.from.status === statusId &&
        r.to.pipeline === pipelineId // если переход внутри или между — расширим позже
      );

      if (!rule) {
        console.log("⏭️ no rule match");
        return new Response("OK");
      }

      // выбираем нового ответственного (пример: берём первого из списка)
      const newResponsible = rule.to.status[0];

      if (responsibleId === newResponsible) {
        console.log("⏭️ already correct responsible");
        return new Response("OK");
      }

      console.log(`✅ UPDATE responsible ${responsibleId} → ${newResponsible}`);

      const updateRes = await fetch(
        `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${env.AMO_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            responsible_user_id: newResponsible
          })
        }
      );

      if (!updateRes.ok) {
        console.log("❌ update error:", await updateRes.text());
      } else {
        console.log("✅ updated successfully");
      }

      return new Response("OK");
    } catch (e) {
      console.log("❌ ERROR:", e.message);
      return new Response("ERROR", { status: 500 });
    }
  }
};
