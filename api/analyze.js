// Vercel Serverless Function: เรียก Claude API อย่างปลอดภัย (คีย์ไม่โผล่ในหน้าเว็บ)
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" });

  const { subject, desc, due, diff, today } = req.body || {};
  const prompt = `คุณเป็นผู้ช่วยวางแผนการเรียนของนักเรียนไทย
วิชา: ${subject}
โจทย์: ${desc}
วันส่ง: ${due}
ความยาก: ${diff}
วันนี้: ${today}

แตกงานเป็นขั้นตอนย่อย 5-8 ขั้น เรียงตามลำดับ ประเมินเวลา (นาที) และกำหนดวันที่ควรทำแต่ละขั้น (รูปแบบ YYYY-MM-DD, ไม่เกินวันส่ง, ไม่ก่อนวันนี้)
ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่นหรือ markdown:
{"steps":[{"title":"ชื่อขั้นตอน","minutes":45,"date":"YYYY-MM-DD"}]}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
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
