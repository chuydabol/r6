const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));

app.get("/api/team/:slug", async (req, res) => {
  try {
    const response = await fetch(`https://api.bo3.gg/api/v1/teams/${req.params.slug}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("TEAM ERROR:", error);
    res.status(500).json({ error: "Failed to fetch team data" });
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

    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("MATCH ERROR:", error);
    res.status(500).json({ error: "Failed to fetch team matches" });
  }
});

app.get("/api/prizepicks/r6", async (req, res) => {
  try {
    const headers = {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0"
    };

    const queryVariants = [
      // Original strict query (kept first for expected board behavior).
      "?league_id=274&per_page=250&single_stat=true&in_game=true&state_code=CA&game_mode=prizepools",
      // Alternate board modes seen in production.
      "?league_id=274&per_page=250&single_stat=true&in_game=true&state_code=CA&game_mode=pickem",
      "?league_id=274&per_page=250&single_stat=true&in_game=true&game_mode=pickem",
      // Relax state / in-game constraints.
      "?league_id=274&per_page=250&single_stat=true&in_game=true",
      "?league_id=274&per_page=250&single_stat=true",
      // Last-resort league query with minimal filters.
      "?league_id=274&per_page=250"
    ];

    let payload = null;
    let selectedQuery = null;
    let bestCount = -1;

    for (const query of queryVariants) {
      const url = `https://api.prizepicks.com/projections${query}`;
      const response = await fetch(url, { headers });
      const candidate = await response.json();
      const candidateData = Array.isArray(candidate?.data) ? candidate.data : [];
      const candidateCount = candidateData.length;

      if (candidateCount > bestCount) {
        payload = candidate;
        selectedQuery = query;
        bestCount = candidateCount;
      }

      // Do not break early: keep scanning variants and choose the richest payload.
    }

    if (!payload) {
      throw new Error("PrizePicks returned an empty response payload");
    }

    const included = Array.isArray(payload.included) ? payload.included : [];
    const projections = Array.isArray(payload.data) ? payload.data : [];

    const includedMap = new Map();
    for (const item of included) {
      includedMap.set(`${item.type}:${item.id}`, item);
    }

    const flatProps = projections.map((projection) => {
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
        teamName: playerAttrs.team || playerAttrs.team_name || "Unknown Team",
        playerImage: playerAttrs.image_url || "",
        lineScore: attrs.line_score ?? null,
        statType: attrs.stat_display_name || attrs.stat_type || statType?.attributes?.name || "Unknown Stat",
        description: attrs.description || "",
        startTime: attrs.start_time || gameAttrs.start_time || null,
        boardTime: attrs.board_time || null,
        status: attrs.status || gameAttrs.status || "unknown",
        projectionType: attrs.projection_type || "Unknown",
        durationName: duration?.attributes?.name || "",
        gameLabel: gameAttrs.external_game_id || attrs.game_id || "",
        homeTeam: teams.home?.abbreviation || "",
        awayTeam: teams.away?.abbreviation || "",
        rawGame: gameAttrs
      };
    });

    res.json({
      count: flatProps.length,
      queryUsed: selectedQuery,
      props: flatProps
    });
  } catch (error) {
    console.error("PRIZEPICKS ERROR:", error);
    res.status(500).json({ error: "Failed to fetch PrizePicks R6 board" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
