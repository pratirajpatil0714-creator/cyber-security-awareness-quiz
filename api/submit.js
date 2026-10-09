
const crypto = require("crypto");
const {
  PASS_MARKS,
  MAX_ATTEMPTS,
  QUESTIONS,
  getWindow,
  statusOf
} = require("./_data");

const db = require("./_db");

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 50);
}

function getParticipantKey(type, name, roll) {
  if (type === "student") {
    return roll;
  }

  // Must match api/check.js exactly.
  const normalizedName = name.toLowerCase();

  const nameHash = crypto
    .createHash("sha256")
    .update(normalizedName)
    .digest("hex");

  return "teacher:" + nameHash;
}

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  if (!db.enabled) {
    return res.status(503).json({
      error: "Database is not connected. Please contact the organiser."
    });
  }

  const body = req.body || {};
  const type = String(body.participantType || "student").toLowerCase();
  const clean = normalizeName(body.name);

  if (clean.length < 2) {
    return res.status(400).json({
      error: "Please enter a valid name."
    });
  }

  let roll = "";
  let dept = "";

  if (type === "student") {
    roll = String(body.roll || "").trim();
    dept = String(body.dept || "").trim().slice(0, 60);

    if (!/^\d{6}$/.test(roll) || dept.length < 2) {
      return res.status(400).json({
        error: "Roll number must be 6 digits and department is required."
      });
    }
  } else if (type !== "teacher") {
    return res.status(400).json({
      error: "Invalid participant type."
    });
  }

  let windowSettings;

  try {
    windowSettings = await getWindow();
  } catch (error) {
    console.error("Could not read quiz schedule:", error);

    return res.status(500).json({
      error: "Could not verify the quiz schedule."
    });
  }

  if (statusOf(windowSettings) !== "open") {
    return res.status(403).json({
      error: "Quiz is not open."
    });
  }

  const participantKey = getParticipantKey(type, clean, roll);
  const triesKey = "tries:" + participantKey;
  const passedKey = "passed:" + participantKey;

  // Validate the submitted answers before consuming an attempt.
  if (
    !Array.isArray(body.answers) ||
    body.answers.length !== QUESTIONS.length
  ) {
    return res.status(400).json({
      error: "Invalid answers."
    });
  }

  const seen = new Set();
  const given = {};

  for (const answer of body.answers) {
    const id = Number(answer && answer.id);
    const selected = Number(answer && answer.a);

    if (
      !Number.isInteger(id) ||
      id < 0 ||
      id >= QUESTIONS.length ||
      seen.has(id) ||
      !Number.isInteger(selected) ||
      selected < 0 ||
      selected > 3
    ) {
      return res.status(400).json({
        error: "Invalid answers."
      });
    }

    seen.add(id);
    given[id] = selected;
  }

  try {
    // Stop participants who already passed.
    if (await db.get(passedKey)) {
      return res.status(403).json({
        error: "You have already passed and are not allowed to take the quiz again."
      });
    }

    // Check the current attempt count.
    const previous = Number(await db.get(triesKey)) || 0;

    if (previous >= MAX_ATTEMPTS) {
      return res.status(403).json({
        error: "You have already used both attempts. You cannot take the quiz again."
      });
    }

    // Reserve this attempt in Redis.
    // Both check.js and submit.js use the same participant key.
    const used = Number(await db.incr(triesKey));

    if (used < 1 || used > MAX_ATTEMPTS) {
      return res.status(403).json({
        error: "You have already used both attempts. You cannot take the quiz again."
      });
    }

    // Calculate the score.
    const score = QUESTIONS.reduce(
      (total, question, index) =>
        total + (given[index] === question.a ? 1 : 0),
      0
    );

    const percent = Math.round(
      (score / QUESTIONS.length) * 100
    );

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
      attemptNo: used,
      attemptsLeft: passed
        ? 0
        : Math.max(0, MAX_ATTEMPTS - used),
      certId: passed
        ? "CSA-" + crypto.randomBytes(4).toString("hex").toUpperCase()
        : null,
      date
    };

    // Save passing status for certificate eligibility.
    if (passed) {
      await db.set(passedKey, {
        participantType: type,
        name: clean,
        roll,
        dept,
        certId: out.certId,
        date: out.date
      });
    }

    // Save the attempt record.
    await db.set("att:" + out.id, out);
    await db.push("attempts", out);

    return res.status(200).json({
      ...out,
      attemptId: out.id
    });
  } catch (error) {
    console.error("Quiz submission failed:", error);

    return res.status(500).json({
      error: "Could not save your quiz result completely. Please contact the organiser."
    });
  }
};

