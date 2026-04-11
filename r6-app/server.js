const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
