const db = require("./_db");

// Feedback is compulsory: it is linked to a real quiz attempt and unlocks the certificate.
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!db.enabled) return res.status(500).json({ error: "Database is not connected." });
  const { attemptId, learned, suggestion } = req.body || {};
  const id = String(attemptId || "");
  const a = String(learned || "").trim().slice(0, 600), b = String(suggestion || "").trim().slice(0, 600);
  if (!/^[0-9a-f]{32}$/.test(id)) return res.status(400).json({ error: "Please take the quiz first." });
  if (a.length < 5 || b.length < 5) return res.status(400).json({ error: "Please answer both questions." });
  try {
    const att = await db.get("att:" + id);
    if (!att) return res.status(400).json({ error: "Quiz attempt not found." });
    if (!(await db.get("fb:" + id))) {
      const rec = { attemptId: id, learned: a, suggestion: b, date: new Date().toISOString() };
      await db.set("fb:" + id, rec);
      await db.push("feedback", rec);
    }
    res.status(200).json({ ok: true, passed: !!att.passed });
  } catch (e) { console.error(e); res.status(500).json({ error: "Could not save feedback." }); }
};
