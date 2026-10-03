// Telegram เรียกไฟล์นี้เมื่อมีคนกด Start ในบอท (webhook) เพื่อผูกบัญชี Telegram กับผู้ใช้เว็บ
const { redis, tg } = require("./_lib");
module.exports = async function handler(req, res) {
  if (req.headers["x-telegram-bot-api-secret-token"] !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.status(401).end();
  try {
    const m = req.body && req.body.message;
    const text = (m && m.text) || "";
    if (m && text.startsWith("/start")) {
      const code = text.split(" ")[1];
      const uid = code && /^[a-zA-Z0-9]{8,40}$/.test(code) ? await redis(["GET", "link:" + code]) : null;
      if (uid) {
        await redis(["SET", "c:" + uid, String(m.chat.id)]);
        await redis(["DEL", "link:" + code]);
        await tg(m.chat.id, "✅ เชื่อมต่อ StudyMate AI สำเร็จแล้ว! ฉันจะแจ้งเตือนงานและแผนอ่านหนังสือให้ทุกเช้า 📚");
      } else {
        await tg(m.chat.id, "ลิงก์หมดอายุหรือไม่ถูกต้อง กลับไปที่เว็บ StudyMate AI แล้วกด \"เชื่อม Telegram\" ใหม่อีกครั้งนะ");
      }
    }
  } catch (e) {}
  res.status(200).json({ ok: true });
};
