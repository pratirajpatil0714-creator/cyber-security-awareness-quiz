const db = require("./_db");
const { MAX_ATTEMPTS } = require("./_data");
// Tells the quiz page whether this roll number already holds a certificate.
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const r = String((req.query && req.query.roll) || "").trim();
  if (!/^\d{6}$/.test(r)) return res.status(400).json({ error: "Invalid roll number." });
  let done = false, used = 0;
  if (!db.enabled) return res.status(200).json({ allowed: false, reason: "Database is not connected. Please contact the organiser." });
  try { done = !!(await db.get("passed:" + r)); used = Number(await db.get("tries:" + r)) || 0; } catch (e) { console.error(e); return res.status(200).json({ allowed: false, reason: "Could not verify your attempts. Please try again." }); }
  if (done) return res.status(200).json({ allowed: false, reason: "A certificate has already been issued for this roll number. You cannot take the quiz again." });
  if (used >= MAX_ATTEMPTS) return res.status(200).json({ allowed: false, reason: "You have already used both attempts. You cannot take the quiz again." });
  res.status(200).json({ allowed: true, attemptsLeft: MAX_ATTEMPTS - used });
};
