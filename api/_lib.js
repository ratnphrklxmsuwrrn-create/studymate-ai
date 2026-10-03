// ฟังก์ชันที่ใช้ร่วมกัน (ไฟล์ขึ้นต้นด้วย _ จะไม่ถูกเปิดเป็นหน้าเว็บ)
const redis = async (cmd) => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) throw new Error("ยังไม่ได้เชื่อมฐานข้อมูล Upstash Redis");
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "redis error");
  return j.result;
};
const tg = async (chat, text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN");
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text }) });
  if (!r.ok) throw new Error("Telegram ส่งไม่สำเร็จ");
};
module.exports = { redis, tg };
