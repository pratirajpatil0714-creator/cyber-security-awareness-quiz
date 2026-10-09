
const crypto = require("crypto");
const db = require("./_db");
const { MAX_ATTEMPTS } = require("./_data");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method !== "GET") {
    return res.status(405).json({
      allowed: false,
      reason: "Method not allowed."
    });
  }

  const type = String(
    (req.query && req.query.type) || "student"
  ).toLowerCase();

  if (!db.enabled) {
    return res.status(503).json({
      allowed: false,
      reason: "Database is not connected. Please contact the organiser."
    });
  }

  let key;

  // Generate the participant key
  if (type === "teacher") {
    const name = String(
      (req.query && req.query.name) || ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({
        allowed: false,
        reason: "Please enter a valid teacher name."
      });
    }

    const nameHash = crypto
      .createHash("sha256")
      .update(name)
      .digest("hex");

    key = "teacher:" + nameHash;

  } else if (type === "student") {
    const roll = String(
      (req.query && req.query.roll) || ""
    ).trim();

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

  try {
    // Read the participant's existing attempt count
    const usedValue = await db.get("tries:" + key);
    const used = Math.max(0, Number(usedValue) || 0);

    // Check whether the participant has already passed
    const passedValue = await db.get("passed:" + key);
    const passed = !!passedValue;

    if (passed) {
      return res.status(200).json({
        allowed: false,
        attemptsUsed: used,
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - used),
        nextAttempt: null,
        reason:
          "You have already passed and received eligibility for a certificate. You cannot take the quiz again."
      });
    }

    if (used >= MAX_ATTEMPTS) {
      return res.status(200).json({
        allowed: false,
        attemptsUsed: used,
        attemptsLeft: 0,
        nextAttempt: null,
        reason:
          "You have already used both attempts. You cannot take the quiz again."
      });
    }

    // Calculate which attempt the participant is about to take
    return res.status(200).json({
      allowed: true,
      attemptsUsed: used,
      attemptsLeft: MAX_ATTEMPTS - used,
      nextAttempt: used + 1,
      maxAttempts: MAX_ATTEMPTS
    });

  } catch (error) {
    console.error("Attempt check failed:", error);

    return res.status(500).json({
      allowed: false,
      reason:
        "Could not verify your attempts. Please try again."
    });
  }
};

