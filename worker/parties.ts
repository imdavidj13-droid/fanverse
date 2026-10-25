import { body, text, json, HttpError, limit, pageCursor } from "./http";
import { resolveFandom } from "./catalogue";
import { requireStaff, throttle, type ProfileRow } from "./security";
import { stationheadUrl } from "../shared/parties";
import type { Env } from "./types";
const visible = `FROM listening_parties p JOIN profiles h ON h.user_id=p.host_id AND h.status='active' JOIN fandoms f ON f.id=p.fandom_id AND f.status='active' WHERE NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.host_id) OR (b.user_id=p.host_id AND b.blocked_id=?))`;
const select = `SELECT p.*,h.display_name host_name,h.username host_username,f.name fandom_name,f.slug fandom_slug,
(SELECT COUNT(*) FROM party_rsvps r JOIN profiles a ON a.user_id=r.user_id AND a.status='active' WHERE r.party_id=p.id AND r.choice='going' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=r.user_id) OR (b.user_id=r.user_id AND b.blocked_id=?))) going,
(SELECT COUNT(*) FROM party_rsvps r JOIN profiles a ON a.user_id=r.user_id AND a.status='active' WHERE r.party_id=p.id AND r.choice='interested' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=r.user_id) OR (b.user_id=r.user_id AND b.blocked_id=?))) interested,
COALESCE((SELECT choice FROM party_rsvps WHERE party_id=p.id AND user_id=?),'none') rsvp `;
export async function parties(request: Request, env: Env, person: ProfileRow | null) {
  const db=env.DB!,url=new URL(request.url),path=url.pathname,viewer=person?.user_id||null;
  if (!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='listening_parties'").first()) throw new HttpError(503,"Listening parties need database migration 0004_listening_parties.sql.");
  if (path === "/api/parties/reports" || /^\/api\/parties\/reports\/[1-9]\d*$/.test(path)) {
    if (!person) throw new HttpError(401,"Please sign in.");
    requireStaff(person);
    if (request.method === "GET" && path === "/api/parties/reports") {
      const n=limit(url),rows=await db.prepare("SELECT r.*,p.title,p.status party_status,h.username host_username FROM party_reports r JOIN listening_parties p ON p.id=r.party_id JOIN profiles h ON h.user_id=p.host_id WHERE r.id<? ORDER BY r.id DESC LIMIT ?").bind(pageCursor(url),n+1).all();
      return json({items:rows.results.slice(0,n),next:rows.results.length>n?rows.results[n-1].id:null});
    }
    if (request.method === "PATCH" && path !== "/api/parties/reports") {
      await throttle(env,person);
      const data=await body(request),id=Number(path.split("/").pop()),note=text(data.note,"Review note",500);
      if (!["resolved","dismissed"].includes(String(data.status))) throw new HttpError(400,"Choose resolved or dismissed.");
      if (!await db.prepare("SELECT id FROM party_reports WHERE id=?").bind(id).first()) throw new HttpError(404,"Report not found.");
      await db.batch([db.prepare("UPDATE party_reports SET status=?,review_note=? WHERE id=?").bind(data.status,note,id),db.prepare("INSERT INTO audit_log(actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)").bind(viewer,"party-report."+data.status,"party_report",String(id),note)]);
      return json({ok:true});
    }
    throw new HttpError(405,"Method not allowed.");
  }
  if(path==="/api/parties" && request.method==="GET") {
    const n=limit(url),before=pageCursor(url),fandomInput=url.searchParams.get("fandom"),fandom=fandomInput?(await resolveFandom(db,fandomInput)).id:null;
    const rows=await db.prepare(select+visible+" AND p.id<? AND (? IS NULL OR p.fandom_id=?) ORDER BY p.id DESC LIMIT ?").bind(viewer,viewer,viewer,viewer,viewer,viewer,viewer,before,fandom,fandom,n+1).all();
    return json({items:rows.results.slice(0,n),next:rows.results.length>n?rows.results[n-1].id:null});
  }
  const match=path.match(/^\/api\/parties\/([1-9]\d*)(?:\/(rsvp|report))?$/);
  if(match && request.method==="GET" && !match[2]) {
    const party=await db.prepare(select+visible+" AND p.id=?").bind(viewer,viewer,viewer,viewer,viewer,viewer,viewer,Number(match[1])).first();
    if(!party)throw new HttpError(404,"Listening party not found.");return json({party});
  }
  if(!person)throw new HttpError(401,"Please sign in.");
  await throttle(env,person);
  if(path==="/api/parties" && request.method==="POST") {
    const data=await body(request),fandom=await resolveFandom(db,text(data.fandomId,"Fandom",120)),title=text(data.title,"Title",120),description=text(data.description??"","Description",1500,false),link=stationheadUrl(text(data.stationheadUrl,"Stationhead link",2000)),start=Date.parse(text(data.startsAt,"Start time",40));
    if(!link)throw new HttpError(400,"Use an HTTPS stationhead.com room or share.stationhead.com link.");
    if(!Number.isFinite(start)||start<Date.now()-60_000||start>Date.now()+366*86400_000)throw new HttpError(400,"Choose a start time within the next year.");
    const row=await db.prepare("INSERT INTO listening_parties(fandom_id,host_id,title,description,starts_at,stationhead_url) VALUES(?,?,?,?,?,?) RETURNING id").bind(fandom.id,person.user_id,title,description,new Date(start).toISOString(),link).first();return json({id:row!.id},201);
  }
  if(!match)throw new HttpError(404,"Party route not found.");
  const id=Number(match[1]),row=await db.prepare("SELECT p.id,p.host_id,p.status "+visible+" AND p.id=?").bind(viewer,viewer,id).first<{id:number;host_id:string;status:string}>();
  if(!row)throw new HttpError(404,"Listening party not found.");
  if(match[2]==="report" && request.method==="POST") {
    const data=await body(request);await db.prepare("INSERT INTO party_reports(party_id,reporter_id,reason) VALUES(?,?,?) ON CONFLICT(party_id,reporter_id) DO UPDATE SET reason=excluded.reason").bind(id,viewer,text(data.reason,"Reason",500)).run();return json({ok:true});
  }
  if(match[2]==="rsvp" && request.method==="PUT") {
    const choice=(await body(request)).choice;
    if(!["going","interested","none"].includes(String(choice)))throw new HttpError(400,"Choose going, interested or none.");
    if(choice!=="none"&&["ended","cancelled"].includes(row.status))throw new HttpError(409,"This party is no longer accepting RSVPs.");
    if(choice==="none")await db.prepare("DELETE FROM party_rsvps WHERE party_id=? AND user_id=?").bind(id,viewer).run();
    else await db.prepare("INSERT INTO party_rsvps(party_id,user_id,choice) VALUES(?,?,?) ON CONFLICT(party_id,user_id) DO UPDATE SET choice=excluded.choice").bind(id,viewer,choice).run();return json({ok:true});
  }
  if(!match[2] && request.method==="PATCH") {
    if(row.host_id!==viewer && person.role!=="admin")throw new HttpError(403,"Only the host or an administrator can change this party.");
    const status=(await body(request)).status;
    if(!["live","ended","cancelled"].includes(String(status)))throw new HttpError(400,"Choose live, ended or cancelled.");
    if(["ended","cancelled"].includes(row.status))throw new HttpError(409,"This party is already closed.");
    await db.batch([db.prepare("UPDATE listening_parties SET status=? WHERE id=?").bind(status,id),db.prepare("INSERT INTO audit_log(actor_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)").bind(viewer,"party."+status,"party",String(id),"Host or administrator updated the party status.")]);return json({ok:true});
  }
  throw new HttpError(405,"Method not allowed.");
}
