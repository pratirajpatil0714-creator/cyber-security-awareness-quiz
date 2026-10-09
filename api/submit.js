
const crypto = require("crypto");
const { PASS_MARKS, MAX_ATTEMPTS, QUESTIONS, getWindow, statusOf } = require("./_data");
const db = require("./_db");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  if (statusOf(await getWindow()) !== "open") {
    return res.status(403).json({ error: "Quiz is not open." });
  }

  const body = req.body || {};
  const type = String(body.participantType || "student").toLowerCase();
  const clean = String(body.name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 50);

  if (clean.length < 2) {
    return res.status(400).json({ error: "Name required." });
  }

  let roll = "";
  let dept = "";
  let participantKey = "";

  if (type === "student") {
    roll = String(body.roll || "").trim();
    dept = String(body.dept || "").trim().slice(0, 60);

    if (!/^\d{6}$/.test(roll) || dept.length < 2) {
      return res.status(400).json({
        error: "Roll number must be 6 digits and department is required."
      });
    }

    participantKey = roll;
  } else if (type === "teacher") {
    // Teachers provide only their name.
    // The normalized name is used as their attempt identifier.
    const normalizedName = clean.toLowerCase();
    participantKey = crypto
      .createHash("sha256")
      .update(normalizedName)
      .digest("hex");
  } else {
    return res.status(400).json({ error: "Invalid participant type." });
  }

  if (!db.enabled) {
    return res.status(500).json({
      error: "Database is not connected. Please contact the organiser."
    });
  }

  const triesKey = "tries:" + participantKey;
  const passedKey = "passed:" + participantKey;

  try {
    if (await db.get(passedKey)) {
      return res.status(403).json({
        error: "A certificate has already been issued for this participant. You cannot take the quiz again."
      });
    }

    if ((Number(await db.get(triesKey)) || 0) >= MAX_ATTEMPTS) {
      return res.status(403).json({
        error: "You have already used both attempts. You cannot take the quiz again."
      });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: "Could not verify your attempts. Please try again."
    });
  }

  if (!Array.isArray(body.answers) || body.answers.length !== QUESTIONS.length) {
    return res.status(400).json({ error: "Invalid answers." });
  }

  const seen = new Set();
  const given = {};

  for (const x of body.answers) {
    const id = Number(x && x.id);
    const a = Number(x && x.a);

    if (
      !Number.isInteger(id) ||
      id < 0 ||
      id >= QUESTIONS.length ||
      seen.has(id) ||
      !Number.isInteger(a) ||
      a < 0 ||
      a > 3
    ) {
      return res.status(400).json({ error: "Invalid answers." });
    }

    seen.add(id);
    given[id] = a;
  }

  // Reserve the attempt in Redis before calculating the result.
  let used;

  try {
    used = Number(await db.incr(triesKey));
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: "Could not record your attempt. Please try again."
    });
  }

  if (!(used >= 1) || used > MAX_ATTEMPTS) {
    return res.status(403).json({
      error: "You have already used both attempts. You cannot take the quiz again."
    });
  }

  const score = QUESTIONS.reduce(
    (n, q, index) => n + (given[index] === q.a ? 1 : 0),
    0
  );

  const percent = Math.round((score / QUESTIONS.length) * 100);
  const passed = score >= PASS_MARKS;
  const date = new Date().toISOString();

  const out = {
    id: crypto.randomBytes(16).toString("hex"),
    participantType: type,
    name: clean,
    roll,
    dept,
    score,
    total: QUESTIONS.length,
    percent,
    passed,
    certId: passed
      ? "CSA-" + crypto.randomBytes(4).toString("hex").toUpperCase()
      : null,
    date
  };

  if (passed) {
    try {
      await db.set(passedKey, {
        participantType: type,
        name: clean,
        roll,
        dept,
        certId: out.certId,
        date: out.date
      });
    } catch (e) {
      console.error("Could not save passed record:", e);
      // Keep the attempt record, but do not claim that the certificate
      // eligibility marker was saved successfully.
      return res.status(500).json({
        error: "Your score was calculated, but the result could not be saved completely. Please contact the organiser."
      });
    }
  }

  const attemptsLeft = passed ? 0 : Math.max(0, MAX_ATTEMPTS - used);
  out.attemptNo = used;
  out.attemptsLeft = attemptsLeft;

  try {
    await db.set("att:" + out.id, out);
    await db.push("attempts", out);
  } catch (e) {
    console.error("Could not save attempt:", e);
    return res.status(500).json({
      error: "Your attempt was processed, but its record could not be saved completely. Please contact the organiser."
    });
  }

  return res.status(200).json({
    ...out,
    attemptId: out.id
  });
};
