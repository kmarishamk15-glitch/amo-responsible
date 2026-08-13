const RULES = [
  {
    from: { pipeline: 5240944, status: 47069740 },
    to: { pipeline: 5276629, status: [47054479, 53410254, 53780378, 53410258, 143, 142] }
  },
  {
    from: { pipeline: 5240944, status: 47069740 },
    to: { pipeline: 5240944, status: [143] }
  }
];

const RESPONSIBLE_USER_NAMES = {
  8789956: "Даниил Бровкин", 8517166: "Михаил Кострюков", 12669626: "Александра Абрамова",
  12280618: "Анна Зернова", 13116242: "Максим Булыков", 13192790: "Мария Смирнова",
  13284018: "Марк Артыков", 13465774: "Илья Буланов", 13249770: "Павел Николаев",
  13347810: "Светлана Маливанова", 13536034: "Артем Сяднев", 7561366: "Ирина Яровицина",
  14030758: "Александра Наумова", 14075570: "Ярослава Демина"
};

const CORRECTION_FIELD_NAMES = {
  983501: "Александра Абрамова", 983503: "Анна Зернова", 983505: "Максим Булыков",
  983507: "Мария Смирнова", 983509: "Марк Артыков", 983511: "Илья Буланов",
  983513: "Павел Николаев", 983515: "Светлана Маливанова", 983517: "Артем Сяднев",
  983519: "Ирина Яровицина", 983521: "Александра Наумова", 983523: "Ярослава Демина",
  983525: "Даниил Бровкин", 983527: "Михаил Кострюков"
};

export default {
  async fetch(request, env, ctx) {
    console.log("======================");
    console.log("🔥 WORKER START");
    console.log("URL:", request.url);
    console.log("METHOD:", request.method);
    console.log("======================");

    if (request.method === "GET") return new Response("Webhook works");
    if (request.method !== "POST") return new Response("OK");

    try {
      console.log("📥 WEBHOOK RECEIVED");

      if (!env?.AMO_DOMAIN || !env?.AMO_TOKEN) {
        console.log("❌ ENV NOT SET");
        return new Response("ENV ERROR");
      }

      const rawBody = await request.text();
      const params = new URLSearchParams(rawBody);

      // =========================
      // 1. КАТЕГОРИЯ ТОВАРА (Обновление полей)
      // =========================
      if (params.has("leads[update][0][id]")) {
        console.log("📦 CATEGORY CHECK");
        
        const leadId = Number(params.get("leads[update][0][id]"));
        const leadRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=custom_fields_values`, {
          headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" }
        });
        if (!leadRes.ok) {
          console.log("❌ Cannot load lead");
          return new Response("OK");
        }

        const lead = await leadRes.json();
        const fields = lead.custom_fields_values || [];

        let type = null, model = null, currentCategory = null, currentPackage = null, currentSoldPackage = null;

        for (const field of fields) {
          if (!field.values?.length) continue;
          if (field.field_id === 466253) type = field.values[0].enum_id;
          if (field.field_id === 577689) model = field.values[0].enum_id;
          if (field.field_id === 575965) currentCategory = field.values[0].enum_id;
          if (field.field_id === 582429) currentPackage = field.values[0].enum_id;
          if (field.field_id === 582431) currentSoldPackage = field.values[0].enum_id;
        }

        let targetCategory = currentCategory;
        let targetPackage = currentPackage;
        let soldPackage = null;

        if (type === 938373) { targetCategory = 974781; targetPackage = 982611; } 
        else if (type === 957159) { targetCategory = 974783; targetPackage = 982607; } 
        else if (type === 931809) {
          const accessories = [975967, 975969, 975971, 976049, 976051, 976053, 976055, 983737, 983741, 983743];
          const hardware = [975973, 975975, 975977, 975981, 975983, 980173, 983739];
          const android = [975979, 976893];
          const iphones = [975985, 975987, 975989, 975991, 975993, 975995, 975997, 975999, 976001, 976003, 976005, 976007, 976009, 976011, 976013, 976015, 976017, 976019, 976021, 976023, 976025, 976027, 976029, 976031, 976033, 976035, 976037, 976039, 976041, 976043, 976045, 976047, 976887, 976889, 976891, 977077, 978049, 978051, 978053, 978055, 979183, 981729, 981731, 981733, 981735, 982255];

          if (iphones.includes(model)) targetCategory = 974775;
          else if (accessories.includes(model)) { targetCategory = 974777; targetPackage = 982613; }
          else if (hardware.includes(model)) { targetCategory = 974779; targetPackage = 982619; }
          else if (android.includes(model)) targetCategory = 982623;
        }

        if (lead.pipeline_id === 5276629 && lead.status_id === 142) {
          if (currentPackage === 982607) soldPackage = 982609;
          else if (currentPackage === 982611) soldPackage = 982617;
          else if (currentPackage === 982613) soldPackage = 982615;
          else if (currentPackage === 982619) soldPackage = 982621;
        }

        const needCategory = currentCategory !== targetCategory;
        const needPackage = targetPackage && currentPackage !== targetPackage;
        const needSoldPackage = soldPackage && currentSoldPackage !== soldPackage;

        if (!needCategory && !needPackage && !needSoldPackage) {
          console.log("⏭️ Category already correct");
          return new Response("OK");
        }

        const custom_fields_values = [];
        if (needCategory) custom_fields_values.push({ field_id: 575965, values: [{ enum_id: targetCategory }] });
        if (needPackage) custom_fields_values.push({ field_id: 582429, values: [{ enum_id: targetPackage }] });
        if (needSoldPackage) custom_fields_values.push({ field_id: 582431, values: [{ enum_id: soldPackage }] });

        const patchRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ custom_fields_values })
        });

        console.log("📦 Category update:", patchRes.status);
        return new Response("OK");
      }

      // =========================
      // 2. СМЕНА СТАТУСА (Оптимизированный блок)
      // =========================
      if (!params.has("leads[status][0][id]")) {
        console.log("⏭️ Not a status event - IGNORING");
        return new Response("OK");
      }

      console.log("📋 Event type: STATUS CHANGE");

      const leadId = Number(params.get("leads[status][0][id]"));
      const pipelineId = Number(params.get("leads[status][0][pipeline_id]"));
      const newStatusId = Number(params.get("leads[status][0][status_id]"));
      const oldStatusId = Number(params.get("leads[status][0][old_status_id]"));
      const oldPipelineId = Number(params.get("leads[status][0][old_pipeline_id]")) || 5240944;
      const userId = Number(params.get("leads[status][0][modified_user_id]") || params.get("leads[status][0][modified_by]") || params.get("leads[status][0][updated_by]"));
      const webhookResponsible = Number(params.get("leads[status][0][responsible_user_id]"));

      console.log("Lead ID:", leadId);
      console.log("Old Pipeline:", oldPipelineId, "Old Status:", oldStatusId);
      console.log("New Pipeline:", pipelineId, "New Status:", newStatusId);

      if (!oldStatusId) return new Response("OK");
      if (oldStatusId === newStatusId) return new Response("OK");

      // 🟢 ДЕЛАЕМ ТОЛЬКО ОДИН GET-ЗАПРОС ДЛЯ ВСЕХ ПРОВЕРОК
      console.log("🔎 Fetching lead details (single GET)");
      const leadDetailsRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=custom_fields_values`, {
        headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" }
      });
      if (!leadDetailsRes.ok) {
        console.log("❌ Cannot load lead details");
        return new Response("OK");
      }

      const leadData = await leadDetailsRes.json();
      const fields = leadData.custom_fields_values || [];
      const actualResponsibleId = leadData.responsible_user_id;

      let currentCategory = null;
      let currentCorrectionId = null;
      let currentCorrectionName = null;

      for (const field of fields) {
        if (field.field_id === 575965 && field.values?.length) {
          currentCategory = field.values[0].enum_id;
        }
        if (field.field_id === 582983 && field.values?.length) {
          currentCorrectionId = field.values[0].enum_id || field.values[0].value;
          currentCorrectionName = CORRECTION_FIELD_NAMES[currentCorrectionId] || field.values[0].value;
        }
      }

      // 📦 СОБИРАЕМ ЕДИНЫЙ ОБЪЕКТ ДЛЯ PATCH-ЗАПРОСА
      const patchPayload = {};
      const customFieldsUpdates = [];

      // --- БЛОК 142 (Купил) ---
      if (pipelineId === 5276629 && newStatusId === 142) {
        console.log("🧹 Processing status 142 (Купил)");
        customFieldsUpdates.push({ field_id: 573457, values: null }); // Очистка причины отказа

        let targetRequestType = null;
        if (currentCategory) {
          if ([974775, 974777, 974779, 982623].includes(currentCategory)) targetRequestType = 931809;
          else if (currentCategory === 974781) targetRequestType = 938373;
          else if (currentCategory === 974783) targetRequestType = 957159;
        }
        if (targetRequestType) {
          console.log(`✅ Setting request type to ${targetRequestType}`);
          customFieldsUpdates.push({ field_id: 466253, values: [{ enum_id: targetRequestType }] });
        }
      }

      // --- БЛОК СМЕНЫ ОТВЕТСТВЕННОГО ---
      const matchedRule = RULES.find(rule => 
        rule.from.pipeline === oldPipelineId && rule.from.status === oldStatusId &&
        rule.to.pipeline === pipelineId && rule.to.status.includes(newStatusId)
      );

      if (matchedRule && userId && actualResponsibleId !== userId) {
        console.log(`✅ RULE MATCHED! Updating responsible: ${actualResponsibleId} → ${userId}`);
        patchPayload.responsible_user_id = userId;
      } else if (!matchedRule) {
        console.log("⏭️ No matching rule for responsible update");
      }

      // --- БЛОК ОБНОВЛЕНИЯ ДАТЫ ---
      if (oldPipelineId === 5240944 && oldStatusId === 47069740 && pipelineId === 5276629 &&
          [47054479, 53410254, 53780378, 53410258, 142].includes(newStatusId)) {
        const today = new Date(new Date().setHours(0,0,0,0));
        patchPayload.created_at = Math.floor(today.getTime() / 1000);
        console.log("📅 Updating created_at to today");
      }

      // --- БЛОК ПРОВЕРКИ ПОЛЯ КОРРЕКТИРОВКА (ПО ФИО) ---
      const responsibleName = RESPONSIBLE_USER_NAMES[actualResponsibleId];
      if (responsibleName && currentCorrectionName && currentCorrectionName === responsibleName && currentCorrectionId !== 983499) {
        console.log(`✅ Names match (${responsibleName}). Setting correction field to 'Не требуется' (983499)`);
        customFieldsUpdates.push({ field_id: 582983, values: [{ enum_id: 983499 }] });
      } else if (responsibleName && currentCorrectionName) {
        console.log(`⏭️ Names do not match: responsible=${responsibleName}, correction=${currentCorrectionName}`);
      } else {
        console.log(`⏭️ Skipping correction field check (no name in mapping or empty)`);
      }

      // 🚀 ОТПРАВЛЯЕМ ОДИН ОБЪЕДИНЕННЫЙ PATCH-ЗАПРОС (ЕСЛИ ЕСТЬ ЧТО МЕНЯТЬ)
      if (Object.keys(patchPayload).length > 0 || customFieldsUpdates.length > 0) {
        if (customFieldsUpdates.length > 0) {
          patchPayload.custom_fields_values = customFieldsUpdates;
        }

        console.log("🚀 Sending COMBINED PATCH:", JSON.stringify(patchPayload, null, 2));

        const updateRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`, {
          method: "PATCH",
          headers: { 
            Authorization: `Bearer ${env.AMO_TOKEN}`, 
            "Content-Type": "application/json", 
            Accept: "application/json" 
          },
          body: JSON.stringify(patchPayload)
        });

        if (!updateRes.ok) {
          const errorText = await updateRes.text();
          console.log("❌ COMBINED PATCH ERROR:", errorText);
          return new Response("ERROR", { status: 500 });
        } else {
          console.log("✅ COMBINED PATCH SUCCESS");
        }
      } else {
        console.log("⏭️ No updates needed for this status change");
      }

      return new Response("OK");

    } catch (e) {
      console.log("💥 CRASH:", e.stack || e.message);
      return new Response("ERROR", { status: 500 });
    }
  }
};
