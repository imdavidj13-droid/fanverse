import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
let mf, db;
const base = "http://localhost:8787",
  accounts = {};
async function req(path, { method = "GET", data, cookie, origin = base } = {}) {
  const response = await mf.dispatchFetch(base + path, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== "GET" ? { Origin: origin } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const value = await response.json().catch(() => null);
  return { response, value, status: response.status };
}
async function account(name) {
  await db.prepare("DELETE FROM rateLimit").run();
  const email = name + "@example.test",
    password = "testing-password-123!";
  const signup = await req("/api/auth/sign-up/email", {
    method: "POST",
    data: { name, email, password },
  });
  assert.equal(signup.status, 200, JSON.stringify(signup.value));
  const login = await req("/api/auth/sign-in/email", {
    method: "POST",
    data: { email, password },
  });
  assert.equal(login.status, 200, JSON.stringify(login.value));
  const cookies = login.response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(cookies);
  const me = await req("/api/me", { cookie: cookies });
  assert.equal(me.status, 200, JSON.stringify(me.value));
  return { cookie: cookies, id: me.value.profile.user_id };
}
before(
  async () => {
    mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        scriptPath: ".worker-test/index.js",
        compatibilityDate: "2026-10-24",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        bindings: {
          BETTER_AUTH_URL: base,
          BETTER_AUTH_SECRET: "test-only-not-a-real-secret-1234567890",
          AUTH_DEV_MODE: "true",
        },
      }),
    );
    db = await mf.getD1Database("DB");
    for (const file of (await readdir("migrations")).sort()) {
      const sql = await readFile("migrations/" + file, "utf8");
      for (const statement of sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await db.prepare(statement).run();
    }
    accounts.alice = await account("Alice");
    accounts.bob = await account("Bob");
    accounts.mod = await account("Moderator");
    accounts.admin = await account("Admin");
    await db
      .prepare("UPDATE profiles SET role='admin' WHERE user_id=?")
      .bind(accounts.admin.id)
      .run();
    await db
      .prepare("UPDATE profiles SET role='moderator' WHERE user_id=?")
      .bind(accounts.mod.id)
      .run();
  },
  { timeout: 120000 },
);
after(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  await db.prepare("DELETE FROM app_rate_limits").run();
  await db.prepare("DELETE FROM rateLimit").run();
});
test("auth works with real D1 sessions and passwords are hashed", async () => {
  const row = await db
    .prepare("SELECT password FROM account WHERE userId=?")
    .bind(accounts.alice.id)
    .first();
  assert.ok(row.password);
  assert.notEqual(row.password, "testing-password-123!");
  assert.equal((await req("/api/admin/overview")).status, 401);
  assert.equal(
    (await req("/api/admin/overview", { cookie: accounts.alice.cookie }))
      .status,
    403,
  );
  assert.equal(
    (await req("/api/admin/overview", { cookie: accounts.admin.cookie }))
      .status,
    200,
  );
});
test("client cannot elevate its role and cross-origin writes are rejected", async () => {
  const result = await req("/api/me", {
    method: "PATCH",
    cookie: accounts.alice.cookie,
    data: {
      displayName: "Alice",
      username: "alice",
      bio: "Fan",
      role: "admin",
    },
  });
  assert.equal(result.status, 200);
  assert.equal(
    (await req("/api/me", { cookie: accounts.alice.cookie })).value.profile
      .role,
    "member",
  );
  assert.equal(
    (
      await req("/api/posts", {
        method: "POST",
        cookie: accounts.alice.cookie,
        origin: "https://evil.test",
        data: { text: "No", fandom: "taylor" },
      })
    ).status,
    403,
  );
});
test("ownership, reactions, replies and idempotent likes", async () => {
  const create = await req("/api/posts", {
    method: "POST",
    cookie: accounts.alice.cookie,
    data: { text: "Ownership test", fandom: "taylor" },
  });
  assert.equal(create.status, 201, JSON.stringify(create.value));
  const id = create.value.id;
  assert.equal(
    (
      await req("/api/posts/" + id, {
        method: "DELETE",
        cookie: accounts.bob.cookie,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/api/posts/" + id, {
        method: "PATCH",
        cookie: accounts.bob.cookie,
        data: { text: "hijack" },
      })
    ).status,
    403,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await req("/api/posts/" + id + "/likes", {
          method: "PUT",
          cookie: accounts.bob.cookie,
        })
      ).status,
      200,
    );
  const posts = (await req("/api/posts", { cookie: accounts.bob.cookie })).value
    .items;
  assert.equal(posts.find((p) => p.id === id).likes, 1);
  const reply = await req("/api/posts/" + id + "/replies", {
    method: "POST",
    cookie: accounts.bob.cookie,
    data: { text: "A shared reply" },
  });
  assert.equal(reply.status, 201);
  assert.equal(
    (
      await req("/api/replies/" + reply.value.id, {
        method: "DELETE",
        cookie: accounts.alice.cookie,
      })
    ).status,
    403,
  );
});
test("reports reach staff, hidden content leaves feeds and audit records the action", async () => {
  const post = await req("/api/posts", {
    method: "POST",
    cookie: accounts.alice.cookie,
    data: { text: "Moderation target", fandom: "sabrina" },
  });
  const id = post.value.id;
  assert.equal(
    (
      await req("/api/posts/" + id + "/reports", {
        method: "POST",
        cookie: accounts.bob.cookie,
        data: { reason: "Review this content" },
      })
    ).status,
    200,
  );
  const queue = await req("/api/admin/reports", {
    cookie: accounts.mod.cookie,
  });
  assert.equal(queue.status, 200, JSON.stringify(queue.value));
  const report = queue.value.items.find((row) => row.post_id === id);
  assert.ok(report);
  assert.equal(
    (
      await req("/api/admin/posts/" + id, {
        method: "PATCH",
        cookie: accounts.mod.cookie,
        data: { status: "hidden", reason: "Community rules violation" },
      })
    ).status,
    200,
  );
  assert.ok(!(await req("/api/posts")).value.items.some((p) => p.id === id));
  assert.equal((await req("/api/posts/" + id + "/replies")).status, 404);
  assert.equal(
    (
      await req("/api/admin/reports/" + report.id, {
        method: "PATCH",
        cookie: accounts.mod.cookie,
        data: { status: "resolved", note: "Removed from the public feed" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await req("/api/admin/audit", { cookie: accounts.mod.cookie })).status,
    403,
  );
  const audit = await req("/api/admin/audit", {
    cookie: accounts.admin.cookie,
  });
  assert.ok(
    audit.value.items.some(
      (row) => row.action === "post.hidden" && row.target_id === String(id),
    ),
  );
});
test("staff permissions and admin self-protection are enforced by the server", async () => {
  assert.equal(
    (
      await req("/api/admin/users/" + accounts.bob.id, {
        method: "PATCH",
        cookie: accounts.mod.cookie,
        data: { status: "suspended", reason: "Not authorized" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/api/admin/users/" + accounts.admin.id, {
        method: "PATCH",
        cookie: accounts.admin.cookie,
        data: { role: "member", reason: "Must not remove own access" },
      })
    ).status,
    400,
  );
  const id = (
    await req("/api/posts", {
      method: "POST",
      cookie: accounts.admin.cookie,
      data: { text: "Staff content", fandom: "taylor" },
    })
  ).value.id;
  assert.equal(
    (
      await req("/api/admin/posts/" + id, {
        method: "PATCH",
        cookie: accounts.mod.cookie,
        data: { status: "hidden", reason: "Needs senior review" },
      })
    ).status,
    403,
  );
});
test("blocks work both ways, remove follows and prevent replies", async () => {
  const id = (
    await req("/api/posts", {
      method: "POST",
      cookie: accounts.alice.cookie,
      data: { text: "Block target", fandom: "olivia" },
    })
  ).value.id;
  await req("/api/follows/" + accounts.alice.id, {
    method: "PUT",
    cookie: accounts.bob.cookie,
  });
  assert.equal(
    (
      await req("/api/blocks/" + accounts.bob.id, {
        method: "PUT",
        cookie: accounts.alice.cookie,
      })
    ).status,
    200,
  );
  assert.ok(
    !(
      await req("/api/posts", { cookie: accounts.bob.cookie })
    ).value.items.some((p) => p.user_id === accounts.alice.id),
  );
  assert.equal(
    (
      await req("/api/posts/" + id + "/replies", {
        method: "POST",
        cookie: accounts.bob.cookie,
        data: { text: "Should be blocked" },
      })
    ).status,
    404,
  );
  assert.equal(
    await db
      .prepare("SELECT COUNT(*) total FROM follows WHERE user_id=?")
      .bind(accounts.bob.id)
      .first("total"),
    0,
  );
  await req("/api/blocks/" + accounts.bob.id, {
    method: "DELETE",
    cookie: accounts.alice.cookie,
  });
});
test("suspending an account invalidates its sessions and hides its posts", async () => {
  const target = await account("Suspended");
  await req("/api/posts", {
    method: "POST",
    cookie: target.cookie,
    data: { text: "Suspension target", fandom: "screen" },
  });
  assert.equal(
    (
      await req("/api/admin/users/" + target.id, {
        method: "PATCH",
        cookie: accounts.admin.cookie,
        data: { status: "suspended", reason: "Repeated rule violations" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/api/posts", {
        method: "POST",
        cookie: target.cookie,
        data: { text: "No longer allowed", fandom: "screen" },
      })
    ).status,
    401,
  );
  assert.ok(
    !(await req("/api/posts")).value.items.some((p) => p.user_id === target.id),
  );
});
test("pagination is stable and public data never includes account emails", async () => {
  const first = await req("/api/posts?limit=1");
  assert.equal(first.status, 200);
  assert.equal(first.value.items.length, 1);
  assert.ok(first.value.next);
  const second = await req("/api/posts?limit=1&before=" + first.value.next);
  assert.notEqual(first.value.items[0].id, second.value.items[0].id);
  assert.ok(!JSON.stringify(first.value).includes("@example.test"));
  assert.equal((await req("/api/posts?limit=100000")).status, 400);
});
test("write limits return 429 rather than silently accepting spam", async () => {
  await db
    .prepare(
      "INSERT OR REPLACE INTO app_rate_limits(key,count,window) VALUES(?,?,?)",
    )
    .bind(accounts.alice.id, 30, Math.floor(Date.now() / 60000))
    .run();
  assert.equal(
    (
      await req("/api/posts", {
        method: "POST",
        cookie: accounts.alice.cookie,
        data: { text: "Rate limited", fandom: "taylor" },
      })
    ).status,
    429,
  );
});
test("a public Worker cannot enable localhost development auth, and missing configuration fails closed", async () => {
  const mismatch = await mf.dispatchFetch(
    "https://public-worker.example/api/status",
  );
  assert.equal((await mismatch.json()).ready, false);
  const mismatchWrite = await mf.dispatchFetch(
    "https://public-worker.example/api/posts",
    {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Not allowed", fandom: "taylor" }),
    },
  );
  assert.equal(mismatchWrite.status, 503);
  const unconfigured = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      scriptPath: ".worker-test/index.js",
      compatibilityDate: "2026-10-24",
      compatibilityFlags: ["nodejs_compat"],
    }),
  );
  try {
    const result = await unconfigured.dispatchFetch(base + "/api/status");
    assert.deepEqual(await result.json(), { ready: false, mode: "preview" });
    assert.equal(
      (
        await unconfigured.dispatchFetch(base + "/api/posts", {
          method: "POST",
        })
      ).status,
      503,
    );
  } finally {
    await unconfigured.dispose();
  }
});
test("admin account search and membership feeds use the database, not browser role claims", async () => {
  const results = await req("/api/admin/users?q=Alice", {
    cookie: accounts.admin.cookie,
  });
  assert.equal(results.status, 200, JSON.stringify(results.value));
  assert.equal(results.value.items.length, 1);
  assert.equal(results.value.items[0].role, "member");
  await req("/api/memberships/taylor", {
    method: "PUT",
    cookie: accounts.bob.cookie,
  });
  const feed = await req("/api/posts?feed=fandoms", {
    cookie: accounts.bob.cookie,
  });
  assert.equal(feed.status, 200);
  assert.ok(feed.value.items.every((p) => p.fandom_id === "taylor"));
  assert.equal((await req("/api/posts?feed=bookmarks")).status, 401);
});

test("signup method availability is truthful and never exposes credentials",async()=>{
  const response=await mf.dispatchFetch(base+'/api/auth-methods');
  assert.deepEqual(await response.json(),{email:true,phone:false,google:false,apple:false});
  const empty=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'.worker-test/index.js',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat']}));
  try{assert.deepEqual(await (await empty.dispatchFetch(base+'/api/auth-methods')).json(),{email:false,phone:false,google:false,apple:false})}finally{await empty.dispose()}
});
test("OAuth starts only for configured providers and cross-origin requests cannot initiate it",async()=>{
  const oauth=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'.worker-test/index.js',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{BETTER_AUTH_URL:base,BETTER_AUTH_SECRET:'oauth-only-test-secret-1234567890123456789',AUTH_DEV_MODE:'true',GOOGLE_CLIENT_ID:'fixture-google-client',GOOGLE_CLIENT_SECRET:'never-display-this-test-secret',APPLE_CLIENT_ID:'fixture-apple-client',APPLE_CLIENT_SECRET:'never-display-this-apple-test-secret'}}));
  try{
    const database=await oauth.getD1Database('DB');
    for(const file of (await readdir('migrations')).sort())for(const sql of (await readFile('migrations/'+file,'utf8')).split(';').map(s=>s.trim()).filter(Boolean))await database.prepare(sql).run();
    const methods=await (await oauth.dispatchFetch(base+'/api/auth-methods')).json();assert.equal(methods.google,true);assert.equal(methods.apple,true);assert.ok(!JSON.stringify(methods).includes('secret'));
    const make=(origin)=>oauth.dispatchFetch(base+'/api/auth/sign-in/social',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({provider:'google',callbackURL:base+'/account'})});
    assert.equal((await make('https://evil.test')).status,403);
    const started=await make(base);assert.equal(started.status,200);const body=await started.json();assert.equal(new URL(body.url).hostname,'accounts.google.com');assert.ok(!JSON.stringify(body).includes('never-display'));
    const bad=await oauth.dispatchFetch(base+'/api/auth/callback/apple',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/x-www-form-urlencoded'},body:'code=invalid&state=invalid'});assert.equal(bad.status,403);
    const apple=await oauth.dispatchFetch(base+'/api/auth/callback/apple',{method:'POST',headers:{Origin:'https://appleid.apple.com','Content-Type':'application/x-www-form-urlencoded'},body:'code=invalid&state=invalid',redirect:'manual'});assert.equal(apple.status,302);
    const finish=await oauth.dispatchFetch(apple.headers.get('location'),{redirect:'manual'});assert.equal(finish.status,302);assert.ok(finish.headers.get('location').includes('/login'));assert.equal(await database.prepare('SELECT COUNT(*) total FROM user').first('total'),0);
  }finally{await oauth.dispose()}
});

test("production Google and Apple can start without email delivery while email routes stay closed",async()=>{
 for (const provider of ['google','apple']) {
  const origin='https://fanverse-auth-test.example';
  const bindings={BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:'social-only-test-secret-1234567890123456789',...(provider==='google'?{GOOGLE_CLIENT_ID:'fixture-google-client',GOOGLE_CLIENT_SECRET:'fixture-google-secret'}:{APPLE_CLIENT_ID:'fixture-apple-service',APPLE_CLIENT_SECRET:'fixture-apple-jwt'})};
  const social=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'.worker-test/index.js',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings}));
  try {
   const database=await social.getD1Database('DB');
   for(const file of (await readdir('migrations')).sort())for(const sql of (await readFile('migrations/'+file,'utf8')).split(';').map(s=>s.trim()).filter(Boolean))await database.prepare(sql).run();
   assert.equal((await (await social.dispatchFetch(origin+'/api/status')).json()).ready,true);
   const methods=await (await social.dispatchFetch(origin+'/api/auth-methods')).json();assert.equal(methods.email,false);assert.equal(methods[provider],true);assert.equal(methods[provider==='google'?'apple':'google'],false);
   const response=await social.dispatchFetch(origin+'/api/auth/sign-in/social',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({provider,callbackURL:origin+'/account'})});assert.equal(response.status,200);const value=await response.json();assert.equal(new URL(value.url).hostname,provider==='google'?'accounts.google.com':'appleid.apple.com');
   for(const path of ['sign-up/email','sign-in/email','request-password-reset','send-verification-email']) {
    const blocked=await social.dispatchFetch(origin+'/api/auth/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Disabled email',email:'disabled@example.test',password:'disabled-email-password-123'})});assert.equal(blocked.status,503,path);
   }
   assert.equal(await database.prepare('SELECT COUNT(*) total FROM user').first('total'),0);
   assert.equal((await social.dispatchFetch('https://wrong-origin.example/api/status').then(r=>r.json())).ready,false);
  } finally { await social.dispose(); }
 }
});
test("a partial social credential pair does not enable production accounts",async()=>{
 const partial=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'.worker-test/index.js',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{BETTER_AUTH_URL:'https://fanverse-auth-test.example',BETTER_AUTH_SECRET:'partial-only-test-secret-1234567890123456789',GOOGLE_CLIENT_ID:'client-without-secret',APPLE_CLIENT_SECRET:'secret-without-client'}}));
 try{assert.equal((await (await partial.dispatchFetch('https://fanverse-auth-test.example/api/status')).json()).ready,false)}finally{await partial.dispose()}
});

test('onboarding checks usernames, completes atomically and keeps birthdays private', async () => {
 const person=await account('NewFan');
 assert.equal((await req('/api/me',{cookie:person.cookie})).value.onboardingCompleted,false);
 assert.equal((await req('/api/onboarding/username?username=admin',{cookie:person.cookie})).value.available,false);
 assert.equal((await req('/api/onboarding/username?username=new_fan_27',{cookie:person.cookie})).value.available,true);
 const submit=(data)=>req('/api/onboarding',{method:'POST',cookie:person.cookie,data});
 assert.equal((await submit({displayName:'David',username:'new_fan_27',dateOfBirth:'2026-02-30'})).status,400);
 assert.equal((await submit({displayName:'David',username:'new_fan_27',dateOfBirth:'2000-04-12'})).status,200);
 const me=(await req('/api/me',{cookie:person.cookie})).value;
 assert.equal(me.onboardingCompleted,true);assert.equal(me.profile.username,'new_fan_27');assert.equal(me.profile.display_name,'David');
 assert.ok(!JSON.stringify(me).includes('2000-04-12'));
 assert.equal((await req('/api/onboarding/username?username=new_fan_27',{cookie:accounts.bob.cookie})).value.available,false);
 assert.equal((await req('/api/onboarding',{method:'POST',cookie:accounts.bob.cookie,data:{displayName:'Taken',username:'new_fan_27',dateOfBirth:'2000-01-01'}})).status,409);
 assert.equal(await db.prepare('SELECT user_id FROM account_onboarding WHERE user_id=?').bind(accounts.bob.id).first(),null);
 assert.equal((await req('/api/onboarding/username?username=anything')).status,401);
});
