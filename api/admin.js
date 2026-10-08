const db = require("./_db");
const { getWindow, statusOf } = require("./_data");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return res.status(500).json({ error: "ADMIN_PASSWORD is not set in Vercel." });
  if (req.headers["x-admin-password"] !== pw) return res.status(401).json({ error: "Wrong password." });

  try {
    if (req.method === "POST") {
      if (!db.enabled) return res.status(400).json({ error: "Connect the database first (Vercel > Storage)." });
      const b = req.body || {}, now = new Date();
      let s, e;
      if (b.action === "allowRetake") {
        const rn = String(b.roll || "").trim();
        if (!/^\d{6}$/.test(rn)) return res.status(400).json({ error: "Enter a valid 6-digit roll number." });
        await db.set("passed:" + rn, null);
        await db.set("tries:" + rn, 0);
      } else if (b.action === "closeNow") { const w = await getWindow(); s = w.start < now ? w.start : now; e = now; }
      else if (b.action === "openNow") { s = now; e = new Date(now.getTime() + (Number(b.days) || 3) * 86400000); }
      else {
        s = new Date(b.start); e = new Date(b.end);
        if (isNaN(s) || isNaN(e) || e <= s) return res.status(400).json({ error: "Choose a valid open time and a later close time." });
      }
      if (b.action !== "allowRetake") await db.set("settings", { start: s.toISOString(), end: e.toISOString() });
    }
    const w = await getWindow();
    const settings = { start: w.start.toISOString(), end: w.end.toISOString(), status: statusOf(w) };
    if (!db.enabled) return res.status(200).json({ dbEnabled: false, settings, rows: [] });
    const [attempts, fb] = await Promise.all([db.all("attempts"), db.all("feedback")]);
    const map = {};
    fb.forEach(f => { map[f.attemptId] = f; });
    res.status(200).json({ dbEnabled: true, settings, rows: attempts.map(a => ({ ...a, feedback: map[a.id] || null })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
