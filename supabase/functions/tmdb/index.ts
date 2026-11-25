// CineMatch → TMDB proxy. Keeps the TMDB key on the server.
// Secret needed: TMDB_READ_TOKEN (TMDB "API Read Access Token", v4).
// Call: GET <project>/functions/v1/tmdb?path=/trending/movie/week&language=en-US
const TOKEN = Deno.env.get("TMDB_READ_TOKEN") ?? "";
const ALLOWED = /^\/(trending\/(movie|tv|all)\/(day|week)|movie\/(popular|top_rated|now_playing|upcoming|\d+)|tv\/(popular|top_rated|on_the_air|\d+)|discover\/(movie|tv)|search\/(movie|tv|multi)|genre\/(movie|tv)\/list)$/;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";
  if (!ALLOWED.test(path)) return Response.json({ error: "path not allowed" }, { status: 400, headers: cors });
  if (!TOKEN) return Response.json({ error: "TMDB_READ_TOKEN secret is not set" }, { status: 500, headers: cors });
  const target = new URL("https://api.themoviedb.org/3" + path);
  url.searchParams.forEach((v, k) => { if (k !== "path") target.searchParams.set(k, v); });
  const r = await fetch(target, { headers: { Authorization: `Bearer ${TOKEN}`, accept: "application/json" } });
  return new Response(await r.text(), {
    status: r.status,
    headers: { ...cors, "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
});
