export type BookmarkCollection = { id: string; name: string };
export const collectionNameKey = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
export function restoreCollections(value: unknown, assignments: unknown, saved: unknown) {
  const collections: BookmarkCollection[]=[];
  if(Array.isArray(value)) for(const item of value){
    if(!item || typeof item.id!=='string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) || ['all','unfiled'].includes(item.id) || typeof item.name!=='string')continue;
    const name=item.name.trim().slice(0,40);
    if(name&&!collections.some(c=>c.id===item.id||collectionNameKey(c.name)===collectionNameKey(name)))collections.push({id:item.id,name});
    if(collections.length===20)break;
  }
  const ids=new Set(collections.map(c=>c.id)), savedIds=new Set(Array.isArray(saved)?saved:[]);
  const clean: Record<number,string>={};
  if(assignments&&typeof assignments==='object'&&!Array.isArray(assignments))for(const [key,value]of Object.entries(assignments)){
    const id=Number(key);
    if(Number.isSafeInteger(id)&&id>0&&savedIds.has(id)&&typeof value==='string'&&ids.has(value))clean[id]=value;
  }
  return {bookmarkCollections:collections,bookmarkAssignments:clean};
}
