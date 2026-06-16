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

    console.log("======================");
    console.log("🔥 WORKER START");
    console.log("URL:", request.url);
    console.log("METHOD:", request.method);
    console.log("PATH:", url.pathname);
    console.log("======================");

    // health check
    if (request.method === "GET") {
      return new Response("Webhook works");
    }

    if (request.method !== "POST") {
      return new Response("OK");
    }

    try {
      console.log("📥 WEBHOOK RECEIVED");

      // 🔴 ENV CHECK (ВАЖНО)
      console.log("ENV:", {
        AMO_DOMAIN: env?.AMO_DOMAIN,
        AMO_TOKEN: env?.AMO_TOKEN ? "SET" : "NOT SET"
      });

      if (!env?.AMO_DOMAIN || !env?.AMO_TOKEN) {
        console.log("❌ ENV NOT SET");
        return new Response("ENV ERROR");
      }

      const rawBody = await request.text();
      console.log("RAW BODY:", rawBody);

      const params = new URLSearchParams(rawBody);

      const leadId = Number(params.get("leads[update][0][id]"));

      console.log("Lead ID:", leadId);

      if (!leadId) {
        console.log("❌ NO LEAD ID");
        return new Response("OK");
      }

      // 🔥 получаем актуальные данные из amoCRM
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
        console.log("❌ AMO API ERROR:", await leadRes.text());
        return new Response("OK");
      }

      const lead = await leadRes.json();

      const pipelineId = lead.pipeline_id;
      const statusId = lead.status_id;
      const responsibleId = lead.responsible_user_id;

      console.log("📊 LEAD DATA:", {
        pipelineId,
        statusId,
        responsibleId
      });

      // ищем правило
      const rule = RULES.find(r =>
        r.from.pipeline === pipelineId &&
        r.from.status === statusId
      );

      if (!rule) {
        console.log("⏭️ NO RULE MATCH");
        return new Response("OK");
      }

      const newResponsible = rule.to.status[0];

      if (responsibleId === newResponsible) {
        console.log("⏭️ ALREADY CORRECT");
        return new Response("OK");
      }

      console.log(`✅ UPDATE: ${responsibleId} → ${newResponsible}`);

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
