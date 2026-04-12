const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const ODDS_API_BASE_URL = "https://api.the-odds-api.com/v4";
const ODDS_API_KEY = process.env.ODDS_API_KEY;

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

function normalizeOddsOutcomes(sport, event, eventOddsData) {
  const bookmakers = Array.isArray(eventOddsData?.bookmakers) ? eventOddsData.bookmakers : [];
  const rows = [];
  bookmakers.forEach(bookmaker => {
    const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
    markets.forEach(market => {
      const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : [];
      outcomes.forEach(outcome => {
        const playerName = String(outcome?.description || outcome?.name || "").trim();
        const side = String(outcome?.name || "").trim();
        const line = Number(outcome?.point);
        const odds = Number(outcome?.price);
        if (!playerName || (side !== "Over" && side !== "Under")) return;
        if (!Number.isFinite(line) || !Number.isFinite(odds)) return;
        rows.push({
          sport,
          eventId: event.id,
          commenceTime: event.commence_time || null,
          homeTeam: event.home_team || "",
          awayTeam: event.away_team || "",
          bookmakerKey: bookmaker?.key || "",
          bookmakerTitle: bookmaker?.title || "Unknown Bookmaker",
          marketKey: market?.key || "",
          playerName,
          side,
          line,
          odds
        });
      });
    });
  });
  return rows;
}

function groupOddsOutcomes(normalizedRows) {
  const grouped = new Map();
  normalizedRows.forEach(row => {
    const key = [
      row.sport,
      row.eventId,
      row.bookmakerTitle,
      row.marketKey,
      row.playerName,
      row.line
    ].join("|");
    if (!grouped.has(key)) {
      grouped.set(key, {
        sport: row.sport,
        eventId: row.eventId,
        commenceTime: row.commenceTime,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        bookmakerKey: row.bookmakerKey,
        bookmakerTitle: row.bookmakerTitle,
        marketKey: row.marketKey,
        playerName: row.playerName,
        line: row.line,
        overOdds: null,
        underOdds: null
      });
    }
    const entry = grouped.get(key);
    if (row.side === "Over") entry.overOdds = row.odds;
    if (row.side === "Under") entry.underOdds = row.odds;
  });

  return Array.from(grouped.values()).map(entry => {
    const impliedOverProbability = americanOddsToImpliedProbability(entry.overOdds);
    const impliedUnderProbability = americanOddsToImpliedProbability(entry.underOdds);
    const fair = removeVigFromTwoWayMarket(impliedOverProbability, impliedUnderProbability);
    return {
      ...entry,
      impliedOverProbability,
      impliedUnderProbability,
      fairOverProbability: fair.fairOver,
      fairUnderProbability: fair.fairUnder,
      fairOverOdds: probabilityToAmericanOdds(fair.fairOver),
      fairUnderOdds: probabilityToAmericanOdds(fair.fairUnder)
    };
  });
}

app.get("/api/odds-comparison", async (req, res) => {
  const sport = String(req.query.sport || "basketball_nba");
  const markets = String(req.query.markets || "player_points");

  if (!ODDS_API_KEY) {
    return res.status(500).json({ error: "ODDS_API_KEY is not configured on the server." });
  }

  try {
    const eventsUrl = new URL(`${ODDS_API_BASE_URL}/sports/${encodeURIComponent(sport)}/odds`);
    eventsUrl.searchParams.set("apiKey", ODDS_API_KEY);
    eventsUrl.searchParams.set("regions", "us");
    eventsUrl.searchParams.set("oddsFormat", "american");

    const eventsResponse = await fetch(eventsUrl.toString());
    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      return res.status(eventsResponse.status).json({
        error: "Failed to load events from Odds API",
        message: errorText
      });
    }
    const events = await eventsResponse.json();
    const safeEvents = Array.isArray(events) ? events : [];

    const allRows = [];
    for (const event of safeEvents) {
      if (!event?.id) continue;
      const eventUrl = new URL(`${ODDS_API_BASE_URL}/sports/${encodeURIComponent(sport)}/events/${encodeURIComponent(event.id)}/odds`);
      eventUrl.searchParams.set("apiKey", ODDS_API_KEY);
      eventUrl.searchParams.set("regions", "us");
      eventUrl.searchParams.set("oddsFormat", "american");
      eventUrl.searchParams.set("markets", markets);

      try {
        const eventResponse = await fetch(eventUrl.toString());
        if (!eventResponse.ok) {
          continue;
        }
        const eventOddsData = await eventResponse.json();
        const normalizedRows = normalizeOddsOutcomes(sport, event, eventOddsData);
        allRows.push(...normalizedRows);
      } catch (eventError) {
        console.error("ODDS EVENT ERROR:", event?.id, eventError?.message || eventError);
      }
    }

    const groupedProps = groupOddsOutcomes(allRows);
    res.json({
      sport,
      markets,
      eventCount: safeEvents.length,
      normalizedCount: allRows.length,
      groupedCount: groupedProps.length,
      props: groupedProps
    });
  } catch (error) {
    console.error("ODDS COMPARISON ERROR:", error);
    res.status(500).json({
      error: "Failed to load sportsbook props",
      message: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
