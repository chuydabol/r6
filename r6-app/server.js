const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const EA_PRO_CLUBS_BASE_URL = "https://proclubs.ea.com/api/fc/clubs/matches";
const LEAGUE_DATA_PATH = path.join(__dirname, "data", "league.json");

app.use(express.static("public"));

function readLeagueData() {
  const raw = fs.readFileSync(LEAGUE_DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

function withComputedTeamFields(team) {
  const goalDifference = team.goalsFor - team.goalsAgainst;
  const points = team.wins * 3 + team.draws;

  return {
    ...team,
    goalDifference,
    points
  };
}

function buildStandings(teams) {
  return teams
    .map(withComputedTeamFields)
    .sort((a, b) => (
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.name.localeCompare(b.name)
    ))
    .reduce((groups, team) => {
      if (!groups[team.conference]) {
        groups[team.conference] = [];
      }

      groups[team.conference].push({
        ...team,
        rank: groups[team.conference].length + 1,
        qualified: groups[team.conference].length < 2
      });

      return groups;
    }, {});
}

function resolveFixtureTeams(fixture, teamMap) {
  const homeTeam = teamMap.get(fixture.homeTeamId);
  const awayTeam = teamMap.get(fixture.awayTeamId);

  return {
    ...fixture,
    homeTeam,
    awayTeam,
    scoreline: fixture.homeScore === null || fixture.awayScore === null
      ? "vs"
      : `${fixture.homeScore} - ${fixture.awayScore}`
  };
}

app.get("/api/league", (_req, res) => {
  try {
    const data = readLeagueData();
    const teams = data.teams.map(withComputedTeamFields);
    const standings = buildStandings(data.teams);
    const teamMap = new Map(teams.map((team) => [team.id, team]));
    const fixtures = data.fixtures.map((fixture) => resolveFixtureTeams(fixture, teamMap));
    const completedFixtures = fixtures.filter((fixture) => fixture.status.toLowerCase() === "final");

    res.json({
      ...data.league,
      teams,
      standings,
      fixtures,
      metrics: {
        clubsEnrolled: teams.length,
        conferences: Object.keys(standings).length,
        matchesPlayed: completedFixtures.length,
        scheduledMatches: fixtures.length - completedFixtures.length,
        currentMatchday: data.league.currentMatchday
      }
    });
  } catch (error) {
    console.error("LEAGUE DATA ERROR:", error);
    res.status(500).json({
      error: "Failed to load EAFC league data",
      message: error.message
    });
  }
});

app.get("/api/teams", (_req, res) => {
  try {
    const data = readLeagueData();
    res.json({ teams: data.teams.map(withComputedTeamFields) });
  } catch (error) {
    console.error("TEAMS DATA ERROR:", error);
    res.status(500).json({ error: "Failed to load teams", message: error.message });
  }
});

app.get("/api/standings", (_req, res) => {
  try {
    const data = readLeagueData();
    res.json({ standings: buildStandings(data.teams) });
  } catch (error) {
    console.error("STANDINGS DATA ERROR:", error);
    res.status(500).json({ error: "Failed to load standings", message: error.message });
  }
});

app.get("/api/fixtures", (_req, res) => {
  try {
    const data = readLeagueData();
    const teams = data.teams.map(withComputedTeamFields);
    const teamMap = new Map(teams.map((team) => [team.id, team]));
    res.json({ fixtures: data.fixtures.map((fixture) => resolveFixtureTeams(fixture, teamMap)) });
  } catch (error) {
    console.error("FIXTURES DATA ERROR:", error);
    res.status(500).json({ error: "Failed to load fixtures", message: error.message });
  }
});

app.get("/api/ea-club-matches/:clubId", async (req, res) => {
  const clubId = String(req.params.clubId || "").trim();
  const platform = String(req.query.platform || "common-gen5");
  const matchType = String(req.query.matchType || "friendlyMatch");

  if (!clubId) {
    return res.status(400).json({ error: "An EA club id is required." });
  }

  try {
    const url = new URL(EA_PRO_CLUBS_BASE_URL);
    url.searchParams.set("matchType", matchType);
    url.searchParams.set("platform", platform);
    url.searchParams.set("clubIds", clubId);

    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Referer": "https://www.ea.com/",
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      const message = await response.text();
      return res.status(response.status).json({
        error: "Failed to load EA Pro Clubs matches",
        message
      });
    }

    const matches = await response.json();
    res.json({ clubId, platform, matchType, matches });
  } catch (error) {
    console.error("EA CLUB MATCHES ERROR:", error);
    res.status(500).json({
      error: "Failed to proxy EA Pro Clubs matches",
      message: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`EAFC league server running on port ${PORT}`);
});
