export type SubjectKind = "artist" | "tv" | "film" | "review" | "unsupported";
export interface CatalogueSubject {
  qid: string;
  name: string;
  description: string;
  aliases: string[];
  kind: SubjectKind;
  sourceUrl: string;
  revision: number | null;
  existing?: { id: string; slug: string; status: string } | null;
}
export interface Entity {
  id?: string;
  lastrevid?: number;
  missing?: unknown;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<
    string,
    {
      rank?: string;
      mainsnak?: { snaktype?: string; datavalue?: { value?: { id?: string } } };
    }[]
  >;
}
export const seededSubjects = [
  {
    id: "taylor",
    qid: "Q26876",
    slug: "taylor-swift",
    name: "Taylor Swift",
    kind: "artist",
  },
  {
    id: "sabrina",
    qid: "Q7396400",
    slug: "sabrina-carpenter",
    name: "Sabrina Carpenter",
    kind: "artist",
  },
  {
    id: "olivia",
    qid: "Q63243883",
    slug: "olivia-rodrigo",
    name: "Olivia Rodrigo",
    kind: "artist",
  },
] as const;
export const validQid = (value: string) => /^Q[1-9]\d{0,12}$/.test(value);
export const normalizeName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function subjectSlug(name: string, qid: string) {
  const base =
    normalizeName(name)
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .replace(/ +/g, "-")
      .slice(0, 70) || "fandom";
  return base + "-" + qid.toLowerCase();
}
export function ids(entity: Entity, property: string) {
  return (entity.claims?.[property] || [])
    .filter((c) => c.rank !== "deprecated" && c.mainsnak?.snaktype === "value")
    .map((c) => c.mainsnak?.datavalue?.value?.id)
    .filter((id): id is string => Boolean(id && validQid(id)));
}
export function classifySubject(
  entity: Entity,
  taxonomy: Record<string, Entity>,
): SubjectKind {
  const closure = (start: string[]) => {
    const found = new Set(start);
    let frontier = start;
    for (let depth = 0; depth < 3; depth++) {
      const next: string[] = [];
      for (const id of frontier)
        for (const parent of ids(taxonomy[id] || {}, "P279"))
          if (!found.has(parent)) {
            found.add(parent);
            next.push(parent);
          }
      frontier = next;
    }
    return found;
  };
  const types = closure(ids(entity, "P31")),
    jobs = closure(ids(entity, "P106"));
  if (types.has("Q482994")) return "unsupported";
  if (types.has("Q5"))
    return ["Q639669", "Q177220", "Q33999"].some((id) => jobs.has(id))
      ? "artist"
      : "review";
  if (types.has("Q5398426")) return "tv";
  if (types.has("Q11424")) return "film";
  if (types.has("Q215380")) return "artist";
  return "review";
}
export function toSubject(
  entity: Entity,
  taxonomy: Record<string, Entity>,
): CatalogueSubject | null {
  const qid = entity.id || "",
    name = (entity.labels?.en || entity.labels?.mul)?.value;
  if (!validQid(qid) || !name || "missing" in entity) return null;
  return {
    qid,
    name: name.slice(0, 200),
    description: (entity.descriptions?.en?.value || "").slice(0, 600),
    aliases: Array.from(
      new Set(
        [...(entity.aliases?.en || []), ...(entity.aliases?.mul || [])]
          .map((a) => a.value.trim())
          .filter(Boolean),
      ),
    ).slice(0, 25),
    kind: classifySubject(entity, taxonomy),
    sourceUrl: "https://www.wikidata.org/wiki/" + qid,
    revision: Number.isSafeInteger(entity.lastrevid) ? entity.lastrevid! : null,
  };
}

// Public discovery contains fandom subjects, rather than everything mentioning them.
export function searchableSubject(subject: { kind: string }) {
  return ["artist", "tv", "film"].includes(subject.kind);
}
export function catalogueSearchResults(subjects: CatalogueSubject[], query: string) {
  const eligible = subjects.filter(searchableSubject);
  const name = normalizeName(query);
  const exact = eligible.filter(subject => normalizeName(subject.name) === name);
  const aliases = eligible.filter(subject =>
    subject.aliases.some(label => normalizeName(label) === name),
  );
  // Keep distinct identities with the same name; never deduplicate by display title.
  return exact.length ? exact : aliases.length ? aliases : eligible;
}
