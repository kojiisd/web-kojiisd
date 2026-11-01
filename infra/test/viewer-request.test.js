import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../functions/viewer-request.js", import.meta.url), "utf8").replace(
  "__CANONICAL_HOST__",
  "www.kojiisd.jp",
);
const handler = new Function(`${source}; return handler;`)();

const run = (host, uri, querystring = {}) => handler({ request: { headers: { host: { value: host } }, uri, querystring } });

test("redirects the apex and legacy hosts to the canonical host", () => {
  for (const host of ["kojiisd.jp", "web.kojiisd.jp"]) {
    const res = run(host, "/works/example/", { a: { value: "1" }, b: { value: "", multiValue: [{ value: "x" }, { value: "y" }] } });
    assert.equal(res.statusCode, 301);
    assert.equal(res.headers.location.value, "https://www.kojiisd.jp/works/example/?a=1&b=x&b=y");
  }
});

test("serves index.html for directory URLs on the canonical host", () => {
  assert.equal(run("www.kojiisd.jp", "/").uri, "/index.html");
  assert.equal(run("www.kojiisd.jp", "/works/example/").uri, "/works/example/index.html");
});

test("adds a trailing slash to extensionless paths", () => {
  const res = run("www.kojiisd.jp", "/works/example");
  assert.equal(res.statusCode, 301);
  assert.equal(res.headers.location.value, "/works/example/");
});

test("passes files through unchanged", () => {
  assert.equal(run("www.kojiisd.jp", "/_astro/index.abc123.css").uri, "/_astro/index.abc123.css");
  assert.equal(run("www.kojiisd.jp", "/favicon.ico").uri, "/favicon.ico");
});
