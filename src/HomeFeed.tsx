import { useEffect, useState } from "react";
import { ArrowUpRight, Compass, Headphones, Image, MessageCircle, Search, Sparkles, Users, X } from "lucide-react";
import { fandoms, type Post } from "./data";
import { filterPosts, type State } from "./model";
import { AppLink } from "./Navigation";
import { navigate, fandomPath, useRoute } from "./routes";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import "./home.css";
const feeds = [
  {id:"latest",label:"For you",description:"From the fandoms you’ve joined and the people you follow."},
  {id:"following",label:"Following",description:"Conversations from people you follow, with your own posts included."},
  {id:"fandoms",label:"My fandoms",description:"The conversation across your joined fandoms, with your own posts included."},
  {id:"discover",label:"Discover",description:"Explore conversations beyond your follows and fandoms. Your hidden and muted choices still apply."},
];
const kinds=[['all','Everything'],['media','Photos & art'],['polls','Polls'],['text','Text posts']];
export function HomeFeed({state,update,onNotice,onPublish}:{state:State;update:(fn:(s:State)=>State)=>void;onNotice:(message:string)=>void;onPublish:(post:Post)=>void}) {
  useRoute();
  const params=new URLSearchParams(location.search), feed=feeds.find(f=>f.id===params.get('feed'))||feeds[0], selected=fandoms.find(f=>f.id===params.get('fandom'))?.id||'',kind=kinds.some(([id])=>id===params.get('kind'))?params.get('kind')!:'all',sort=['latest','popular','discussed'].includes(params.get('sort')||'')?params.get('sort')!:'latest',query=params.get('q')||'';
  const [search,setSearch]=useState(query),[count,setCount]=useState(12);
  useEffect(()=>{setSearch(query);setCount(12)},[location.search]);
  function href(change:Record<string,string>){const p=new URLSearchParams(location.search);for(const [key,value]of Object.entries(change)){if(!value||(key==='kind'&&value==='all')||(key==='feed'&&value==='latest')||(key==='sort'&&value==='latest'))p.delete(key);else p.set(key,value);}return '/'+(p.size?'?'+p:'');}
  const base=filterPosts(state,{page:'Home',tab:feed.label,fandom:'',query:''});
  const filtered=base.filter(p=>(!selected||p.fandom===selected)&&(!query||`${p.text} ${p.handle} ${p.author}`.toLowerCase().includes(query.toLowerCase()))&&(kind==='all'||(kind==='media'?Boolean(p.art||p.image):kind==='polls'?Boolean(p.poll?.length):!p.art&&!p.image&&!p.poll?.length)));
  const likes=(p:Post)=>p.likes+Number(state.liked.includes(p.id));
  const timestamp=(p:Post)=>{const date=p.createdAt?Date.parse(p.createdAt):NaN;return Number.isFinite(date)?date:p.id};
  const ordered=[...filtered].sort((a,b)=>sort==='popular'?likes(b)-likes(a)||timestamp(b)-timestamp(a):sort==='discussed'?(state.replies[b.id]?.length||0)-(state.replies[a.id]?.length||0)||timestamp(b)-timestamp(a):timestamp(b)-timestamp(a));
  const scoped=Boolean(selected||kind!=='all'||query);
  return <section className="home-feed">
    <header className="feed-heading"><div><span className="feed-eyebrow">YOUR DAILY DOSE OF FANDOM</span><h1>All your worlds.<br className="feed-mobile-break"/> One place.</h1><p>The songs, the stories, the conversations you came for.</p></div><AppLink className="feed-shared-link" href="/community">Shared feed <ArrowUpRight size={14}/></AppLink></header>
    <nav className="home-feed-tabs" aria-label="Home feed">{feeds.map(f=><AppLink key={f.id} href={href({feed:f.id,fandom:''})} aria-current={f.id===feed.id?'page':undefined} className={f.id===feed.id?'selected':''}>{f.id==='discover'&&<Compass size={13}/>} {f.label}</AppLink>)}</nav>
    <p className="feed-explanation"><Sparkles size={13}/>{feed.description}</p>
    <div className="home-fandom-chips" aria-label="Filter Home by fandom"><AppLink href={href({fandom:''})} aria-current={!selected?'true':undefined} className={!selected?'selected':''}>All fandoms</AppLink>{fandoms.map(f=><AppLink key={f.id} className={selected===f.id?'selected':''} aria-current={selected===f.id?'true':undefined} href={href({fandom:selected===f.id?'':f.id})}><span style={{background:f.color}} aria-hidden="true">{f.symbol}</span>{f.id==='sabrina'?'Sabrina':f.id==='olivia'?'Olivia':f.name}</AppLink>)}</div>
    <div className="feed-discovery-cards"><AppLink href="/catalogue" className="feed-discovery-card catalogue"><Compass size={20}/><div><small>FIND YOUR NEXT OBSESSION</small><strong>There’s a fandom for that.</strong><span>Explore artists, shows & films</span></div><ArrowUpRight size={16}/></AppLink><AppLink href="/parties" className="feed-discovery-card parties"><Headphones size={20}/><div><small>MAKE IT A FAN NIGHT</small><strong>Good music. Your people.</strong><span>Discover Stationhead parties</span></div><ArrowUpRight size={16}/></AppLink></div>
    <Composer profile={state.profile} onPublish={onPublish} onNotice={onNotice} initialFandom={selected||state.joined[0]||'taylor'} key={selected||'home'} context="home"/>
    <div className="home-conversation-heading"><h2>{feed.id==='discover'?'Around the fandoms':'The conversation'}<span>{ordered.length}</span></h2><label><span className="sr-only">Sort home feed</span><select value={sort} onChange={e=>navigate(href({sort:e.target.value}),{scroll:false})}><option value="latest">Latest first</option><option value="popular">Most liked</option><option value="discussed">Most replies</option></select></label></div>
    <form className="home-feed-search" onSubmit={e=>{e.preventDefault();navigate(href({q:search.trim()}),{scroll:false})}}><Search size={15}/><input aria-label="Search this feed" placeholder="Find a conversation in this feed…" value={search} onChange={e=>setSearch(e.target.value)} maxLength={100}/><button type="submit">Search</button></form>
    <div className="home-content-filters" aria-label="Post type">{kinds.map(([id,label])=><AppLink key={id} href={href({kind:id})} aria-current={kind===id?'true':undefined} className={kind===id?'selected':''}>{id==='media'&&<Image size={12}/>} {id==='polls'&&<MessageCircle size={12}/>} {label}</AppLink>)}{scoped&&<AppLink className="feed-clear" href={href({kind:'all',fandom:'',q:''})}><X size={12}/>Clear filters</AppLink>}</div>
    <div className="home-posts">{ordered.slice(0,count).map(p=><div className="home-post-wrap" key={p.id}>{feed.id==='latest'&&<p className="home-post-reason">{p.own?<><Sparkles size={11}/> Your post</>:state.joined.includes(p.fandom)?<><Users size={11}/> From your {fandoms.find(f=>f.id===p.fandom)?.name} fandom</>:<><Users size={11}/> You follow @{p.handle}</>}</p>}<PostCard post={p} state={state} update={update} onCommunity={()=>navigate(fandomPath(p.fandom))} onNotice={onNotice}/></div>)}</div>
    {!ordered.length&&<div className="home-feed-empty"><Compass size={28}/><h2>{scoped?'Nothing matches just yet':feed.id==='following'?'Find your kind of people':'Make room for a new obsession'}</h2><p>{scoped?'Try another fandom, post type or search. Your follow and mute preferences still apply.':feed.id==='following'?'Follow a fan from their profile or post menu, and their conversations will appear here.':'Join a fandom or browse Discover to find a conversation worth jumping into.'}</p><div>{scoped&&<AppLink className="secondary" href={href({fandom:'',kind:'all',q:''})}>Clear filters</AppLink>}<AppLink className="primary" href={href({feed:'discover',fandom:'',kind:'all',q:''})}>Explore Discover</AppLink></div></div>}
    {ordered.length>count?<button className="secondary home-load-more" onClick={()=>setCount(n=>n+12)}>Show more conversations ({ordered.length-count})</button>:ordered.length>0&&<div className="feed-caught-up"><span>✦</span><strong>You’re caught up with this preview.</strong><p>Find another conversation in Discover, or start one of your own.</p><AppLink href={href({feed:'discover',fandom:'',kind:'all',q:''})}>Explore more fandoms <ArrowUpRight size={13}/></AppLink></div>}
    <p className="feed-preview-footnote">Preview conversations and activity are saved in this browser. Sample engagement is labelled on demo posts.</p>
  </section>;
}

export function HomeSidebar({state}:{state:State}) {
  const posts=filterPosts(state,{page:'Home',tab:'For you',fandom:'',query:''}).slice().sort((a,b)=>b.likes-a.likes).slice(0,3);
  return <><section className="rail-card home-orbit"><span className="feed-eyebrow">IN YOUR ORBIT</span><h2>Conversation starters</h2><p>From your preview fandoms and follows.</p>{posts.map((p,i)=><AppLink className="home-orbit-post" href={'/posts/'+p.id} key={p.id}><span>0{i+1}</span><div><small>{fandoms.find(f=>f.id===p.fandom)?.name}</small><strong>{p.text}</strong><small>@{p.handle} · {p.own?'Your post':'Sample conversation'}</small></div><ArrowUpRight size={13}/></AppLink>)}{!posts.length&&<p>Join a fandom or follow someone to find conversations here.</p>}</section><section className="rail-card feed-settings-card"><Sparkles size={21}/><h2>A feed that feels like you.</h2><p>Choose your fandoms, mute words and decide what belongs on Home.</p><AppLink href="/settings">Tune your preferences <ArrowUpRight size={13}/></AppLink></section></>;
}
