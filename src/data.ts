export const fandoms = [
 {id:'taylor',name:'Taylor Swift',symbol:'✦',color:'#bca6d9',members:'128K',description:'The theories, the bridges, the friendship bracelets.'},
 {id:'sabrina',name:'Sabrina Carpenter',symbol:'♡',color:'#edb4a5',members:'92K',description:'A little sweet, a little espresso. All things Sabrina.'},
 {id:'olivia',name:'Olivia Rodrigo',symbol:'★',color:'#a295d7',members:'76K',description:'For the songs that say exactly how you feel.'},
 {id:'screen',name:'TV & Film',symbol:'▣',color:'#8eada2',members:'64K',description:'Your next obsession starts with one more episode.'}
];
export type Post = {id:number;author:string;handle:string;avatar:string;fandom:string;text:string;likes:number;following:boolean;art?:boolean;poll?:string[]};
export const initialPosts:Post[] = [
 {id:1,author:'ella',handle:'swiftie.stories',avatar:'E',fandom:'taylor',text:'There’s something about an entire stadium singing the same bridge together. What’s your favourite concert memory? 💜',likes:1248,following:true,art:true},
 {id:2,author:'mia',handle:'sabrinaspills',avatar:'M',fandom:'sabrina',text:'Important question for the group chat: which song gets the next music video? ✨',likes:486,following:true,poll:['Please Please Please','Espresso','Good Graces','Taste']},
 {id:3,author:'jules',handle:'livsdiary',avatar:'J',fandom:'olivia',text:'Making a playlist for a late-night drive. Give me the Olivia song you would put first. Mine is so american 🦋',likes:382,following:false},
 {id:4,author:'sam',handle:'screenandserotonin',avatar:'S',fandom:'screen',text:'Anyone else finish a series and immediately want to talk about every single detail? Tell me your latest obsession. No spoilers please 🍿',likes:216,following:false}
];
