import {statements} from "./sql.mjs";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
const base = "http://localhost:8787";
const claim = (id) => ({
  rank: "normal",
  mainsnak: { snaktype: "value", datavalue: { value: { id } } },
});
export const fixtureEntities = {
  Q9990001: {
    id: "Q9990001",
    lastrevid: 12,
    labels: { en: { value: "Fixture artist" } },
    descriptions: { en: { value: "Synthetic singer for integration tests" } },
    aliases: { en: [{ value: "Fixture nickname" }] },
    claims: { P31: [claim("Q5")], P106: [claim("Q177220")] },
  },
  Q9990002: {
    id: "Q9990002",
    labels: { en: { value: "Same title" } },
    descriptions: { en: { value: "Synthetic film for tests" } },
    claims: { P31: [claim("Q11424")] },
  },
  Q9990003: {
    id: "Q9990003",
    labels: { en: { value: "Same title" } },
    descriptions: { en: { value: "Synthetic TV series for tests" } },
    claims: { P31: [claim("Q5398426")] },
  },
  Q9990004: {
    id: "Q9990004",
    labels: { en: { value: "Fixture artist" } },
    descriptions: { en: { value: "Synthetic album with the artist name" } },
    claims: { P31: [claim("Q482994")] },
  },
  Q9990005: {
    id: "Q9990005",
    labels: { en: { value: "Unclear performer" } },
    descriptions: {
      en: { value: "Synthetic record without a classified occupation" },
    },
    claims: { P31: [claim("Q5")] },
  },
  Q9990006: {
    id: "Q9990006",
    labels: { en: { value: "Fixture artist duplicate record" } },
    descriptions: { en: { value: "Synthetic duplicate for merge testing" } },
    claims: { P31: [claim("Q5")], P106: [claim("Q639669")] },
  },
  Q9990007: {
    id: "Q9990007",
    labels: { en: { value: "Concurrent artist" } },
    claims: { P31: [claim("Q5")], P106: [claim("Q177220")] },
  },
};
fixtureEntities.Q9990008 = { ...fixtureEntities.Q9990001, id: "Q9990001" };
fixtureEntities.Q9990009 = { ...fixtureEntities.Q9990001, id: "Q9990009" };
fixtureEntities.Q9990010 = { id: "Q9990010", labels: { en: { value: "Fixture artist perfume" } }, claims: { P31: [claim("Q12144")] } };
fixtureEntities.Q9990011 = { id: "Q9990011", labels: { en: { value: "Fixture artist discography" } }, claims: { P31: [claim("Q273057")] } };
fixtureEntities.Q9990013 = { ...fixtureEntities.Q9990003, id: "Q9990013", labels: { en: { value: "Same title: another adaptation" } }, aliases: { en: [{ value: "Same title" }] } };
fixtureEntities.Q9990012 = { ...fixtureEntities.Q9990002, id: "Q9990012", labels: { en: { value: "Fixture artist: concert film" } } };
let sourceCalls = 0;
export async function fixtureSource(request) {
  sourceCalls++;
  const p = new URL(request.url).searchParams;
  if (p.get("search") === "busy")
    return new Response("Busy", {
      status: 429,
      headers: { "Retry-After": "30" },
    });
  if (p.get("action") === "wbsearchentities") {
    const ids =
      p.get("search") === "Fixture artist"
        ? ["Q9990004", "Q9990010", "Q9990011", "Q9990005", "Q9990012", "Q9990001"]
        : p.get("search") === "Same title"
          ? ["Q9990004", "Q9990003", "Q9990002", "Q9990013"]
        : p.get("search") === "redirected"
        ? ["Q9990001", "Q9990008"]
        : p.get("search") === "ambiguous"
          ? ["Q9990004", "Q9990003", "Q9990002", "Q9990013"]
          : p.get("search") === "missing"
            ? []
            : ["Q9990001"];
    return Response.json({
      search: ids.map((id) => ({
        id,
        label: fixtureEntities[id].labels.en.value,
      })),
    });
  }
  return Response.json({
    entities: Object.fromEntries(
      (p.get("ids") || "")
        .split("|")
        .map((id) => [id, fixtureEntities[id] || { id, missing: "" }]),
    ),
  });
}
const options = (extra = {}) =>
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: ".worker-test/index.js",
    compatibilityDate: "2026-10-24",
    compatibilityFlags: ["nodejs_compat"],
    serviceBindings: { CATALOGUE_SOURCE: fixtureSource },
    ...extra,
  });
let mf, db;
const accounts = {};
async function req(path, { method = "GET", cookie, data } = {}) {
  const response = await mf.dispatchFetch(base + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== "GET" ? { Origin: base } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return {
    status: response.status,
    value: await response.json().catch(() => null),
    response,
  };
}
async function apply(database, files) {
  for (const name of files) {
    for (const sql of statements(await readFile("migrations/" + name, "utf8")))
      await database.prepare(sql).run();
  }
}
async function signup(name) {
  await db.prepare("DELETE FROM rateLimit").run();
  const email = name + "@example.test",
    password = "fixture-password-123";
  assert.equal(
    (
      await req("/api/auth/sign-up/email", {
        method: "POST",
        data: { name, email, password },
      })
    ).status,
    200,
  );
  const login = await req("/api/auth/sign-in/email", {
      method: "POST",
      data: { email, password },
    }),
    cookie = login.response.headers
      .getSetCookie()
      .map((h) => h.split(";")[0])
      .join("; "),
    me = await req("/api/me", { cookie });
  return { id: me.value.profile.user_id, cookie };
}
before(
  async () => {
    mf = new Miniflare(
      options({
        d1Databases: ["DB"],
        bindings: {
          BETTER_AUTH_URL: base,
          BETTER_AUTH_SECRET: "catalogue-local-test-secret-only-123456",
          AUTH_DEV_MODE: "true",
        },
      }),
    );
    db = await mf.getD1Database("DB");
    await apply(db, (await readdir("migrations")).sort());
    accounts.member = await signup("Member");
    accounts.admin = await signup("Owner");
    accounts.mod = await signup("Moderator");
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
beforeEach(async () => {
  await db.prepare("DELETE FROM app_rate_limits").run();
});
after(async () => {
  await mf?.dispose();
});
test("catalogue search works with no database, preserves disambiguation and caches repeated searches", async () => {
  const preview = new Miniflare(options());
  try {
    let response = await preview.dispatchFetch(
      base + "/api/catalogue/search?q=ambiguous",
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.directoryConnected, false);
    assert.deepEqual(result.items.map(s => s.kind), ["tv", "film", "tv"]);
    const previous = sourceCalls;
    response = await preview.dispatchFetch(
      base + "/api/catalogue/search?q=ambiguous",
    );
    assert.equal(response.status, 200);
    assert.equal(sourceCalls, previous);
    const status = await preview.dispatchFetch(base + "/api/status");
    assert.equal((await status.json()).ready, false);
    assert.equal(
      (
        await preview.dispatchFetch(base + "/api/fandoms/activate", {
          method: "POST",
        })
      ).status,
      503,
    );
    assert.equal(
      (await preview.dispatchFetch(base + "/api/catalogue/search?q=busy"))
        .status,
      503,
    );
  } finally {
    await preview.dispose();
  }
});
test("one subject ID yields one fandom even when clients submit different names or aliases", async () => {
  const first = await req("/api/fandoms/activate", {
    method: "POST",
    cookie: accounts.member.cookie,
    data: {
      qid: "Q9990001",
      name: "Taylor Swift Fans UK",
      slug: "another-copy",
      kind: "tv",
    },
  });
  assert.equal(first.status, 201, JSON.stringify(first.value));
  assert.equal(first.value.fandom.name, "Fixture artist");
  assert.equal(first.value.fandom.kind, "artist");
  const repeat = await req("/api/fandoms/activate", {
    method: "POST",
    cookie: accounts.member.cookie,
    data: { qid: "Q9990001", name: "Different name" },
  });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.value.fandom.id, first.value.fandom.id);
  assert.equal(
    await db
      .prepare(
        "SELECT COUNT(*) total FROM fandoms WHERE wikidata_id='Q9990001'",
      )
      .first("total"),
    1,
  );
  assert.equal(
    (
      await req("/api/fandoms/activate", {
        method: "POST",
        data: { qid: "Q9990001" },
      })
    ).status,
    401,
  );
});
test("different works sharing a title remain distinct and albums cannot become sub-fandoms", async () => {
  for (const qid of ["Q9990002", "Q9990003"])
    assert.equal(
      (
        await req("/api/fandoms/activate", {
          method: "POST",
          cookie: accounts.member.cookie,
          data: { qid },
        })
      ).status,
      201,
    );
  assert.equal(
    await db
      .prepare("SELECT COUNT(*) total FROM fandoms WHERE name='Same title'")
      .first("total"),
    2,
  );
  assert.equal(
    (
      await req("/api/fandoms/activate", {
        method: "POST",
        cookie: accounts.member.cookie,
        data: { qid: "Q9990004" },
      })
    ).status,
    400,
  );
});
test("uncertain types enter review and only administrators can approve them", async () => {
  const request = await req("/api/fandoms/activate", {
    method: "POST",
    cookie: accounts.member.cookie,
    data: { qid: "Q9990005" },
  });
  assert.equal(request.status, 202);
  assert.equal(
    await db
      .prepare(
        "SELECT COUNT(*) total FROM fandoms WHERE wikidata_id='Q9990005'",
      )
      .first("total"),
    0,
  );
  assert.equal(
    (await req("/api/admin/fandom-requests", { cookie: accounts.mod.cookie }))
      .status,
    200,
  );
  assert.equal(
    (
      await req("/api/admin/fandom-requests/Q9990005", {
        method: "PATCH",
        cookie: accounts.mod.cookie,
        data: { status: "approved", kind: "artist", note: "Not allowed" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/api/admin/fandom-requests/Q9990005", {
        method: "PATCH",
        cookie: accounts.admin.cookie,
        data: {
          status: "approved",
          kind: "artist",
          note: "Verified test subject",
        },
      })
    ).status,
    200,
  );
  assert.equal((await req("/api/fandoms/wd-Q9990005")).status, 200);
});
test("concurrent activation cannot create two communities for the same subject", async () => {
  const results = await Promise.all(
    [1, 2].map(() =>
      req("/api/fandoms/activate", {
        method: "POST",
        cookie: accounts.member.cookie,
        data: { qid: "Q9990007" },
      }),
    ),
  );
  assert.ok(
    results.every((r) => [200, 201].includes(r.status)),
    JSON.stringify(results.map((r) => r.value)),
  );
  assert.equal(
    await db
      .prepare(
        "SELECT COUNT(*) total FROM fandoms WHERE wikidata_id='Q9990007'",
      )
      .first("total"),
    1,
  );
});
test("new canonical fandoms accept posts and memberships, archives hide content without freeing the identity", async () => {
  const id = "wd-Q9990001";
  assert.equal(
    (
      await req("/api/memberships/" + id, {
        method: "PUT",
        cookie: accounts.member.cookie,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/api/posts", {
        method: "POST",
        cookie: accounts.member.cookie,
        data: { text: "A dynamically catalogued community", fandom: id },
      })
    ).status,
    201,
  );
  assert.equal(
    (await req("/api/posts?fandom=" + id)).value.items[0].fandom_id,
    id,
  );
  assert.equal(
    (
      await req("/api/admin/fandoms/" + id, {
        method: "PATCH",
        cookie: accounts.admin.cookie,
        data: { status: "archived", reason: "Temporary test archive" },
      })
    ).status,
    200,
  );
  assert.ok(
    !(await req("/api/posts")).value.items.some((p) => p.fandom_id === id),
  );
  assert.equal(
    (
      await req("/api/fandoms/activate", {
        method: "POST",
        cookie: accounts.member.cookie,
        data: { qid: "Q9990001" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await req("/api/admin/fandoms/" + id, {
        method: "PATCH",
        cookie: accounts.admin.cookie,
        data: { status: "active", reason: "Restore test community" },
      })
    ).status,
    200,
  );
});
test("merges transfer content and membership, keep old links and catalogue IDs, and are audited", async () => {
  await req("/api/fandoms/activate", {
    method: "POST",
    cookie: accounts.member.cookie,
    data: { qid: "Q9990006" },
  });
  await req("/api/memberships/wd-Q9990006", {
    method: "PUT",
    cookie: accounts.member.cookie,
  });
  await req("/api/posts", {
    method: "POST",
    cookie: accounts.member.cookie,
    data: { text: "A post to transfer", fandom: "wd-Q9990006" },
  });
  const denied = await req("/api/admin/fandoms/wd-Q9990006/merge", {
    method: "POST",
    cookie: accounts.mod.cookie,
    data: { targetId: "wd-Q9990001", reason: "No permission" },
  });
  assert.equal(denied.status, 403);
  const merged = await req("/api/admin/fandoms/wd-Q9990006/merge", {
    method: "POST",
    cookie: accounts.admin.cookie,
    data: { targetId: "wd-Q9990001", reason: "Duplicate test record" },
  });
  assert.equal(merged.status, 200, JSON.stringify(merged.value));
  assert.equal(
    (await req("/api/fandoms/wd-Q9990006")).value.fandom.id,
    "wd-Q9990001",
  );
  assert.equal(
    (
      await req("/api/fandoms/activate", {
        method: "POST",
        cookie: accounts.member.cookie,
        data: { qid: "Q9990006" },
      })
    ).value.fandom.id,
    "wd-Q9990001",
  );
  assert.equal(
    await db
      .prepare("SELECT fandom_id FROM posts WHERE text='A post to transfer'")
      .first("fandom_id"),
    "wd-Q9990001",
  );
  assert.equal(
    await db
      .prepare(
        "SELECT COUNT(*) total FROM fandom_memberships WHERE user_id=? AND fandom_id='wd-Q9990001'",
      )
      .bind(accounts.member.id)
      .first("total"),
    1,
  );
  assert.ok(
    (
      await req("/api/admin/audit", { cookie: accounts.admin.cookie })
    ).value.items.some((row) => row.action === "fandom.merged"),
  );
});
test("catalogue migration preserves all existing post, reply, like, report and membership data", async () => {
  const old = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ["DB"],
      compatibilityDate: "2026-10-24",
    }),
  );
  try {
    const database = await old.getD1Database("DB");
    await apply(database, ["0001_auth.sql", "0002_community.sql"]);
    await database
      .prepare(
        "INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES('old','Old','old@example.test',1,1,1)",
      )
      .run();
    await database
      .prepare(
        "INSERT INTO profiles(user_id,username,display_name) VALUES('old','old','Old')",
      )
      .run();
    await database
      .prepare(
        "INSERT INTO posts(id,user_id,fandom_id,text) VALUES(7,'old','taylor','Keep this post')",
      )
      .run();
    await database
      .prepare(
        "INSERT INTO replies(id,post_id,user_id,text) VALUES(9,7,'old','Keep this reply')",
      )
      .run();
    for (const table of ["post_likes", "post_bookmarks"])
      await database
        .prepare(`INSERT INTO ${table}(user_id,post_id) VALUES('old',7)`)
        .run();
    await database
      .prepare("INSERT INTO fandom_memberships VALUES('old','taylor')")
      .run();
    await database
      .prepare(
        "INSERT INTO reports(reporter_id,post_id,reason) VALUES('old',7,'Keep this report')",
      )
      .run();
    await apply(database, ["0003_catalogue.sql"]);
    assert.equal(
      await database.prepare("SELECT text FROM posts WHERE id=7").first("text"),
      "Keep this post",
    );
    for (const table of [
      "replies",
      "post_likes",
      "post_bookmarks",
      "reports",
      "fandom_memberships",
    ])
      assert.equal(
        await database
          .prepare("SELECT COUNT(*) total FROM " + table)
          .first("total"),
        1,
      );
    assert.equal(
      (await database.prepare("PRAGMA foreign_key_check").all()).results.length,
      0,
    );
    assert.equal(
      await database.prepare("SELECT version FROM app_meta").first("version"),
      2,
    );
  } finally {
    await old.dispose();
  }
});

test("redirected catalogue results collapse to one canonical subject", async () => {
  const result = await req("/api/catalogue/search?q=redirected");
  assert.equal(result.status, 200);
  assert.equal(result.value.items.length, 1);
  assert.equal(result.value.items[0].qid, "Q9990001");
});
test("an administrator rejection cannot be bypassed by later confident classification", async () => {
  await db
    .prepare(
      "INSERT INTO fandom_requests(qid,name,description,source_kind,status,requested_by) VALUES('Q9990009','Declined subject','','review','rejected',?)",
    )
    .bind(accounts.member.id)
    .run();
  const result = await req("/api/fandoms/activate", {
    method: "POST",
    cookie: accounts.member.cookie,
    data: { qid: "Q9990009" },
  });
  assert.equal(result.status, 409);
  assert.equal(
    await db
      .prepare(
        "SELECT COUNT(*) total FROM fandoms WHERE wikidata_id='Q9990009'",
      )
      .first("total"),
    0,
  );
});

test("account writes wait until the catalogue schema migration is complete", async () => {
  await db.prepare("UPDATE app_meta SET version=1").run();
  try {
    const result = await req("/api/auth/sign-up/email", {
      method: "POST",
      data: {
        name: "Not ready",
        email: "not-ready@example.test",
        password: "not-ready-password-123",
      },
    });
    assert.equal(result.status, 503);
    assert.equal(
      await db
        .prepare(
          "SELECT COUNT(*) total FROM user WHERE email='not-ready@example.test'",
        )
        .first("total"),
      0,
    );
  } finally {
    await db.prepare("UPDATE app_meta SET version=2").run();
  }
});

test("artist searches exclude albums, perfume, discographies and related works", async () => {
  const result = await req("/api/catalogue/search?q=Fixture%20artist");
  assert.equal(result.status, 200);
  assert.deepEqual(result.value.items.map(s => s.qid), ["Q9990001"]);
});
test("exact show titles preserve separate legitimate productions", async () => {
  const result = await req("/api/catalogue/search?q=Same%20title");
  assert.equal(result.status, 200);
  assert.deepEqual(result.value.items.map(s => s.qid), ["Q9990003", "Q9990002"]);
});

test("Stationhead party creation validates links and keeps hosting authenticated", async () => {
  const host=await signup('PartyHost'),other=await signup('PartyGuest');
  const payload={fandomId:'taylor',title:'Fan night',description:'Bring your favourite bridges',startsAt:new Date(Date.now()+86400000).toISOString(),stationheadUrl:'https://www.stationhead.com/test-host'};
  assert.equal((await req('/api/parties',{method:'POST',data:payload})).status,401);
  for(const url of ['https://stationhead.com.evil.test/room','http://stationhead.com/room','https://evil.test/room','https://user:pass@stationhead.com/room','javascript:alert(1)','https://stationhead.com/']){
    assert.equal((await req('/api/parties',{method:'POST',cookie:host.cookie,data:{...payload,stationheadUrl:url}})).status,400,url);
  }
  const created=await req('/api/parties',{method:'POST',cookie:host.cookie,data:payload});assert.equal(created.status,201,JSON.stringify(created.value));const id=created.value.id;
  assert.equal((await req('/api/parties/'+id,{method:'PATCH',cookie:other.cookie,data:{status:'live'}})).status,403);
  for(let i=0;i<2;i++)assert.equal((await req('/api/parties/'+id+'/rsvp',{method:'PUT',cookie:other.cookie,data:{choice:'going'}})).status,200);
  let detail=await req('/api/parties/'+id,{cookie:other.cookie});assert.equal(detail.value.party.going,1);assert.equal(detail.value.party.rsvp,'going');assert.ok(!JSON.stringify(detail.value).includes('@example.test'));
  assert.equal((await req('/api/parties/'+id,{method:'PATCH',cookie:host.cookie,data:{status:'live'}})).status,200);
  assert.equal((await req('/api/parties/'+id)).value.party.status,'live');
  assert.equal((await req('/api/parties/'+id,{method:'PATCH',cookie:host.cookie,data:{status:'ended'}})).status,200);
  assert.equal((await req('/api/parties/'+id+'/rsvp',{method:'PUT',cookie:other.cookie,data:{choice:'going'}})).status,409);
  assert.equal((await req('/api/parties/'+id,{method:'PATCH',cookie:host.cookie,data:{status:'live'}})).status,409);
  assert.equal((await req('/api/parties/'+id+'/rsvp',{method:'PUT',cookie:other.cookie,data:{choice:'none'}})).status,200);
  assert.ok(await db.prepare("SELECT id FROM audit_log WHERE action='party.ended' AND target_id=?").bind(String(id)).first());
});
test("listening party reports are private to staff and review actions are audited",async()=>{
  const host=await signup('ReportHost'),guest=await signup('ReportGuest');
  const created=await req('/api/parties',{method:'POST',cookie:host.cookie,data:{fandomId:'taylor',title:'Reported room',description:'',startsAt:new Date(Date.now()+86400000).toISOString(),stationheadUrl:'https://share.stationhead.com/test-room'}});assert.equal(created.status,201);const id=created.value.id;
  assert.equal((await req('/api/parties/'+id+'/report',{method:'POST',cookie:guest.cookie,data:{reason:'Misleading event details'}})).status,200);
  assert.equal((await req('/api/parties/reports',{cookie:guest.cookie})).status,403);
  const list=await req('/api/parties/reports',{cookie:accounts.admin.cookie});assert.equal(list.status,200);const report=list.value.items.find(r=>r.party_id===id);assert.ok(report);
  assert.equal((await req('/api/parties/reports/'+report.id,{method:'PATCH',cookie:accounts.admin.cookie,data:{status:'resolved',note:'Host corrected details'}})).status,200);
  assert.ok(await db.prepare("SELECT id FROM audit_log WHERE action='party-report.resolved' AND target_id=?").bind(String(report.id)).first());
});
test("party visibility respects blocks and suspension and follows canonical fandom merges",async()=>{
  const host=await signup('VisibleHost'),guest=await signup('VisibleGuest');
  await db.prepare("INSERT INTO fandoms(id,slug,name,kind) VALUES('party-source','party-source','Source performer','artist'),('party-target','party-target','Canonical performer','artist')").run();
  const created=await req('/api/parties',{method:'POST',cookie:host.cookie,data:{fandomId:'party-source',title:'Visible event',description:'',startsAt:new Date(Date.now()+86400000).toISOString(),stationheadUrl:'https://stationhead.com/test-station'}});assert.equal(created.status,201);const id=created.value.id;
  await req('/api/blocks/'+host.id,{method:'PUT',cookie:guest.cookie});assert.equal((await req('/api/parties/'+id,{cookie:guest.cookie})).status,404);assert.ok(!(await req('/api/parties',{cookie:guest.cookie})).value.items.some(p=>p.id===id));
  assert.equal((await req('/api/parties/'+id+'/rsvp',{method:'PUT',cookie:guest.cookie,data:{choice:'going'}})).status,404);
  assert.equal((await req('/api/admin/fandoms/party-source/merge',{method:'POST',cookie:accounts.admin.cookie,data:{targetId:'party-target',reason:'Consolidating canonical fandom'}})).status,200);
  assert.equal((await req('/api/parties/'+id)).value.party.fandom_id,'party-target');
  await db.prepare("UPDATE profiles SET status='suspended' WHERE user_id=?").bind(host.id).run();assert.equal((await req('/api/parties/'+id)).status,404);
});
