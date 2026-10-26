export const fandoms = [
  {
    id: "taylor",
    name: "Taylor Swift",
    symbol: "✦",
    color: "#bca6d9",
    members: "0",
    description: "The theories, the bridges, the friendship bracelets.",
  },
  {
    id: "sabrina",
    name: "Sabrina Carpenter",
    symbol: "♡",
    color: "#edb4a5",
    members: "0",
    description: "A little sweet, a little espresso. All things Sabrina.",
  },
  {
    id: "olivia",
    name: "Olivia Rodrigo",
    symbol: "★",
    color: "#a295d7",
    members: "0",
    description: "For the songs that say exactly how you feel.",
  },
  {
    id: "screen",
    name: "TV & Film",
    symbol: "▣",
    color: "#8eada2",
    members: "0",
    description: "Your next obsession starts with one more episode.",
  },
];
export type Post = {
  id: number;
  author: string;
  handle: string;
  avatar: string;
  fandom: string;
  text: string;
  likes: number;
  following: boolean;
  art?: boolean;
  poll?: string[];
  pollCounts?: number[];
  own?: boolean;
  image?: string;
  imageAlt?: string;
  createdAt?: string;
  spoiler?: boolean;
};
