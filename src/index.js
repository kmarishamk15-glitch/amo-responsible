const RULES = [
  { from: { pipeline: 5240944, status: 47069740 }, to: { pipeline: 5276629, status: [47054479, 53410254, 53780378, 53410258, 143, 142] } },
  { from: { pipeline: 5240944, status: 47069740 }, to: { pipeline: 5240944, status: [143] } }
];

const RESPONSIBLE_USER_NAMES = {
  8789956: "Даниил Бровкин", 8517166: "Михаил Кострюков", 12669626: "Александра Абрамова",
  12280618: "Анна Зернова", 13116242: "Максим Булыков", 13192790: "Мария Смирнова",
  13284018: "Марк Артыков", 13465774: "Илья Буланов", 13249770: "Павел Николаев",
  13349558: "Светлана Маливанова", 13536034: "Артем Сяднев", 7561366: "Ирина Яровицина",
  14030758: "Александра Наумова", 14075570: "Ярослава Демина", 14212262: "Александра Потехина"
};

const CORRECTION_FIELD_NAMES = {
  983501: "Александра Абрамова", 983503: "Анна Зернова", 983505: "Максим Булыков",
  983507: "Мария Смирнова", 983509: "Марк Артыков", 983511: "Илья Буланов",
  983513: "Павел Николаев", 983515: "Светлана Маливанова", 983517: "Артем Сяднев",
  983519: "Ирина Яровицина", 983521: "Александра Наумова", 983523: "Ярослава Демина",
  983525: "Даниил Бровкин", 983527: "Михаил Кострюков", 983923: "Александра Потехина"
};

const DISCOUNT_NONE = 972987;
const AIRPODS_MAX = 975969;
const BUDGET_IPHONE_BY_PACKAGE = { 982597: 1000, 982599: 2000, 982601: 2500 };
const BUDGET_AKSY = { 972987: 1000, 981917: 700, 981919: 450, 972989: 450, 976369: 950, 976371: 950, 976373: 850, 976375: 450 };
const BUDGET_HARDWARE = { 972987: 2300, 981917: 1610, 981919: 1035, 972989: 1035, 976369: 2185, 976371: 2185, 976373: 1955, 976375: 1035 };
const BUDGET_BU = { 972987: 2500, 981917: 1750, 981919: 1125, 972989: 1125, 976369: 2375, 976371: 2375, 976373: 2125, 976375: 1125 };

const ACCESSORIES = [975967, 975969, 975971, 976049, 976051, 976053, 976055, 983737, 983741, 983743];
const HARDWARE_MODELS = [975973, 975975, 975977, 975981, 975983, 980173, 983739];
const ANDROID_MODELS = [975979, 976893];
const IPHONES = [
  975985, 975987, 975989, 975991, 975993, 975995, 975997, 975999,
  976001, 976003, 976005, 976007, 976009, 976011, 976013, 976015,
  976017, 976019, 976021, 976023, 976025, 976027, 976029, 976031,
  976033, 976035, 976037, 976039, 976041, 976043, 976045, 976047,
  976887, 976889, 976891, 977077, 978049, 978051, 978053, 978055,
  979183, 981729, 981731, 981733, 981735, 982255,
  983885, 983887, 983889, 983891
];

const TARGET_PIPELINE_OLD = 5276629;
const TARGET_STATUS_OLD = 143;
const FIELD_REQUEST_TYPE = 466253;
const ALLOWED_OLD_TYPES = [931809, 938373, 957159];
const NEW_TYPE_VALUE = 931811;

const FIELD_PAYMENT_METHOD = 574905;

const LONG_CALL_THRESHOLD = 480; // 8 минут в секундах
const BITRIX_CHAT_ID = 461;
const BITRIX_NOTE_MARKER = "📞 Длинный звонок (>8 мин) — уведомление отправлено в Bitrix";

const PAYMENT_KEYWORDS = [
  { keys: ['рассрочка', 'рассрочкой', 'рассрочке', 'рассрочку'], id: 973117 },
  { keys: ['кредит', 'кредитом', 'кредиту', 'кредите'], id: 973117 },
  { keys: ['наличные', 'наличка', 'нал', 'налом', 'наличными', 'наличкой'], id: 973115 },
  { keys: ['карта', 'картой', 'карте', 'карту'], id: 977839 },
  { keys: ['долями', 'долям'], id: 977071 }
];

function matchesKeyword(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^а-яёa-z0-9])${escaped}([^а-яёa-z0-9]|$)`, 'i');
  return regex.test(text);
}

async function safeJsonParse(response) {
  try {
    const text = await response.text();
    return (text && text.trim() !== "") ? JSON.parse(text) : null;
  } catch (e) { return null; }
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

function isPromo(leadName) { return leadName && leadName.toLowerCase().includes("акция"); }

function calcBudget(category, model, discount, soldPackage, promo = false) {
  let budget = null, forceNoDiscount = false, multiplier = promo ? 2 : 1;
  if (category === 974775) {
    forceNoDiscount = true;
    const base = BUDGET_IPHONE_BY_PACKAGE[soldPackage];
    budget = base != null ? base * multiplier : null;
  } else if (category === 974783) { budget = 1500; } 
  else {
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

function getCorrectionUpdate(fields, responsibleId) {
  let currentCorrectionId = null, currentCorrectionName = null;
  for (const field of fields) {
    if (field.field_id === 582983 && field.values?.length) {
      currentCorrectionId = field.values[0].enum_id || field.values[0].value;
      currentCorrectionName = CORRECTION_FIELD_NAMES[currentCorrectionId] || field.values[0].value;
    }
  }
  const responsibleName = RESPONSIBLE_USER_NAMES[responsibleId];
  if (responsibleName && currentCorrectionName && responsibleName.trim().toLowerCase() === currentCorrectionName.trim().toLowerCase() && currentCorrectionId !== 983499) {
    return { field_id: 582983, values: [{ enum_id: 983499 }] };
  }
  return null;
}

function getBudgetUpdates(lead, fields, promo) {
  const custom_fields_values = [];
  let newPrice = null, type = null, model = null, currentDiscount = null, currentSoldPackage = null, currentCategory = null;
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
    custom_fields_values.push({ field_id: 574827, values: [{ enum_id: DISCOUNT_NONE }] });
  }
  if (budget != null && lead.price !== budget) newPrice = budget;
  return { custom_fields_values, newPrice };
}

function processStatus143Logic(fields) {
  const custom_fields_values = [];
  let requestTypeId = null, rejectionReasonId = null;
  for (const field of fields) {
    if (!field.values?.length) continue;
    if (field.field_id === 466253) requestTypeId = field.values[0].enum_id;
    if (field.field_id === 573457) rejectionReasonId = field.values[0].enum_id;
  }
  if (requestTypeId === 978137 && rejectionReasonId !== 970329 && rejectionReasonId !== 976779 && rejectionReasonId !== 977497) {
    custom_fields_values.push({ field_id: 573457, values: [{ enum_id: 970329 }] });
  } else if (requestTypeId === 931811 && rejectionReasonId !== 970313) {
    custom_fields_values.push({ field_id: 573457, values: [{ enum_id: 970313 }] });
  }
  return custom_fields_values;
}

async function addCartTagIfPresent(leadId, noteText, env) {
  if (!noteText.includes("ЗАКАЗ ИЗ КОРЗИНЫ")) return;
  console.log(`🛒 Найден "ЗАКАЗ ИЗ КОРЗИНЫ" в примечании сделки ${leadId}`);
  try {
    const updateRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tags_to_add: [{ id: 415953 }] })
    });
    if (updateRes.ok) console.log(`✅ УСПЕХ! Тег "корзина" добавлен к сделке ${leadId}`);
  } catch (e) { console.log(`❌ Ошибка тега корзины: ${e.message}`); }
}

// 🔊 ИСПРАВЛЕННАЯ ФУНКЦИЯ: используем /notes вместо /history
//  ИСПРАВЛЕННАЯ ФУНКЦИЯ С ПОДРОБНЫМ ЛОГИРОВАНИЕМ
async function checkLongCallsAndNotify(leadId, env) {
  console.log(`🔔 [DEBUG 1] checkLongCallsAndNotify ЗАПУЩЕНА для сделки ${leadId}`);
  try {
    console.log(`🔔 [DEBUG 2] Запрашиваем ПРИМЕЧАНИЯ для ${leadId}...`);
    const notesRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}/notes`, {
      headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" }
    });
    
    console.log(`🔔 [DEBUG 3] Ответ примечаний: статус ${notesRes.status}`);
    if (!notesRes.ok) {
      console.log(`❌ [DEBUG] Ошибка получения примечаний: ${notesRes.status}`);
      return;
    }
    
    const notesData = await safeJsonParse(notesRes);
    console.log(`🔔 [DEBUG 4] Данные получены. Есть _embedded.notes?`, !!notesData?._embedded?.notes);
    
    if (!notesData || !notesData._embedded || !notesData._embedded.notes) {
      console.log(`⏭️ [DEBUG] Примечания пусты для сделки ${leadId}`);
      return;
    }
    
    const notes = notesData._embedded.notes;
    console.log(` [DEBUG] Всего примечаний:`, notes.length);
    
    // 🔍 ЛОГИРУЕМ ВСЕ ПРИМЕЧАНИЯ
    notes.forEach((note, index) => {
      console.log(`📌 [NOTE ${index}] type=${note.note_type}, text=${note.params?.text?.substring(0, 50)}, duration=${note.params?.duration}, call=${note.params?.call}`);
    });
    
    // Проверяем, есть ли уже маркер
    const alreadyNotified = notes.some(note => note.params?.text && note.params.text.includes(BITRIX_NOTE_MARKER));
    console.log(` [DEBUG 5] Уже было уведомление?`, alreadyNotified);
    if (alreadyNotified) return;
    
    // Ищем звонки (note_type 11, 12, 13)
    const longCalls = notes.filter(note => {
      const isCall = note.note_type === '11' || note.note_type === '12' || note.note_type === '13';
      if (!isCall) return false;
      const duration = note.params?.duration || 0;
      console.log(`🔍 [DEBUG] Проверка звонка: type=${note.note_type}, duration=${duration}, threshold=${LONG_CALL_THRESHOLD}`);
      return duration > LONG_CALL_THRESHOLD;
    });
    
    console.log(`🔔 [DEBUG 6] Найдено длинных звонков (>8 мин):`, longCalls.length);
    if (longCalls.length === 0) {
      // 🔍 Ищем ВСЕ звонки вообще
      const allCalls = notes.filter(note => 
        note.note_type === '11' || note.note_type === '12' || note.note_type === '13'
      );
      console.log(` [DEBUG] Найдено ВСЕГО звонков (любой длины):`, allCalls.length);
      allCalls.forEach((call, i) => {
        console.log(`📞 [CALL ${i}] type=${call.note_type}, duration=${call.params?.duration}, text=${call.params?.text?.substring(0, 30)}`);
      });
      return;
    }
    
    const longestCall = longCalls.reduce((max, note) => {
      const dur = note.params?.duration || 0;
      const maxDur = max.params?.duration || 0;
      return dur > maxDur ? note : max;
    });
    
    const duration = longestCall.params?.duration || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const callType = longestCall.note_type === '12' ? 'Входящий' : (longestCall.note_type === '13' ? 'Исходящий' : 'Пропущенный');
    const callTime = longestCall.created_at ? new Date(longestCall.created_at * 1000).toLocaleString('ru-RU') : 'неизвестно';
    
    console.log(`🔔 [DEBUG 7] Готовим сообщение для Bitrix: ${durationStr}`);
    
    const webhookUrl = env.BITRIX_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log(`❌ [DEBUG] BITRIX_WEBHOOK_URL не настроен в переменных окружения!`);
      return;
    }
    
    const bitrixMessage = ` <b>Длинный звонок в amoCRM</b>\n\n` +
      `🔗 Сделка: <a href="https://repairmyapple.amocrm.ru/leads/detail/${leadId}">#${leadId}</a>\n` +
      `⏱ Длительность: <b>${durationStr}</b>\n` +
      `📞 Тип: ${callType}\n` +
      ` Время: ${callTime}\n\n` +
      `⚠️ Звонок превышает 8 минут!`;
    
    console.log(` [DEBUG 8] Отправляем запрос в Bitrix...`);
    const bitrixRes = await fetch(`${webhookUrl}/im.message.add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        DIALOG_ID: `chat${BITRIX_CHAT_ID}`,
        MESSAGE: bitrixMessage,
        ATTACH: [{ TYPE: "LINK", LINK: { NAME: `Сделка #${leadId}`, LINK: `https://repairmyapple.amocrm.ru/leads/detail/${leadId}`, IMAGE_URL: "https://www.amocrm.ru/i/logo.png" } }]
      })
    });
    
    if (bitrixRes.ok) {
      console.log(`✅ [DEBUG] Уведомление успешно отправлено в Bitrix для сделки ${leadId}`);
      await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}/notes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ note_type: 4, params: { text: `${BITRIX_NOTE_MARKER} (Длительность: ${durationStr}, ${callTime})` } }])
      });
      console.log(`📝 [DEBUG] Примечание-маркер добавлено в сделку ${leadId}`);
    } else {
      const errText = await bitrixRes.text();
      console.log(`❌ [DEBUG] Ошибка отправки в Bitrix: ${bitrixRes.status} - ${errText.substring(0, 300)}`);
    }
  } catch (e) {
    console.log(`💥 [DEBUG] КРИТИЧЕСКАЯ ОШИБКА в checkLongCallsAndNotify: ${e.message}`);
  }
}

async function updatePaymentMethodFromNote(elementId, noteText, elementType, env) {
  try {
    let text = "";
    try { text = decodeURIComponent(noteText || "").toLowerCase(); }
    catch (e) { text = (noteText || "").toLowerCase(); }
    if (!text) return;

    let enumId = null, foundKey = "", reason = "";
    const aiMatch = text.match(/способ\s+оплаты\s*:\s*(наличн|карт|кредит|рассрочк|долям)/i);
    if (aiMatch && aiMatch[1]) {
      for (const item of PAYMENT_KEYWORDS) {
        if (item.keys.some(k => aiMatch[1].includes(k))) { enumId = item.id; foundKey = aiMatch[1]; reason = "ИИ"; break; }
      }
    }
    if (!enumId) {
      for (const item of PAYMENT_KEYWORDS) {
        for (const key of item.keys) {
          if (matchesKeyword(text, key)) { enumId = item.id; foundKey = key; reason = "Ключевое слово"; break; }
        }
        if (enumId) break;
      }
    }
    if (enumId) {
      const res = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${elementId}`, {
        method: "PATCH", headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ custom_fields_values: [{ field_id: FIELD_PAYMENT_METHOD, values: [{ enum_id: enumId }] }] })
      });
      if (res.ok) console.log(`✅ Способ оплаты обновлен: ${enumId}`);
      else if (res.status === 403) console.log(`⚠️ ПРОПУСК: Нет прав на изменение поля "Способ оплаты" (403).`);
    }
  } catch (e) { console.log(`❌ Ошибка updatePaymentMethod: ${e.message}`); }
}

function hasPaymentKeyword(text) {
  const lower = text.toLowerCase();
  if (/способ\s+оплаты\s*:\s*(наличн|карт|кредит|рассрочк|долям)/i.test(lower)) return true;
  return PAYMENT_KEYWORDS.some(item => item.keys.some(key => matchesKeyword(lower, key)));
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (!env?.AMO_DOMAIN || !env?.AMO_TOKEN) return new Response("OK");
      const rawBody = await request.text();
      const params = new URLSearchParams(rawBody);

      const hasNotes = params.has("leads[note][0][note][element_id]") || params.has("notes[add][0][element_id]");
      const hasStatus = params.has("leads[status][0][id]");
      const hasUpdate = params.has("leads[update][0][id]");
      
      console.log(`📨 Webhook: notes=${hasNotes}, status=${hasStatus}, update=${hasUpdate}`);

      if (hasNotes) {
        const elementId = Number(params.get("leads[note][0][note][element_id]") || params.get("notes[add][0][element_id]"));
        const noteType = params.get("leads[note][0][note][note_type]") || params.get("notes[add][0][note_type]");
        const noteText = params.get("leads[note][0][note][text]") || params.get("notes[add][0][text]") || "";
        
        console.log(`📝 Детали: element_id=${elementId}, note_type=${noteType}`);
        
        if (noteType === '4' || noteType === '10' || noteType === '109' || noteType === '11' || noteType === '12' || noteType === '13') {
          ctx.waitUntil(addCartTagIfPresent(elementId, noteText, env));
          ctx.waitUntil(checkLongCallsAndNotify(elementId, env));
          if (hasPaymentKeyword(noteText)) ctx.waitUntil(updatePaymentMethodFromNote(elementId, noteText, null, env));
        }
        return new Response("OK");
      }

      if (hasUpdate) {
        const leadId = Number(params.get("leads[update][0][id]"));
        ctx.waitUntil(checkLongCallsAndNotify(leadId, env));
        
        const leadRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=custom_fields_values`, { headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" } });
        if (!leadRes.ok) return new Response("OK");
        const lead = await safeJsonParse(leadRes);
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
        if (currentCategory !== targetCategory) custom_fields_values.push({ field_id: 575965, values: [{ enum_id: targetCategory }] });
        if (targetPackage && currentPackage !== targetPackage) custom_fields_values.push({ field_id: 582429, values: [{ enum_id: targetPackage }] });
        if (soldPackage && currentSoldPackage !== soldPackage) custom_fields_values.push({ field_id: 582431, values: [{ enum_id: soldPackage }] });

        const correctionUpdate = getCorrectionUpdate(fields, lead.responsible_user_id);
        if (correctionUpdate) custom_fields_values.push(correctionUpdate);

        let newPrice = null;
        if (lead.pipeline_id === 5276629 && lead.status_id === 142) {
          if (!lead.name || !lead.name.toLowerCase().includes("исключение")) {
            const promo = isPromo(lead.name);
            const budgetUpdates = getBudgetUpdates(lead, fields, promo);
            custom_fields_values.push(...budgetUpdates.custom_fields_values);
            newPrice = budgetUpdates.newPrice;
          }
        }
        if (lead.pipeline_id === 5276629 && lead.status_id === 143) {
          custom_fields_values.push(...processStatus143Logic(fields));
        }

        if (custom_fields_values.length > 0 || newPrice != null) {
          const patchBody = { custom_fields_values };
          if (newPrice != null) patchBody.price = newPrice;
          await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`, {
            method: "PATCH", headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify(patchBody)
          });
        }
        return new Response("OK");
      }

      if (!hasStatus) return new Response("OK");

      const leadId = Number(params.get("leads[status][0][id]"));
      const pipelineId = Number(params.get("leads[status][0][pipeline_id]"));
      const newStatusId = Number(params.get("leads[status][0][status_id]"));
      const oldStatusId = Number(params.get("leads[status][0][old_status_id]"));
      const oldPipelineId = Number(params.get("leads[status][0][old_pipeline_id]")) || 5240944;
      const userId = Number(params.get("leads[status][0][modified_user_id]") || params.get("leads[status][0][modified_by]"));

      if (!oldStatusId || oldStatusId === newStatusId) return new Response("OK");

      const leadDetailsRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}?with=custom_fields_values`, { headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" } });
      if (!leadDetailsRes.ok) return new Response("OK");
      const leadData = await safeJsonParse(leadDetailsRes);
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
        if (!leadData.name || !leadData.name.toLowerCase().includes("исключение")) {
          const effectiveCategory = deriveCategory(type, model, currentCategory);
          let targetRequestType = null;
          if (effectiveCategory) {
            if ([974775, 974777, 974779, 982623].includes(effectiveCategory)) targetRequestType = 931809;
            else if (effectiveCategory === 974781) targetRequestType = 938373;
            else if (effectiveCategory === 974783) targetRequestType = 957159;
          }
          if (targetRequestType) customFieldsUpdates.push({ field_id: 466253, values: [{ enum_id: targetRequestType }] });
          const promo = isPromo(leadData.name);
          const budgetUpdates = getBudgetUpdates(leadData, fields, promo);
          customFieldsUpdates.push(...budgetUpdates.custom_fields_values);
          if (budgetUpdates.newPrice != null) patchPayload.price = budgetUpdates.newPrice;
        }
      }

      if (pipelineId === 5276629 && newStatusId === 143) {
        customFieldsUpdates.push(...processStatus143Logic(fields));
        customFieldsUpdates.push({ field_id: 573459, values: null });
        customFieldsUpdates.push({ field_id: 578879, values: null });
        patchPayload.price = 0;
      }

      const matchedRule = RULES.find(rule =>
        rule.from.pipeline === oldPipelineId && rule.from.status === oldStatusId &&
        rule.to.pipeline === pipelineId && rule.to.status.includes(newStatusId)
      );

      if (matchedRule) {
        if (userId && actualResponsibleId !== userId) {
          patchPayload.responsible_user_id = userId;
          console.log(`✅ Ответственный: ${leadId} -> ${userId}`);
        }
        if (newStatusId === 143 && type) {
          let targetPipeline = null, reason = "";
          if (type === 938315) { targetPipeline = 5240944; reason = "Нецелевой услуги → Услуги"; } 
          else if (type === 982245) { targetPipeline = 5240944; reason = "Сущ гарантия услуги → Услуги"; } 
          else if (type === 978137) { targetPipeline = 5276629; reason = "Нецелевой техника → Техника"; } 
          else if (type === 931811) { targetPipeline = 5276629; reason = "Сущ гарантия техника → Техника"; }

          if (targetPipeline && targetPipeline !== pipelineId) {
            patchPayload.pipeline_id = targetPipeline;
            patchPayload.status_id = 143;
            console.log(`🔄 КОРРЕКТИРОВКА ВОРОНКИ: сделка ${leadId} → ${reason}`);
          }
        }
      }

      if (oldPipelineId === 5240944 && oldStatusId === 47069740 && pipelineId === 5276629 && [47054479, 53410254, 53780378, 53410258, 142].includes(newStatusId)) {
        patchPayload.created_at = Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000);
      }

      const correctionUpdate = getCorrectionUpdate(fields, actualResponsibleId);
      if (correctionUpdate) customFieldsUpdates.push(correctionUpdate);

      if (Object.keys(patchPayload).length > 0 || customFieldsUpdates.length > 0) {
        if (customFieldsUpdates.length > 0) patchPayload.custom_fields_values = customFieldsUpdates;
        await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}`, {
          method: "PATCH", headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(patchPayload)
        });
      }
      return new Response("OK");
    } catch (e) {
      console.log(`💥 КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
      return new Response("OK"); 
    }
  }
};
