export type PartyStatus = "scheduled" | "live" | "ended" | "cancelled";
export type PartyRsvp = "going" | "interested" | "none";
export interface ListeningParty {
  id: string | number;
  title: string;
  description: string;
  fandom_id: string;
  fandom_name: string;
  fandom_slug?: string;
  starts_at: string;
  stationhead_url: string;
  status: PartyStatus;
  host_id: string;
  host_name: string;
  host_username: string;
  going: number;
  interested: number;
  rsvp: PartyRsvp;
}
export function stationheadUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["stationhead.com", "www.stationhead.com", "share.stationhead.com"].includes(url.hostname) || url.username || url.password || url.port || url.pathname === "/" || /[\u0000-\u0020\\]/.test(value)) return null;
    // Preserve Stationhead's share-link parameters; never fetch or proxy playback.
    return url.href;
  } catch { return null; }
}
export function partyLabel(party: ListeningParty, now = Date.now()) {
  if (party.status === "live") return "Live · Host confirmed";
  if (party.status === "ended") return "Ended";
  if (party.status === "cancelled") return "Cancelled";
  const delta = Date.parse(party.starts_at) - now;
  if (delta <= 0) return "Scheduled time reached";
  if (delta <= 15 * 60_000) return "Starting soon";
  return "Upcoming";
}
export const partyPath = (id: string | number) => "/parties/" + id;
export function calendarFile(party: ListeningParty) {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const start = new Date(party.starts_at);
  const raw = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fanverse//Listening Parties//EN", "BEGIN:VEVENT", "UID:"+party.id+"@fanverse-party", "DTSTAMP:"+stamp(new Date()), "DTSTART:"+stamp(start), "DTEND:"+stamp(new Date(start.getTime()+60*60_000)), "SUMMARY:"+escape(party.title), "DESCRIPTION:"+escape(party.description+"\nStationhead: "+party.stationhead_url+"\nPlanned duration: one hour; host schedule may vary."), "URL:"+party.stationhead_url, "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", "DESCRIPTION:Listening party starts in 10 minutes", "END:VALARM", "END:VEVENT", "END:VCALENDAR"];
  // Fold by UTF-8 byte length, as calendar readers expect.
  const lines: string[] = [];
  for (const line of raw) { let chunk = ""; for (const char of line) { if (new TextEncoder().encode(chunk+char).length > 73) { lines.push(chunk); chunk = " "; } chunk += char; } lines.push(chunk); }
  return lines.join("\r\n")+"\r\n";
}
