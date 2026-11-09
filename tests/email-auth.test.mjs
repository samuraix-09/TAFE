import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(
  new URL(
    "../supabase/functions/emailjs-registration/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const script = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const origin = "http://localhost:4173";
const email = "student@example.test";
const requestId = "c6000000-0000-4000-8000-000000000001";
const password = "Fixture-password-123";
const tokens = (label) => ({ access_token: label, refresh_token: label });

function fixture(flow, { consumed = true, passwordError = null } = {}) {
  let handler;
  const calls = [];
  const profileQuery = {
    select: () => profileQuery,
    eq: () => profileQuery,
    update: () => {
      calls.push("profile");
      return profileQuery;
    },
    maybeSingle: async () => ({ data: { flow } }),
  };
  const service = {
    from: () => profileQuery,
    rpc: async () => ({ data: consumed }),
    auth: {
      admin: {
        updateUserById: async (id, attributes) => {
          calls.push("password");
          assert.equal(id, requestId);
          assert.equal(attributes.password, password);
          return { error: passwordError };
        },
      },
    },
  };
  const user = {
    auth: {
      verifyOtp: async (details) => {
        calls.push("verify");
        assert.equal(details.type, flow);
        assert.equal(details.email, email);
        return { data: { user: { id: requestId }, session: tokens("otp") } };
      },
      signInWithPassword: async (details) => {
        calls.push("sign-in");
        assert.equal(details.password, password);
        return { data: { session: tokens("fresh") } };
      },
    },
  };
  const env = {
    TAFE_ALLOWED_ORIGINS: origin,
    SUPABASE_URL: "https://example.test",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
    SUPABASE_ANON_KEY: "fixture-anon",
  };
  vm.runInNewContext(script, {
    Deno: {
      env: { get: (key) => env[key] },
      serve: (fn) => {
        handler = fn;
      },
    },
    exports: {},
    require: () => ({
      createClient: (_url, key) => {
        if (key === env.SUPABASE_SERVICE_ROLE_KEY) return service;
        assert.equal(key, env.SUPABASE_ANON_KEY);
        return user;
      },
    }),
    crypto,
    Headers,
    Response,
    TextEncoder,
  });
  const verify = (requestOrigin = origin) =>
    handler(
      new Request(origin, {
        method: "POST",
        headers: { origin: requestOrigin },
        body: JSON.stringify({
          action: "verify",
          requestId,
          email,
          password,
          name: "Student",
          code: "123456",
        }),
      }),
    );
  return { calls, verify };
}

test("signup verifies first, saves the password with the service client and returns a fresh session", async () => {
  const { calls, verify } = fixture("signup");
  const response = await verify();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    flow: "signup",
    session: tokens("fresh"),
  });
  assert.deepEqual(calls, ["verify", "password", "profile", "sign-in"]);
});

test("recovery returns only its verified session and never writes the signup password", async () => {
  const { calls, verify } = fixture("recovery");
  const response = await verify();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    flow: "recovery",
    session: tokens("otp"),
  });
  assert.deepEqual(calls, ["verify"]);
});

test("expired, incorrect or consumed challenges stop before native verification", async () => {
  const { calls, verify } = fixture("signup", { consumed: false });
  assert.equal((await verify()).status, 400);
  assert.deepEqual(calls, []);
});

test("a failed password save returns no session", async () => {
  const { calls, verify } = fixture("signup", {
    passwordError: { code: "weak_password" },
  });
  const response = await verify();
  assert.equal(response.status, 400);
  assert.equal((await response.json()).session, undefined);
  assert.deepEqual(calls, ["verify", "password"]);
});

test("an origin outside the allowlist cannot verify", async () => {
  const { calls, verify } = fixture("signup");
  assert.equal((await verify("https://untrusted.example.test")).status, 403);
  assert.deepEqual(calls, []);
});
