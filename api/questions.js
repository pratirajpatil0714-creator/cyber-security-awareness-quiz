const { PASS_PERCENT, PASS_MARKS, QUESTIONS, getWindow, statusOf } = require("./_data");

module.exports = async (req, res) => {
  const w = await getWindow(), s = statusOf(w);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    status: s, start: w.start.toISOString(), end: w.end.toISOString(), passPercent: PASS_PERCENT, passMarks: PASS_MARKS, total: QUESTIONS.length,
    questions: s === "open" ? QUESTIONS.map(({ q, o }, id) => ({ id, q, o })) : []
  });
};
