import { useEffect, useState } from 'react';
import { Headphones, ArrowUpRight, CalendarDays } from 'lucide-react';
import { api, type LiveProfile, type Page } from './api';
import { AppLink } from './Navigation';
import { navigate } from './routes';
import { stationheadUrl, partyPath, partyLabel, calendarFile, type ListeningParty } from '../shared/parties';
import './parties.css';
function PartyCard({ party: p }: {
    party: ListeningParty;
}) { return <article className="listening-card"><div className="listening-art"><Headphones /></div><div className="listening-card-body"><span className={'party-status ' + p.status}>{partyLabel(p)}</span><AppLink href={partyPath(p.id)}><h3>{p.title}</h3></AppLink><p>{p.fandom_name}</p><small>{new Date(p.starts_at).toLocaleString('en-GB')}</small></div></article>; }
export function ListeningPartyBoard({ fandom, embedded = false }: {
    fandom?: {
        id: string;
        name: string;
    };
    embedded?: boolean;
}) {
    const [items, setItems] = useState<ListeningParty[]>([]), [next, setNext] = useState<string | number | null>(null), [options, setOptions] = useState<{
        id: string;
        name: string;
    }[]>([]), [error, setError] = useState(''), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [filter, setFilter] = useState('upcoming');
    async function load(more = false) { setBusy(true); try {
        const p = new URLSearchParams();
        if (fandom)
            p.set('fandom', fandom.id);
        if (more && next)
            p.set('before', String(next));
        const v = await api<Page<ListeningParty>>('/api/parties?' + p);
        setItems(old => more ? [...old, ...v.items] : v.items);
        setNext(v.next);
        setError('');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    useEffect(() => { void load(); if (!fandom)
        api<Page<{
            id: string;
            name: string;
        }>>('/api/fandoms?limit=50').then(v => setOptions(v.items)).catch(e => setError((e as Error).message)); }, [fandom?.id]);
    return <section className={'listening-board ' + (embedded ? 'embedded' : '')}><div className="listening-heading"><div><span className="fandom-eyebrow">MUSIC BRINGS US TOGETHER</span><h1>{embedded ? 'Listening parties' : 'Your next fan night'}</h1><p>Plan here. Listen together on Stationhead.</p></div><Headphones size={30}/></div>{error && <p className="save-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></p>}<div className="cloud-inline"><button className="primary" onClick={() => setOpen(v => !v)}>Create listening party</button><select aria-label="Party filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="upcoming">Upcoming</option><option value="all">All parties</option></select></div>{open && <form className="listening-form" onSubmit={async (e) => { e.preventDefault(); const v = new FormData(e.currentTarget); setBusy(true); try {
        const room = stationheadUrl(String(v.get('url')));
        if (!room)
            throw Error('Use a valid Stationhead room or share link.');
        const result = await api<{
            id: number;
        }>('/api/parties', 'POST', { fandomId: fandom?.id || v.get('fandom'), title: v.get('title'), description: v.get('description'), startsAt: new Date(String(v.get('start'))).toISOString(), stationheadUrl: room });
        navigate(partyPath(result.id));
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }}>{!fandom && <label>Fandom<select name="fandom" required>{options.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}<label>Party title<input name="title" maxLength={120} required/></label><label>About<textarea name="description" maxLength={1500}/></label><label>Start date and time<input name="start" type="datetime-local" required/></label><label>Stationhead room or share link<input name="url" type="url" maxLength={2000} required placeholder="https://www.stationhead.com/yourstation"/></label><button className="primary" disabled={busy}>Publish listening party</button></form>}<div className="listening-list">{items.filter(p => filter === 'all' || !['ended', 'cancelled'].includes(p.status)).map(p => <PartyCard key={p.id} party={p}/>)}</div>{!items.length && !error && !busy && <div className="listening-empty"><Headphones /><h3>Start the next fan night</h3><p>No parties yet. Add a real Stationhead room and invite your fandom.</p></div>}{busy && <p>Loading…</p>}{next && <button disabled={busy} onClick={() => void load(true)}>Load more parties</button>}<p className="listening-footnote">Music plays on Stationhead. Its account and subscription requirements apply.</p></section>;
}
export function ListeningPartyDetail() {
    const id = location.pathname.split('/').pop(), [party, setParty] = useState<ListeningParty | null>(null), [me, setMe] = useState<LiveProfile | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
    async function load() { try {
        const [v, m] = await Promise.all([api<{
                party: ListeningParty;
            }>('/api/parties/' + id), api<{
                profile: LiveProfile;
            }>('/api/me')]);
        setParty(v.party);
        setMe(m.profile);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    useEffect(() => { void load(); }, [id]);
    async function act(path: string, method: string, data: unknown) { setBusy(true); try {
        await api(path, method, data);
        await load();
        return true;
    }
    catch (e) {
        setError((e as Error).message);
        return false;
    }
    finally {
        setBusy(false);
    } }
    if (!party)
        return <section className="listening-board"><h1>{error ? 'Party unavailable' : 'Opening party…'}</h1>{error && <p role="alert">{error}</p>}</section>;
    const closed = ['ended', 'cancelled'].includes(party.status), owner = me?.user_id === party.host_id || me?.role === 'admin';
    return <section className="listening-board"><AppLink href="/parties">← Listening parties</AppLink><div className="party-detail-cover"><Headphones size={45}/><span>STATIONHEAD LISTENING PARTY</span><h1>{party.title}</h1><p>{party.fandom_name}</p></div><p className={'party-status ' + party.status}>{partyLabel(party)}</p><p>{new Date(party.starts_at).toLocaleString('en-GB')}</p><AppLink href={'/fans/' + party.host_username}>Hosted by {party.host_name}</AppLink><p className="party-description">{party.description}</p>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<div className="party-rsvp"><span>{party.going} going · {party.interested} interested</span>{!closed && ['going', 'interested'].map(choice => <button className={party.rsvp === choice ? 'primary' : 'secondary'} disabled={busy} key={choice} onClick={() => void act('/api/parties/' + id + '/rsvp', 'PUT', { choice: party.rsvp === choice ? 'none' : choice })}>{choice === 'going' ? 'Going' : 'Interested'}</button>)}</div>{!closed && <a className="primary" href={stationheadUrl(party.stationhead_url) || undefined} target="_blank" rel="noopener noreferrer">Open Stationhead room <ArrowUpRight size={15}/></a>}<div className="party-detail-actions"><button className="secondary" onClick={() => { const url = URL.createObjectURL(new Blob([calendarFile(party)], { type: 'text/calendar;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'listening-party.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}><CalendarDays size={15}/>Add to calendar</button><AppLink href={'/community?fandom=' + party.fandom_id}>Fandom discussion</AppLink></div>{owner && !closed && <section className="party-host-controls"><h2>Host controls</h2><p>Mark live only after you start broadcasting on Stationhead.</p>{['live', 'ended', 'cancelled'].filter(s => s !== party.status).map(status => <button disabled={busy} key={status} onClick={() => void act('/api/parties/' + id, 'PATCH', { status })}>{status === 'live' ? 'Mark live' : status === 'ended' ? 'End party' : 'Cancel party'}</button>)}</section>}<details><summary>Report this party</summary><form className="cloud-form" onSubmit={async (e) => { e.preventDefault(); if(await act('/api/parties/' + id + '/report', 'POST', { reason: new FormData(e.currentTarget).get('reason') })) setNotice('Report submitted to moderators.'); }}><textarea name="reason" required maxLength={500} aria-label="Report reason"/><button disabled={busy}>Submit report</button></form></details></section>;
}
export function PartiesRail() { const [items, setItems] = useState<ListeningParty[]>([]), [error, setError] = useState(''); useEffect(() => { api<Page<ListeningParty>>('/api/parties?limit=3').then(v => setItems(v.items.filter(p => !['ended', 'cancelled'].includes(p.status)))).catch(e => setError((e as Error).message)); }, []); return <section className="rail-card"><h2>Listening parties</h2>{items.map(p => <PartyCard key={p.id} party={p}/>)}{error && <p>{error}</p>}{!items.length && !error && <p>No upcoming parties yet.</p>}<AppLink href="/parties">Browse and create parties ↗</AppLink></section>; }
