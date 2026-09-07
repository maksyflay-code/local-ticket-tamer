// Gera JWT_SECRET, SECRET_KEY_BASE, ANON_KEY e SERVICE_ROLE_KEY
// para a instalação local (self-hosted).
import crypto from "node:crypto";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = b64url(crypto.createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

const jwtSecret = process.argv[2] || crypto.randomBytes(32).toString("hex");
const secretKeyBase = crypto.randomBytes(32).toString("hex");
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10; // 10 anos

const anon = sign({ role: "anon", iss: "supabase", iat, exp }, jwtSecret);
const service = sign({ role: "service_role", iss: "supabase", iat, exp }, jwtSecret);

console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`SECRET_KEY_BASE=${secretKeyBase}`);
console.log(`ANON_KEY=${anon}`);
console.log(`SERVICE_ROLE_KEY=${service}`);
