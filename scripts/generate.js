// Generates js/data.js and img/covers/*.svg for Arc Predict.
// Deterministic: seeded PRNG keyed on each market slug.
// Cover art: monochrome editorial geometry (no emoji), red accent only.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const COVER_DIR = path.join(ROOT, "img", "covers");
fs.rmSync(COVER_DIR, { recursive: true, force: true });
fs.mkdirSync(COVER_DIR, { recursive: true });

// ---------- helpers ----------
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function slugify(q) {
  return q.toLowerCase()
    .replace(/[''\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-").slice(0, 9).join("-");
}

// ---------- categories ----------
const CATS = {
  politics: { label: "Politics" },
  crypto: { label: "Crypto" },
  sports: { label: "Sports" },
  economics: { label: "Economics" },
  tech: { label: "Tech & AI" },
  culture: { label: "Culture" },
  world: { label: "World" },
  science: { label: "Science" },
};

// ---------- markets ----------
// [question, category, endDate, yesCents, source, resolution sentence]
const M = [
  ["Will Republicans win the most House seats in the 2026 midterms?", "politics", "2026-11-04", 46, "official state returns", "This market resolves YES if the Republican party wins at least 218 seats in the US House of Representatives in the November 2026 general election."],
  ["Will Democrats control the Senate after the 2026 midterms?", "politics", "2026-11-04", 24, "official state returns", "This market resolves YES if Democrats hold at least 51 Senate seats after all 2026 Senate races are certified, including Independents who caucus with Democrats."],
  ["Will the Democratic nominee win the 2028 presidential election?", "politics", "2028-11-08", 52, "certified electoral votes", "This market resolves YES if the candidate nominated by the Democratic party wins the 2028 US presidential election."],
  ["Will Gavin Newsom be the 2028 Democratic presidential nominee?", "politics", "2028-07-25", 31, "DNC convention roll call", "This market resolves YES if Gavin Newsom wins the Democratic nomination for president at the 2028 national convention."],
  ["Will JD Vance be the 2028 Republican presidential nominee?", "politics", "2028-07-25", 58, "RNC convention roll call", "This market resolves YES if JD Vance wins the Republican nomination for president at the 2028 national convention."],
  ["Will a third party candidate win any electoral votes in 2028?", "politics", "2028-11-08", 12, "certified electoral votes", "This market resolves YES if a candidate outside the two major parties wins at least one electoral vote in the 2028 presidential election."],
  ["Will a Democrat win the 2026 California gubernatorial election?", "politics", "2026-11-04", 88, "California Secretary of State", "This market resolves YES if the Democratic nominee wins the 2026 California governor's race."],
  ["Will Beto O'Rourke win the 2026 Texas gubernatorial election?", "politics", "2026-11-04", 21, "Texas Secretary of State", "This market resolves YES if Beto O'Rourke wins the 2026 Texas governor's race."],
  ["Will a Democrat win the 2026 Florida gubernatorial election?", "politics", "2026-11-04", 17, "Florida Division of Elections", "This market resolves YES if the Democratic nominee wins the 2026 Florida governor's race."],
  ["Will Trump's approval rating be above 50% on Dec 31, 2026?", "politics", "2026-12-31", 38, "aggregate of approved polls", "This market resolves YES if the average of the five most recent national approval polls published in December 2026 shows above 50% approval."],
  ["Will France hold snap parliamentary elections before Jul 1, 2027?", "politics", "2027-07-01", 41, "French Interior Ministry", "This market resolves YES if the French National Assembly is dissolved and new legislative elections are called before July 1, 2027."],
  ["Will the RN candidate win the 2027 French presidential election?", "politics", "2027-05-09", 36, "French Interior Ministry", "This market resolves YES if the candidate endorsed by the Rassemblement National wins the 2027 French presidential runoff."],
  ["Will Keir Starmer be UK Prime Minister on Dec 31, 2026?", "politics", "2026-12-31", 64, "UK government records", "This market resolves YES if Keir Starmer is serving as UK Prime Minister at 23:59 GMT on December 31, 2026."],
  ["Will Lula win Brazil's 2026 presidential election?", "politics", "2026-10-25", 57, "TSE official results", "This market resolves YES if Luiz Inacio Lula da Silva wins Brazil's October 2026 presidential runoff."],
  ["Will Jair Bolsonaro be a candidate in Brazil's 2026 election?", "politics", "2026-10-04", 15, "TSE candidate registry", "This market resolves YES if Jair Bolsonaro's candidacy is on the official ballot for Brazil's 2026 presidential election."],
  ["Will the US government shut down in October 2026?", "politics", "2026-10-31", 34, "OMB notices", "This market resolves YES if a lapse in federal appropriations causes a government shutdown at any point during October 2026."],
  ["Will Congress pass a crypto market structure bill in 2026?", "politics", "2026-12-31", 42, "Congressional record", "This market resolves YES if the CLARITY Act or a successor digital asset market structure bill is signed into law during calendar year 2026."],
  ["Will Lisa Cook remain a Federal Reserve governor on Dec 31, 2026?", "politics", "2026-12-31", 71, "Federal Reserve records", "This market resolves YES if Lisa Cook is listed as a sitting Federal Reserve governor on December 31, 2026."],

  ["Will Bitcoin hit $150,000 by Dec 31, 2026?", "crypto", "2026-12-31", 36, "CoinGecko 1-minute data", "This market resolves YES if Bitcoin trades at or above $150,000 at any moment before December 31, 2026."],
  ["Will Bitcoin hit $200,000 by Mar 31, 2027?", "crypto", "2027-03-31", 19, "CoinGecko 1-minute data", "This market resolves YES if Bitcoin trades at or above $200,000 at any moment before March 31, 2027."],
  ["Will Bitcoin set a new all-time high in 2026?", "crypto", "2026-12-31", 44, "CoinGecko 1-minute data", "This market resolves YES if Bitcoin exceeds its all-time high price at any point during calendar year 2026."],
  ["Will Bitcoin close above $125,000 on Sep 30, 2026?", "crypto", "2026-09-30", 48, "CoinGecko daily close", "This market resolves YES if the daily UTC close on September 30, 2026 is at or above $125,000."],
  ["Will Ethereum hit $10,000 by Dec 31, 2026?", "crypto", "2026-12-31", 23, "CoinGecko 1-minute data", "This market resolves YES if Ethereum trades at or above $10,000 at any moment before December 31, 2026."],
  ["Will Solana hit $500 by Jan 31, 2027?", "crypto", "2027-01-31", 16, "CoinGecko 1-minute data", "This market resolves YES if Solana trades at or above $500 at any moment before January 31, 2027."],
  ["Will XRP hit $10 by Dec 31, 2026?", "crypto", "2026-12-31", 9, "CoinGecko 1-minute data", "This market resolves YES if XRP trades at or above $10.00 at any moment before December 31, 2026."],
  ["Will Bitcoin dominance be above 60% on Dec 31, 2026?", "crypto", "2026-12-31", 33, "TradingView dominance chart", "This market resolves YES if BTC dominance is above 60% at the December 31, 2026 UTC close."],
  ["Will total crypto market cap exceed $5 trillion in 2026?", "crypto", "2026-12-31", 28, "CoinGecko global charts", "This market resolves YES if total cryptocurrency market capitalization exceeds $5 trillion at any point in 2026."],
  ["Will a spot XRP ETF launch in the US by Dec 31, 2026?", "crypto", "2026-12-31", 61, "SEC filings", "This market resolves YES if a US-listed spot XRP exchange traded fund begins trading before December 31, 2026."],
  ["Will the US government buy Bitcoin in Q4 2026?", "crypto", "2026-12-31", 22, "official treasury statements", "This market resolves YES if the US federal government announces a purchase of Bitcoin for its strategic reserve during Q4 2026."],
  ["Will USDC circulation exceed $100 billion by Dec 31, 2026?", "crypto", "2026-12-31", 47, "Circle attestation reports", "This market resolves YES if USDC circulating supply exceeds $100 billion at any point before December 31, 2026."],
  ["Will Arc mainnet TVL exceed $10 billion by Jun 30, 2027?", "crypto", "2027-06-30", 39, "DefiLlama chain pages", "This market resolves YES if total value locked on the Arc network exceeds $10 billion before June 30, 2027."],
  ["Will any memecoin reach a $100 billion market cap in 2026?", "crypto", "2026-12-31", 7, "CoinGecko market data", "This market resolves YES if any token categorized as a memecoin reaches a $100 billion fully diluted market cap in 2026."],
  ["Will Circle stock close above $250 by Dec 31, 2026?", "crypto", "2026-12-31", 41, "NYSE daily close", "This market resolves YES if CRCL closes at or above $250.00 at any session before December 31, 2026."],
  ["Will Strategy buy 50,000+ BTC in Q4 2026?", "crypto", "2026-12-31", 18, "8-K filings", "This market resolves YES if Strategy (formerly MicroStrategy) discloses net purchases of 50,000 BTC or more during Q4 2026."],
  ["Will a Bitcoin ETF record a $5B single day inflow in 2026?", "crypto", "2026-12-31", 13, "Farside investors data", "This market resolves YES if US spot Bitcoin ETFs record total daily net inflows above $5 billion on any single day in 2026."],
  ["Will stablecoin supply exceed $400 billion by Mar 31, 2027?", "crypto", "2027-03-31", 43, "DefiLlama stablecoins", "This market resolves YES if combined stablecoin circulating supply exceeds $400 billion before March 31, 2027."],
  ["Will a top 5 exchange launch a venue on Arc in 2026?", "crypto", "2026-12-31", 52, "official exchange announcements", "This market resolves YES if an exchange ranked in the top 5 by volume announces live spot or perp trading on the Arc network during 2026."],
  ["Will Arc daily active wallets exceed 1 million by Jun 2027?", "crypto", "2027-06-30", 35, "Arc network dashboards", "This market resolves YES if the Arc network reports more than 1,000,000 daily active wallets in any month before June 30, 2027."],
  ["Will Ethereum staking yield fall below 2.5% by Mar 2027?", "crypto", "2027-03-31", 26, "Coinbase yield pages", "This market resolves YES if the Ethereum staking participation yield drops below 2.5% annualized at any point before March 31, 2027."],

  ["Will the Chiefs win Super Bowl LXI?", "sports", "2027-02-08", 15, "NFL official results", "This market resolves YES if the Kansas City Chiefs win Super Bowl LXI in February 2027."],
  ["Will the Bills win Super Bowl LXI?", "sports", "2027-02-08", 13, "NFL official results", "This market resolves YES if the Buffalo Bills win Super Bowl LXI in February 2027."],
  ["Will the Eagles repeat as Super Bowl champions?", "sports", "2027-02-08", 12, "NFL official results", "This market resolves YES if the Philadelphia Eagles win back to back titles by winning Super Bowl LXI."],
  ["Will the Ravens win Super Bowl LXI?", "sports", "2027-02-08", 9, "NFL official results", "This market resolves YES if the Baltimore Ravens win Super Bowl LXI in February 2027."],
  ["Will the Packers win Super Bowl LXI?", "sports", "2027-02-08", 10, "NFL official results", "This market resolves YES if the Green Bay Packers win Super Bowl LXI in February 2027."],
  ["Will the Lions win Super Bowl LXI?", "sports", "2027-02-08", 11, "NFL official results", "This market resolves YES if the Detroit Lions win Super Bowl LXI in February 2027."],
  ["Will the Thunder win the 2027 NBA championship?", "sports", "2027-06-21", 29, "NBA official results", "This market resolves YES if the Oklahoma City Thunder win the 2027 NBA Finals."],
  ["Will the Nuggets win the 2027 NBA championship?", "sports", "2027-06-21", 9, "NBA official results", "This market resolves YES if the Denver Nuggets win the 2027 NBA Finals."],
  ["Will Victor Wembanyama win 2026-27 NBA MVP?", "sports", "2027-04-15", 22, "official NBA awards", "This market resolves YES if Victor Wembanyama is voted 2026-27 regular season MVP."],
  ["Will Arsenal win the 2026-27 Premier League?", "sports", "2027-05-24", 38, "Premier League table", "This market resolves YES if Arsenal finish first in the 2026-27 Premier League season."],
  ["Will Liverpool win the 2026-27 Premier League?", "sports", "2027-05-24", 22, "Premier League table", "This market resolves YES if Liverpool finish first in the 2026-27 Premier League season."],
  ["Will Real Madrid win La Liga 2026-27?", "sports", "2027-05-23", 44, "La Liga official table", "This market resolves YES if Real Madrid finish first in La Liga for the 2026-27 season."],
  ["Will Bayern Munich win the 2026-27 Bundesliga?", "sports", "2027-05-15", 61, "Bundesliga official table", "This market resolves YES if Bayern Munich finish first in the 2026-27 Bundesliga."],
  ["Will a Spanish club win the 2027 Champions League?", "sports", "2027-06-06", 27, "UEFA official results", "This market resolves YES if a Spanish club wins the 2026-27 UEFA Champions League final."],
  ["Will Max Verstappen win the 2026 F1 drivers' championship?", "sports", "2026-12-06", 34, "FIA classification", "This market resolves YES if Max Verstappen wins the 2026 Formula 1 World Drivers' Championship."],
  ["Will a first time F1 champion be crowned in 2026?", "sports", "2026-12-06", 52, "FIA classification", "This market resolves YES if the 2026 Formula 1 World Drivers' Champion has never won the title before this season."],
  ["Will the Dodgers repeat as World Series champions?", "sports", "2026-11-05", 24, "MLB official results", "This market resolves YES if the Los Angeles Dodgers win the 2026 World Series after their 2025 title."],
  ["Will a college football team finish 2026 regular season undefeated?", "sports", "2026-11-29", 33, "NCAA records", "This market resolves YES if at least one FBS team finishes the 2026 regular season with zero losses."],
  ["Will Novak Djokovic win another Grand Slam before Jul 2027?", "sports", "2027-07-05", 19, "Grand Slam official results", "This market resolves YES if Novak Djokovic wins any singles major title before July 2027."],
  ["Will Carlos Alcaraz finish 2026 ranked ATP No. 1?", "sports", "2026-12-31", 71, "ATP year-end rankings", "This market resolves YES if Carlos Alcaraz is ranked ATP world No. 1 in the final 2026 rankings."],
  ["Will Australia win the 2026-27 Ashes series?", "sports", "2027-01-08", 58, "Cricket Australia official results", "This market resolves YES if Australia win the 2026-27 Ashes Test series against England."],
  ["Will Jon Jones fight again in 2026?", "sports", "2026-12-31", 26, "athletic commission records", "This market resolves YES if Jon Jones appears in a sanctioned professional MMA bout during calendar year 2026."],
  ["Will Messi re-sign with Inter Miami for the 2027 season?", "sports", "2026-12-31", 44, "MLS player transactions", "This market resolves YES if Lionel Messi signs a contract keeping him at Inter Miami for the 2027 MLS season."],
  ["Will the US win the most gold medals at LA 2028?", "sports", "2028-08-14", 78, "official medal table", "This market resolves YES if the United States wins the most gold medals at the 2028 Los Angeles Olympics."],
  ["Will an NBA expansion team be announced by Dec 31, 2026?", "sports", "2026-12-31", 37, "official NBA announcements", "This market resolves YES if the NBA formally awards an expansion franchise before December 31, 2026."],
  ["Will a Western team win the 2026 League of Legends Worlds?", "sports", "2026-11-08", 8, "Riot Games official results", "This market resolves YES if a team from the LCS, LEC, LTA or LCP wins the 2026 League of Legends World Championship."],
  ["Will Connor McDavid re-sign with the Oilers before Jan 1, 2027?", "sports", "2026-12-31", 49, "NHL player transactions", "This market resolves YES if Connor McDavid signs an NHL contract extension with Edmonton before January 1, 2027."],

  ["Will the Fed cut rates at the October 2026 FOMC meeting?", "economics", "2026-10-28", 63, "FOMC statements", "This market resolves YES if the Federal Open Market Committee announces a reduction in the federal funds target range at its October 2026 meeting."],
  ["Will the Fed cut rates at the December 2026 FOMC meeting?", "economics", "2026-12-15", 55, "FOMC statements", "This market resolves YES if the Federal Open Market Committee announces a reduction in the federal funds target range at its December 2026 meeting."],
  ["Will US CPI inflation be above 3% for November 2026?", "economics", "2026-12-10", 41, "BLS CPI release", "This market resolves YES if headline CPI year over year inflation for November 2026 is reported above 3.0%."],
  ["Will the S&P 500 close above 7,000 by Dec 31, 2026?", "economics", "2026-12-31", 34, "official index closes", "This market resolves YES if the S&P 500 closes at or above 7,000 at any session before December 31, 2026."],
  ["Will the S&P 500 fall 10% from its high before Dec 31, 2026?", "economics", "2026-12-31", 27, "official index closes", "This market resolves YES if the S&P 500 closes 10% or more below its highest close from the prior 12 months at any point before December 31, 2026."],
  ["Will gold close above $4,500 by Dec 31, 2026?", "economics", "2026-12-31", 48, "CME settlement data", "This market resolves YES if spot gold trades at or above $4,500 per troy ounce before December 31, 2026."],
  ["Will WTI crude close above $90 by Dec 31, 2026?", "economics", "2026-12-31", 21, "EIA spot prices", "This market resolves YES if WTI crude oil trades at or above $90 per barrel before December 31, 2026."],
  ["Will the 10-year Treasury yield top 4.5% on Dec 31, 2026?", "economics", "2026-12-31", 29, "US Treasury daily data", "This market resolves YES if the 10-year Treasury yield is at or above 4.50% at the December 31, 2026 close."],
  ["Will US unemployment be 4.5% or higher in the October jobs report?", "economics", "2026-11-06", 37, "BLS employment situation", "This market resolves YES if the October 2026 employment situation report shows the unemployment rate at 4.5% or higher."],
  ["Will the US avoid a recession through 2027?", "economics", "2027-12-31", 74, "NBER business cycle dating", "This market resolves YES if the NBER does not declare a US recession with a start date on or before December 31, 2027."],
  ["Will Nvidia report Q3 revenue above $65 billion?", "economics", "2026-11-25", 58, "Nvidia earnings release", "This market resolves YES if Nvidia reports quarterly revenue above $65 billion for its fiscal Q3 2027."],
  ["Will Congress raise the debt limit before Jan 20, 2027?", "economics", "2027-01-15", 66, "Congressional record", "This market resolves YES if Congress passes legislation suspending or raising the federal debt limit before January 20, 2027."],
  ["Will the ECB cut rates again in 2026?", "economics", "2026-12-17", 47, "ECB monetary policy decisions", "This market resolves YES if the European Central Bank lowers its deposit facility rate at any 2026 meeting."],
  ["Will USD/JPY trade below 140 by Mar 31, 2027?", "economics", "2027-03-31", 31, "interbank reference rates", "This market resolves YES if USD/JPY trades below 140.00 at any point before March 31, 2027."],
  ["Will 30-year mortgage rates fall below 6% by Dec 31, 2026?", "economics", "2026-12-31", 23, "Freddie Mac PMMS", "This market resolves YES if the Freddie Mac 30-year fixed average falls below 6.00% before December 31, 2026."],
  ["Will the Magnificent 7 exceed $25 trillion combined market cap in 2026?", "economics", "2026-12-31", 45, "CompaniesMarketCap data", "This market resolves YES if the combined market cap of Apple, Microsoft, Nvidia, Alphabet, Amazon, Meta and Tesla exceeds $25 trillion before December 31, 2026."],

  ["Will OpenAI release GPT-6 in 2026?", "tech", "2026-12-31", 52, "official OpenAI announcements", "This market resolves YES if OpenAI publicly releases a flagship model branded GPT-6 during calendar year 2026."],
  ["Will Google release Gemini 4 in 2026?", "tech", "2026-12-31", 61, "official Google announcements", "This market resolves YES if Google DeepMind publicly releases a flagship model branded Gemini 4 during calendar year 2026."],
  ["Will OpenAI book over $30 billion of revenue in 2026?", "tech", "2027-03-31", 49, "audited financial disclosures", "This market resolves YES if OpenAI's reported or disclosed revenue for calendar year 2026 exceeds $30 billion."],
  ["Will any AI lab reach a $1 trillion valuation by Dec 31, 2026?", "tech", "2026-12-31", 34, "confirmed funding announcements", "This market resolves YES if OpenAI, Anthropic or xAI confirms a funding round or tender at a valuation of $1 trillion or more before December 31, 2026."],
  ["Will Nvidia reach a $6 trillion market cap by Jun 30, 2027?", "tech", "2027-06-30", 38, "exchange market cap data", "This market resolves YES if Nvidia's market capitalization exceeds $6 trillion at any session before June 30, 2027."],
  ["Will Apple ship a foldable iPhone before Jun 30, 2027?", "tech", "2027-06-30", 57, "Apple press releases", "This market resolves YES if Apple begins customer shipments of a foldable iPhone before June 30, 2027."],
  ["Will Tesla operate robotaxis in 20+ cities by Dec 31, 2026?", "tech", "2026-12-31", 19, "official Tesla announcements", "This market resolves YES if Tesla's robotaxi service is live in 20 or more distinct US metropolitan areas by December 31, 2026."],
  ["Will Neuralink implant 100+ patients by Mar 31, 2027?", "tech", "2027-03-31", 43, "clinical trial registry", "This market resolves YES if Neuralink's clinical trial registry shows 100 or more implanted participants before March 31, 2027."],
  ["Will Starship complete orbital refueling before Jun 30, 2027?", "tech", "2027-06-30", 46, "SpaceX mission updates", "This market resolves YES if SpaceX demonstrates cryogenic propellant transfer between two Starships in orbit before June 30, 2027."],
  ["Will SpaceX launch an uncrewed Starship to Mars in the 2026 window?", "tech", "2026-12-31", 17, "SpaceX mission updates", "This market resolves YES if an uncrewed Starship departs Earth orbit toward Mars during the late 2026 transfer window."],
  ["Will Waymo operate in 15+ cities by Jun 30, 2027?", "tech", "2027-06-30", 54, "official Waymo announcements", "This market resolves YES if Waymo's paid riderhip service is live in 15 or more distinct cities before June 30, 2027."],
  ["Will OpenAI's Stargate top 10 active sites by Dec 31, 2026?", "tech", "2026-12-31", 36, "official partnership disclosures", "This market resolves YES if the Stargate project confirms 10 or more active data center sites under construction or operating before December 31, 2026."],
  ["Will IBM demonstrate error corrected quantum advantage in 2026?", "tech", "2026-12-31", 21, "peer reviewed publications", "This market resolves YES if IBM publishes a peer reviewed demonstration of a logical-qubit quantum computer beating the best classical algorithm on a practical task in 2026."],
  ["Will humanoid robot shipments exceed 10,000 units in 2026?", "tech", "2026-12-31", 25, "manufacturer disclosures", "This market resolves YES if any manufacturer discloses cumulative 2026 shipments of 10,000 or more general purpose humanoid robots."],
  ["Will xAI raise funding above a $200 billion valuation by Dec 31, 2026?", "tech", "2026-12-31", 44, "confirmed funding announcements", "This market resolves YES if xAI confirms a primary round priced at a valuation above $200 billion before December 31, 2026."],
  ["Will Anthropic's annualized revenue exceed $20 billion by Dec 31, 2026?", "tech", "2026-12-31", 48, "disclosed company metrics", "This market resolves YES if Anthropic discloses an annualized revenue run rate above $20 billion on or before December 31, 2026."],

  ["Will GTA VI release by Dec 1, 2026?", "culture", "2026-12-01", 62, "Rockstar Games announcements", "This market resolves YES if Grand Theft Auto VI begins general retail or digital sale on or before December 1, 2026."],
  ["Will GTA VI be delayed into 2027?", "culture", "2026-12-01", 38, "Rockstar Games announcements", "This market resolves YES if Rockstar Games moves the Grand Theft Auto VI release date beyond December 1, 2026."],
  ["Will Dune: Part Three gross over $500 million worldwide?", "culture", "2027-01-31", 71, "box office trackers", "This market resolves YES if Dune: Part Three's cumulative worldwide box office passes $500 million within 45 days of release."],
  ["Will Avengers: Doomsday open above $300 million domestic?", "culture", "2026-12-27", 66, "box office trackers", "This market resolves YES if Avengers: Doomsday posts an opening weekend above $300 million at the domestic box office."],
  ["Will a Marvel movie gross over $1 billion in 2026?", "culture", "2026-12-31", 58, "box office trackers", "This market resolves YES if any film in the Marvel Cinematic Universe passes $1 billion worldwide during calendar year 2026."],
  ["Will Taylor Swift win Album of the Year at the 2027 Grammys?", "culture", "2027-02-07", 32, "Recording Academy results", "This market resolves YES if Taylor Swift wins the Album of the Year award at the 2027 Grammy Awards."],
  ["Will a woman be Spotify's most streamed artist of 2026?", "culture", "2026-12-31", 46, "Spotify Wrapped data", "This market resolves YES if Spotify's 2026 Wrapped names a female solo artist or all female group as the global top artist."],
  ["Will Kendrick Lamar release a new album in 2026?", "culture", "2026-12-31", 41, "streaming platform releases", "This market resolves YES if Kendrick Lamar releases a studio album on major streaming platforms during calendar year 2026."],
  ["Will the Super Bowl LXI halftime show top 140 million viewers?", "culture", "2027-02-08", 51, "Nielsen audience data", "This market resolves YES if reported US audience for the Super Bowl LXI halftime show exceeds 140 million viewers."],
  ["Will Netflix exceed 350 million subscribers by Dec 31, 2026?", "culture", "2026-12-31", 37, "Netflix shareholder letters", "This market resolves YES if Netflix reports more than 350 million global memberships for the quarter ending on or before December 31, 2026."],
  ["Will a video game movie gross over $750 million in 2026?", "culture", "2026-12-31", 22, "box office trackers", "This market resolves YES if a theatrical film adapted from a video game passes $750 million worldwide during 2026."],
  ["Will an AI figure be named TIME Person of the Year 2026?", "culture", "2026-12-11", 39, "TIME official announcement", "This market resolves YES if TIME names a person whose primary fame is in artificial intelligence as its 2026 Person of the Year."],
  ["Will Beyoncé announce a world tour for 2027?", "culture", "2026-12-31", 34, "official artist announcements", "This market resolves YES if Beyoncé or her promoters announce a 2027 stadium tour on or before December 31, 2026."],
  ["Will a debut novelist win the 2026 National Book Award?", "culture", "2026-11-18", 29, "National Book Foundation", "This market resolves YES if the 2026 National Book Award for Fiction goes to the author's first published novel."],

  ["Will Russia and Ukraine sign a ceasefire agreement in 2026?", "world", "2026-12-31", 26, "UN records", "This market resolves YES if Russia and Ukraine sign a documented ceasefire agreement covering the active front lines during calendar year 2026."],
  ["Will Putin and Zelensky meet in person before Dec 31, 2026?", "world", "2026-12-31", 31, "official government statements", "This market resolves YES if Vladimir Putin and Volodymyr Zelensky attend a documented in person meeting before December 31, 2026."],
  ["Will the US and Iran sign a nuclear framework agreement in 2026?", "world", "2026-12-31", 18, "State Department statements", "This market resolves YES if the United States and Iran sign a documented nuclear framework agreement during calendar year 2026."],
  ["Will a new country join NATO before Jul 1, 2027?", "world", "2027-07-01", 14, "NATO official records", "This market resolves YES if a state not currently in NATO deposits its instrument of accession before July 1, 2027."],
  ["Will Donald Trump win the 2026 Nobel Peace Prize?", "world", "2026-10-09", 22, "Nobel Institute announcement", "This market resolves YES if the Norwegian Nobel Committee announces Donald Trump as the 2026 Nobel Peace Prize laureate."],
  ["Will the 2026 Nobel Peace Prize go to an organization?", "world", "2026-10-09", 34, "Nobel Institute announcement", "This market resolves YES if the 2026 Nobel Peace Prize is awarded to an organization rather than an individual."],
  ["Will China announce large scale exercises in the Taiwan Strait in Q4 2026?", "world", "2026-12-31", 27, "official PLA statements", "This market resolves YES if China's military publicly announces joint exercises involving live fire in the Taiwan Strait during Q4 2026."],
  ["Will Maduro cease to be Venezuela's president before Dec 31, 2026?", "world", "2026-12-31", 33, "Venezuelan government records", "This market resolves YES if Nicolas Maduro stops serving as Venezuela's recognized president for any reason before December 31, 2026."],
  ["Will Israel and Saudi Arabia normalize relations before Dec 31, 2027?", "world", "2027-12-31", 21, "official government statements", "This market resolves YES if Israel and Saudi Arabia announce full diplomatic relations before December 31, 2027."],
  ["Will COP31 produce a fossil fuel phase out commitment?", "world", "2026-11-20", 19, "UNFCCC decision documents", "This market resolves YES if the COP31 cover decision includes explicit language committing parties to phase out fossil fuels."],
  ["Will Pope Leo XIV visit the United States in 2026?", "world", "2026-12-31", 36, "Vatican travel schedule", "This market resolves YES if Pope Leo XIV makes a documented pastoral visit to the United States during calendar year 2026."],
  ["Will 2026 be the hottest year on record?", "world", "2027-01-15", 55, "Copernicus and NOAA datasets", "This market resolves YES if major climate monitoring agencies rank 2026 as the warmest calendar year in the instrumental record."],

  ["Will Artemis III launch before Dec 31, 2027?", "science", "2027-12-31", 41, "NASA official updates", "This market resolves YES if NASA's Artemis III crewed lunar mission launches before December 31, 2027."],
  ["Will Starship V3 reach orbit on its first launch?", "science", "2027-03-31", 54, "SpaceX mission updates", "This market resolves YES if the first Starship V3 flight achieves orbital velocity or a nominal orbit insertion."],
  ["Will Blue Origin launch Blue Moon MK1 in 2026?", "science", "2026-12-31", 28, "Blue Origin mission updates", "This market resolves YES if Blue Origin launches its Blue Moon MK1 cargo lander toward the Moon before December 31, 2026."],
  ["Will China land astronauts on the Moon before 2030?", "science", "2030-12-31", 39, "CMSA official updates", "This market resolves YES if China's crewed lunar program lands taikonauts on the lunar surface before January 1, 2031."],
  ["Will JWST confirm a biosignature on an exoplanet by Dec 31, 2027?", "science", "2027-12-31", 23, "peer reviewed publications", "This market resolves YES if a peer reviewed JWST study claims robust detection of a biosignature gas on an exoplanet atmosphere before December 31, 2027."],
  ["Will a fusion experiment announce Q>10 before Dec 31, 2027?", "science", "2027-12-31", 26, "lab press releases and journals", "This market resolves YES if any fusion experiment credibly announces target gain above 10 before December 31, 2027."],
  ["Will an individualized CRISPR therapy win FDA approval in 2026?", "science", "2026-12-31", 31, "FDA approval letters", "This market resolves YES if the FDA approves a bespoke individualized CRISPR based therapy during calendar year 2026."],
  ["Will the 2026 Atlantic hurricane season see 14+ named storms?", "science", "2026-11-30", 43, "National Hurricane Center", "This market resolves YES if the 2026 Atlantic season records 14 or more named tropical storms."],
  ["Will a magnitude 8.0+ earthquake occur in 2026?", "science", "2026-12-31", 39, "USGS earthquake catalog", "This market resolves YES if USGS records at least one earthquake of magnitude 8.0 or higher during calendar year 2026."],
  ["Will the Rubin Observatory find 1 million+ asteroids by Jun 2027?", "science", "2027-06-30", 61, "Rubin Observatory data releases", "This market resolves YES if the Vera C. Rubin Observatory reports over 1,000,000 newly discovered asteroids before June 30, 2027."],
  ["Will SpaceX complete 200 orbital launches in 2026?", "science", "2026-12-31", 34, "launch tracker records", "This market resolves YES if SpaceX completes 200 or more orbital class launches during calendar year 2026."],
  ["Will an Alzheimer's drug cut decline by 40% in 2026 phase 3 results?", "science", "2026-12-31", 18, "peer reviewed publications", "This market resolves YES if a 2026 phase 3 readout shows an investigational Alzheimer's therapy slowing decline by 40% or more on its primary endpoint."],
];

// ---------- trader names & leaderboard ----------
const NAMES = [
  "deano.eth", "quantfren", "0xAlchemist", "mrsushi.eth", "arcmaxi", "perp_lord", "kalshi_arb", "noobtrader21",
  "solana_sam", "vitalikfan99", "whalewatch", "polywhale", "gm_ghost", "beta_betty", "otium.eth", "dicegoblin",
  "paperhandsphil", "longtermjen", "riskoff_ron", "yolo.eth", "fedwatcher", "shadowbanker", "mev_maxxing", "onchain_larry",
  "usdc_carl", "gamma_gabe", "volatility.v", "smoothbrain33", "deckard.eth", "jetsetjane", "hawkeye_eth", "ta_karen",
  "arcade.eth", "moon_or_bust", "dipbuyerdan", "spreadsheetjen", "limitorderlarry", "cbdc_enjoyer", "thesis_eth", "kelly_criterion",
  "perma_bull_pete", "basis_tradez", "contrariankat", "sniper_no_sniping", "liquidity_liz", "fourier.eth", "arc_de_triomphe", "hopium_hannah",
];
const LEADERS = [
  ["whalewatch", 892, 41.8, "$12.4m"], ["gamma_gabe", 771, 36.2, "$9.8m"], ["quantfren", 690, 33.5, "$8.1m"],
  ["contrariankat", 644, 31.9, "$7.6m"], ["basis_tradez", 601, 29.4, "$6.9m"], ["arcmaxi", 556, 27.8, "$6.2m"],
  ["kelly_criterion", 512, 26.1, "$5.8m"], ["onchain_larry", 487, 24.7, "$5.1m"], ["volatility.v", 443, 23.2, "$4.7m"],
  ["spreadsheetjen", 402, 22.5, "$4.3m"], ["hawkeye_eth", 371, 20.8, "$3.9m"], ["moon_or_bust", 338, 19.9, "$3.6m"],
];

// ---------- build markets ----------
const slugCount = {};
const markets = M.map((row) => {
  const [q, cat, end, cents, src, res] = row;
  let slug = slugify(q);
  slugCount[slug] = (slugCount[slug] || 0) + 1;
  if (slugCount[slug] > 1) slug = `${slug}-${slugCount[slug]}`;

  const rnd = mulberry32(hashStr(slug));
  const n = 240;
  const endTs = Date.parse(end + "T12:00:00Z");
  const startTs = endTs - (40 + Math.floor(rnd() * 230)) * 86400000;

  // odds history: random walk, corrected to end at current price
  const step = 2 + rnd() * 4;
  let p = Math.min(95, Math.max(5, cents + (rnd() - 0.5) * 40));
  const hist = [];
  for (let i = 0; i < n; i++) {
    hist.push(p);
    p = Math.min(98, Math.max(2, p + (rnd() - 0.5) * 2 * step));
  }
  const drift = (cents - hist[n - 1]) / (n - 1);
  for (let i = 0; i < n; i++) hist[i] = Math.round(Math.min(98, Math.max(2, hist[i] + drift * i)) * 10);

  const vol24 = Math.round(80 + rnd() * rnd() * 8000);
  const volT = Math.round((3000 + rnd() * rnd() * 120000) / 100) * 100;
  const liq = Math.round((2000 + rnd() * 80000) / 100) * 100;
  const traders = Math.round(15 + rnd() * 800);
  const change = +(hist[n - 1] - hist[n - 9]) / 10;

  return {
    slug, q, cat, end, src, res,
    c: cents, vol24, volT, liq, traders, start: startTs,
    hist, change,
    motif: Math.floor(rnd() * 6),
    dark: rnd() < 0.42,
    flip: rnd() < 0.5,
  };
});

// hot flag: top volume markets
const byVol = [...markets].sort((a, b) => b.vol24 - a.vol24);
byVol.slice(0, 10).forEach((m) => (m.hot = true));

// ---------- cover art (editorial geometry, ink + red on paper or ink) ----------
function coverSVG(m) {
  const W = 800, H = 450;
  const rnd = mulberry32(hashStr(m.slug + "v2"));
  const dark = m.dark;
  const bg = dark ? "#111110" : "#F4F2ED";
  const ink = dark ? "#F4F2ED" : "#111110";
  const soft = dark ? "rgba(244,242,237,.30)" : "rgba(17,17,16,.26)";
  const softer = dark ? "rgba(244,242,237,.14)" : "rgba(17,17,16,.12)";
  const red = "#E0231D";
  const j = (a, b) => a + rnd() * (b - a);
  let art = "";

  if (m.motif === 0) {
    // corner rings (brand arc motif)
    const cx = m.flip ? 40 : 760, cy = m.flip ? 40 : 410;
    let rings = "";
    for (let i = 0; i < 7; i++) {
      const r = 46 + i * 44;
      const isRed = i === 2;
      rings += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${isRed ? red : i % 2 ? soft : ink}" stroke-width="${isRed ? 14 : i % 2 ? 1.5 : 7}"/>`;
    }
    art = rings + `<circle cx="${cx}" cy="${cy}" r="16" fill="${red}"/>`;
  } else if (m.motif === 1) {
    // diagonal stripes
    let lines = "";
    let n = 0;
    for (let x = -420; x < 1400; x += 46) {
      const isRed = n === 5;
      const col = isRed ? red : n % 3 === 0 ? ink : softer;
      lines += `<rect x="${x}" y="-260" width="${isRed ? 14 : 9}" height="1000" fill="${col}" transform="rotate(${m.flip ? 18 : -18} 400 225)"/>`;
      n++;
    }
    art = lines;
  } else if (m.motif === 2) {
    // halftone field with red focal dot
    const fx = j(180, 620), fy = j(110, 340);
    let dots = "";
    for (let x = 36; x < W; x += 34) {
      for (let y = 30; y < H; y += 34) {
        const d = Math.hypot(x - fx, y - fy);
        const t = Math.max(0, 1 - d / 430);
        const r = 1 + t * 6.4;
        if (t < 0.06) continue;
        dots += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${ink}" opacity="${(0.16 + t * 0.6).toFixed(2)}"/>`;
      }
    }
    art = dots + `<circle cx="${fx}" cy="${fy}" r="13" fill="${red}"/>`;
  } else if (m.motif === 3) {
    // orbit diagram
    const cx = j(240, 560), cy = j(140, 300), r1 = j(110, 160);
    const a = j(0, Math.PI * 2);
    const px = cx + Math.cos(a) * r1, py = cy + Math.sin(a) * r1;
    art = `
      <circle cx="${cx}" cy="${cy}" r="${r1}" fill="none" stroke="${ink}" stroke-width="2.5"/>
      <circle cx="${cx}" cy="${cy}" r="${r1 + 44}" fill="none" stroke="${soft}" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="${r1 + 88}" fill="none" stroke="${softer}" stroke-width="1.5" stroke-dasharray="4 7"/>
      <line x1="${cx - r1 - 110}" y1="${cy}" x2="${cx + r1 + 110}" y2="${cy}" stroke="${softer}" stroke-width="1.5"/>
      <line x1="${cx}" y1="${cy - r1 - 110}" x2="${cx}" y2="${cy + r1 + 110}" stroke="${softer}" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="7" fill="${ink}"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="15" fill="${red}"/>`;
  } else if (m.motif === 4) {
    // abstract bars
    let bars = "";
    const nB = 9, bw = 40, gap = 18;
    const x0 = (W - nB * bw - (nB - 1) * gap) / 2;
    const redIdx = Math.floor(rnd() * nB);
    for (let i = 0; i < nB; i++) {
      const h = j(50, 300);
      const x = x0 + i * (bw + gap);
      bars += `<rect x="${x}" y="${H - 40 - h}" width="${bw}" height="${h}" fill="${i === redIdx ? red : i % 2 ? soft : ink}"/>`;
    }
    art = bars + `<line x1="${x0 - 26}" y1="${H - 40}" x2="${x0 + nB * bw + (nB - 1) * gap + 26}" y2="${H - 40}" stroke="${ink}" stroke-width="3"/>`;
  } else {
    // offset circles
    const cx = j(260, 540), cy = j(150, 290), r1 = j(90, 140);
    art = `
      <circle cx="${cx}" cy="${cy}" r="${r1}" fill="${ink}"/>
      <circle cx="${cx + j(-120, 120)}" cy="${cy + j(-60, 60)}" r="${r1 * j(0.5, 0.75)}" fill="${red}"/>
      <circle cx="${cx + j(-150, 150)}" cy="${cy + j(-80, 80)}" r="${r1 * 1.5}" fill="none" stroke="${soft}" stroke-width="2"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${art}
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="${softer}" stroke-width="1.5"/>
</svg>`;
}

markets.forEach((m) => {
  fs.writeFileSync(path.join(COVER_DIR, m.slug + ".svg"), coverSVG(m));
});

// ---------- global activity seed ----------
const rndG = mulberry32(20260917);
const feed = [];
for (let i = 0; i < 140; i++) {
  const m = markets[Math.floor(rndG() * markets.length)];
  const yes = rndG() < (m.c / 100) * 0.85 + 0.07;
  feed.push({
    m: m.slug,
    yes,
    amt: Math.round((40 + rndG() * rndG() * 4000) / 10) * 10,
    name: NAMES[Math.floor(rndG() * NAMES.length)],
    t: Math.floor(rndG() * 3600),
  });
}

const meta = {
  totalVol: Math.round(markets.reduce((s, m) => s + m.volT, 0) * 1.15),
  vol24: markets.reduce((s, m) => s + m.vol24, 0),
  traders: 1128,
  updated: 1758150000000,
};

const out = `// Generated by scripts/generate.js. Do not edit by hand.
window.ARC = {
  meta: ${JSON.stringify(meta)},
  cats: ${JSON.stringify(Object.fromEntries(Object.entries(CATS).map(([k, v]) => [k, { label: v.label }])))},
  markets: ${JSON.stringify(markets)},
  names: ${JSON.stringify(NAMES)},
  leaders: ${JSON.stringify(LEADERS)},
  feed: ${JSON.stringify(feed)}
};`;

fs.writeFileSync(path.join(ROOT, "js", "data.js"), out);
console.log(`markets: ${markets.length}`);
console.log(`covers: ${markets.length} svg written`);
console.log(`data.js: ${(out.length / 1024).toFixed(0)} KB`);
