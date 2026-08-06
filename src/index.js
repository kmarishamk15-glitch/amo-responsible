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
        let currentSoldPackage = null;

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

          if (field.field_id === 582431) {
            currentSoldPackage = field.values[0].enum_id;
          }
        }

        // ✅ ИСПРАВЛЕНИЕ: инициализируем ТЕКУЩИМИ значениями
        // Если тип не распознан — оставим как есть
        let targetCategory = currentCategory;
        let targetPackage = currentPackage;
        let soldPackage = null;

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
            975967, 975969, 975971, 976049, 976051, 976053, 976055
          ];

          const hardware = [
            975973, 975975, 975977, 975981, 975983, 980173
          ];

          const android = [
            975979, 976893
          ];

          const iphones = [
            975985, 975987, 975989, 975991,
            975993, 975995, 975997, 975999,
            976001, 976003, 976005, 976007,
            976009, 976011, 976013, 976015,
            976017, 976019, 976021, 976023,
            976025, 976027, 976029, 976031,
            976033, 976035, 976037, 976039,
            976041, 976043, 976045, 976047,
            976887, 976889, 976891,
            977077,
            978049, 978051, 978053, 978055,
            979183,
            981729, 981731, 981733, 981735,
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
          // ✅ Если модель не найдена (Прочее/неизвестная) —
          // targetCategory остаётся = currentCategory, ничего не меняется
        }
        // ✅ Если тип не распознан — targetCategory остаётся = currentCategory

        // =========================
        // ЛИД ПРОДАН ПО ПАКЕТУ
        // =========================
        if (
          lead.pipeline_id === 5276629 &&
          lead.status_id === 142
        ) {
          switch (currentPackage) {
            case 982607:
              soldPackage = 982609;
              break;

            case 982611:
              soldPackage = 982617;
              break;

            case 982613:
              soldPackage = 982615;
              break;

            case 982619:
              soldPackage = 982621;
              break;
          }
        }

        const needCategory =
          currentCategory !== targetCategory;

        const needPackage =
          targetPackage &&
          currentPackage !== targetPackage;

        const needSoldPackage =
          soldPackage &&
          currentSoldPackage !== soldPackage;

        if (
          !needCategory &&
          !needPackage &&
          !needSoldPackage
        ) {
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

        if (needSoldPackage) {
          custom_fields_values.push({
            field_id: 582431,
            values: [
              {
                enum_id: soldPackage
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

      if (!oldStatusId) {
        console.log("⏭️ No old status");
        return new Response("OK");
      }

      if (oldStatusId === newStatusId) {
        console.log("⏭️ Same status");
        return new Response("OK");
      }

      // ========================================
      // 🆕 БЛОК ДЕЙСТВИЙ ПРИ ЭТАПЕ 142 (Клиент купил)
      // ========================================
      if (pipelineId === 5276629 && newStatusId === 142) {
        
        // 1. ОЧИСТКА ПРИЧИНЫ ОТКАЗА
        console.log("🧹 Clearing reject reason (status 142)");
        const clearRes = await fetch(
          `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${env.AMO_TOKEN}`,
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify({
              custom_fields_values: [
                {
                  field_id: 573457,
                  values: null
                }
              ]
            })
          }
        );
        console.log("🧹 Clear reject reason status:", clearRes.status);

        // 2. АВТОМАТИЧЕСКАЯ УСТАНОВКА ТИПА ЗАПРОСА ПО КАТЕГОРИИ
        console.log("🔄 Checking category to set request type (status 142)");
        
        // Получаем актуальные поля сделки, так как в статус-вебхуке их может не быть
        const leadDetailsRes = await fetch(
          `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=custom_fields_values`,
          {
            headers: {
              Authorization: `Bearer ${env.AMO_TOKEN}`,
              Accept: "application/json"
            }
          }
        );

        if (leadDetailsRes.ok) {
          const leadDetails = await leadDetailsRes.json();
          const fields = leadDetails.custom_fields_values || [];
          
          let currentCategory = null;
          for (const field of fields) {
            if (field.field_id === 575965 && field.values?.length) {
              currentCategory = field.values[0].enum_id;
              break;
            }
          }

          let targetRequestType = null;

          if (currentCategory) {
            // Группируем категории, которые ведут к "Новая техника" (931809)
            if ([974775, 974777, 974779, 982623].includes(currentCategory)) {
              targetRequestType = 931809;
            } 
            // Б/У
            else if (currentCategory === 974781) {
              targetRequestType = 938373;
            } 
            // Трейд-ин
            else if (currentCategory === 974783) {
              targetRequestType = 957159;
            }
          }

          if (targetRequestType) {
            console.log(`✅ Setting request type to ${targetRequestType} based on category ${currentCategory}`);
            
            const updateTypeRes = await fetch(
              `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
              {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${env.AMO_TOKEN}`,
                  "Content-Type": "application/json",
                  Accept: "application/json"
                },
                body: JSON.stringify({
                  custom_fields_values: [
                    {
                      field_id: 466253,
                      values: [
                        {
                          enum_id: targetRequestType
                        }
                      ]
                    }
                  ]
                })
              }
            );

            console.log("🔄 Request type update status:", updateTypeRes.status);
            if (!updateTypeRes.ok) {
              console.log("❌ Request type update error:", await updateTypeRes.text());
            }
          } else {
            console.log("⏭️ Category not mapped or not found, skipping request type update.");
          }
        } else {
          console.log("❌ Cannot load lead details for category check");
        }
      }

      // ========================================
      // СТАРАЯ ЛОГИКА: СМЕНА ОТВЕТСТВЕННОГО (НЕ ТРОНУТА!)
      // ========================================

      const matchedRule = RULES.find(rule => {
        const fromMatches =
          rule.from.pipeline === oldPipelineId &&
          rule.from.status === oldStatusId;

        const toMatches =
          rule.to.pipeline === pipelineId &&
          rule.to.status.includes(newStatusId);

        return fromMatches && toMatches;
      });

      if (!matchedRule) {
        console.log("⏭️ No matching rule");
        return new Response("OK");
      }

      console.log("✅ RULE MATCHED!");

      if (!userId) {
        console.log("⏭️ No user ID");
        return new Response("OK");
      }

      if (currentResponsible === userId) {
        console.log("⏭️ Responsible already correct");
        return new Response("OK");
      }

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
      if (
        oldPipelineId === 5240944 &&
        oldStatusId === 47069740 &&
        pipelineId === 5276629 &&
        [
          47054479,
          53410254,
          53780378,
          53410258,
          142
        ].includes(newStatusId)
      ) {

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const timestamp = Math.floor(today.getTime() / 1000);

        console.log("📅 Updating created_at:", new Date(timestamp * 1000).toISOString());

        const dateRes = await fetch(
          `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${env.AMO_TOKEN}`,
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify({
              created_at: timestamp
            })
          }
        );

        console.log("📅 Date update:", dateRes.status);

        if (!dateRes.ok) {
          console.log("❌ Date update error:", await dateRes.text());
        }
      }

      return new Response("OK");

    } catch (e) {
      console.log("💥 CRASH:", e.stack || e.message);
      return new Response("ERROR", { status: 500 });
    }
  }
};
