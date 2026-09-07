import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/_diag")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.SUPABASE_URL ?? "";
        const pub = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

        const decodeRole = (jwt: string) => {
          try {
            const part = jwt.split(".")[1];
            const json = JSON.parse(
              Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"),
            );
            return { role: json.role, ref: json.ref };
          } catch {
            return null;
          }
        };

        let adminProbe: { status: number; message: string } | null = null;
        if (url && svc) {
          try {
            const r = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1`, {
              headers: { apikey: svc, Authorization: `Bearer ${svc}` },
            });
            const text = await r.text();
            adminProbe = { status: r.status, message: text.slice(0, 200) };
          } catch (e) {
            adminProbe = { status: 0, message: e instanceof Error ? e.message : String(e) };
          }
        }

        return Response.json({
          hasUrl: Boolean(url),
          urlHost: url ? new URL(url).host : null,
          hasPublishable: Boolean(pub),
          publishable: pub ? { len: pub.length, ...decodeRole(pub) } : null,
          hasServiceRole: Boolean(svc),
          serviceRole: svc ? { len: svc.length, ...decodeRole(svc) } : null,
          adminProbe,
        });
      },
    },
  },
});