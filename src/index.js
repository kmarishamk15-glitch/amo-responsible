async function checkLongCallsAndNotify(leadId, env) {
  try {
    const res = await fetch(
      `https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}/notes?limit=250&order[id]=desc`,
      { headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, Accept: "application/json" } }
    );
    if (!res.ok) { console.log(`⚠️ notes ${leadId}: HTTP ${res.status}`); return; }
    
    const data = await safeJsonParse(res);
    const notes = data?._embedded?.notes || [];
    console.log(`📋 Сделка ${leadId}: всего примечаний ${notes.length}`);

    // Ищем уже отправленные звонки (по ID звонка в маркере)
    const notified = new Set();
    for (const n of notes) {
      const t = n.params?.text || "";
      const m = t.match(/\[call:(\d+)\]/);
      if (t.includes(CALL_MARKER) && m) {
        notified.add(m[1]);
        console.log(`🔍 Найден маркер для звонка ID=${m[1]}`);
      }
    }
    console.log(`🔍 Уже уведомлённых звонков: ${notified.size}`);

    for (const note of notes) {
      if (!isCallNote(note)) continue;
      const duration = getCallDuration(note);
      console.log(`📞 Звонок ID=${note.id}, type=${note.type}, note_type=${note.note_type}, duration=${duration}с`);
      
      if (duration <= LONG_CALL_SECONDS) {
        console.log(`⏭️ Звонок ${note.id} короче 8 мин, пропускаем`);
        continue;
      }
      
      if (notified.has(String(note.id))) {
        console.log(`✅ Звонок ${note.id} уже уведомлён (найден маркер), пропускаем`);
        continue;
      }

      console.log(`🚨 Звонок ${note.id} (${duration}с) — ОТПРАВЛЯЕМ В BITRIX!`);
      
      const incoming = String(note.type || "").toLowerCase() === "call_in" || String(note.note_type) === "12";
      const when = new Date((note.created_at || 0) * 1000)
        .toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

      // 🆕 ПРОСТОЙ ТЕКСТ БЕЗ BBCODE
      const text =
        `📞 Длинный звонок в amoCRM\n` +
        `Сделка: ${leadId}\n` +
        `Длительность: ${formatDuration(duration)}\n` +
        `Время: ${when}`;

      if (!(await sendToBitrix(text, env))) {
        console.log(`❌ Не удалось отправить в Bitrix, маркер не добавляем`);
        continue;
      }

      // 🆕 ДОБАВЛЯЕМ МАРКЕР С ПРОВЕРКОЙ ОТВЕТА
      const markerText = `${CALL_MARKER} [call:${note.id}]`;
      console.log(`📝 Добавляем маркер: "${markerText}"`);
      
      const markRes = await fetch(`https://${env.AMO_DOMAIN}/api/v4/leads/${leadId}/notes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.AMO_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ note_type: "common", params: { text: markerText } }])
      });
      
      const markText = await markRes.text();
      console.log(`✅ Маркер добавлен: HTTP ${markRes.status}, ответ: ${markText.substring(0, 300)}`);
      
      if (!markRes.ok) {
        console.log(`❌ ОШИБКА: маркер НЕ добавлен! Статус: ${markRes.status}`);
      }
    }
  } catch (e) {
    console.log(`❌ checkLongCallsAndNotify: ${e.message}`);
  }
}
