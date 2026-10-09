
const crypto = require("crypto");
const db = require("./_db");
const { MAX_ATTEMPTS } = require("./_data");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const type = String((req.query && req.query.type) || "student").toLowerCase();

  if (!db.enabled) {
    return res.status(200).json({
      allowed: false,
      reason: "Database is not connected. Please contact the organiser."
    });
  }

  let key;

  if (type === "teacher") {
    const name = String((req.query && req.query.name) || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({
        allowed: false,
        reason: "Please enter a valid teacher name."
      });
    }

    const nameHash = crypto.createHash("sha256").update(name).digest("hex");
    key = "teacher:" + nameHash;
  } else if (type === "student") {
    const roll = String((req.query && req.query.roll) || "").trim();

    if (!/^\d{6}$/.test(roll)) {
      return res.status(400).json({
        allowed: false,
        reason: "Invalid 6-digit roll number."
      });
    }

    key = roll;
  } else {
    return res.status(400).json({
      allowed: false,
      reason: "Invalid participant type."
    });
  }

  let done = false;
  let used = 0;

  try {
    done = !!(await db.get("passed:" + key));
    used = Number(await db.get("tries:" + key)) || 0;
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      allowed: false,
      reason: "Could not verify your attempts. Please try again."
    });
  }

  if (done) {
    return res.status(200).json({
      allowed: false,
      reason: "A certificate has already been issued for this participant. You cannot take the quiz again."
    });
  }

  if (used >= MAX_ATTEMPTS) {
    return res.status(200).json({
      allowed: false,
      reason: "You have already used both attempts. You cannot take the quiz again."
    });
  }

  return res.status(200).json({
    allowed: true,
    attemptsLeft: MAX_ATTEMPTS - used
  });
};
