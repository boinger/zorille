import { describe, test, expect } from "bun:test";

/**
 * Behavioral tests for checklist regex patterns.
 * Each test verifies that a pattern matches known-bad samples
 * and does NOT match known-good samples.
 */

describe("Security patterns", () => {
  test("hardcoded secrets", () => {
    const re = /password\s*=|secret\s*=|api_key\s*=|API_KEY\s*=|token\s*=.*['"]/;
    expect(re.test('password = "hunter2"')).toBe(true);
    expect(re.test('secret = "abc123"')).toBe(true);
    expect(re.test('API_KEY = "sk-1234"')).toBe(true);
    expect(re.test('token = "bearer-xyz"')).toBe(true);
    // Note: this pattern is a candidate finder — it matches "password ="
    // regardless of the RHS. Manual review filters false positives.
    // So "password = process.env.DB_PASSWORD" correctly matches as a candidate.
    expect(re.test("password = process.env.DB_PASSWORD")).toBe(true);
  });

  test("insecure deserialization", () => {
    // Note: pattern includes eval() which is tested as a string match target,
    // not executed. This detects dangerous deserialization patterns in audited code.
    const re = /eval\(|pickle\.loads|yaml\.load\b|Marshal\.load/;
    expect(re.test("eval(userInput)")).toBe(true);
    expect(re.test("pickle.loads(data)")).toBe(true);
    expect(re.test("yaml.load(content)")).toBe(true);
    expect(re.test("Marshal.load(bytes)")).toBe(true);
    // Good: yaml.safe_load is fine
    expect(re.test("yaml.safe_load(content)")).toBe(false);
    // Good: yaml.load should not match yaml.loader
    expect(re.test("yaml.loader")).toBe(false);
  });

  test("XSS vectors", () => {
    const re = /innerHTML|dangerouslySetInnerHTML|html_safe|raw\(|v-html/;
    expect(re.test('el.innerHTML = userContent')).toBe(true);
    expect(re.test('dangerouslySetInnerHTML={{ __html: data }}')).toBe(true);
    expect(re.test('content.html_safe')).toBe(true);
    expect(re.test('<div v-html="msg">')).toBe(true);
    // Good: textContent is safe
    expect(re.test("el.textContent = userContent")).toBe(false);
  });

  test("overly permissive CORS", () => {
    const re = /Access-Control-Allow-Origin.*\*|cors\(\)/;
    expect(re.test('Access-Control-Allow-Origin: *')).toBe(true);
    expect(re.test("app.use(cors())")).toBe(true);
    // Good: specific origin
    expect(
      re.test('Access-Control-Allow-Origin: https://example.com'),
    ).toBe(false);
  });
});

describe("Correctness patterns", () => {
  test("empty catch blocks", () => {
    const re = /catch\s*\([^)]*\)\s*\{\s*\}/;
    expect(re.test("catch (e) {}")).toBe(true);
    expect(re.test("catch (error) { }")).toBe(true);
    // Good: catch with handling
    expect(re.test("catch (e) { console.error(e); }")).toBe(false);
  });

  test("type coercion bugs (loose equality)", () => {
    const re = /[^!=]==[^=]/;
    expect(re.test('if (x == "1")')).toBe(true);
    expect(re.test("if (a == null)")).toBe(true);
    // Good: strict equality
    expect(re.test('if (x === "1")')).toBe(false);
  });
});

describe("Reliability patterns", () => {
  test("missing timeouts - HTTP fetch without timeout", () => {
    // This pattern checks for fetch/request calls; timeout check is manual
    const re = /fetch\(|axios\(|request\(|http\.get\(/;
    expect(re.test("fetch(url)")).toBe(true);
    expect(re.test("axios(config)")).toBe(true);
    expect(re.test("http.get(url)")).toBe(true);
  });

  test("resource leaks - event listeners", () => {
    const re = /addEventListener\(/;
    expect(re.test('window.addEventListener("resize", handler)')).toBe(true);
    expect(re.test("el.addEventListener('click', fn)")).toBe(true);
  });
});

describe("Tech debt patterns", () => {
  test("TODO/FIXME markers", () => {
    const re = /TODO|FIXME|HACK|XXX|WORKAROUND/;
    expect(re.test("// TODO: fix this later")).toBe(true);
    expect(re.test("# FIXME: race condition")).toBe(true);
    expect(re.test("/* HACK: temporary workaround */")).toBe(true);
    expect(re.test("// XXX: this is fragile")).toBe(true);
    expect(re.test("// WORKAROUND for upstream bug")).toBe(true);
    // Good: normal comments
    expect(re.test("// this function validates input")).toBe(false);
  });
});

describe("General patterns", () => {
  test("secrets in source", () => {
    const re =
      /(api_key|apikey|secret_key|password|token|auth_token)\s*[:=]\s*['"][^'"]{8,}/i;
    expect(re.test('api_key = "sk_live_1234567890"')).toBe(true);
    expect(re.test('password: "supersecretpassword"')).toBe(true);
    expect(re.test('auth_token = "abcdefghij"')).toBe(true);
    // Good: short values (likely not real secrets)
    expect(re.test('token = "test"')).toBe(false);
    // Good: env var reference
    expect(re.test("api_key = os.environ['KEY']")).toBe(false);
  });

  test("missing TLS verification", () => {
    const re =
      /verify\s*=\s*False|rejectUnauthorized\s*:\s*false|InsecureSkipVerify\s*:\s*true|CURLOPT_SSL_VERIFYPEER\s*=>\s*false/;
    expect(re.test("verify = False")).toBe(true);
    expect(re.test("rejectUnauthorized: false")).toBe(true);
    expect(re.test("InsecureSkipVerify: true")).toBe(true);
    // Good: TLS verification enabled
    expect(re.test("verify = True")).toBe(false);
    expect(re.test("rejectUnauthorized: true")).toBe(false);
  });

  test("hardcoded URLs", () => {
    const re =
      /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d|192\.168)\b|https?:\/\/[a-z]+\.[a-z]+\.\w+\//;
    expect(re.test("http://localhost:3000/api")).toBe(true);
    expect(re.test("http://127.0.0.1:8080")).toBe(true);
    expect(re.test("http://192.168.1.1/admin")).toBe(true);
    expect(re.test("https://api.example.com/v1")).toBe(true);
  });
});

describe("Infrastructure patterns", () => {
  test("unpinned base image", () => {
    const re = /(?:^FROM\s+\S+:latest\b|^FROM\s+\w+\s*$)/im;
    expect(re.test("FROM node:latest")).toBe(true);
    expect(re.test("FROM ubuntu")).toBe(true);
    // Good: pinned version
    expect(re.test("FROM node:18-alpine")).toBe(false);
  });

  test("privileged container", () => {
    const re = /privileged:\s*true/;
    expect(re.test("privileged: true")).toBe(true);
    expect(re.test("  privileged: true")).toBe(true);
    // Good: not privileged
    expect(re.test("privileged: false")).toBe(false);
  });

  test("unpinned GitHub Action", () => {
    const re = /uses:\s+\S+@(main|master)\b/;
    expect(re.test("uses: actions/checkout@main")).toBe(true);
    expect(re.test("uses: actions/setup-node@master")).toBe(true);
    // Good: pinned to SHA
    expect(re.test("uses: actions/checkout@a1b2c3d4e5f6")).toBe(false);
  });

  test("public S3 bucket", () => {
    const re = /acl\s*=\s*"public/i;
    expect(re.test('acl = "public-read"')).toBe(true);
    expect(re.test('acl = "public-read-write"')).toBe(true);
    // Good: private
    expect(re.test('acl = "private"')).toBe(false);
  });

  test("secrets in GitHub Actions run blocks", () => {
    const re = /\$\{\{\s*secrets\./;
    expect(re.test("${{ secrets.API_KEY }}")).toBe(true);
    expect(re.test("${{secrets.TOKEN}}")).toBe(true);
    // Good: env reference (not directly in run)
    expect(re.test("${{ env.API_KEY }}")).toBe(false);
  });

  test("weak TLS protocols", () => {
    const re = /ssl_protocols\s+.*(?:SSLv3|TLSv1\.0|TLSv1\.1)/;
    expect(re.test("ssl_protocols SSLv3 TLSv1.0 TLSv1.1 TLSv1.2;")).toBe(true);
    expect(re.test("ssl_protocols TLSv1.0 TLSv1.1;")).toBe(true);
    expect(re.test("ssl_protocols TLSv1.1;")).toBe(true);
    // Good: modern only
    expect(re.test("ssl_protocols TLSv1.2 TLSv1.3;")).toBe(false);
  });
});
