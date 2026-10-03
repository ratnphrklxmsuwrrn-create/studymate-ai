// POST: sync | status | link | test | unlink (ทุกคำสั่งใช้ uid ประจำเบราว์เซอร์ของแต่ละคน)
// GET : Vercel Cron ทุกเช้า วนส่งแจ้งเตือนให้ทุกคนที่เชื่อม Telegram แล้ว
const { redis, tg, pick } = require("./_lib");
const bkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const daysTo = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const rand = () => [...require("crypto").randomBytes(12)].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);

function buildLines(tasks, today) {
  const lines = [];
  for (const t of tasks) {
    if (t.sample) continue;
    const left = (t.steps || []).filter((s) => !s.done);
    if (!left.length) continue;
    const dl = daysTo(today, t.due);
    if (t.kind === "exam") {
      if (dl === 2) lines.push(`📝 อีก 2 วันสอบ ${t.subject}`);
      if (dl >= 0) left.filter((s) => s.date <= today).forEach((s) => lines.push(`📖 วันนี้ควรอ่าน ${t.subject}: ${s.title} (${s.min} นาที)`));
    } else if (dl === 2) {
      lines.push(`⏰ อีก 2 วันต้องส่ง ${t.subject}: ${t.desc} (เหลือ ${left.length} ขั้นตอน)`);
    }
  }
  return lines;
}

function buildReport(tasks, today) {
  const now = [], soon = [];
  for (const t of tasks) {
    const left = (t.steps || []).filter((s) => !s.done);
    if (!left.length) continue;
    left.filter((s) => s.date <= today).forEach((s) => now.push(`• ${t.subject}: ${s.title} (${s.min} นาที)`));
    const dl = daysTo(today, t.due);
    if (dl >= 0 && dl <= 7) soon.push(`• ${t.subject} ${t.kind === "exam" ? "สอบ" : "ส่ง"} ${t.due.slice(8, 10)}/${t.due.slice(5, 7)} (อีก ${dl} วัน)`);
  }
  let m = "📋 สรุปงานตอนนี้\n\n";
  m += now.length ? `🎯 ต้องทำวันนี้\n${now.join("\n")}\n\n` : "🎉 วันนี้ไม่มีงานค้างแล้ว\n\n";
  if (soon.length) m += `⏰ ใกล้ถึงกำหนด (7 วัน)\n${soon.join("\n")}\n\n`;
  return m + pick();
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const { action, uid, tasks } = req.body || {};
      if (!/^[a-f0-9-]{36}$/.test(uid || "")) throw new Error("bad uid");
      if (action === "sync") {
        if (!Array.isArray(tasks)) throw new Error("bad tasks");
        const s = JSON.stringify(tasks);
        if (s.length > 200000) throw new Error("too large");
        await redis(["SET", "t:" + uid, s]);
        await redis(["SADD", "users", uid]);
        return res.status(200).json({ ok: true });
      }
      if (action === "status") return res.status(200).json({ linked: !!(await redis(["GET", "c:" + uid])) });
      if (action === "link") {
        const bot = process.env.TELEGRAM_BOT_USERNAME;
        if (!bot) throw new Error("ยังไม่ได้ตั้งค่า TELEGRAM_BOT_USERNAME");
        const code = rand();
        await redis(["SET", "link:" + code, uid, "EX", 900]);
        return res.status(200).json({ url: `https://t.me/${bot}?start=${code}` });
      }
      if (action === "test") {
        const chat = await redis(["GET", "c:" + uid]);
        if (!chat) throw new Error("ยังไม่ได้เชื่อม Telegram");
        await tg(chat, "✅ ทดสอบสำเร็จ! StudyMate AI จะแจ้งเตือนคุณทุกเช้า");
        return res.status(200).json({ ok: true });
      }
      if (action === "report") {
        const chat = await redis(["GET", "c:" + uid]);
        if (!chat) throw new Error("ยังไม่ได้เชื่อม Telegram");
        if (!Array.isArray(tasks)) throw new Error("bad tasks");
        await tg(chat, buildReport(tasks, bkk()));
        return res.status(200).json({ ok: true });
      }
      if (action === "unlink") { await redis(["DEL", "c:" + uid]); return res.status(200).json({ ok: true }); }
      return res.status(400).json({ error: "unknown action" });
    }
    if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`)
      return res.status(401).json({ error: "unauthorized" });
    const today = bkk(), uids = (await redis(["SMEMBERS", "users"])) || [];
    let sent = 0;
    for (const uid of uids) {
      try {
        const chat = await redis(["GET", "c:" + uid]);
        if (!chat) continue;
        const raw = await redis(["GET", "t:" + uid]);
        const lines = buildLines(raw ? JSON.parse(raw) : [], today);
        if (lines.length) { await tg(chat, "สวัสดีตอนเช้า 📚 StudyMate AI\n\n" + lines.join("\n") + "\n\n" + pick()); sent++; }
      } catch (e) {}
    }
    res.status(200).json({ users: uids.length, sent });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
