import {
  ids,
  catalogueSearchResults,
  toSubject,
  validQid,
  type CatalogueSubject,
  type Entity,
} from "../shared/catalogue";
import { HttpError } from "./http";
import type { Env } from "./types";
const apiUrl = "https://www.wikidata.org/w/api.php";
const agent =
  "FanverseCatalogue/0.1 (https://github.com/imdavidj13-droid/fanverse)";
let upstreamTail: Promise<unknown> = Promise.resolve();
const inFlight = new Map<string, Promise<Record<string, unknown>>>();
export class WikidataClient {
  constructor(private env: Env) {}
  async request(params: Record<string, string>) {
    const url = new URL(apiUrl);
    url.search = new URLSearchParams({ format: "json", ...params }).toString();
    const key = new Request(url),
      cache =
        typeof caches !== "undefined"
          ? await caches.open("wikidata-catalogue-v1")
          : null;
    const hit = await cache?.match(key);
    if (hit) return hit.json() as Promise<Record<string, unknown>>;
    const existing = inFlight.get(url.href);
    if (existing) return existing;
    if (inFlight.size >= 12)
      throw new HttpError(
        503,
        "The catalogue search queue is busy. Please try again shortly.",
      );
    const work = upstreamTail.then(async () => {
      const queuedHit = await cache?.match(key);
      if (queuedHit) return (await queuedHit.json()) as Record<string, unknown>;
      const source = this.env.CATALOGUE_SOURCE;
      let response: Response;
      try {
        response = source
          ? await source.fetch(
              new Request(url, { headers: { "User-Agent": agent } }),
            )
          : await fetch(url, {
              headers: { "User-Agent": agent },
              signal: AbortSignal.timeout(10000),
            });
      } catch {
        throw new HttpError(
          503,
          "The catalogue is temporarily unavailable. Please try again later.",
        );
      }
      if (response.status === 429 || response.status === 503) {
        const retry = response.headers.get("Retry-After");
        throw new HttpError(
          503,
          "The catalogue is busy. Please try again" +
            (retry && /^\d+$/.test(retry)
              ? " in " + Math.min(Number(retry), 300) + " seconds"
              : " later") +
            ".",
        );
      }
      if (!response.ok)
        throw new HttpError(503, "The catalogue could not be reached.");
      const value = (await response.json()) as Record<string, unknown>;
      if (value.error)
        throw new HttpError(
          503,
          "The catalogue could not complete this search.",
        );
      if (cache)
        await cache.put(
          key,
          new Response(JSON.stringify(value), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control":
                "public,max-age=" +
                (params.action === "wbgetentities" ? "86400" : "900"),
            },
          }),
        );
      return value;
    });
    upstreamTail = work.then(
      () => undefined,
      () => undefined,
    );
    inFlight.set(url.href, work);
    try {
      return await work;
    } finally {
      inFlight.delete(url.href);
    }
  }
  async entities(qids: string[]) {
    const result = await this.request({
      action: "wbgetentities",
      ids: qids.join("|"),
      props: "labels|descriptions|aliases|claims",
      languages: "en|mul",
      redirects: "yes",
    });
    return (result.entities as Record<string, Entity>) || {};
  }
  async hydrate(qids: string[]) {
    const entities = await this.entities(qids),
      taxonomy: Record<string, Entity> = {};
    let frontier = Array.from(
      new Set(
        Object.values(entities).flatMap((e) => [
          ...ids(e, "P31"),
          ...ids(e, "P106"),
        ]),
      ),
    ).slice(0, 35);
    const roots = new Set([
      "Q5",
      "Q639669",
      "Q177220",
      "Q33999",
      "Q5398426",
      "Q11424",
      "Q215380",
      "Q482994",
    ]);
    for (let depth = 0; depth < 2; depth++) {
      const unknown = frontier
        .filter((id) => !roots.has(id) && !taxonomy[id])
        .slice(0, 35);
      if (!unknown.length) break;
      const batch = await this.entities(unknown);
      Object.assign(taxonomy, batch);
      frontier = Array.from(
        new Set(Object.values(batch).flatMap((e) => ids(e, "P279"))),
      );
    }
    const subjects = Object.values(entities)
      .map((e) => toSubject(e, taxonomy))
      .filter((s): s is CatalogueSubject => Boolean(s));
    return Array.from(
      new Map(subjects.map((subject) => [subject.qid, subject])).values(),
    );
  }
  async search(query: string) {
    const value = await this.request({
      action: "wbsearchentities",
      search: query,
      language: "en",
      uselang: "en",
      type: "item",
      limit: "20",
    });
    const results = (value.search as { id: string }[]) || [];
    const qids = Array.from(new Set(results.map((r) => r.id).filter(validQid)));
    if (!qids.length) return [];
    return catalogueSearchResults(await this.hydrate(qids), query);
  }
  async get(qid: string) {
    if (!validQid(qid)) throw new HttpError(400, "Invalid catalogue ID.");
    const subjects = await this.hydrate([qid]);
    if (!subjects[0]) throw new HttpError(404, "Catalogue subject not found.");
    return subjects[0];
  }
}
