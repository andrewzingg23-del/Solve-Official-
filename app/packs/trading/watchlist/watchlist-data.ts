// Memecoin signal watchlist — data extracted from the Oct 2026 deep-research
// report (~/workspace/research_notes/reputable-memecoin-accounts-20261008-0015).
// Every caveat is preserved verbatim-in-spirit: no account here is a trade
// recommendation. Follower counts are dated snapshots, not live reads.

export type WatchTier = "safety" | "traders" | "commentators" | "media";

export interface WatchAccount {
  name: string;
  handle: string;
  platform: string;
  role: string;
  knownFor: string;
  whyTrusted: string;
  caveat: string;
  tier: WatchTier;
}

export const TIERS: { id: WatchTier; title: string; blurb: string }[] = [
  {
    id: "safety",
    title: "On-chain safety & data",
    blurb: "The verify-before-you-buy layer. Timestamped, checkable data — no calls to sell you.",
  },
  {
    id: "traders",
    title: "Traders with documented receipts",
    blurb: "Real on-chain receipts. Every one carries a real caveat — read it before anything else.",
  },
  {
    id: "commentators",
    title: "Honest commentators",
    blurb: "Signal-adjacent, not callers. Sanity checks, not entries.",
  },
  {
    id: "media",
    title: "Research & media",
    blurb: "Context, not conviction. No personal track records here.",
  },
];

export const ACCOUNTS: WatchAccount[] = [
  // ——— Tier 1: on-chain safety & data ———
  {
    name: "ZachXBT",
    handle: "@zachxbt",
    platform: "X",
    role: "On-chain sleuth / fraud investigator",
    knownFor:
      "Exposing memecoin presale abandonments ($26.7M across 12 Solana presales), the GROK deployer scandal, the Murad hidden-wallet allegations, and the Lark Davis dump allegations.",
    whyTrusted:
      "Fraud investigation; never a promotional channel. No calls, no promos, no token — nothing to sell. ~1.0M followers.",
    caveat: "Not a signal account. He's the vetting layer, not the idea layer.",
    tier: "safety",
  },
  {
    name: "Bubblemaps",
    handle: "@bubblemaps",
    platform: "X + web app",
    role: "Wallet clustering / rug-pull detection",
    knownFor:
      "Bubble-map visualizations of holder distribution; investigated TRUMP, MELANIA, Hawk Tuah. Sept 15, 2026: memecoin discovery feed that pre-filters insider clusters, plus a Bubblemaps score.",
    whyTrusted:
      "Method is public and falsifiable — compare clusters vs. published tokenomics. Integrated with CoinGecko, DexScreener, Pump.fun. Revenue comes from tools and data, not calls.",
    caveat:
      "The Sept 2026 revamp coverage is largely paid press releases; the core method is independently corroborated.",
    tier: "safety",
  },
  {
    name: "Lookonchain",
    handle: "@lookonchain",
    platform: "X + lookonchain.com",
    role: "Smart-money / whale flow tracking",
    knownFor:
      "Timestamped whale and smart-money transaction threads with tx links. First major reporter on the Oct 2026 Frogman $4M wallet hack.",
    whyTrusted:
      "Cited across crypto press. Data-first, no calls, no token.",
    caveat:
      "A 2024 piece aired community skepticism that highlighted trades could funnel retail into rugs; nothing recent repeats it. Treat as a data feed, not a buy signal.",
    tier: "safety",
  },
  {
    name: "EmberCN",
    handle: "@EmberCN",
    platform: "X (Chinese-language)",
    role: "On-chain analyst",
    knownFor:
      "First to flag the Frogman hack (Oct 7, 2026) with loss estimates; tracked a 2015 Ethereum ICO whale realizing ~$193M profit (3,655x).",
    whyTrusted: "Consistently first and accurate on wallet movements; widely cited by crypto press.",
    caveat: "Posts in Chinese — needs translation for an English watchlist.",
    tier: "safety",
  },
  {
    name: "ai_9684xtpa",
    handle: "@ai_9684xtpa",
    platform: "X (Chinese-language)",
    role: "On-chain analyst",
    knownFor:
      "Whale accumulation/distribution tracking — e.g. $32M ETH accumulation; a WBTC→ETH rotation netting $5.2M.",
    whyTrusted: "Checkable, timestamped flow data; cited by Lookonchain.",
    caveat: "Chinese-language.",
    tier: "safety",
  },
  {
    name: "Arkham",
    handle: "@arkham",
    platform: "X + arkhamintel.com",
    role: "Labeled-wallet data platform",
    knownFor:
      "Entity-labeled wallets and public dashboards; its data underpinned reporting on Bonkguy's $20M drawdown (Mar 2026) and Murad's $14.5M tracked net worth (Sept 2026).",
    whyTrusted: "Data platform with public dashboards others audit. No calls.",
    caveat: "A platform, not a person — it shows you wallets, not what to do about them.",
    tier: "safety",
  },
  // ——— Tier 2: traders with documented receipts ———
  {
    name: "Bonkguy (Unipcs)",
    handle: "@Unipcs",
    platform: "X",
    role: "Memecoin trader — FOMO-verified #1 all-time",
    knownFor:
      "$16K → ~$20M peak unrealized on a leveraged BONK long (2023–24), narrated live through every correction. USELESS evangelism in 2025; Robinhood-chain memes in 2026; portfolio crossed $20M again in Sept 2026.",
    whyTrusted:
      "The most completely documented public trade in memecoin history — timestamped posts plus on-chain verification via the FOMO leaderboard (avg holding time ~5d 10h: genuine conviction holding). He also narrated the downside: total liquidation in the Oct 2025 cascade before rebuilding.",
    caveat:
      "Leverage made and unmade him — wiped out once. Portfolio figures across sources are volatile dated snapshots. Copy-trading him is extremely high risk.",
    tier: "traders",
  },
  {
    name: "Ansem",
    handle: "@blknoiz06",
    platform: "X",
    role: "Solana / memecoin trader",
    knownFor:
      "Early SOL call (~$1.50), early BONK and WIF conviction with on-chain-visible receipts. His tweets move small caps within minutes.",
    whyTrusted: "Earned influence through early, timestamped calls rather than paid promo.",
    caveat:
      "1.4M followers means you buy after his audience — pure exit-liquidity risk. In 2026 his activity became directly connected to the $ANSEM memecoin with reported substantial wallet holdings: a direct commercial conflict when interpreting his posts.",
    tier: "traders",
  },
  {
    name: "Murad Mahmudov",
    handle: "@MustStopMurad",
    platform: "X",
    role: "“Memecoin supercycle” thesis",
    knownFor:
      "Token2049 (2024) memecoin-supercycle thesis; SPX6900 +10,500% in the year after his endorsement; turned <$2M into ~$70M on paper (peak July 2025); preaches never selling.",
    whyTrusted:
      "On-chain receipts are real and extraordinary; his inactivity is verifiable — trackers show zero realized P/L (never sold the top, never capitulated the bottom; ~$67M → ~$8M by Apr 2026, back to ~$14.5M by Sept 2026).",
    caveat:
      "Heavy: ZachXBT alleged front-running (a wallet bought 1% of MIN supply one hour before Murad's promo) — unanswered. His Adaptive Capital fund collapsed in 2020. His entries are ~100x below any follower's. SPX fell >80% from highs. Prophet or top signal is actively debated.",
    tier: "traders",
  },
  {
    name: "Hsaka",
    handle: "@HsakaTrades",
    platform: "X",
    role: "Trader, order-flow",
    knownFor:
      "Early positioning on major moves; documented May 2024 PEPE “dethrone SHIB” call — PEPE rallied ~71% in days and climbed into the top 20 by market cap.",
    whyTrusted:
      "Peer-respected, posts analysis rather than hype, no paid-promo history found. ~550K+ followers.",
    caveat: "General trader, not memecoin-exclusive. No public portfolio dashboard like Murad/Bonkguy.",
    tier: "traders",
  },
  {
    name: "Threadguy",
    handle: "@notthreadguy",
    platform: "X + Twitch/YouTube",
    role: "Markets media — daily live stream",
    knownFor:
      "The biggest daily live crypto markets stream; long-form interviews. Runs counterparty.tv with a public disclosures page.",
    whyTrusted:
      "Live, uneditable format is harder to fake than tweets; discloses positions; survived the LIBRA scandal and rebuilt into a genuine media operation.",
    caveat: "Influence is real-time attention — stream mentions move prices instantly. Entertainment + news, not a call service.",
    tier: "traders",
  },
  // ——— Tier 3: honest commentators ———
  {
    name: "Cobie",
    handle: "@cobie",
    platform: "X",
    role: "Market commentator, ex-UpOnly",
    knownFor:
      "Sharp, infrequent market commentary; exposed 2022 Coinbase insider trading on-chain (led to SEC/DOJ action); openly admitted FTX losses; burned a 60%-of-supply UPONLY memecoin airdrop rather than promote it.",
    whyTrusted: "1.2M followers, zero paid promotions, anti-shill on record.",
    caveat: "Posts in bursts, then goes quiet. Now runs the Base App (2026) — a Base-ecosystem conflict to discount.",
    tier: "commentators",
  },
  {
    name: "DonAlt",
    handle: "@CryptoDonAlt",
    platform: "X",
    role: "Veteran trader",
    knownFor: "Long-running technical and market-structure commentary. ~784K followers.",
    whyTrusted: "Longevity and consistency; no hype-call or paid-promo history surfaced.",
    caveat: "General trader — memecoin-adjacent at best. A sanity-check follow, not a signal source.",
    tier: "commentators",
  },
  // ——— Tier 4: research / media ———
  {
    name: "AirdropAlert",
    handle: "airdropalert.com/blogs",
    platform: "Web",
    role: "KOL research series",
    knownFor:
      "Firsthand, dated profiles of meme KOLs with an explicit “attention signal, never conviction” framework and copy-trade risk ratings.",
    whyTrusted:
      "The only outlet found doing sustained, critical (not promotional) KOL research, with author skin-in-the-game disclosure.",
    caveat: "A media outlet, not a trader. Its risk ratings are editorial judgment.",
    tier: "media",
  },
  {
    name: "Unchained",
    handle: "unchainedcrypto.com",
    platform: "Podcast",
    role: "Crypto media — The Chopping Block",
    knownFor:
      "Sept 10, 2026 episode with the FOMO co-founder defending the memecoin trenches; Feb 2025 “memecoin reckoning” episode (Bybit hack, LIBRA, Vape Cabal).",
    whyTrusted: "Established outlet, adversarial interview format, no token sales.",
    caveat: "General crypto media; trenches coverage is periodic, not a dedicated feed.",
    tier: "media",
  },
  {
    name: "DeFi Education",
    handle: "defieducation.substack.com",
    platform: "Substack",
    role: "Trenches newsletter",
    knownFor:
      "“The Trenches Are Back, But There's a Catch” (Sept 2026) — frames memecoin trenches as a risk-appetite signal, not a buy list.",
    whyTrusted: "Risk-aware framing is the opposite of hype-farming.",
    caveat: "Thin evidence base — a single data point; author track record not established. A watch, not a recommendation.",
    tier: "media",
  },
];

export interface ViralVerdict {
  handle: string;
  followers: string;
  bio: string;
  finding: string;
  verdict: string;
}

export const VIRAL_VERDICTS: ViralVerdict[] = [
  {
    handle: "@savipww",
    followers: "2–5K",
    bio: "“Deep into AI & Quant since 2022.”",
    finding:
      "No evidence of the claimed GROKBOT+JEV autonomous trading setup anywhere — no calls, no track record, no viral posts. “GROKBOT” resolves to a pump.fun ticker and an unrelated xAI Slack bot.",
    verdict: "Not credible as a signal source. Do not add. (Obscurity is not a clean bill of health.)",
  },
  {
    handle: "@defileo",
    followers: "~40K–53K",
    bio: "“DeFi & AI insights | Quality over Quantity.”",
    finding:
      "High-volume DeFi/AI threadoor. Not a memecoin account — no memecoin calls or track record found, and no scam allegations either.",
    verdict: "Neutral-to-skip. General DeFi noise, not memecoin alpha.",
  },
  {
    handle: "@MAXdeg0",
    followers: "4K–6K",
    bio: "“DeFi lover | DM open for collab.” DEX ambassador.",
    finding: "Small DeFi account. “DM open for collab” is explicit promo-for-hire signaling.",
    verdict: "Not credible. Skip.",
  },
];

export interface CautionEntry {
  name: string;
  handle: string;
  flags: string;
}

export const CAUTION: CautionEntry[] = [
  {
    name: "FaZe Banks",
    handle: "X, millions of followers",
    flags:
      "Promoted MLG (a few $M → ~$200M → −90%+). Leaked messages suggested pressuring the MLG team for preferential OTC allocations, contradicting his “zero affiliation, not paid” claim. Stepped down as FaZe Clan CEO July 2025. Also touched by LIBRA. Denies wrongdoing; no charges.",
  },
  {
    name: "Frank (DeGods)",
    handle: "X",
    flags:
      "“LA Vape Cabal” member; stepped down as DeGods CEO May 2025 after the LIBRA scandal. Group alleged to have front-run and rugged Solana memecoins for months. Operator incentives throughout.",
  },
  {
    name: "Gainzy",
    handle: "@gainzy222 · ~200K",
    flags:
      "“Accidentally” sold his own token gnzystrm via a phone “fat finger” — $4.6M → $12K in seconds — while personally netting $168K. Arkham publicly doubted the accident story. Casino sponsorships. Entertainer, not a trader.",
  },
  {
    name: "James Wynn",
    handle: "X",
    flags:
      "Turned $7K PEPE into $25M+, then lost ~$100M in days on 40x BTC perps. Admitted “basically gambling.” Cautionary tale, not a signal.",
  },
  {
    name: "Lark Davis",
    handle: "@TheCryptoLark",
    flags:
      "ZachXBT (2022): 8 instances of promoting low-caps then dumping, >$1.2M profits; withdrew $2.5M from Celsius while still promoting it with a referral code. Denies wrongdoing. The archetypal dump-on-followers case.",
  },
  {
    name: "BitBoy",
    handle: "YouTube / X",
    flags: "Former biggest crypto YouTuber; personal and legal unraveling, arrest. Dormant with “comeback” lore. No current track record.",
  },
  {
    name: "Crypto Rover",
    handle: "@cryptorover · 1.6M",
    flags: "Publishes clearly labeled paid partnerships — commercial placement mixed into market commentary. Separate the two.",
  },
  {
    name: "Orangie",
    handle: "Video creator",
    flags: "Millionaire-story, aspiration content. Content is the product, not calls. Onboards trenches traders without giving them edge.",
  },
  {
    name: "DeFiTracer",
    handle: "@DeFiTracer · ~410K",
    flags:
      "Engagement farming: “$10,000 SOL giveaway — Like, Retweet, Reply,” “1000x memes” threads, unverifiable “$217 → $182,754” claims. No timestamped track record.",
  },
  {
    name: "Growbot-style Telegram channels",
    handle: "Telegram",
    flags:
      "Fabricated profit screenshots, fake forwarded testimonials, “set up your BOT for FREE” funnels. Any channel shaped like this is a scam until proven otherwise.",
  },
];

export interface ShillFlag {
  title: string;
  detail: string;
}

export const SHILL_CHECKLIST: ShillFlag[] = [
  {
    title: "No timestamped receipts",
    detail:
      "Claims like “called X at $Y” with no dated post or tx hash. Check: search their handle + token; check FOMO/Arkham leaderboards for on-chain verification.",
  },
  {
    title: "“DM for collab” in the bio",
    detail: "Explicit for-sale influence. Assume every call is inventory distribution.",
  },
  {
    title: "Giveaway / engagement bait",
    detail: "“Like + RT + reply with wallet for $10K” = farming followers to sell later.",
  },
  {
    title: "Sells a bot, course, or VIP group",
    detail: "Fabricated P/L screenshots, urgency funnels. Real edge is never sold for $99/month.",
  },
  {
    title: "Undisclosed positions",
    detail: "If they don't say what they hold and when they sell, assume they're selling into you.",
  },
  {
    title: "Deletes wrong calls",
    detail: "Accounts that only leave winners up are manufacturing a record.",
  },
  {
    title: "Celebrity coins with “zero affiliation”",
    detail: "Verify with Bubblemaps: insider clusters + promoter wallets = exit-liquidity setup.",
  },
  {
    title: "Front-running evidence",
    detail: "ZachXBT-style wallet tracing is the gold standard for disqualification.",
  },
  {
    title: "Leverage as the whole record",
    detail: "A 100x win is one liquidation from zero. Ask: what survived a full cycle?",
  },
  {
    title: "Bot-network amplification",
    detail: "Sudden follower spikes, identical reply-guy phrasing, coordinated shill waves. Check social proof before trusting it.",
  },
  {
    title: "“Never sells” framed as virtue",
    detail: "Diamond hands without exits isn't a strategy you can copy — it's a narrative that needs your buying to sustain it.",
  },
];
