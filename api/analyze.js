// เรียก Claude API: mode "exam" = แผนอ่านหนังสือสอบ, อย่างอื่น = แผนทำการบ้าน
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" });
  const { mode, subject, desc, due, diff, perDay, today } = req.body || {};
  const format = `ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่นหรือ markdown:
{"steps":[{"title":"ชื่อขั้นตอน","minutes":45,"date":"YYYY-MM-DD"}]}`;
  const prompt = mode === "exam"
    ? `คุณเป็นติวเตอร์วางแผนอ่านหนังสือสอบให้นักเรียนไทย
วิชา: ${subject}
วันสอบ: ${due}
เนื้อหาที่ออกสอบ (หนึ่งหัวข้อต่อบรรทัด):
${desc}
เวลาอ่านต่อวัน: ประมาณ ${perDay} นาที
วันนี้: ${today}

แบ่งการอ่านเป็นขั้นตอนตามหัวข้อ ขึ้นต้น title ด้วย "อ่าน: " กระจายวันให้พอดี หัวข้อยากให้เวลามากกว่า วันสุดท้ายก่อนสอบให้ทบทวนรวม (title "ทบทวนรวมและทำโจทย์") วันที่ต้องไม่ก่อนวันนี้และไม่เกินวันสอบ
${format}`
    : `คุณเป็นผู้ช่วยวางแผนการเรียนของนักเรียนไทย
วิชา: ${subject}
โจทย์: ${desc}
วันส่ง: ${due}
ความยาก: ${diff}
วันนี้: ${today}

แตกงานเป็นขั้นตอนย่อย 5-8 ขั้น เรียงตามลำดับ ประเมินเวลา (นาที) และกำหนดวันที่ควรทำแต่ละขั้น (YYYY-MM-DD, ไม่เกินวันส่ง, ไม่ก่อนวันนี้)
${format}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || "API error" });
    const text = data.content.map((c) => c.text || "").join("").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.steps)) throw new Error("bad format");
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
