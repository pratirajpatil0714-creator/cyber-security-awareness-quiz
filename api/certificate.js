
const db = require("./_db");

// A certificate is released only for a PASSED attempt whose feedback form has been submitted.
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const id = String((req.query && req.query.id) || "");

  if (!/^[0-9a-f]{32}$/.test(id)) {
    return res.status(400).json({ error: "invalid" });
  }

  if (!db.enabled) {
    return res.status(500).json({ error: "Database is not connected." });
  }

  try {
    const att = await db.get("att:" + id);

    if (!att) {
      return res.status(404).json({ error: "not_found" });
    }

    if (!att.passed) {
      return res.status(403).json({ error: "not_passed" });
    }

    if (!(await db.get("fb:" + id))) {
      return res.status(403).json({ error: "feedback_required" });
    }

    res.status(200).json({
      name: att.name,
      certId: att.certId,
      date: att.date
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server" });
  }
};
