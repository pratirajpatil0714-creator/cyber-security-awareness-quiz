// Tiny Redis (Upstash REST) helper. Works with Vercel's Upstash/KV integration.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const enabled = !!(URL_ && TOKEN);
async function cmd(args) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
module.exports = {
  enabled,
  get: async k => { const v = await cmd(["GET", k]); return v ? JSON.parse(v) : null; },
  set: (k, v) => cmd(["SET", k, JSON.stringify(v)]),
  incr: key => cmd(["INCR", key]),
  push: (key, val) => cmd(["LPUSH", key, JSON.stringify(val)]),
  all: async key => (await cmd(["LRANGE", key, 0, -1])).map(x => JSON.parse(x))
};
