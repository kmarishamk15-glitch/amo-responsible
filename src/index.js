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
  13349558: "Светлана Маливанова", 13536034: "Артем Сяднев", 7561366: "Ирина Яровицина",
  14030758: "Александра Наумова", 14075570: "Ярослава Демина",
  14212262: "Александра Потехина"
};

const CORRECTION_FIELD_NAMES = {
  983501: "Александра Абрамова", 983503: "Анна Зернова", 983505: "Максим Булыков",
  983507: "Мария Смирнова", 983509: "Марк Артыков", 983511: "Илья Буланов",
  983513: "Павел Николаев", 983515: "Светлана Маливанова", 983517: "Артем Сяднев",
  983519: "Ирина Яровицина", 983521: "Александра Наумова", 983523: "Ярослава Демина",
  983525: "Даниил Бровкин", 983527: "Михаил Кострюков",
  983923: "Александра Потехина"
};

// ===== БЮДЖЕТ =====
const DISCOUNT_NONE = 972987;
const AIRPODS_MAX = 975969;
const BUDGET_IPHONE_BY_PACKAGE = { 982597: 1000, 982599: 2000, 982601: 2500 };
const BUDGET_AKSY = {
  972987: 1000, 981917: 700, 981919: 450, 972989: 450,
  976369: 950, 976371: 950, 976373: 850, 976375: 450
};
const BUDGET_HARDWARE = {
  972987: 2300, 981917: 1610, 981919: 1035, 972989: 1035,
  976369: 2185, 976371: 2185, 976373: 1955, 976375: 1035
};
const BUDGET_BU = {
  972987: 2500, 981917: 1750, 981919: 1125, 972989: 1125,
  976369: 2375, 976371: 2375, 976373: 2125, 976375: 1125
};

const ACCESSORIES = [975967, 975969, 975971, 976049, 976051, 976053, 976055, 983737, 983741, 983743];
const HARDWARE_MODELS = [975973, 975975, 975977, 975981, 975983, 980173, 983739];
const ANDROID_MODELS = [975979, 976893];
const IPHONES = [975985, 975987, 975989, 975991, 975993, 975995, 975997, 975999, 976001, 976003, 976005, 976007, 976009, 976011, 976013, 976015, 976017, 976019, 976021, 976023, 976025, 976027, 976029, 976031, 976033, 976035, 976037, 976039, 976041, 976043, 976045, 976047, 976887, 976889, 976891, 977077, 978049, 978051, 978053, 978055, 979183, 981729, 981731, 981733, 981735, 982255];

// ===== ЛОГИКА ДУБЛЕЙ =====
const TARGET_PIPELINE_OLD = 5276629;
const TARGET_STATUS_OLD = 143;
const FIELD_REQUEST_TYPE = 466253;
const ALLOWED_OLD_TYPES = [931809, 938373, 957159];
const NEW_TYPE_VALUE = 931811;

// ===== СПОСОБ ОПЛАТЫ ИЗ ПРИМЕЧАНИЯ =====
const FIELD_PAYMENT_METHOD = 574905;
const PAYMENT_METHOD_MAP = {
  'наличн': 973115,
  'карт': 977839,
  'кредит': 973117,
  'рассрочк': 975917,
  'долям': 977071
};

async function safeJsonParse(response, context = "API") {
  try {
    const text = await response.text();
    if (!text || text.trim() === "") {
      console.log(`️ [${context}] Пустой ответ от API (HTTP статус: ${response.status})`);
      return null;
    }
    return JSON.parse(text);
  } catch (e) {
    console.log(`❌ [${context}] Ошибка парсинга JSON. Статус: ${response.status}. Ответ: ${String(text).substring(0, 150)}...`);
    return null;
  }
}

function deriveCategory(type, model, currentCategory) {
  let target = currentCategory;
  if (type === 938373) target = 974781;
  else if (type === 957159) target = 974783;
  else if (type === 931809) {
    if (IPHONES.includes(model)) target = 974775;
    else if (ACCESSORIES.includes(model)) target = 974777;
    else if (HARDWARE_MODELS.includes(model)) target = 974779;
    else if (ANDROID_MODELS.includes(model)) target = 982623;
  }
  return target;
}

function derivePackage(type, model, currentPackage) {
  let target = currentPackage;
  if (type === 938373) target = 982611;
  else if (type === 957159) target = 982607;
  else if (type === 931809) {
    if (ACCESSORIES.includes(model)) target = 982613;
    else if (HARDWARE_MODELS.includes(model)) target = 982619;
  }
  return target;
}

function isPromo(leadName) {
  if (!leadName) return false;
  return leadName.toLowerCase().includes("акция");
}

function calcBudget(category, model, discount, soldPackage, promo = false) {
  let budget = null;
  let forceNoDiscount = false;
  const multiplier = promo ? 2 : 1;

  if (category === 974775) {
    forceNoDiscount = true;
    const base = BUDGET_IPHONE_BY_PACKAGE[soldPackage];
    budget = base != null ? base * multiplier : null;
  } else if (category === 974783) {
    budget = 1500;
  } else {
    let table = null;
    if (category === 974777) table = (model === AIRPODS_MAX) ? BUDGET_HARDWARE : BUDGET_AKSY;
    else if (category === 974779) table = BUDGET_HARDWARE;
    else if (category === 974781 || category === 982623) table = BUDGET_BU;

    if (table && discount != null) {
      const base = table[discount];
      budget = base != null ? base * multiplier : null;
    }
  }

  return { budget, forceNoDiscount };
}

// 🆕 ФУНКЦИЯ: ЧТЕНИЕ СПОСОБА ОПЛАТЫ ИЗ ПОСЛЕДНЕГО ПРИМЕЧАНИЯ
async function getPaymentMethodFromLastNote(leadId, env) {
  console.log(`💬 [Способ оплаты] Читаем последнее примечание для лида ${leadId}`);

  const notesRes = await fetch(
    `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}/notes?sort_by=-created_at&limit=1`,
    { headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" } }
  );

  if (!notesRes.ok) {
    console.log(`️ [Способ оплаты] Не удалось получить примечания: ${notesRes.status}`);
    return null;
  }

  const notesData = await safeJsonParse(notesRes, "Получение примечаний");
  if (!notesData) return null;

  const notes = notesData._embedded?.notes || [];
  if (notes.length === 0) {
    console.log("️ [Способ оплаты] Примечания не найдены.");
    return null;
  }

  const lastNote = notes[0];
  const noteText = lastNote?.params?.text || "";
  if (!noteText) {
    console.log("⏭️ [Способ оплаты] Последнее примечание пустое.");
    return null;
  }

  console.log(`📝 [Способ оплаты] Последнее примечание (первые 100 символов): ${noteText.substring(0, 100)}...`);

  // Ищем строку "Способ оплаты: [слово]"
  const match = noteText.match(/Способ\s+оплаты\s*:\s*([^\s(]+)/i);
  if (!match || !match[1]) {
    console.log("⏭️ [Способ оплаты] Строка 'Способ оплаты:' не найдена в примечании.");
    return null;
  }

  const rawWord = match[1].toLowerCase();
  console.log(`🔍 [Способ оплаты] Найдено слово: "${rawWord}"`);

  // Сопоставление по вхождению (например, "наличные" содержит "наличн")
  for (const [key, enumId] of Object.entries(PAYMENT_METHOD_MAP)) {
    if (rawWord.includes(key)) {
      console.log(`✅ [Способ оплаты] Сопоставлено с "${key}" → enum_id ${enumId}`);
      return { field_id: FIELD_PAYMENT_METHOD, values: [{ enum_id: enumId }] };
    }
  }

  console.log(`️ [Способ оплаты] Слово "${rawWord}" не сопоставлено ни с одним вариантом.`);
  return null;
}

function getCorrectionUpdate(fields, responsibleId) {
  let currentCorrectionId = null;
  let currentCorrectionName = null;

  for (const field of fields) {
    if (field.field_id === 582983 && field.values?.length) {
      currentCorrectionId = field.values[0].enum_id || field.values[0].value;
      currentCorrectionName = CORRECTION_FIELD_NAMES[currentCorrectionId] || field.values[0].value;
    }
  }

  const responsibleName = RESPONSIBLE_USER_NAMES[responsibleId];

  console.log(`🔍 Проверка исправления: ответственный = ${responsibleName || responsibleId}, исправление = ${currentCorrectionName || currentCorrectionId || "пустое"}`);

  if (
    responsibleName &&
    currentCorrectionName &&
    responsibleName.trim().toLowerCase() === currentCorrectionName.trim().toLowerCase() &&
    currentCorrectionId !== 983499
  ) {
    console.log(`✅ Имена совпадают (${responsibleName}) → установка 'Не требуется' (983499)`);
    return { field_id: 582983, values: [{ enum_id: 983499 }] };
  }

  return null;
}

function getBudgetUpdates(lead, fields, promo, logPrefix) {
  const custom_fields_values = [];
  let newPrice = null;

  let type = null, model = null, currentDiscount = null, currentSoldPackage = null;
  let currentCategory = null;

  for (const field of fields) {
    if (!field.values?.length) continue;
    if (field.field_id === 466253) type = field.values[0].enum_id;
    if (field.field_id === 577689) model = field.values[0].enum_id;
    if (field.field_id === 575965) currentCategory = field.values[0].enum_id;
    if (field.field_id === 574827) currentDiscount = field.values[0].enum_id;
    if (field.field_id === 582431) currentSoldPackage = field.values[0].enum_id;
  }

  const effectiveCategory = deriveCategory(type, model, currentCategory);
  const { budget, forceNoDiscount } = calcBudget(effectiveCategory, model, currentDiscount, currentSoldPackage, promo);

  if (forceNoDiscount && currentDiscount != null && currentDiscount !== DISCOUNT_NONE) {
    console.log(`${logPrefix}  iPhone: принудительная установка скидки 'Без скидки'`);
    custom_fields_values.push({ field_id: 574827, values: [{ enum_id: DISCOUNT_NONE }] });
  }

  if (budget != null && lead.price !== budget) {
    console.log(`${logPrefix}  Установка бюджета: ${lead.price} → ${budget}${promo ? " (x2 акция)" : ""}`);
    newPrice = budget;
  }

  return { custom_fields_values, newPrice };
}

function processStatus143Logic(fields) {
  const custom_fields_values = [];
  let requestTypeId = null;
  let rejectionReasonId = null;

  for (const field of fields) {
    if (!field.values?.length) continue;
    if (field.field_id === 466253) requestTypeId = field.values[0].enum_id;
    if (field.field_id === 573457) rejectionReasonId = field.values[0].enum_id;
  }

  if (requestTypeId === 978137) {
    if (rejectionReasonId !== 970329 && rejectionReasonId !== 976779 && rejectionReasonId !== 977497) {
      console.log(" [Правило 143-1] Тип запроса 'нецелевой техника', исправляем причину отказа на 'нецелевой звонок' (970329)");
      custom_fields_values.push({ field_id: 573457, values: [{ enum_id: 970329 }] });
    } else {
      console.log(`✅ [Правило 143-1] Причина отказа уже корректна (${rejectionReasonId}), пропускаем.`);
    }
  } else if (requestTypeId === 931811) {
    if (rejectionReasonId !== 970313) {
      console.log("🛑 [Правило 143-2] Тип запроса 'сущ гарантия техника', исправляем причину отказа на 'по текущему заказу' (970313)");
      custom_fields_values.push({ field_id: 573457, values: [{ enum_id: 970313 }] });
    } else {
      console.log("✅ [Правило 143-2] Причина отказа уже 'по текущему заказу', пропускаем.");
    }
  } else {
    console.log("⏭️ [Правило 143-3] Тип запроса не подпадает под правила для этапа 143, ничего не делаем.");
  }

  return custom_fields_values;
}

async function checkDuplicatesForNewLead(leadId, env) {
  console.log(`🔍 [Проверка дубликатов/Сущ] Начинаем с лида ${leadId}`);

  const leadRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=contacts`, {
    headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" }
  });
  if (!leadRes.ok) {
    console.log(` Не удалось получить лид ${leadId}: ${leadRes.status}`);
    return null;
  }
  const lead = await safeJsonParse(leadRes, "Получение лида (дубли)");
  if (!lead) return null;

  let phone = null;
  if (lead._embedded?.contacts?.length > 0) {
    const contactId = lead._embedded.contacts[0].id;
    console.log(`📞 Ищем телефон в контакте ID: ${contactId}`);
    
    const contactRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/contacts/${contactId}?with=custom_fields_values`, {
      headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" }
    });
    
    if (contactRes.ok) {
      const contact = await safeJsonParse(contactRes, "Получение контакта (дубли)");
      if (contact) {
        const targetPhoneId = env.PHONE_FIELD_ID ? Number(env.PHONE_FIELD_ID) : 7;
        let phoneField = contact.custom_fields_values?.find(f => f.field_id === targetPhoneId);

        if (!phoneField?.values?.length) {
          phoneField = contact.custom_fields_values?.find(f => {
            const val = f.values?.[0]?.value;
            if (!val) return false;
            const digits = val.replace(/\D/g, '');
            return digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'));
          });
        }

        if (phoneField?.values?.length) {
          let rawPhone = phoneField.values[0].value;
          phone = rawPhone.replace(/\D/g, '');
          if (phone.startsWith('8') && phone.length === 11) {
            phone = '7' + phone.slice(1);
          }
          console.log(`✅ Нормализованный номер для поиска: ${phone}`);
        }
      }
    }
  }

  if (!phone || phone.length !== 11) {
    console.log("⏭️ [Проверка дубликатов] Корректный номер телефона (11 цифр) не найден. Пропуск.");
    return null;
  }

  console.log(`🎯 Номер найден. Начинаем поиск старых сделок по номеру ${phone}...`);

  const searchLeadsRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads?query=${phone}&filter[pipeline_id]=${TARGET_PIPELINE_OLD}&filter[status_id]=${TARGET_STATUS_OLD}&with=custom_fields_values`, {
    headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" }
  });

  if (!searchLeadsRes.ok) {
    console.log(`❌ Ошибка поиска сделок: ${searchLeadsRes.status}`);
    return null;
  }

  const searchLeadsData = await safeJsonParse(searchLeadsRes, "Поиск сделок (дубли)");
  if (!searchLeadsData) return null;

  const foundLeads = searchLeadsData._embedded?.leads || [];
  console.log(` Найдено сделок по фильтру: ${foundLeads.length}`);

  const cutoffDate = Math.floor((Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000);

  for (const oldLead of foundLeads) {
    console.log(`📋 Анализ старой сделки ID: ${oldLead.id}`);

    if (oldLead.id === leadId) {
      console.log(`   ⏭️ Пропуск: это та же самая новая сделка.`);
      continue;
    }
    
    if (oldLead.created_at < cutoffDate) {
      console.log(`   ️ Пропуск: сделка старше 30 дней.`);
      continue;
    }

    const reqTypeField = oldLead.custom_fields_values?.find(f => f.field_id === FIELD_REQUEST_TYPE);
    const currentType = reqTypeField?.values?.[0]?.enum_id;
    console.log(`   ️ Тип запроса в старой сделке: ${currentType}`);

    if (ALLOWED_OLD_TYPES.includes(currentType)) {
      console.log(`✅ [УСПЕХ] Найдена старая сделка ${oldLead.id}. Меняем тип в НОВОЙ сделке на Сущ (931811).`);
      return {
        custom_fields_values: [{ field_id: FIELD_REQUEST_TYPE, values: [{ enum_id: NEW_TYPE_VALUE }] }]
      };
    } else {
      console.log(`   ⏭️ Пропуск: тип запроса (${currentType}) не входит в разрешенные.`);
    }
  }

  console.log("⏭️ [Проверка дубликатов] Подходящих старых сделок не найдено.");
  return null;
}

export default {
  async fetch(request, env, ctx) {
    console.log("======================");
    console.log("🔥 ЗАПУСК РАБОЧЕГО ПРОЦЕССА |", request.method);
    console.log("======================");

    if (request.method === "GET") return new Response("Webhook works");
    if (request.method !== "POST") return new Response("OK");

    try {
      if (!env?.AMO_DOMAIN || !env?.AMO_TOKEN) {
        console.log("❌ ENV NOT SET");
        return new Response("ENV ERROR");
      }

      const rawBody = await request.text();
      const params = new URLSearchParams(rawBody);

      // =========================
      // 1. ОБНОВЛЕНИЕ ПОЛЕЙ (leads[update])
      // =========================
      if (params.has("leads[update][0][id]")) {
        console.log("📦 ОБНОВЛЕНИЕ СОБЫТИЯ (Поля изменены)");
        const leadId = Number(params.get("leads[update][0][id]"));
        const leadRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=custom_fields_values`, {
          headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" }
        });
        if (!leadRes.ok) return new Response("OK");

        const lead = await safeJsonParse(leadRes, "Обновление полей");
        if (!lead) return new Response("OK");

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

        const targetCategory = deriveCategory(type, model, currentCategory);
        const targetPackage = derivePackage(type, model, currentPackage);

        let soldPackage = null;
        if (lead.pipeline_id === 5276629 && lead.status_id === 142) {
          if (currentPackage === 982607) soldPackage = 982609;
          else if (currentPackage === 982611) soldPackage = 982617;
          else if (currentPackage === 982613) soldPackage = 982615;
          else if (currentPackage === 982619) soldPackage = 982621;
        }

        const custom_fields_values = [];

        if (currentCategory !== targetCategory) {
          custom_fields_values.push({ field_id: 575965, values: [{ enum_id: targetCategory }] });
        }
        if (targetPackage && currentPackage !== targetPackage) {
          custom_fields_values.push({ field_id: 582429, values: [{ enum_id: targetPackage }] });
        }
        if (soldPackage && currentSoldPackage !== soldPackage) {
          custom_fields_values.push({ field_id: 582431, values: [{ enum_id: soldPackage }] });
        }

        const correctionUpdate = getCorrectionUpdate(fields, lead.responsible_user_id);
        if (correctionUpdate) custom_fields_values.push(correctionUpdate);

        let newPrice = null;
        
        if (lead.pipeline_id === 5276629 && lead.status_id === 142) {
          if (lead.name && lead.name.toLowerCase().includes("исключение")) {
            console.log("⏭️ [UPDATE] Найдено слово 'исключение' в названии. Маржа/бюджет не меняется.");
          } else {
            const promo = isPromo(lead.name);
            const budgetUpdates = getBudgetUpdates(lead, fields, promo, "[UPDATE]");
            custom_fields_values.push(...budgetUpdates.custom_fields_values);
            newPrice = budgetUpdates.newPrice;
          }

          // 🆕 ЧТЕНИЕ СПОСОБА ОПЛАТЫ ИЗ ПОСЛЕДНЕГО ПРИМЕЧАНИЯ
          const paymentMethodUpdate = await getPaymentMethodFromLastNote(leadId, env);
          if (paymentMethodUpdate) {
            console.log("💳 [UPDATE] Применяем способ оплаты из примечания.");
            custom_fields_values.push(paymentMethodUpdate);
          }
        }

        if (lead.pipeline_id === 5276629 && lead.status_id === 143) {
          const status143Updates = processStatus143Logic(fields);
          custom_fields_values.push(...status143Updates);
        }

        if (custom_fields_values.length === 0 && newPrice == null) {
          console.log("⏭️ Обновлять нечего");
          return new Response("OK");
        }

        const patchBody = { custom_fields_values };
        if (newPrice != null) patchBody.price = newPrice;

        await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(patchBody)
        });

        return new Response("OK");
      }

      // =========================
      // 2. СМЕНА СТАТУСА (leads[status])
      // =========================
      if (!params.has("leads[status][0][id]")) {
        return new Response("OK");
      }

      console.log("📋 Тип события: ИЗМЕНЕНИЕ СТАТУСА");

      const leadId = Number(params.get("leads[status][0][id]"));
      const pipelineId = Number(params.get("leads[status][0][pipeline_id]"));
      const newStatusId = Number(params.get("leads[status][0][status_id]"));
      const oldStatusId = Number(params.get("leads[status][0][old_status_id]"));
      const oldPipelineId = Number(params.get("leads[status][0][old_pipeline_id]")) || 5240944;
      
      const modifiedUserId = Number(params.get("leads[status][0][modified_user_id]") || params.get("leads[status][0][modified_by]"));
      const webhookResponsibleId = Number(params.get("leads[status][0][responsible_user_id]"));
      const userId = modifiedUserId || webhookResponsibleId;

      console.log("Ведущий:", leadId, "|", oldPipelineId, oldStatusId, "→", pipelineId, newStatusId);

      if (!oldStatusId || oldStatusId === newStatusId) return new Response("OK");

      const leadDetailsRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=custom_fields_values`, {
        headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" }
      });
      if (!leadDetailsRes.ok) return new Response("OK");

      const leadData = await safeJsonParse(leadDetailsRes, "Смена статуса");
      if (!leadData) return new Response("OK");

      const fields = leadData.custom_fields_values || [];
      const actualResponsibleId = leadData.responsible_user_id;

      let type = null, model = null, currentCategory = null;
      for (const field of fields) {
        if (!field.values?.length) continue;
        if (field.field_id === 466253) type = field.values[0].enum_id;
        if (field.field_id === 577689) model = field.values[0].enum_id;
        if (field.field_id === 575965) currentCategory = field.values[0].enum_id;
      }

      const patchPayload = {};
      const customFieldsUpdates = [];

      if (pipelineId === 5276629 && (newStatusId === 142 || newStatusId === 53410258)) {
        customFieldsUpdates.push({ field_id: 573457, values: null });
      }

      if (pipelineId === 5276629 && newStatusId === 142) {
        if (leadData.name && leadData.name.toLowerCase().includes("исключение")) {
          console.log("⏭️ [STATUS 142] Найдено слово 'исключение' в названии. Автоматический расчет маржи/бюджета и полей ПРОПУЩЕН.");
        } else {
          const effectiveCategory = deriveCategory(type, model, currentCategory);
          let targetRequestType = null;
          if (effectiveCategory) {
            if ([974775, 974777, 974779, 982623].includes(effectiveCategory)) targetRequestType = 931809;
            else if (effectiveCategory === 974781) targetRequestType = 938373;
            else if (effectiveCategory === 974783) targetRequestType = 957159;
          }
          if (targetRequestType) {
            customFieldsUpdates.push({ field_id: 466253, values: [{ enum_id: targetRequestType }] });
          }

          const promo = isPromo(leadData.name);
          const budgetUpdates = getBudgetUpdates(leadData, fields, promo, "[STATUS 142]");
          customFieldsUpdates.push(...budgetUpdates.custom_fields_values);
          if (budgetUpdates.newPrice != null) patchPayload.price = budgetUpdates.newPrice;
        }

        // 🆕 ЧТЕНИЕ СПОСОБА ОПЛАТЫ ИЗ ПОСЛЕДНЕГО ПРИМЕЧАНИЯ ПРИ ПЕРЕХОДЕ В "КУПИЛ"
        const paymentMethodUpdate = await getPaymentMethodFromLastNote(leadId, env);
        if (paymentMethodUpdate) {
          console.log("💳 [STATUS 142] Применяем способ оплаты из примечания.");
          customFieldsUpdates.push(paymentMethodUpdate);
        }
      }

      if (pipelineId === 5276629 && newStatusId === 143) {
        const status143Updates = processStatus143Logic(fields);
        customFieldsUpdates.push(...status143Updates);
      }

      const matchedRule = RULES.find(rule =>
        rule.from.pipeline === oldPipelineId && rule.from.status === oldStatusId &&
        rule.to.pipeline === pipelineId && rule.to.status.includes(newStatusId)
      );

      if (matchedRule) {
        console.log("✅ ПРАВИЛО СОБЛЮДЕНО! Сделка вышла из ПНЛ. Запускаем смену ответственного и проверку на Сущ.");
        
        if (userId && actualResponsibleId !== userId) {
          console.log(`🔄 СМЕНА ОТВЕТСТВЕННОГО: Было ${actualResponsibleId} → Станет ${userId}`);
          patchPayload.responsible_user_id = userId;
        } else {
          console.log(`⏭️ Ответственный не меняется (userId=${userId}, actual=${actualResponsibleId})`);
        }

        const duplicateUpdate = await checkDuplicatesForNewLead(leadId, env);
        if (duplicateUpdate) {
          console.log("🔄 Применение обновлений из проверки дубликатов (Сущ) к НОВОЙ сделке.");
          customFieldsUpdates.push(...duplicateUpdate.custom_fields_values);
        }
      } else {
        console.log("⏭️ Сделка НЕ вышла из ПНЛ. Проверка на Сущ и смена ответственного ПРОПУЩЕНЫ.");
      }

      if (oldPipelineId === 5240944 && oldStatusId === 47069740 && pipelineId === 5276629 &&
          [47054479, 53410254, 53780378, 53410258, 142].includes(newStatusId)) {
        const today = new Date(new Date().setHours(0, 0, 0, 0));
        patchPayload.created_at = Math.floor(today.getTime() / 1000);
      }

      const correctionUpdate = getCorrectionUpdate(fields, actualResponsibleId);
      if (correctionUpdate) customFieldsUpdates.push(correctionUpdate);

      if (Object.keys(patchPayload).length > 0 || customFieldsUpdates.length > 0) {
        if (customFieldsUpdates.length > 0) patchPayload.custom_fields_values = customFieldsUpdates;

        console.log(" Отправка СБОРНОГО ПАТЧА для лида:", leadId);
        
        const updateRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(patchPayload)
        });

        if (!updateRes.ok) {
          console.log("❌ ОШИБКА СБОРНОГО ПАТЧА:", await updateRes.text());
          return new Response("ERROR", { status: 500 });
        }
        console.log("✅ СБОРНЫЙ ПАТЧ УСТАНОВЛЕН УСПЕШНО");
      } else {
        console.log("⏭️ Ничего не нужно обновлять (нет изменений в payload)");
      }

      return new Response("OK");

    } catch (e) {
      console.log(" CRASH:", e.stack || e.message);
      return new Response("ERROR", { status: 500 });
    }
  }
};
