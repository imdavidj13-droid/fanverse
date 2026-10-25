import { useEffect, useState } from "react";
import { api, type LiveProfile, type Page } from "./api";
import { AppLink } from "./Navigation";
import { navigate, useRoute, fandomPath } from "./routes";
import {
  seededSubjects,
  searchableSubject,
  validQid,
  type CatalogueSubject,
} from "../shared/catalogue";
import { SharedFeed } from "./LiveArea";
import { FandomShell, FandomEvents, FandomAbout } from "./FandomPage";
type Planned = { qid: string; name: string; kind: string; sourceUrl: string };
const planKey = "fanverse.catalogue-plan.v1";
function readPlan(): Planned[] {
  try {
    const value = JSON.parse(localStorage.getItem(planKey) || "[]");
    return Array.isArray(value)
      ? value
          .filter((p) => validQid(p.qid) && typeof p.name === "string" && searchableSubject(p))
          .slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
const kindLabel = (kind: string) =>
  ({
    artist: "Artist / performer",
    tv: "TV series",
    film: "Film",
    review: "Needs type review",
    unsupported: "Artist topic / album",
    hub: "General hub",
  })[kind] || kind;
export function CatalogueBrowser({ initialQid }: { initialQid?: string }) {
  const route = useRoute(),
    selectedQid =
      initialQid ||
      new URLSearchParams(location.search).get("subject") ||
      undefined,
    params = new URLSearchParams(location.search),
    [query, setQuery] = useState(params.get("q") || ""),
    [items, setItems] = useState<CatalogueSubject[]>([]),
    [kind, setKind] = useState(params.get("kind") || "all"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false),
    [profile, setProfile] = useState<LiveProfile | null>(null),
    [plan, setPlan] = useState(readPlan),
    [searched, setSearched] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api<{ ready: boolean }>("/api/status");
        if (cancelled) return;
        setReady(status.ready);
        if (status.ready) {
          const me = await api<{ profile: LiveProfile | null }>("/api/me");
          if (!cancelled) setProfile(me.profile);
        }
      } catch {
        /* Public catalogue lookup can still work without account configuration. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams(location.search).get("q") || "";
    setQuery(q);
    if (!q && !selectedQid) {
      setItems([]);
      setSearched(false);
      return;
    }
    setBusy(true);
    setError("");
    setSearched(true);
    (async () => {
      try {
        const result = selectedQid
          ? [
              await api<CatalogueSubject>(
                "/api/catalogue/subjects/" + selectedQid,
              ),
            ]
          : (
              await api<{ items: CatalogueSubject[] }>(
                "/api/catalogue/search?q=" + encodeURIComponent(q),
              )
            ).items;
        if (!cancelled) setItems(result);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.query, selectedQid, revision]);
  useEffect(
    () => setKind(new URLSearchParams(location.search).get("kind") || "all"),
    [location.search],
  );
  function savePlan(next: Planned[]) {
    try {
      localStorage.setItem(planKey, JSON.stringify(next));
      setPlan(next);
      setNotice(
        "Saved to your setup list on this browser. No public fandom has been created.",
      );
    } catch {
      setError(
        "The setup list could not be saved. Browser storage may be full or disabled.",
      );
    }
  }
  async function activate(subject: CatalogueSubject) {
    setBusy(true);
    setError("");
    try {
      const value = await api<{
        fandom?: { id: string; slug: string };
        review?: boolean;
        status?: string;
      }>("/api/fandoms/activate", "POST", { qid: subject.qid });
      if (value.review) {
        setNotice(
          value.status === "rejected"
            ? "This subject has already been declined by a reviewer."
            : "This subject is in the fandom review queue. No duplicate community was created.",
        );
        return;
      }
      if (value.fandom) {
        await api("/api/memberships/" + value.fandom.id, "PUT");
        savePlan(plan.filter((p) => p.qid !== subject.qid));
        navigate("/community?fandom=" + encodeURIComponent(value.fandom.id));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter((item) => searchableSubject(item) && (kind === "all" || item.kind === kind));
  return (
    <>
      <div className="local-page-title">
        <h1>Find your fandom</h1>
        <p>
          One community per artist, show or film. Search the catalogue, then
          choose the exact subject.
        </p>
      </div>
      <form
        className="catalogue-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length < 2) return;
          setRevision((n) => n + 1);
          navigate(
            "/catalogue?q=" +
              encodeURIComponent(query.trim()) +
              (kind !== "all" ? "&kind=" + kind : ""),
          );
        }}
      >
        <label className="sr-only" htmlFor="catalogue-query">
          Search the fandom catalogue
        </label>
        <input
          id="catalogue-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          minLength={2}
          maxLength={100}
          required
          placeholder="Search an artist, TV series or film…"
        />
        <button className="primary" disabled={busy}>
          Search
        </button>
      </form>
      <div className="catalogue-filters">
        <label>
          Subject type
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              const p = new URLSearchParams(location.search);
              if (e.target.value === "all") p.delete("kind");
              else p.set("kind", e.target.value);
              navigate("/catalogue" + (p.size ? "?" + p : ""), {
                replace: true,
                scroll: false,
              });
            }}
          >
            <option value="all">All results</option>
            <option value="artist">Artists & performers</option>
            <option value="tv">TV series</option>
            <option value="film">Films</option>
          </select>
        </label>
        <span>
          {ready
            ? "Shared directory connected"
            : "Catalogue preview · No database needed"}
        </span>
      </div>
      {error && (
        <div className="save-error" role="alert">
          {error}
          <p>
            Try again later. Existing communities and your setup list are still
            available.
          </p>
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {busy && <p className="live-empty">Looking up catalogue records…</p>}
      {!searched && (
        <section className="catalogue-help">
          <h2>Try a subject</h2>
          <div>
            {[
              "Taylor Swift",
              "Sabrina Carpenter",
              "Olivia Rodrigo",
              "Stranger Things",
              "Wicked",
            ].map((name) => (
              <AppLink
                key={name}
                className="secondary"
                href={"/catalogue?q=" + encodeURIComponent(name)}
              >
                {name}
              </AppLink>
            ))}
          </div>
          <p>
            These are search shortcuts, not imported fandoms. Different works
            can share a name, so check the type and description before choosing.
          </p>
        </section>
      )}
      {visible.map((subject) => {
        const seed = seededSubjects.find((s) => s.qid === subject.qid),
          planned = plan.some((p) => p.qid === subject.qid);
        return (
          <article className="catalogue-card" key={subject.qid}>
            <div className="catalogue-card-title">
              <span className="catalogue-kind">{kindLabel(subject.kind)}</span>
              <small>{subject.qid}</small>
            </div>
            <h2>{subject.name}</h2>
            <p>
              {subject.description ||
                "This record needs more context before creating a fandom."}
            </p>
            {subject.aliases.length > 0 && (
              <small className="catalogue-aliases">
                Also known as: {subject.aliases.slice(0, 4).join(" · ")}
              </small>
            )}
            <a
              className="catalogue-source"
              href={subject.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Check the Wikidata record ↗
            </a>
            <div className="catalogue-actions">
              {subject.existing ? (
                <AppLink
                  className="primary"
                  href={
                    "/community?fandom=" +
                    encodeURIComponent(subject.existing.id)
                  }
                >
                  Open existing fandom
                </AppLink>
              ) : seed && !ready ? (
                <AppLink className="primary" href={fandomPath(seed.id)}>
                  Open preview fandom
                </AppLink>
              ) : subject.kind === "unsupported" ? (
                <p>
                  This is an album or related artist topic. Discuss it inside
                  the artist’s fandom.
                </p>
              ) : ready ? (
                profile ? (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => activate(subject)}
                  >
                    {subject.kind === "review"
                      ? "Suggest for review"
                      : "Start & join fandom"}
                  </button>
                ) : (
                  <AppLink className="primary" href="/account">
                    Sign in to continue
                  </AppLink>
                )
              ) : (
                <button
                  className="primary"
                  disabled={planned || plan.length >= 30}
                  onClick={() =>
                    savePlan([
                      ...plan,
                      {
                        qid: subject.qid,
                        name: subject.name,
                        kind: subject.kind,
                        sourceUrl: subject.sourceUrl,
                      },
                    ])
                  }
                >
                  {planned ? "On your setup list" : "Save for setup"}
                </button>
              )}
            </div>
            {!ready && !seed && subject.kind !== "unsupported" && (
              <small>
                Saving this record only stages it locally. Activation waits for
                the database.
              </small>
            )}
            {subject.existing && subject.existing.status !== "active" && (
              <small>
                This record is already managed by the platform. It cannot be
                recreated as another fandom.
              </small>
            )}
          </article>
        );
      })}
      {searched && !busy && !error && visible.length === 0 && (
        <div className="empty-state">
          <h2>No matching catalogue subjects</h2>
          <p>
            Try the artist’s name or the show or film’s title. Search only includes
            artists, TV series and films; albums, products and related topics are excluded.
          </p>
        </div>
      )}
      {plan.length > 0 && (
        <section className="settings-card catalogue-plan">
          <h2>Your setup list</h2>
          <p>
            Saved only on this browser. After account setup, open each record to
            activate it or submit it for review.
          </p>
          {plan.map((item) => (
            <div key={item.qid}>
              <AppLink href={"/catalogue?subject=" + item.qid}>
                {item.name} <small>{item.qid}</small>
              </AppLink>
              <button
                className="text-button"
                aria-label={"Remove " + item.name + " from setup list"}
                onClick={() => savePlan(plan.filter((p) => p.qid !== item.qid))}
              >
                Remove
              </button>
            </div>
          ))}
        </section>
      )}
      <p className="catalogue-attribution">
        Structured catalogue data:{" "}
        <a
          href="https://www.wikidata.org/wiki/Wikidata:Data_access"
          target="_blank"
          rel="noreferrer"
        >
          Wikidata (CC0)
        </a>
        . Search results are not artist endorsements. Images are not imported
        automatically.
      </p>
    </>
  );
}
export function CatalogueFandom() {
  useRoute();
  const section = new URLSearchParams(location.search).get("section") || "discussions";
  const tab = ["discussions", "media", "events", "about"].includes(section) ? section : "discussions";
  const slug = location.pathname.split("/").pop()!,
    qid = slug.match(/-q(\d+)$/)?.[1],
    [fandom, setFandom] = useState<{
      id: string;
      name: string;
      description: string;
      wikidata_id: string;
    } | null>(null),
    [profile, setProfile] = useState<LiveProfile | null>(null),
    [ready, setReady] = useState<boolean | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setReady(null);
    (async () => {
      try {
        const status = await api<{ ready: boolean }>("/api/status");
        if (cancelled) return;
        setReady(status.ready);
        if (status.ready) {
          const row = await api<{ fandom: NonNullable<typeof fandom> }>(
              "/api/fandoms/" + encodeURIComponent(slug),
            ),
            me = await api<{ profile: LiveProfile | null }>("/api/me");
          if (!cancelled) {
            setFandom(row.fandom);
            setProfile(me.profile);
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);
  if (error)
    return (
      <div className="empty-state">
        <h1>Fandom unavailable</h1>
        <p>{error}</p>
        <AppLink href="/catalogue">Find another fandom</AppLink>
      </div>
    );
  if (ready === false)
    return <CatalogueBrowser initialQid={qid ? "Q" + qid : undefined} />;
  if (!fandom) return <p className="live-empty">Opening fandom…</p>;
  return (
    <FandomShell community={fandom} tab={tab} shared onTab={id => navigate(location.pathname + (id === "discussions" ? "" : "?section="+id))}>
      {tab === "discussions" && <SharedFeed profile={profile} fixedFandom={fandom.id} fixedName={fandom.name} />}
      {tab === "events" && <FandomEvents key={fandom.id} id={fandom.id} name={fandom.name} />}
      {tab === "about" && <FandomAbout community={fandom} />}
      {tab === "media" && <div className="fandom-quiet"><h2>A home for fan creations</h2><p>Shared media uploads are still being connected. Text conversations are available in Discussions.</p></div>}
      <p className="fandom-footnote"><a href={"https://www.wikidata.org/wiki/" + fandom.wikidata_id} target="_blank" rel="noreferrer">Catalogue identity: {fandom.wikidata_id}</a></p>
    </FandomShell>
  );
}
