import assert from "node:assert/strict";
import test from "node:test";

// The built Worker imports cloudflare: modules, so exercise the same runtime
// and emitted configuration that hosting uses rather than Node's ESM loader.
process.env.WRANGLER_LOG_PATH ??= ".wrangler/test.log";
process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
const { unstable_dev } = await import("wrangler");

test("server-renders the Planbranch application shell", async (t) => {
  const worker = await unstable_dev("dist/server/index.js", {
    config: "dist/server/wrangler.json",
    local: true,
    port: 0,
    inspectorPort: 0,
    persist: false,
    logLevel: "error",
    experimental: {
      disableExperimentalWarning: true,
      disableDevRegistry: true,
      watch: false,
    },
  });
  t.after(() => worker.stop());
  const response = await worker.fetch("/", {
    headers: { accept: "text/html" },
  });
  assert.equal(
    response.status,
    200,
    response.status === 200 ? undefined : (await response.text()).slice(0, 1000),
  );
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Planbranch<\/title>/i);
  assert.match(html, /Planbranch/);
  assert.match(html, /local planning workspace/);
  assert.match(html, /Ordered decomposition/);
  assert.match(html, /og\.png/);
  assert.match(html, /OpenAI · Codex app-server/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);

  const scriptPath = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  assert.ok(scriptPath, "HTML includes a client entrypoint");
  const script = await worker.fetch(scriptPath);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type") ?? "", /javascript/);
  const image = await worker.fetch("/og.png");
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type") ?? "", /^image\/png/);
});
