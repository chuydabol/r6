const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const SPORTSGAMEODDS_BASE_URL = "https://api.sportsgameodds.com/v2/events";
const SPORTSGAMEODDS_KEY = process.env.SPORTSGAMEODDS_KEY;

app.use(express.static("public"));

app.get("/api/team-search", async (req, res) => {
  try {
    const query = (req.query.q || "").trim();

    if (!query) {
      return res.json({ results: [] });
    }

    const url =
      `https://api.bo3.gg/api/v1/filters/teams` +
      `?page[offset]=0` +
      `&page[limit]=8` +
      `&filter[teams.discipline_id][eq]=7` +
      `&search_text=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("TEAM SEARCH ERROR:", error);
    res.status(500).json({
      error: "Failed to search teams",
      message: error.message
    });
  }
});

app.get("/api/team/:slug", async (req, res) => {
  try {
    const response = await fetch(`https://api.bo3.gg/api/v1/teams/${req.params.slug}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("TEAM ERROR:", error);
    res.status(500).json({
      error: "Failed to fetch team data",
      message: error.message
    });
  }
});

app.get("/api/team-matches/:teamId", async (req, res) => {
  try {
    const teamId = req.params.teamId;

    const url =
      `https://api.bo3.gg/api/v1/matches` +
      `?page[offset]=0` +
      `&page[limit]=20` +
      `&sort=-start_date` +
      `&filter[matches.status][in]=current,upcoming,finished,defwin` +
      `&filter[matches.team_ids][overlap]=${teamId}` +
      `&filter[matches.discipline_id][eq]=7` +
      `&with=teams,tournament,ai_predictions,r6siege_games`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("MATCH ERROR:", error);
    res.status(500).json({
      error: "Failed to fetch team matches",
      message: error.message
    });
  }
});

app.get("/api/player-matches/:playerId", async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const url =
      `https://api.bo3.gg/api/v1/matches` +
      `?page[offset]=0` +
      `&page[limit]=40` +
      `&sort=-start_date` +
      `&filter[matches.player_ids][overlap]=${playerId}` +
      `&filter[matches.discipline_id][eq]=7` +
      `&with=teams,tournament,ai_predictions,r6siege_games`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("PLAYER MATCHES ERROR:", error);
    res.status(500).json({
      error: "Failed to fetch player matches",
      message: error.message
    });
  }
});

app.get("/api/match-details/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    const url =
      `https://api.bo3.gg/api/v1/matches/${slug}` +
      `?scope=show-match` +
      `&prefer_locale=en` +
      `&with=r6siege_games,teams_and_players,tournament_deep,stage,ai_predictions,insights`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("MATCH DETAILS ERROR:", error);
    res.status(500).json({
      error: "Failed to fetch match details",
      message: error.message
    });
  }
});

app.get("/api/match-player-stats/:matchId", async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const url = `https://api.bo3.gg/api/v1/r6siege/stats/matches/${matchId}/players_stats`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("PLAYER STATS ERROR:", error);
    res.status(500).json({
      error: "Failed to fetch player stats",
      message: error.message
    });
  }
});

app.get("/api/prizepicks/manual", (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "prizepicks.json");

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: "Manual PrizePicks file not found",
        message: "Create data/prizepicks.json and paste the PrizePicks API response into it."
      });
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(raw);

    const included = Array.isArray(json.included) ? json.included : [];
    const projections = Array.isArray(json.data) ? json.data : [];

    const includedMap = new Map();
    included.forEach(item => {
      includedMap.set(`${item.type}:${item.id}`, item);
    });

    const props = projections.map(projection => {
      const attrs = projection.attributes || {};
      const rel = projection.relationships || {};

      const playerId = rel.new_player?.data?.id || null;
      const gameId = rel.game?.data?.id || null;
      const statTypeId = rel.stat_type?.data?.id || null;
      const durationId = rel.duration?.data?.id || null;

      const player = playerId ? includedMap.get(`new_player:${playerId}`) : null;
      const game = gameId ? includedMap.get(`game:${gameId}`) : null;
      const statType = statTypeId ? includedMap.get(`stat_type:${statTypeId}`) : null;
      const duration = durationId ? includedMap.get(`duration:${durationId}`) : null;

      const playerAttrs = player?.attributes || {};
      const gameAttrs = game?.attributes || {};
      const gameMeta = gameAttrs.metadata || {};
      const gameInfo = gameMeta.game_info || {};
      const teams = gameInfo.teams || {};

      return {
        projectionId: projection.id,
        playerId,
        gameId,
        playerName: playerAttrs.display_name || playerAttrs.name || "Unknown",
        teamName: playerAttrs.team || playerAttrs.team_name || "Unknown",
        lineScore: attrs.line_score ?? null,
        statType: attrs.stat_display_name || attrs.stat_type || statType?.attributes?.name || "Unknown Stat",
        description: attrs.description || "",
        startTime: attrs.start_time || gameAttrs.start_time || null,
        status: attrs.status || gameAttrs.status || "unknown",
        projectionType: attrs.projection_type || "Unknown",
        durationName: duration?.attributes?.name || "",
        gameExternalId: gameAttrs.external_game_id || "",
        gameMetaId: gameMeta.game_id || "",
        homeTeam: teams.home?.abbreviation || "",
        awayTeam: teams.away?.abbreviation || "",
        matchupText: `${teams.home?.abbreviation || ""} vs ${teams.away?.abbreviation || ""}`.trim()
      };
    });

    res.json({
      count: props.length,
      firstProp: props[0] || null,
      props
    });
  } catch (error) {
    console.error("MANUAL PRIZEPICKS ERROR:", error);
    res.status(500).json({
      error: "Failed to read manual PrizePicks data",
      message: error.message
    });
  }
});

function americanOddsToImpliedProbability(odds) {
  const parsed = Number(odds);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  if (parsed < 0) return Math.abs(parsed) / (Math.abs(parsed) + 100);
  return 100 / (parsed + 100);
}

function removeVigFromTwoWayMarket(impliedOver, impliedUnder) {
  if (!Number.isFinite(impliedOver) || !Number.isFinite(impliedUnder)) {
    return { fairOver: null, fairUnder: null };
  }
  const total = impliedOver + impliedUnder;
  if (!Number.isFinite(total) || total <= 0) {
    return { fairOver: null, fairUnder: null };
  }
  return {
    fairOver: impliedOver / total,
    fairUnder: impliedUnder / total
  };
}

function probabilityToAmericanOdds(probability) {
  const parsed = Number(probability);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) return null;
  if (parsed >= 0.5) return -Math.round((parsed / (1 - parsed)) * 100);
  return Math.round(((1 - parsed) / parsed) * 100);
}

const NON_PLAYER_ENTITIES = new Set(["all", "home", "away"]);
const PLAYER_SIDE_MAP = { over: "over", under: "under" };
const SUPPORTED_LEAGUE_IDS = new Set([
  "NBA",
  "NFL",
  "MLB",
  "NHL",
  "EPL",
  "UEFA_CHAMPIONS_LEAGUE",
  "NCAAB",
  "NCAAF"
]);
const LEAGUE_ALIAS_MAP = {
  NBA: ["NBA"],
  NFL: ["NFL"],
  MLB: ["MLB"],
  NHL: ["NHL"],
  EPL: ["EPL"],
  UEFA_CHAMPIONS_LEAGUE: ["UEFA_CHAMPIONS_LEAGUE"],
  NCAAB: ["NCAAB", "NCAA-M", "NCAA_BASKETBALL"],
  NCAAF: ["NCAAF", "NCAA_FOOTBALL"]
};
const STAT_ALIAS_MAP = {
  points: ["points", "pts", "player_points"],
  rebounds: ["rebounds", "reb", "player_rebounds"],
  assists: ["assists", "ast", "player_assists"],
  threes: ["threepointersmade", "three_pointers_made"],
  pra: ["pra", "points+rebounds+assists", "points_rebounds_assists", "player_points_rebounds_assists"],
  fantasy_points: ["fantasy_points", "fantasyscore", "player_fantasy_points"]
};
const NBA_PRIZEPICKS_SUPPORT_MAP = {
  game: new Set([
    "points",
    "rebounds",
    "assists",
    "threepointersmade",
    "points+rebounds+assists",
    "points+assists",
    "points+rebounds",
    "rebounds+assists",
    "blocks",
    "steals",
    "turnovers",
    "blocks+steals",
    "fieldgoalsmade",
    "freethrowsattempted",
    "freethrowsmade",
    "fantasyscore"
  ]),
  "1q": new Set([
    "assists",
    "points",
    "rebounds",
    "threepointersmade"
  ]),
  "1h": new Set([
    "fantasyscore",
    "points+rebounds+assists",
    "points",
    "threepointersmade"
  ]),
  "2h": new Set(["fantasyscore"]),
  "4q": new Set(["fantasyscore"])
};

function normalizeLeagueID(value) {
  const target = String(value || "NBA").trim().toUpperCase();
  if (target === "BASKETBALL_NBA") return "NBA";
  if (target === "BASKETBALL_NCAAB") return "NCAAB";
  if (!target) return "NBA";
  return SUPPORTED_LEAGUE_IDS.has(target) ? target : null;
}

function matchesLeague(eventLeague, selectedLeague) {
  const eventKey = String(eventLeague || "").trim().toUpperCase();
  const aliases = LEAGUE_ALIAS_MAP[selectedLeague] || [selectedLeague];
  return aliases.some(alias => eventKey.includes(alias));
}

function splitStatIDs(statIDsParam) {
  const raw = String(statIDsParam || "").trim();
  if (!raw) return [];
  return raw.split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
}

function normalizeStatIDKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_]/g, "");
}

function matchesStatID(statID, requestedStatIDs) {
  if (!requestedStatIDs.length) return true;
  const statKey = normalizeStatIDKey(statID);
  if (!statKey) return false;
  return requestedStatIDs.some(requested => {
    if (requested === "all") return true;
    const aliases = STAT_ALIAS_MAP[requested] || [requested];
    return aliases
      .map(alias => normalizeStatIDKey(alias))
      .some(alias => statKey === alias);
  });
}

function parseOddID(oddID) {
  const parts = String(oddID || "").split("-");
  return {
    oddID: oddID || "",
    statID: parts[0] || null,
    statEntityID: parts[1] || null,
    periodID: parts[2] || null,
    betTypeID: parts[3] || null,
    sideID: parts[4] || null
  };
}

function normalizePrizePicksStatKey(statID) {
  return String(statID || "").trim().toLowerCase().replace(/\s+/g, "");
}

function isPrizePicksSupportedNBA(statID, periodID, betTypeID) {
  const periodKey = String(periodID || "").trim().toLowerCase();
  const betTypeKey = String(betTypeID || "").trim().toLowerCase();
  if (betTypeKey !== "ou") return false;
  const supportedStats = NBA_PRIZEPICKS_SUPPORT_MAP[periodKey];
  if (!supportedStats) return false;
  return supportedStats.has(normalizePrizePicksStatKey(statID));
}

function formatPlayerName(statEntityID) {
  const raw = String(statEntityID || "").trim();
  if (!raw) return "Unknown Player";
  const parts = raw.split("_").filter(Boolean);
  while (parts.length && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  while (parts.length && /^[A-Z]{2,6}$/.test(parts[parts.length - 1])) parts.pop();
  const formatted = parts.map(part => {
    const lower = part.toLowerCase();
    if (["ii", "iii", "iv", "jr", "sr"].includes(lower)) return lower.toUpperCase();
    if (lower === "mccollum") return "McCollum";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" ");
  return formatted || raw.replace(/_/g, " ");
}

function resolvePlayerName(event, statEntityID) {
  const rawPlayerID = String(statEntityID || "").trim();
  if (!rawPlayerID) return "Unknown Player";
  const eventPlayers = event?.players && typeof event.players === "object" ? event.players : {};
  const directName = eventPlayers?.[rawPlayerID]?.name;
  if (typeof directName === "string" && directName.trim()) return directName.trim();
  return formatPlayerName(rawPlayerID);
}

function getTeamShortName(teamNode, fallback) {
  const shortName = teamNode?.names?.short || teamNode?.shortName || teamNode?.name;
  const cleaned = String(shortName || fallback || "").trim();
  return cleaned || "";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBookmakerOdds(bookmakerNode) {
  if (!bookmakerNode || typeof bookmakerNode !== "object") return null;
  const oddsCandidates = [bookmakerNode.odds, bookmakerNode.price, bookmakerNode.americanOdds];
  for (const candidate of oddsCandidates) {
    const value = toNumber(candidate);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function getBookmakerLine(bookmakerNode) {
  if (!bookmakerNode || typeof bookmakerNode !== "object") return null;
  const lineCandidates = [bookmakerNode.overUnder, bookmakerNode.line, bookmakerNode.total, bookmakerNode.spread];
  for (const candidate of lineCandidates) {
    const value = toNumber(candidate);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function buildMarketKey(meta) {
  return [meta.statID || "unknown", meta.periodID || "full", meta.betTypeID || "unknown"].join(":");
}

function getDisplayMarketLabel(statID, marketKey) {
  const key = normalizeStatIDKey(statID);
  const labels = {
    points: "Points",
    rebounds: "Rebounds",
    assists: "Assists",
    threepointersmade: "3PT Made",
    "points+rebounds+assists": "PRA",
    fantasyscore: "Fantasy Points"
  };
  return labels[key] || String(marketKey || statID || "Stat");
}

function buildPlayerGroupKey(meta) {
  return [meta.eventID || "", meta.playerIDRaw || "", meta.statID || "", meta.periodID || ""].join("|");
}

function buildPrizePicksMatchKey(meta) {
  return [meta.eventID || "", meta.playerIDRaw || "", meta.statID || "", meta.periodID || "", meta.betTypeID || ""].join("|");
}

function normalizePrizePicksRawEntry(bookmakerNode, meta) {
  return {
    bookmakerID: "prizepicks",
    odds: getBookmakerOdds(bookmakerNode),
    overUnder: getBookmakerLine(bookmakerNode),
    available: bookmakerNode?.available !== false,
    deeplink: String(bookmakerNode?.deeplink || bookmakerNode?.deepLink || "").trim() || null,
    oddID: meta.oddID || null,
    statID: meta.statID || null,
    statEntityID: meta.statEntityID || null,
    periodID: meta.periodID || null,
    sideID: meta.sideID || null
  };
}

function buildPrizePicksFromRawEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const mergedByLine = new Map();

  entries.forEach(entry => {
    const line = toNumber(entry?.overUnder);
    const lineKey = Number.isFinite(line) ? String(line) : "no-line";
    if (!mergedByLine.has(lineKey)) {
      mergedByLine.set(lineKey, {
        bookmakerID: "prizepicks",
        line,
        overOdds: null,
        underOdds: null,
        available: entry?.available !== false,
        deeplink: entry?.deeplink || null
      });
    }

    const merged = mergedByLine.get(lineKey);
    const side = String(entry?.sideID || "").toLowerCase();
    const odds = toNumber(entry?.odds);
    if (side === "over" && Number.isFinite(odds)) merged.overOdds = odds;
    if (side === "under" && Number.isFinite(odds)) merged.underOdds = odds;
    if (entry?.available === false) merged.available = false;
    if (!merged.deeplink && entry?.deeplink) merged.deeplink = entry.deeplink;
  });

  const candidates = Array.from(mergedByLine.values());
  const withLine = candidates.find(candidate => Number.isFinite(candidate.line));
  return withLine || candidates[0] || null;
}

function normalizeSportsGameOddsResponse(events, options) {
  const rawPlayerPropRecords = [];
  const uniqueBookmakers = new Map();
  const prizePicksRawByGroup = new Map();
  const prizePicksTraceByGroup = new Map();
  const requestedStatIDs = splitStatIDs(options.statIDs);
  const mode = options.marketMode === "alternate" ? "alternate" : "standard";

  events.forEach(event => {
    if (!matchesLeague(event?.leagueID || event?.league || event?.sportID, options.leagueID)) return;
    const oddsNode = event?.odds && typeof event.odds === "object" ? event.odds : {};
    Object.entries(oddsNode).forEach(([oddID, oddNode]) => {
      const parsedOddID = parseOddID(oddID);
      const statEntityID = String(oddNode?.statEntityID || parsedOddID.statEntityID || "").trim();
      if (!statEntityID || NON_PLAYER_ENTITIES.has(statEntityID.toLowerCase())) return;

      const statID = String(oddNode?.statID || parsedOddID.statID || "").trim();
      const periodID = String(oddNode?.periodID || parsedOddID.periodID || "").trim();
      const betTypeID = String(oddNode?.betTypeID || parsedOddID.betTypeID || "").trim().toLowerCase();
      const sideID = String(oddNode?.sideID || parsedOddID.sideID || "").trim().toLowerCase();
      if (!matchesStatID(statID, requestedStatIDs)) return;
      if (betTypeID !== "ou") return;
      if (!PLAYER_SIDE_MAP[sideID]) return;
      const eventID = String(event?.eventID || event?.id || "");
      const ppSupported = options.leagueID === "NBA"
        ? isPrizePicksSupportedNBA(statID, periodID, betTypeID)
        : false;
      const prizePicksMatchKey = buildPrizePicksMatchKey({ eventID, playerIDRaw: statEntityID, statID, periodID, betTypeID });
      if (!prizePicksTraceByGroup.has(prizePicksMatchKey)) {
        prizePicksTraceByGroup.set(prizePicksMatchKey, {
          eventID,
          playerIDRaw: statEntityID,
          statID,
          periodID,
          betTypeID,
          marketKey: buildMarketKey({ statID, periodID, betTypeID }),
          ppSupported,
          rawOddsFound: 0,
          rawPrizePicksFound: false,
          pairedPrizePicksFound: false,
          groupedPrizePicksFound: false,
          parsedStatID: parsedOddID.statID || null,
          parsedPeriodID: parsedOddID.periodID || null,
          rawPrizePicksEntries: []
        });
      }
      const trace = prizePicksTraceByGroup.get(prizePicksMatchKey);
      trace.rawOddsFound += 1;

      const isAlternateLine = Boolean(oddNode?.isAlternateLine) || Number.isFinite(toNumber(oddNode?.altLineIndex));
      if (mode === "standard" && isAlternateLine) return;

      const byBookmaker = oddNode?.byBookmaker && typeof oddNode.byBookmaker === "object" ? oddNode.byBookmaker : {};
      const rawPrizePicksBook = byBookmaker?.prizepicks;
      if (ppSupported && rawPrizePicksBook && typeof rawPrizePicksBook === "object") {
        trace.rawPrizePicksFound = true;
        const rawPrizePicksEntry = normalizePrizePicksRawEntry(rawPrizePicksBook, {
          oddID,
          statID,
          statEntityID,
          periodID,
          sideID
        });
        trace.rawPrizePicksEntries.push(rawPrizePicksEntry);
        if (!prizePicksRawByGroup.has(prizePicksMatchKey)) {
          prizePicksRawByGroup.set(prizePicksMatchKey, []);
        }
        prizePicksRawByGroup.get(prizePicksMatchKey).push(rawPrizePicksEntry);
      }

      Object.entries(byBookmaker).forEach(([bookmakerID, bookmakerNode]) => {
        const line = getBookmakerLine(bookmakerNode);
        const odds = getBookmakerOdds(bookmakerNode);
        const available = bookmakerNode?.available !== false;
        if (!Number.isFinite(line) || !Number.isFinite(odds)) return;
        const altLinesRaw = Array.isArray(bookmakerNode?.altLines) ? bookmakerNode.altLines : [];
        const altLines = altLinesRaw.map(item => ({
          line: getBookmakerLine(item),
          overOdds: toNumber(item?.overOdds ?? item?.over),
          underOdds: toNumber(item?.underOdds ?? item?.under),
          available: item?.available !== false
        })).filter(item => Number.isFinite(item.line));

        const bookmakerTitle = String(bookmakerNode?.bookmakerTitle || bookmakerNode?.title || bookmakerID || "Unknown Bookmaker");
        uniqueBookmakers.set(bookmakerID, bookmakerTitle);
        const awayTeam = getTeamShortName(event?.teams?.away, event?.awayTeam || event?.away);
        const homeTeam = getTeamShortName(event?.teams?.home, event?.homeTeam || event?.home);

        rawPlayerPropRecords.push({
          leagueID: options.leagueID,
          eventID,
          commenceTime: event?.commenceTime || event?.startTime || null,
          homeTeam,
          awayTeam,
          matchup: awayTeam && homeTeam ? `${awayTeam} @ ${homeTeam}` : "Unknown matchup",
          playerIDRaw: statEntityID,
          playerName: resolvePlayerName(event, statEntityID),
          statID,
          periodID,
          betTypeID,
          marketKey: buildMarketKey({ statID, periodID, betTypeID }),
          displayMarketLabel: getDisplayMarketLabel(statID, buildMarketKey({ statID, periodID, betTypeID })),
          bookmakerID,
          bookmakerTitle,
          side: PLAYER_SIDE_MAP[sideID],
          line,
          odds,
          available,
          altLines,
          oddID
        });
      });
    });
  });

  const pairMap = new Map();
  rawPlayerPropRecords.forEach(record => {
    const key = [record.eventID, record.playerIDRaw, record.statID, record.periodID, record.betTypeID, record.bookmakerID, record.line].join("|");
    if (!pairMap.has(key)) {
      pairMap.set(key, {
        leagueID: record.leagueID,
        eventID: record.eventID,
        commenceTime: record.commenceTime,
        homeTeam: record.homeTeam,
        awayTeam: record.awayTeam,
        matchup: record.matchup,
        playerIDRaw: record.playerIDRaw,
        playerName: record.playerName,
        statID: record.statID,
        periodID: record.periodID,
        betTypeID: record.betTypeID,
        marketKey: record.marketKey,
        displayMarketLabel: record.displayMarketLabel,
        bookmakerID: record.bookmakerID,
        bookmakerTitle: record.bookmakerTitle,
        line: record.line,
        altLines: record.altLines || [],
        overOdds: null,
        underOdds: null,
        oddIDOver: null,
        oddIDUnder: null
      });
    }
    const pair = pairMap.get(key);
    if (record.side === "over") {
      pair.overOdds = record.odds;
      pair.oddIDOver = record.oddID;
    }
    if (record.side === "under") {
      pair.underOdds = record.odds;
      pair.oddIDUnder = record.oddID;
    }
  });

  const pairedBookProps = Array.from(pairMap.values()).map(pair => {
    if (!Number.isFinite(pair.overOdds) || !Number.isFinite(pair.underOdds)) return null;
    const pairGroupKey = buildPrizePicksMatchKey(pair);
    const pairTrace = prizePicksTraceByGroup.get(pairGroupKey);
    if (pairTrace?.ppSupported && String(pair.bookmakerID || "").toLowerCase() === "prizepicks") {
      pairTrace.pairedPrizePicksFound = true;
    }
    const impliedOverProbability = americanOddsToImpliedProbability(pair.overOdds);
    const impliedUnderProbability = americanOddsToImpliedProbability(pair.underOdds);
    const fair = removeVigFromTwoWayMarket(impliedOverProbability, impliedUnderProbability);
    return {
      ...pair,
      impliedOverProbability,
      impliedUnderProbability,
      fairOverProbability: fair.fairOver,
      fairUnderProbability: fair.fairUnder,
      fairOverOdds: probabilityToAmericanOdds(fair.fairOver),
      fairUnderOdds: probabilityToAmericanOdds(fair.fairUnder)
    };
  }).filter(Boolean);

  const groupedMap = new Map();
  const alternateMap = new Map();

  pairedBookProps.forEach(pair => {
    const standardKey = [pair.eventID, pair.playerIDRaw, pair.statID, pair.periodID, pair.betTypeID].join("|");
    if (!groupedMap.has(standardKey)) {
      groupedMap.set(standardKey, {
        leagueID: pair.leagueID,
        eventID: pair.eventID,
        commenceTime: pair.commenceTime,
        homeTeam: pair.homeTeam,
        awayTeam: pair.awayTeam,
        matchup: pair.matchup,
        playerIDRaw: pair.playerIDRaw,
        playerName: pair.playerName,
        statID: pair.statID,
        periodID: pair.periodID,
        betTypeID: pair.betTypeID,
        marketKey: pair.marketKey,
        displayMarketLabel: pair.displayMarketLabel,
        books: [],
        prizepicks: null
      });
    }

    const standardGroup = groupedMap.get(standardKey);
    standardGroup.books.push(pair);
    const pairTrace = prizePicksTraceByGroup.get(buildPrizePicksMatchKey(pair));
    if (pairTrace?.ppSupported && String(pair.bookmakerID || "").toLowerCase() === "prizepicks") {
      standardGroup.prizepicks = {
        bookmakerID: "prizepicks",
        line: pair.line,
        overOdds: pair.overOdds,
        underOdds: pair.underOdds,
        available: true,
        deeplink: null
      };
    }

    const altKey = [pair.eventID, pair.playerIDRaw, pair.statID, pair.periodID].join("|");
    if (!alternateMap.has(altKey)) {
      alternateMap.set(altKey, {
        eventID: pair.eventID,
        playerIDRaw: pair.playerIDRaw,
        playerName: pair.playerName,
        statID: pair.statID,
        periodID: pair.periodID,
        betTypeID: pair.betTypeID,
        marketKey: pair.marketKey,
        displayMarketLabel: pair.displayMarketLabel,
        homeTeam: pair.homeTeam,
        awayTeam: pair.awayTeam,
        matchup: pair.matchup,
        booksMap: new Map()
      });
    }

    const altGroup = alternateMap.get(altKey);
    if (!altGroup.booksMap.has(pair.bookmakerID)) {
      altGroup.booksMap.set(pair.bookmakerID, {
        bookmakerID: pair.bookmakerID,
        bookmakerTitle: pair.bookmakerTitle,
        lines: []
      });
    }
    const bookLines = altGroup.booksMap.get(pair.bookmakerID).lines;
    bookLines.push({
      line: pair.line,
      overOdds: pair.overOdds,
      underOdds: pair.underOdds,
      available: true
    });
    (pair.altLines || []).forEach(altLine => {
      bookLines.push({
        line: altLine.line,
        overOdds: Number.isFinite(altLine.overOdds) ? altLine.overOdds : null,
        underOdds: Number.isFinite(altLine.underOdds) ? altLine.underOdds : null,
        available: altLine.available !== false
      });
    });
  });

  const groupedStandardProps = Array.from(groupedMap.values()).map(group => {
    const standardKey = buildPrizePicksMatchKey(group);
    const trace = prizePicksTraceByGroup.get(standardKey) || {
      ppSupported: false,
      rawOddsFound: 0,
      rawPrizePicksFound: false,
      pairedPrizePicksFound: false,
      groupedPrizePicksFound: false,
      parsedStatID: null,
      parsedPeriodID: null,
      rawPrizePicksEntries: []
    };
    const rawPrizePicksEntries = trace.ppSupported ? (prizePicksRawByGroup.get(standardKey) || []) : [];
    const rawPrizePicksValue = trace.ppSupported ? buildPrizePicksFromRawEntries(rawPrizePicksEntries) : null;
    if (trace.ppSupported) {
      if (!group.prizepicks && rawPrizePicksValue) {
        group.prizepicks = rawPrizePicksValue;
      } else if (group.prizepicks && rawPrizePicksValue) {
        group.prizepicks.available = rawPrizePicksValue.available;
        group.prizepicks.deeplink = rawPrizePicksValue.deeplink;
      }
    }
    trace.groupedPrizePicksFound = Boolean(group.prizepicks);

    const lines = group.books.map(book => book.line).filter(Number.isFinite).sort((a, b) => a - b);
    const booksCount = group.books.length;
    const minLine = lines.length ? lines[0] : null;
    const maxLine = lines.length ? lines[lines.length - 1] : null;
    const meanLine = lines.length ? lines.reduce((sum, line) => sum + line, 0) / lines.length : null;
    const medianLine = lines.length
      ? (lines.length % 2 === 1
        ? lines[(lines.length - 1) / 2]
        : (lines[(lines.length / 2) - 1] + lines[lines.length / 2]) / 2)
      : null;

    const outliers = Number.isFinite(meanLine)
      ? group.books
        .filter(book => Number.isFinite(book.line) && Math.abs(book.line - meanLine) >= 1)
        .map(book => ({
          bookmakerID: book.bookmakerID,
          bookmakerTitle: book.bookmakerTitle,
          line: book.line,
          direction: book.line < meanLine ? "lower than consensus" : "higher than consensus"
        }))
      : [];

    const fairBooks = group.books.filter(book =>
      Number.isFinite(book.fairOverProbability) && Number.isFinite(book.fairUnderProbability)
    );
    const consensusFairOverProbability = fairBooks.length
      ? fairBooks.reduce((sum, book) => sum + book.fairOverProbability, 0) / fairBooks.length
      : null;
    const consensusFairUnderProbability = fairBooks.length
      ? fairBooks.reduce((sum, book) => sum + book.fairUnderProbability, 0) / fairBooks.length
      : null;

    const bestOverLine = group.books.reduce((best, book) => {
      if (!best) return book;
      if (book.overOdds > best.overOdds) return book;
      return best;
    }, null);

    const bestUnderLine = group.books.reduce((best, book) => {
      if (!best) return book;
      if (book.underOdds > best.underOdds) return book;
      return best;
    }, null);

    const prizepicksLine = Number.isFinite(group.prizepicks?.line) ? group.prizepicks.line : null;
    let prizepicksEdge = null;
    if (Number.isFinite(prizepicksLine) && Number.isFinite(meanLine)) {
      if (prizepicksLine < meanLine) prizepicksEdge = "Better for OVER";
      else if (prizepicksLine > meanLine) prizepicksEdge = "Better for UNDER";
      else prizepicksEdge = "In line with market";
    }

    const altCandidates = [];
    group.books.forEach(book => {
      (book.altLines || []).forEach(altLine => {
        if (!Number.isFinite(altLine?.line) || !Number.isFinite(meanLine)) return;
        altCandidates.push({
          bookmakerID: book.bookmakerID,
          bookmakerTitle: book.bookmakerTitle,
          line: altLine.line,
          overOdds: altLine.overOdds,
          underOdds: altLine.underOdds,
          deltaFromConsensus: Math.abs(altLine.line - meanLine),
          valueTag: altLine.line < meanLine
            ? "Lower than consensus (OVER lean)"
            : altLine.line > meanLine
              ? "Higher than consensus (UNDER lean)"
              : "At consensus"
        });
      });
    });
    const bestAltOpportunity = altCandidates.sort((a, b) => b.deltaFromConsensus - a.deltaFromConsensus)[0] || null;

    return {
      ...group,
      booksCount,
      consensusLineMean: meanLine,
      consensusLineMedian: medianLine,
      minLine,
      maxLine,
      outliers,
      bestOver: bestOverLine ? {
        line: bestOverLine.line,
        odds: bestOverLine.overOdds,
        bookmakerID: bestOverLine.bookmakerID,
        bookmakerTitle: bestOverLine.bookmakerTitle
      } : null,
      bestUnder: bestUnderLine ? {
        line: bestUnderLine.line,
        odds: bestUnderLine.underOdds,
        bookmakerID: bestUnderLine.bookmakerID,
        bookmakerTitle: bestUnderLine.bookmakerTitle
      } : null,
      rawPrizePicksFound: Boolean(trace.rawPrizePicksFound),
      pairedPrizePicksFound: Boolean(trace.pairedPrizePicksFound),
      groupedPrizePicksFound: Boolean(trace.groupedPrizePicksFound),
      ppSupported: trace.ppSupported ? "yes" : "no",
      ppRaw: trace.rawPrizePicksFound ? "yes" : "no",
      ppPaired: trace.pairedPrizePicksFound ? "yes" : "no",
      ppGrouped: trace.groupedPrizePicksFound ? "yes" : "no",
      parsedStatID: trace.parsedStatID,
      parsedPeriodID: trace.parsedPeriodID,
      prizepicksStatus: trace.ppSupported
        ? (trace.rawPrizePicksFound ? "line" : "not_returned_by_api")
        : "unsupported_market",
      prizepicksDebug: (trace.rawOddsFound || trace.rawPrizePicksEntries?.length || trace.pairedPrizePicksFound || trace.groupedPrizePicksFound)
        ? {
          rawOddsFound: trace.rawOddsFound,
          ppSupported: trace.ppSupported,
          parsedStatID: trace.parsedStatID,
          parsedPeriodID: trace.parsedPeriodID,
          rawPrizePicksEntries: trace.rawPrizePicksEntries
        }
        : null,
      prizepicksEdge,
      bestAltOpportunity,
      consensusFairOverProbability,
      consensusFairUnderProbability,
      consensusFairOverOdds: probabilityToAmericanOdds(consensusFairOverProbability),
      consensusFairUnderOdds: probabilityToAmericanOdds(consensusFairUnderProbability)
    };
  });

  const groupedAlternateProps = Array.from(alternateMap.values()).map(group => {
    const books = Array.from(group.booksMap.values()).map(book => ({
      ...book,
      lines: Array.from(
        new Map(
          book.lines
            .filter(line => Number.isFinite(line?.line))
            .map(line => [`${line.line}|${line.overOdds}|${line.underOdds}`, line])
        ).values()
      ).sort((a, b) => a.line - b.line)
    }));
    const allLines = books.flatMap(book => book.lines.map(line => line.line)).filter(Number.isFinite);
    return {
      eventID: group.eventID,
      playerIDRaw: group.playerIDRaw,
      playerName: group.playerName,
      statID: group.statID,
      periodID: group.periodID,
      betTypeID: group.betTypeID,
      marketKey: group.marketKey,
      displayMarketLabel: group.displayMarketLabel,
      homeTeam: group.homeTeam,
      awayTeam: group.awayTeam,
      matchup: group.matchup,
      books,
      booksCount: books.length,
      lowestLine: allLines.length ? Math.min(...allLines) : null,
      highestLine: allLines.length ? Math.max(...allLines) : null
    };
  });

  return {
    rawPlayerPropRecords,
    pairedBookProps,
    groupedStandardProps,
    groupedAlternateProps,
    uniqueBookmakers: Array.from(uniqueBookmakers, ([bookmakerID, bookmakerTitle]) => ({ bookmakerID, bookmakerTitle }))
  };
}

app.get("/api/odds-comparison", async (req, res) => {
  const leagueID = normalizeLeagueID(req.query.leagueID || "NBA");
  if (!leagueID) {
    return res.status(400).json({ error: "Unsupported league for current SportsGameOdds setup" });
  }
  const debugLeagueMap = {
    NBA: "NBA",
    NFL: "NFL",
    MLB: "MLB",
    NHL: "NHL",
    NCAAB: "NCAAB",
    NCAAF: "NCAAF"
  };
  const selectedLeagueID = debugLeagueMap[leagueID];
  if (!selectedLeagueID) {
    return res.status(400).json({ error: "Unsupported league for current SportsGameOdds setup" });
  }
  const marketMode = String(req.query.marketMode || "standard") === "alternate" ? "alternate" : "standard";
  const statIDs = String(req.query.statIDs || "");
  const sentParams = {
    leagueID: selectedLeagueID,
    oddsAvailable: "true",
    includeAltLines: "true",
    limit: "10"
  };

  if (!SPORTSGAMEODDS_KEY) {
    return res.status(500).json({
      success: false,
      error: "SPORTSGAMEODDS_KEY is not configured on the server.",
      debug: { sentParams }
    });
  }

  try {
    const eventsURL = new URL(SPORTSGAMEODDS_BASE_URL);
    Object.entries(sentParams).forEach(([key, value]) => {
      eventsURL.searchParams.set(key, value);
    });
    console.log("SportsGameOdds params:", sentParams);

    const response = await fetch(eventsURL.toString(), {
      headers: {
        "x-api-key": SPORTSGAMEODDS_KEY,
        "accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: "Failed to load events from SportsGameOdds",
        message: errorText,
        debug: { sentParams }
      });
    }

    const payload = await response.json();
    const events = Array.isArray(payload?.data) ? payload.data : [];

    const normalized = normalizeSportsGameOddsResponse(events, {
      leagueID,
      marketMode,
      statIDs
    });

    res.json({
      success: true,
      provider: "sportsgameodds",
      leagueID,
      marketMode,
      eventsLoaded: events.length,
      rawPlayerPropRecords: normalized.rawPlayerPropRecords.length,
      pairedBookProps: normalized.pairedBookProps.length,
      groupedProps: marketMode === "alternate" ? normalized.groupedAlternateProps.length : normalized.groupedStandardProps.length,
      uniqueBookmakers: normalized.uniqueBookmakers,
      debug: {
        sentParams,
        eventsReturned: events.length
      },
      bookProps: normalized.pairedBookProps,
      groupedStandardProps: normalized.groupedStandardProps,
      groupedAlternateProps: normalized.groupedAlternateProps
    });
  } catch (error) {
    console.error("SPORTSGAMEODDS ODDS COMPARISON ERROR:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load sportsbook props",
      message: error.message,
      debug: { sentParams }
    });
  }
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
