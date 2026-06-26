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

      // =========================
// КАТЕГОРИЯ ТОВАРА
// =========================

    if (params.has("leads[update][0][id]")) {
    
      console.log("📦 CATEGORY CHECK");
    
      const leadId = Number(params.get("leads[update][0][id]"));
    
      const leadRes = await fetch(
        `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=custom_fields_values`,
        {
          headers: {
            Authorization: `Bearer ${env.AMO_TOKEN}`,
            Accept: "application/json"
          }
        }
      );
    
      if (!leadRes.ok) {
        console.log("❌ Cannot load lead");
        return new Response("OK");
      }
    
      const lead = await leadRes.json();
    
      const fields = lead.custom_fields_values || [];
    
      let type = null;
      let model = null;
      let currentCategory = null;
      let currentPackage = null;
    
      for (const field of fields) {
    
        if (!field.values?.length) continue;
    
        if (field.field_id === 466253) {
          type = field.values[0].enum_id;
        }
    
        if (field.field_id === 577689) {
          model = field.values[0].enum_id;
        }
    
        if (field.field_id === 575965) {
          currentCategory = field.values[0].enum_id;
        }
    
        if (field.field_id === 582429) {
          currentPackage = field.values[0].enum_id;
        }
      }
    
      let targetCategory = null;
      let targetPackage = null;
    
      // Покупка БУ
    
      if (type === 938373) {
        targetCategory = 974781;
        targetPackage = 982611;
      }
    
      // Trade-In
    
      else if (type === 957159) {
        targetCategory = 974783;
        targetPackage = 982607;
      }
    
      // Новая техника
    
      else if (type === 931809) {
    
        const accessories = [
          975967,975969,975971,976049,976051,976053,976055
        ];
    
        const hardware = [
          975973,975975,975977,975981,975983,980173
        ];
    
        const android = [
          975979,976893
        ];
    
        const iphones = [
          975985,975987,975989,975991,
          975993,975995,975997,975999,
          976001,976003,976005,976007,
          976009,976011,976013,976015,
          976017,976019,976021,976023,
          976025,976027,976029,976031,
          976033,976035,976037,976039,
          976041,976043,976045,976047,
          976887,976889,976891,
          977077,
          978049,978051,978053,978055,
          979183,
          981729,981731,981733,981735,
          982255
        ];
    
        if (iphones.includes(model)) {
          targetCategory = 974775;
        }
    
        else if (accessories.includes(model)) {
          targetCategory = 974777;
          targetPackage = 982613;
        }
    
        else if (hardware.includes(model)) {
          targetCategory = 974779;
          targetPackage = 982619;
        }
    
        else if (android.includes(model)) {
          targetCategory = 982623;
        }
      }
    
      if (!targetCategory) {
        console.log("⏭️ Category not determined");
        return new Response("OK");
      }
    
      const needCategory =
        currentCategory !== targetCategory;
    
      const needPackage =
        targetPackage &&
        currentPackage !== targetPackage;
    
      if (!needCategory && !needPackage) {
        console.log("⏭️ Category already correct");
        return new Response("OK");
      }
    
      const custom_fields_values = [];
    
      if (needCategory) {
        custom_fields_values.push({
          field_id: 575965,
          values: [
            {
              enum_id: targetCategory
            }
          ]
        });
      }
    
      if (needPackage) {
        custom_fields_values.push({
          field_id: 582429,
          values: [
            {
              enum_id: targetPackage
            }
          ]
        });
      }
    
      const patchRes = await fetch(
        `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${env.AMO_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            custom_fields_values
          })
        }
      );
    
      console.log(
        "📦 Category update:",
        patchRes.status
      );
    
      return new Response("OK");
    }

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
            // =========================
      // ОБНОВЛЕНИЕ ДАТЫ СДЕЛКИ
      // =========================
      
      
      return new Response("OK");

    } catch (e) {
      console.log("💥 CRASH:", e.stack || e.message);
      return new Response("ERROR", { status: 500 });
    }
  }
};
