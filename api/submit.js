const crypto = require("crypto");
const { PASS_MARKS, MAX_ATTEMPTS, QUESTIONS, getWindow, statusOf } = require("./_data");
const db = require("./_db");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (statusOf(await getWindow()) !== "open") return res.status(403).json({ error: "Quiz is not open." });

  const { name, roll, dept, answers } = req.body || {};
  const clean = String(name || "").trim().slice(0, 50);
  if (clean.length < 2) return res.status(400).json({ error: "Name required." });
  const r = String(roll || "").trim().slice(0, 20), dp = String(dept || "").trim().slice(0, 60);
  if (!/^\d{6}$/.test(r) || dp.length < 2) return res.status(400).json({ error: "Roll number must be 6 digits and department is required." });
  // The 2-attempt limit is enforced on the server; if the database is down we refuse rather than allow unlimited tries.
  if (!db.enabled) return res.status(500).json({ error: "Database is not connected. Please contact the organiser." });
  try {
    if (await db.get("passed:" + r)) return res.status(403).json({ error: "A certificate has already been issued for this roll number. You cannot take the quiz again." });
    if ((Number(await db.get("tries:" + r)) || 0) >= MAX_ATTEMPTS) return res.status(403).json({ error: "You have already used both attempts. You cannot take the quiz again." });
  } catch (e) { console.error(e); return res.status(500).json({ error: "Could not verify your attempts. Please try again." }); }
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length)
    return res.status(400).json({ error: "Invalid answers." });

  const seen = new Set(), given = {};
  for (const x of answers) {
    const id = Number(x && x.id), a = Number(x && x.a);
    if (!Number.isInteger(id) || id < 0 || id >= QUESTIONS.length || seen.has(id) || !(a >= 0 && a <= 3)) return res.status(400).json({ error: "Invalid answers." });
    seen.add(id); given[id] = a;
  }
  // Reserve the attempt atomically (INCR) so two simultaneous submissions cannot bypass the limit.
  let used;
  try { used = Number(await db.incr("tries:" + r)); } catch (e) { console.error(e); return res.status(500).json({ error: "Could not record your attempt. Please try again." }); }
  if (!(used >= 1) || used > MAX_ATTEMPTS) return res.status(403).json({ error: "You have already used both attempts. You cannot take the quiz again." });
  const score = QUESTIONS.reduce((n, q, i) => n + (given[i] === q.a ? 1 : 0), 0);
  const percent = Math.round((score / QUESTIONS.length) * 100);
  const passed = score >= PASS_MARKS;
  const out = {
    id: crypto.randomBytes(16).toString("hex"), name: clean, roll: r, dept: dp, score, total: QUESTIONS.length, percent, passed,
    certId: passed ? "CSA-" + crypto.randomBytes(4).toString("hex").toUpperCase() : null,
    date: new Date().toISOString()
  };
  if (db.enabled && passed) { try { await db.set("passed:" + r, { name: clean, certId: out.certId, date: out.date }); } catch (e) { console.error(e); } }
  const attemptsLeft = passed ? 0 : Math.max(0, MAX_ATTEMPTS - used);
  out.attemptNo = used;
  if (db.enabled) { try { await db.set("att:" + out.id, out); } catch (e) { console.error(e); } }
  if (db.enabled) { try { await db.push("attempts", out); } catch (e) { console.error(e); } }
  res.status(200).json({ ...out, attemptId: out.id, attemptsLeft });
};
