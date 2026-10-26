// Keep SQLite trigger bodies intact when applying real migrations in Miniflare.
export function statements(sql){const triggers=[];const simple=sql.replace(/CREATE TRIGGER[\s\S]*?END;/g,t=>{triggers.push(t);return '';});return [...simple.split(';').map(s=>s.trim()).filter(Boolean),...triggers];}
