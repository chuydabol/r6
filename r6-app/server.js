const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));

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

app.get("/api/prizepicks/r6", async (req, res) => {
  try {
    const url = new URL("https://api.prizepicks.com/projections");
    url.searchParams.set("league_id", "274");
    url.searchParams.set("per_page", "250");
    url.searchParams.set("single_stat", "true");
    url.searchParams.set("in_game", "true");
    url.searchParams.set("state_code", "CA");
    url.searchParams.set("game_mode", "prizepools");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Host": "api.prizepicks.com",
        "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": "https://app.prizepicks.com",
        "Referer": "https://app.prizepicks.com/",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Ch-Ua": `"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"`,
        "Sec-Ch-Ua-Mobile": "?1",
        "Sec-Ch-Ua-Platform": `"Android"`,
        "Sec-Fetch-Site": "same-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty"
      }
    });

    const text = await response.text();

    console.log("PRIZEPICKS STATUS:", response.status);
    console.log("PRIZEPICKS RAW:", text.slice(0, 500));

    let payload;
    try {
      payload = JSON.parse(text);
    } catch (parseError) {
      return res.json({
        debug: true,
        parseFailed: true,
        status: response.status,
        rawPreview: text.slice(0, 500),
        count: 0,
        props: []
      });
    }

    const included = Array.isArray(payload.included) ? payload.included : [];
    const projections = Array.isArray(payload.data) ? payload.data : [];

    const includedMap = new Map();
    included.forEach(item => {
      includedMap.set(`${item.type}:${item.id}`, item);
    });

    const props = projections.map(projection => {
      const attrs = projection.attributes || {};
      const rel = projection.relationships || {};

      const player = includedMap.get(`new_player:${rel.new_player?.data?.id}`);
      const game = includedMap.get(`game:${rel.game?.data?.id}`);
      const statType = includedMap.get(`stat_type:${rel.stat_type?.data?.id}`);
      const duration = includedMap.get(`duration:${rel.duration?.data?.id}`);

      const playerAttrs = player?.attributes || {};
      const gameAttrs = game?.attributes || {};
      const gameMeta = gameAttrs.metadata || {};
      const gameInfo = gameMeta.game_info || {};
      const teams = gameInfo.teams || {};

      return {
        projectionId: projection.id,
        playerName: playerAttrs.display_name || playerAttrs.name || "Unknown",
        teamName: playerAttrs.team || playerAttrs.team_name || "Unknown",
        lineScore: attrs.line_score ?? null,
        statType: attrs.stat_display_name || attrs.stat_type || statType?.attributes?.name || "Unknown Stat",
        description: attrs.description || "",
        startTime: attrs.start_time || gameAttrs.start_time || null,
        status: attrs.status || gameAttrs.status || "unknown",
        projectionType: attrs.projection_type || "Unknown",
        durationName: duration?.attributes?.name || "",
        homeTeam: teams.home?.abbreviation || "",
        awayTeam: teams.away?.abbreviation || ""
      };
    });

    res.json({
      debug: true,
      status: response.status,
      count: props.length,
      firstProp: props[0] || null,
      props
    });
  } catch (error) {
    console.error("PRIZEPICKS ERROR:", error);
    res.status(500).json({
      error: "Failed to fetch PrizePicks R6 board",
      message: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});