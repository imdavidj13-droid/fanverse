import { useEffect, useState } from 'react';
import { api, type Page } from './api';
import { navigate, useRoute } from './routes';
import { AppLink } from './Navigation';
import { searchableSubject, type CatalogueSubject } from '../shared/catalogue';
export function CatalogueBrowser() {
    const route = useRoute(), params = new URLSearchParams(location.search), [query, setQuery] = useState(params.get('q') || ''), [items, setItems] = useState<CatalogueSubject[]>([]), [directory, setDirectory] = useState<{
        id: string;
        slug: string;
        name: string;
    }[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [rev, setRev] = useState(0), [next, setNext] = useState<string | null>(null);
    async function loadDirectory(more = false) { try {
        const v = await api<Page<{
            id: string;
            slug: string;
            name: string;
        }>>('/api/fandoms?limit=50' + (more && next ? '&after=' + encodeURIComponent(next) : ''));
        setDirectory(old => more ? [...old, ...v.items] : v.items);
        setNext(v.next as string | null);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    useEffect(() => { void loadDirectory(); }, []);
    useEffect(() => { let active = true; const q = params.get('q') || '', subject = params.get('subject'); setQuery(q); if (!q && !subject) {
        setItems([]);
        return;
    } setBusy(true); setError(''); (subject ? api<CatalogueSubject>('/api/catalogue/subjects/' + subject).then(item => ({ items: [item] })) : api<{
        items: CatalogueSubject[];
    }>('/api/catalogue/search?q=' + encodeURIComponent(q))).then(v => { if (active)
        setItems(v.items.filter(searchableSubject)); }).catch(e => { if (active)
        setError((e as Error).message); }).finally(() => { if (active)
        setBusy(false); }); return () => { active = false; }; }, [route.query, params.get('subject'), rev]);
    async function activate(qid: string) { setBusy(true); setError(''); try {
        const v = await api<{
            fandom?: {
                id: string;
                slug: string;
            };
            review?: boolean;
            status?: string;
        }>('/api/fandoms/activate', 'POST', { qid });
        if (v.fandom) {
            await api('/api/memberships/' + v.fandom.id, 'PUT');
            location.assign('/fandoms/' + v.fandom.slug);
        }
        else
            setNotice(v.status === 'rejected' ? 'This subject was declined by a reviewer.' : 'This subject is in the review queue.');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <section className="cloud-page-heading"><h1>Find your fandom</h1><p>One community per artist, TV show or film. Find the exact subject and join its community.</p><form className="cloud-inline" onSubmit={e => { e.preventDefault(); setRev(v => v + 1); navigate('/catalogue?q=' + encodeURIComponent(query.trim())); }}><input value={query} minLength={2} maxLength={100} required onChange={e => setQuery(e.target.value)} placeholder="Search artists, TV shows and films" aria-label="Search the fandom catalogue"/><button className="primary" disabled={busy}>Search</button></form>{error && <p className="save-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{busy && <p>Searching the catalogue…</p>}{items.map(s => <article className="cloud-event" key={s.qid}><small>{s.kind === 'artist' ? 'Artist' : s.kind === 'tv' ? 'TV series' : 'Film'}</small><h2>{s.name}</h2><p>{s.description}</p><button className="primary" disabled={busy} onClick={() => void activate(s.qid)}>Join fandom</button></article>)}{query && !busy && !items.length && !error && <p>No matching artists, TV shows or films found.</p>}<h2>Community directory</h2><div className="cloud-directory">{directory.map(f => <article key={f.id}><AppLink href={'/fandoms/' + f.slug}><h3>{f.name}</h3></AppLink><button onClick={() => { void api('/api/memberships/' + f.id, 'PUT').then(() => location.assign('/fandoms/' + f.slug)).catch(e => setError((e as Error).message)); }}>Join community</button></article>)}</div>{next && <button onClick={() => void loadDirectory(true)}>More communities</button>}</section>;
}
