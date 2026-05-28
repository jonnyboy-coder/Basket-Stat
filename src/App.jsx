import React, { useMemo, useState } from "react";
import {
  RotateCcw,
  Undo2,
  ClipboardList,
  Users,
  Trophy,
  Edit3,
  Save,
  FolderOpen,
  FileDown,
} from "lucide-react";

const initialPlayers = [];

const emptyLine = {
  pts: 0,
  reb: 0,
  oreb: 0,
  dreb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  pf: 0,
  tov: 0,
  twoM: 0,
  twoA: 0,
  threeM: 0,
  threeA: 0,
  ftM: 0,
  ftA: 0,
};

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border shadow-xl ${className}`}>{children}</div>
);

const CardContent = ({ children, className = "" }) => <div className={className}>{children}</div>;

const Button = ({ children, className = "", disabled = false, onClick, type = "button" }) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={`${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    {children}
  </button>
);

const statButtons = [
  { label: "2PT +", type: "2PT_MADE" },
  { label: "2PT –", type: "2PT_MISS" },
  { label: "3PT +", type: "3PT_MADE" },
  { label: "3PT –", type: "3PT_MISS" },
  { label: "FT +", type: "FT_MADE" },
  { label: "FT –", type: "FT_MISS" },
  { label: "REB", type: "REB" },
  { label: "STL", type: "STL" },
  { label: "BLK", type: "BLK" },
  { label: "FOUL", type: "FOUL" },
  { label: "TO", type: "TO" },
];

const leaderCategories = [
  ["Points", "pts"],
  ["Rebounds", "reb"],
  ["Assists", "ast"],
  ["Steals", "stl"],
  ["Blocks", "blk"],
];

const averageLeaderCategories = [
  ["PPG", "pts"],
  ["RPG", "reb"],
  ["APG", "ast"],
  ["SPG", "stl"],
  ["BPG", "blk"],
];

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeStorageGet(key, fallback) {
  try {
    if (typeof localStorage === "undefined") return fallback;
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Local storage may be unavailable in some preview environments.
  }
}

function applyEvent(line, eventType) {
  const next = { ...emptyLine, ...line };

  if (eventType === "2PT_MADE") {
    next.pts += 2;
    next.twoM += 1;
    next.twoA += 1;
  }
  if (eventType === "2PT_MISS") next.twoA += 1;

  if (eventType === "3PT_MADE") {
    next.pts += 3;
    next.threeM += 1;
    next.threeA += 1;
  }
  if (eventType === "3PT_MISS") next.threeA += 1;

  if (eventType === "FT_MADE") {
    next.pts += 1;
    next.ftM += 1;
    next.ftA += 1;
  }
  if (eventType === "FT_MISS") next.ftA += 1;

  if (eventType === "REB") next.reb += 1;
  if (eventType === "OREB") {
    next.reb += 1;
    next.oreb += 1;
  }
  if (eventType === "DREB") {
    next.reb += 1;
    next.dreb += 1;
  }

  if (eventType === "AST") next.ast += 1;
  if (eventType === "STL") next.stl += 1;
  if (eventType === "BLK") next.blk += 1;
  if (eventType === "FOUL") next.pf += 1;
  if (eventType === "TO") next.tov += 1;

  return next;
}

function eventLabel(event) {
  const labels = {
    "2PT_MADE": "made 2PT",
    "2PT_MISS": "missed 2PT",
    "3PT_MADE": "made 3PT",
    "3PT_MISS": "missed 3PT",
    "FT_MADE": "made FT",
    "FT_MISS": "missed FT",
    REB: "rebound",
    OREB: "offensive rebound",
    DREB: "defensive rebound",
    AST: "assist",
    STL: "steal",
    BLK: "block",
    FOUL: "foul",
    TO: "turnover",
  };

  let base = labels[event.type] || event.type;
  if ((event.type === "2PT_MADE" || event.type === "3PT_MADE") && event.assistName) {
    base += ` assisted by ${event.assistName}`;
  }
  if ((event.type === "2PT_MADE" || event.type === "3PT_MADE") && event.noAssist) {
    base += " unassisted";
  }
  return base;
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function rowsToCSV(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function calculateGameLines(players, events) {
  const lines = Object.fromEntries(players.map((p) => [p.id, { ...emptyLine }]));

  for (const event of events) {
    if (lines[event.playerId]) lines[event.playerId] = applyEvent(lines[event.playerId], event.type);
    if (event.assistPlayerId && lines[event.assistPlayerId]) {
      lines[event.assistPlayerId] = applyEvent(lines[event.assistPlayerId], "AST");
    }
  }

  return lines;
}

function buildSeasonRows(savedGames) {
  const totalsByPlayer = new Map();

  for (const game of savedGames) {
    const gamePlayers = game.players || [];
    const gameEvents = game.events || [];
    const gameLines = calculateGameLines(gamePlayers, gameEvents);

    for (const player of gamePlayers) {
      const line = gameLines[player.id] || { ...emptyLine };
      const appeared = gameEvents.some((event) => event.playerId === player.id || event.assistPlayerId === player.id);
      const key = `${player.number}-${player.name}`;

      if (!totalsByPlayer.has(key)) {
        totalsByPlayer.set(key, {
          id: key,
          number: player.number,
          name: player.name,
          gp: 0,
          ...emptyLine,
        });
      }

      const row = totalsByPlayer.get(key);
      if (appeared) row.gp += 1;
      for (const stat of Object.keys(emptyLine)) row[stat] += line[stat] || 0;
    }
  }

  return [...totalsByPlayer.values()].sort(sortByNumberThenName);
}

function sortByNumberThenName(a, b) {
  const aNum = Number(a.number);
  const bNum = Number(b.number);
  if (Number.isNaN(aNum) && Number.isNaN(bNum)) return String(a.name).localeCompare(String(b.name));
  if (Number.isNaN(aNum)) return 1;
  if (Number.isNaN(bNum)) return -1;
  return aNum - bNum;
}

function filterAndSortSeasonRows(rows, search, minGames, sortKey) {
  const query = search.trim().toLowerCase();
  const minGp = Number(minGames) || 0;

  const filtered = rows.filter((p) => {
    const matchesSearch =
      !query ||
      String(p.name).toLowerCase().includes(query) ||
      String(p.number).toLowerCase().includes(query);
    return matchesSearch && p.gp >= minGp;
  });

  return [...filtered].sort((a, b) => {
    if (sortKey === "pts") return b.pts - a.pts;
    if (sortKey === "reb") return b.reb - a.reb;
    if (sortKey === "ast") return b.ast - a.ast;
    if (sortKey === "stl") return b.stl - a.stl;
    if (sortKey === "blk") return b.blk - a.blk;
    if (sortKey === "ppg") return (b.gp ? b.pts / b.gp : 0) - (a.gp ? a.pts / a.gp : 0);
    if (sortKey === "rpg") return (b.gp ? b.reb / b.gp : 0) - (a.gp ? a.reb / a.gp : 0);
    if (sortKey === "apg") return (b.gp ? b.ast / b.gp : 0) - (a.gp ? a.ast / a.gp : 0);
    return sortByNumberThenName(a, b);
  });
}

function runSanityTests() {
  const madeThree = applyEvent({ ...emptyLine }, "3PT_MADE");
  console.assert(madeThree.pts === 3, "3PT made should add 3 points");
  console.assert(madeThree.threeM === 1 && madeThree.threeA === 1, "3PT made should add one make and one attempt");

  const offensiveRebound = applyEvent({ ...emptyLine }, "OREB");
  console.assert(offensiveRebound.reb === 1 && offensiveRebound.oreb === 1, "OREB should count as one rebound and one offensive rebound");

  const csv = rowsToCSV([["Player", "PTS"], ["Matti", 12]]);
  console.assert(csv === '"Player","PTS"\n"Matti","12"', "CSV output should use escaped cells and newline separators");

  const testPlayers = [{ id: 1, number: 7, name: "Matti" }];
  const testEvents = [{ playerId: 1, type: "2PT_MADE" }, { playerId: 1, type: "OREB" }];
  const gameLines = calculateGameLines(testPlayers, testEvents);
  console.assert(gameLines[1].pts === 2 && gameLines[1].reb === 1, "Game lines should calculate points and rebounds");

  const season = buildSeasonRows([{ players: testPlayers, events: testEvents }]);
  console.assert(season[0].gp === 1 && season[0].pts === 2, "Season rows should count games played and totals");

  const filtered = filterAndSortSeasonRows(season, "mat", 1, "pts");
  console.assert(filtered.length === 1 && filtered[0].name === "Matti", "Season filters should find matching players");
}

if (typeof window !== "undefined") {
  runSanityTests();
}

export default function FylkirLiveStatsPrototype() {
  const [players, setPlayers] = useState(initialPlayers);
  const [teamName] = useState("Grindavík");
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [events, setEvents] = useState([]);
  const [quarter, setQuarter] = useState(1);
  const [opponentScore, setOpponentScore] = useState(0);
  const [possession, setPossession] = useState("team");
  const [screen, setScreen] = useState("game");
  const [pendingStat, setPendingStat] = useState(null);
  const [pendingShot, setPendingShot] = useState(null);
  const [pendingRebound, setPendingRebound] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [lastDeletedEvent, setLastDeletedEvent] = useState(null);
  const [savedGames, setSavedGames] = useState(() => safeStorageGet("basketball_saved_games", []));
  const [gameTitle, setGameTitle] = useState("Grindavík vs Opponent");
  const [parsedTeamName, parsedOpponentName] = gameTitle
    .split(/\s+vs\s+/i)
    .map((name) => name.trim());

  const displayTeamName = parsedTeamName || "Team";
  const displayOpponentName = parsedOpponentName || "Opponent";  
  const [seasonSearch, setSeasonSearch] = useState("");
  const [seasonMinGames, setSeasonMinGames] = useState(0);
  const [seasonSort, setSeasonSort] = useState("number");

  const mainButton = "h-14 px-5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-blue-950 text-lg font-black";

  const sortedPlayers = useMemo(() => [...players].sort(sortByNumberThenName), [players]);
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) || sortedPlayers[0];

  const boxScore = useMemo(() => calculateGameLines(players, events), [events, players]);

  const teamScore = useMemo(() => Object.values(boxScore).reduce((sum, line) => sum + line.pts, 0), [boxScore]);

  const leaders = useMemo(() => {
    const rows = sortedPlayers.map((p) => ({ ...p, ...boxScore[p.id] }));
    return {
      pts: [...rows].sort((a, b) => b.pts - a.pts).slice(0, 3),
      reb: [...rows].sort((a, b) => b.reb - a.reb).slice(0, 3),
      ast: [...rows].sort((a, b) => b.ast - a.ast).slice(0, 3),
    };
  }, [sortedPlayers, boxScore]);

  const teamTotals = useMemo(() => {
    return Object.values(boxScore).reduce(
      (totals, line) => {
        for (const key of Object.keys(emptyLine)) totals[key] += line[key] || 0;
        return totals;
      },
      { ...emptyLine }
    );
  }, [boxScore]);

  const seasonRows = useMemo(() => buildSeasonRows(savedGames), [savedGames]);

  const filteredSeasonRows = useMemo(
    () => filterAndSortSeasonRows(seasonRows, seasonSearch, seasonMinGames, seasonSort),
    [seasonRows, seasonSearch, seasonMinGames, seasonSort]
  );

  const seasonLeaders = useMemo(() => {
    const qualifiedRows = filteredSeasonRows.filter((p) => p.gp > 0);
    const average = (player, stat) => (player.gp ? player[stat] / player.gp : 0);

    return {
      totals: {
        pts: [...filteredSeasonRows].sort((a, b) => b.pts - a.pts).slice(0, 5),
        reb: [...filteredSeasonRows].sort((a, b) => b.reb - a.reb).slice(0, 5),
        oreb: [...filteredSeasonRows].sort((a, b) => b.oreb - a.oreb).slice(0, 5),
        dreb: [...filteredSeasonRows].sort((a, b) => b.dreb - a.dreb).slice(0, 5),
        ast: [...filteredSeasonRows].sort((a, b) => b.ast - a.ast).slice(0, 5),
        stl: [...filteredSeasonRows].sort((a, b) => b.stl - a.stl).slice(0, 5),
        blk: [...filteredSeasonRows].sort((a, b) => b.blk - a.blk).slice(0, 5),
      },
      averages: {
        pts: [...qualifiedRows].sort((a, b) => average(b, "pts") - average(a, "pts")).slice(0, 5),
        reb: [...qualifiedRows].sort((a, b) => average(b, "reb") - average(a, "reb")).slice(0, 5),
        oreb: [...qualifiedRows].sort((a, b) => average(b, "oreb") - average(a, "oreb")).slice(0, 5),
        dreb: [...qualifiedRows].sort((a, b) => average(b, "dreb") - average(a, "dreb")).slice(0, 5),
        ast: [...qualifiedRows].sort((a, b) => average(b, "ast") - average(a, "ast")).slice(0, 5),
        stl: [...qualifiedRows].sort((a, b) => average(b, "stl") - average(a, "stl")).slice(0, 5),
        blk: [...qualifiedRows].sort((a, b) => average(b, "blk") - average(a, "blk")).slice(0, 5),
      },
    };
  }, [filteredSeasonRows]);

  const seasonTeamTotals = useMemo(() => {
    return filteredSeasonRows.reduce(
      (totals, player) => {
        totals.pts += player.pts || 0;
        totals.reb += player.reb || 0;
        totals.oreb += player.oreb || 0;
        totals.dreb += player.dreb || 0;
        totals.ast += player.ast || 0;
        totals.stl += player.stl || 0;
        totals.blk += player.blk || 0;
        totals.threeM += player.threeM || 0;
        return totals;
      },
      { pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, threeM: 0 }
    );
  }, [filteredSeasonRows]);

  const downloadCSV = (filename, rows) => {
    const csv = rowsToCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.replace(/[\\/:*?"<>|]/g, "-");
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSeasonTotals = () => {
    const rows = [
      [
        [
        "Player",
        "GP",
        "PTS",
        "PPG",
        "REB",
        "RPG",
        "OREB",
        "ORPG",
        "DREB",
        "DRPG",
        "AST",
        "APG",
        "STL",
        "SPG",
        "BLK",
        "BPG",
        "PF",
        "PFG",
        "TO",
        "TOG",
        "2PM",
        "2MPG",
        "2PA",
        "2APG",
        "3PM",
        "3MPG",
        "3PA",
        "3APG",
        "FTM",
        "FTMPG",
        "FTA",
        "FTAPG",
      ],
      ],
      ...filteredSeasonRows.map((p) => [
        `#${p.number} ${p.name}`,
        p.gp,
        p.pts,
        p.gp ? (p.pts / p.gp).toFixed(1) : "0.0",
        p.reb,
        p.gp ? (p.reb / p.gp).toFixed(1) : "0.0",
        p.oreb,
        p.gp ? (p.oreb / p.gp).toFixed(1) : "0.0",
        p.dreb,
        p.gp ? (p.dreb / p.gp).toFixed(1) : "0.0",
        p.ast,
        p.gp ? (p.ast / p.gp).toFixed(1) : "0.0",
        p.stl,
        p.gp ? (p.stl / p.gp).toFixed(1) : "0.0",
        p.blk,
        p.gp ? (p.blk / p.gp).toFixed(1) : "0.0",
        p.pf,
        p.gp ? (p.pf / p.gp).toFixed(1) : "0.0",
        p.tov,
        p.gp ? (p.tov / p.gp).toFixed(1) : "0.0",
        p.twoM,
        p.gp ? (p.twoM / p.gp).toFixed(1) : "0.0",
        p.twoA,
        p.gp ? (p.twoA / p.gp).toFixed(1) : "0.0",
        p.threeM,
        p.gp ? (p.threeM / p.gp).toFixed(1) : "0.0",
        p.threeA,
        p.gp ? (p.threeA / p.gp).toFixed(1) : "0.0",
        p.ftM,
        p.gp ? (p.ftM / p.gp).toFixed(1) : "0.0",
        p.ftA,
        p.gp ? (p.ftA / p.gp).toFixed(1) : "0.0",
      ]),
    ];
    downloadCSV("season-totals.csv", rows);
  };

  const exportBoxScore = () => {
    const rows = [
      ["Player", "PTS", "REB", "OREB", "DREB", "AST", "STL", "BLK", "PF", "TO", "2PM", "2PA", "3PM", "3PA", "FTM", "FTA"],
      ...sortedPlayers.map((p) => {
        const l = boxScore[p.id] || emptyLine;
        return [
          `#${p.number} ${p.name}`,
          l.pts,
          l.reb,
          l.oreb,
          l.dreb,
          l.ast,
          l.stl,
          l.blk,
          l.pf,
          l.tov,
          l.twoM,
          l.twoA,
          l.threeM,
          l.threeA,
          l.ftM,
          l.ftA,
        ];
      }),
    ];
    downloadCSV(`${gameTitle || "game"}-box-score.csv`, rows);
  };

  const exportPlayByPlay = () => {
    const rows = [
      ["Quarter", "Time Saved", "Possession", "Player", "Event"],
      ...[...events].reverse().map((event) => [
        `Q${event.quarter}`,
        event.createdAt,
        event.possession === "team" ? teamName : "Opponent",
        `#${event.playerNumber} ${event.playerName}`,
        eventLabel(event),
      ]),
    ];
    downloadCSV(`${gameTitle || "game"}-play-by-play.csv`, rows);
  };

  const saveEvent = (type, extra = {}) => {
  const player = extra.playerOverride || selectedPlayer;
  if (!player) return;

  const event = {
      id: makeId(),
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
      type,
      quarter,
      possession,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      ...extra,
    };
    setEvents((prev) => [event, ...prev]);
  };

const addEvent = (type) => {
  setPendingStat(type);
};

const choosePlayerForStat = (player) => {
  if (!pendingStat || !player) return;

  if (pendingStat === "2PT_MADE" || pendingStat === "3PT_MADE") {
    setPendingShot({ type: pendingStat, scorer: player });
    setPendingStat(null);
    return;
  }

  if (pendingStat === "REB") {
  setPendingRebound({ rebounder: player });
  setPendingStat(null);
  return;
}

saveEvent(pendingStat, { playerOverride: player });
setPendingStat(null);
};
  const chooseAssist = (assistPlayer) => {
    if (!pendingShot) return;
    saveEvent(
      pendingShot.type,
      {
        playerOverride: pendingShot.scorer,
        ...(assistPlayer
          ? {
              assistPlayerId: assistPlayer.id,
              assistName: assistPlayer.name,
              assistNumber: assistPlayer.number,
            }
          : { noAssist: true }),
      }
    );    setPendingShot(null);
  };

  const chooseReboundType = (type) => {
  if (!pendingRebound) return;
  saveEvent(type, { playerOverride: pendingRebound.rebounder });
  setPendingRebound(null);
};

  const undo = () => setEvents((prev) => prev.slice(1));

  const deleteEvent = (eventId) => {
    const deletedEvent = events.find((event) => event.id === eventId);

    if (deletedEvent) {
      setLastDeletedEvent(deletedEvent);
    }

    setEvents((prev) =>
      prev.filter((event) => event.id !== eventId)
    );
  };
  const restoreDeletedEvent = () => {
    if (!lastDeletedEvent) return;

    setEvents((prev) =>
      [lastDeletedEvent, ...prev].sort((a, b) => b.id - a.id)
    );

    setLastDeletedEvent(null);
  };
  const reset = () => {
    setEvents([]);
    setOpponentScore(0);
    setQuarter(1);
    setPossession("team");
    setPendingShot(null);
    setPendingRebound(null);
    setSelectedPlayerId(players[0]?.id);
  };

  const updatePlayer = (id, field, value) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: field === "number" ? Number(value) || "" : value } : p))
    );
  };

  const addPlayer = () => {
    const id = Date.now();
    setPlayers((prev) => [...prev, { id, number: "", name: "New Player" }]);
    setSelectedPlayerId(id);
  };

  const removePlayer = (id) => {
    const remaining = players.filter((p) => p.id !== id);
    setPlayers(remaining);
    if (selectedPlayerId === id) setSelectedPlayerId(remaining[0]?.id);
  };

  const saveCurrentGame = () => {
    const game = {
      id: makeId(),
      title: gameTitle || `${teamName} vs Opponent`,
      savedAt: new Date().toLocaleString(),
      players,
      events,
      quarter,
      opponentScore,
      possession,
      teamName,
    };
    const next = [game, ...savedGames];
    setSavedGames(next);
    safeStorageSet("basketball_saved_games", next);
  };

  const loadGame = (game) => {
    const loadedPlayers = game.players || initialPlayers;
    setPlayers(loadedPlayers);
    setEvents(game.events || []);
    setQuarter(game.quarter || 1);
    setOpponentScore(game.opponentScore || 0);
    setPossession(game.possession || "team");
    setGameTitle(game.title || `${teamName} vs Opponent`);
    setSelectedPlayerId(loadedPlayers[0]?.id);
    setScreen("game");
  };

  const deleteSavedGame = (id) => {
    const next = savedGames.filter((game) => game.id !== id);
    setSavedGames(next);
    safeStorageSet("basketball_saved_games", next);
  };

  const clearSeasonFilters = () => {
    setSeasonSearch("");
    setSeasonMinGames(0);
    setSeasonSort("number");
  };

  const Scoreboard = () => (
    <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3 text-center">
      <div className="rounded-2xl bg-yellow-400 text-blue-950 p-4">
        <div className="text-sm opacity-90 font-bold">{teamName}</div>
        <div className="text-5xl font-black">{teamScore}</div>
      </div>
      <div className="rounded-2xl bg-blue-800 p-4 border border-blue-600">
        <div className="text-sm text-blue-100">Quarter</div>
        <div className="flex items-center justify-center gap-2 mt-2">
          {[1, 2, 3, 4].map((q) => (
            <button
              key={q}
              onClick={() => setQuarter(q)}
              className={`h-12 w-12 rounded-xl text-xl font-black ${quarter === q ? "bg-yellow-400 text-blue-950" : "bg-blue-700 text-white"}`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-blue-800 p-4 border border-blue-600">
        <div className="text-sm text-blue-100">Possession</div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={() => setPossession("team")}
            className={`h-14 rounded-xl font-black ${possession === "team" ? "bg-yellow-400 text-blue-950" : "bg-blue-700 text-white"}`}
          >
            {displayTeamName}
          </button>
          <button
            onClick={() => setPossession("opponent")}
            className={`h-14 rounded-xl font-black ${possession === "opponent" ? "bg-yellow-400 text-blue-950" : "bg-blue-700 text-white"}`}
          >
            {displayOpponentName}
          </button>
        </div>
      </div>
      <div className="rounded-2xl bg-blue-800 p-4 border border-blue-600">
        <div className="text-sm text-blue-100">Opponent Points Only</div>
        <div className="text-5xl font-black text-yellow-300">{opponentScore}</div>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={`plus-${n}`}
                onClick={() => setOpponentScore((s) => s + n)}
                className="px-4 py-2 rounded-xl bg-yellow-400 text-blue-950 font-black text-lg"
              >
                +{n}
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={`minus-${n}`}
                onClick={() => setOpponentScore((s) => Math.max(0, s - n))}
                className="px-4 py-2 rounded-xl bg-blue-700 text-white font-black text-lg border border-blue-500"
              >
                -{n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const BoxScoreTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm table-fixed">
        <thead className="text-white">
          <tr className="border-b border-blue-700">
            <th className="text-left py-2 pr-3 w-40">Player</th>
            <th>PTS</th>
            <th>REB</th>
            <th>OREB</th>
            <th>DREB</th>
            <th>AST</th>
            <th>STL</th>
            <th>BLK</th>
            <th>PF</th>
            <th>TO</th>
            <th>2P</th>
            <th>3P</th>
            <th>FT</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p) => {
            const l = boxScore[p.id] || emptyLine;
            return (
              <tr key={p.id} className="border-b border-blue-800/70">
                <td className="py-3 pr-3 font-black whitespace-nowrap text-yellow-300">
                  #{p.number} {p.name}
                </td>
                <td className="text-center font-black text-yellow-300">{l.pts}</td>
                <td className="text-center font-black text-yellow-300">{l.reb}</td>
                <td className="text-center font-black text-yellow-300">{l.oreb}</td>
                <td className="text-center font-black text-yellow-300">{l.dreb}</td>
                <td className="text-center font-black text-yellow-300">{l.ast}</td>
                <td className="text-center font-black text-yellow-300">{l.stl}</td>
                <td className="text-center font-black text-yellow-300">{l.blk}</td>
                <td className="text-center font-black text-yellow-300">{l.pf}</td>
                <td className="text-center font-black text-yellow-300">{l.tov}</td>
                <td className="text-center font-black text-yellow-300">{l.twoM}/{l.twoA}</td>
                <td className="text-center font-black text-yellow-300">{l.threeM}/{l.threeA}</td>
                <td className="text-center font-black text-yellow-300">{l.ftM}/{l.ftA}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const TeamTotalsCards = ({ totals }) => (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
      {[
        ["PTS", totals.pts],
        ["REB", totals.reb],
        ["OREB", totals.oreb],
        ["DREB", totals.dreb],
        ["AST", totals.ast],
        ["STL", totals.stl],
        ["BLK", totals.blk],
        ["3PM", totals.threeM],
      ].map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-blue-800 border border-blue-600 p-4 text-center">
          <div className="text-blue-100 text-sm">Team {label}</div>
          <div className="text-3xl font-black text-yellow-300">{value}</div>
        </div>
      ))}
    </div>
  );

  if (screen === "season") {
    return (
      <div className="min-h-screen bg-blue-950 text-white p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Card className="bg-blue-900 border-blue-700 shadow-xl rounded-2xl">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                  <div className="text-sm text-blue-100">Season Database</div>
                  <h1 className="text-3xl md:text-4xl font-black text-yellow-300">Season Dashboard</h1>
                  <div className="text-white mt-1">Saved games included: {savedGames.length}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={exportSeasonTotals} className={mainButton}>
                    <FileDown className="mr-2 h-5 w-5" /> Season CSV
                  </Button>
                  <Button onClick={() => setScreen("game")} className={mainButton}>
                    Back to Game
                  </Button>
                </div>
              </div>

              {savedGames.length === 0 && (
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-5 text-blue-100 mb-5">
                  No saved games yet. Save games from the live tracker, then they will appear here as season totals.
                </div>
              )}

              <div className="rounded-2xl bg-blue-800 border border-blue-600 p-4 mb-5">
                <h2 className="text-xl font-black text-yellow-300 mb-3">Filter & Search</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    value={seasonSearch}
                    onChange={(e) => setSeasonSearch(e.target.value)}
                    className="h-14 rounded-xl bg-white text-blue-950 px-4 text-lg font-bold"
                    placeholder="Search player or #"
                  />
                  <select
                    value={seasonMinGames}
                    onChange={(e) => setSeasonMinGames(Number(e.target.value))}
                    className="h-14 rounded-xl bg-white text-blue-950 px-4 text-lg font-bold"
                  >
                    <option value={0}>All players</option>
                    <option value={1}>Min 1 game</option>
                    <option value={3}>Min 3 games</option>
                    <option value={5}>Min 5 games</option>
                    <option value={10}>Min 10 games</option>
                  </select>
                  <select
                    value={seasonSort}
                    onChange={(e) => setSeasonSort(e.target.value)}
                    className="h-14 rounded-xl bg-white text-blue-950 px-4 text-lg font-bold"
                  >
                    <option value="number">Sort by number</option>
                    <option value="pts">Total points</option>
                    <option value="reb">Total rebounds</option>
                    <option value="ast">Total assists</option>
                    <option value="stl">Total steals</option>
                    <option value="blk">Total blocks</option>
                    <option value="ppg">Points per game</option>
                    <option value="rpg">Rebounds per game</option>
                    <option value="apg">Assists per game</option>
                  </select>
                  <Button onClick={clearSeasonFilters} className={mainButton}>
                    Clear Filters
                  </Button>
                </div>
                <div className="text-sm text-blue-100 mt-3">
                  Showing {filteredSeasonRows.length} of {seasonRows.length} players
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
                <div className="rounded-2xl bg-yellow-400 text-blue-950 p-5 text-center">
                  <div className="text-sm font-bold">Games Saved</div>
                  <div className="text-5xl font-black">{savedGames.length}</div>
                </div>
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-5 text-center">
                  <div className="text-sm text-blue-100">Players</div>
                  <div className="text-5xl font-black text-yellow-300">{filteredSeasonRows.length}</div>
                </div>
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-5 text-center">
                  <div className="text-sm text-blue-100">Total PTS</div>
                  <div className="text-5xl font-black text-yellow-300">{seasonTeamTotals.pts}</div>
                </div>
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-5 text-center">
                  <div className="text-sm text-blue-100">Total 3PM</div>
                  <div className="text-5xl font-black text-yellow-300">{seasonTeamTotals.threeM}</div>
                </div>
              </div>

              <TeamTotalsCards totals={seasonTeamTotals} />

              <h2 className="text-2xl font-black text-yellow-300 mb-3">Season Total Leaders</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
                {leaderCategories.map(([title, stat]) => (
                  <div key={stat} className="rounded-2xl bg-blue-800 border border-blue-600 p-4">
                    <h2 className="text-xl font-black text-yellow-300 mb-3">Season {title}</h2>
                    {seasonLeaders.totals[stat].map((p) => (
                      <div key={p.id} className="flex justify-between text-white mb-2">
                        <span>#{p.number} {p.name}</span>
                        <span className="font-black text-yellow-300">{p[stat]}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <h2 className="text-2xl font-black text-yellow-300 mb-3">Season Average Leaders</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
                {averageLeaderCategories.map(([title, stat]) => (
                  <div key={title} className="rounded-2xl bg-blue-800 border border-blue-600 p-4">
                    <h2 className="text-xl font-black text-yellow-300 mb-3">{title}</h2>
                    {seasonLeaders.averages[stat].map((p) => (
                      <div key={p.id} className="flex justify-between text-white mb-2">
                        <span>#{p.number} {p.name}</span>
                        <span className="font-black text-yellow-300">{p.gp ? (p[stat] / p.gp).toFixed(1) : "0.0"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-blue-800 border border-blue-600 p-4 overflow-x-auto">
                <h2 className="text-xl font-black text-yellow-300 mb-3">Season Totals & Averages</h2>
                <table className="w-full text-sm">
                  <thead className="text-white">
                    <tr className="border-b border-blue-700">
                      <th className="text-left py-2 pr-3">Player</th>
                      <th>GP</th>
                      <th>PTS</th>
                      <th>PPG</th>
                      <th>REB</th>
                      <th>RPG</th>
                      <th>AST</th>
                      <th>APG</th>
                      <th>STL</th>
                      <th>BLK</th>
                      <th>TO</th>
                      <th>2P</th>
                      <th>3P</th>
                      <th>FT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSeasonRows.map((p) => (
                      <tr key={p.id} className="border-b border-blue-900">
                        <td className="py-3 pr-3 font-black whitespace-nowrap text-yellow-300">#{p.number} {p.name}</td>
                        <td className="text-center font-black text-yellow-300">{p.gp}</td>
                        <td className="text-center font-black text-yellow-300">{p.pts}</td>
                        <td className="text-center font-black text-yellow-300">{p.gp ? (p.pts / p.gp).toFixed(1) : "0.0"}</td>
                        <td className="text-center font-black text-yellow-300">{p.reb}</td>
                        <td className="text-center font-black text-yellow-300">{p.gp ? (p.reb / p.gp).toFixed(1) : "0.0"}</td>
                        <td className="text-center font-black text-yellow-300">{p.ast}</td>
                        <td className="text-center font-black text-yellow-300">{p.gp ? (p.ast / p.gp).toFixed(1) : "0.0"}</td>
                        <td className="text-center font-black text-yellow-300">{p.stl}</td>
                        <td className="text-center font-black text-yellow-300">{p.blk}</td>
                        <td className="text-center font-black text-yellow-300">{p.tov}</td>
                        <td className="text-center font-black text-yellow-300">{p.twoM}/{p.twoA}</td>
                        <td className="text-center font-black text-yellow-300">{p.threeM}/{p.threeA}</td>
                        <td className="text-center font-black text-yellow-300">{p.ftM}/{p.ftA}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === "report") {
    return (
      <div className="min-h-screen bg-blue-950 text-white p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Card className="bg-blue-900 border-blue-700 shadow-xl rounded-2xl">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                  <div className="text-sm text-blue-100">Postgame</div>
                  <h1 className="text-3xl md:text-4xl font-black text-yellow-300">Game Report</h1>
                  <div className="text-xl font-bold text-white mt-1">{gameTitle}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={exportBoxScore} className={mainButton}>
                    <FileDown className="mr-2 h-5 w-5" /> Box CSV
                  </Button>
                  <Button onClick={exportPlayByPlay} className={mainButton}>
                    <FileDown className="mr-2 h-5 w-5" /> Plays CSV
                  </Button>
                  <Button onClick={() => setScreen("game")} className={mainButton}>
                    Back to Game
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center mb-5">
                <div className="rounded-2xl bg-yellow-400 text-blue-950 p-5">
                  <div className="text-sm font-bold">{teamName}</div>
                  <div className="text-6xl font-black">{teamScore}</div>
                </div>
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-5">
                  <div className="text-sm text-blue-100">Final / Current Quarter</div>
                  <div className="text-6xl font-black text-yellow-300">Q{quarter}</div>
                </div>
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-5">
                  <div className="text-sm text-blue-100">Opponent</div>
                  <div className="text-6xl font-black text-yellow-300">{opponentScore}</div>
                </div>
              </div>

              <TeamTotalsCards totals={teamTotals} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-4">
                  <h2 className="text-xl font-black text-yellow-300 mb-3">Points Leaders</h2>
                  {leaders.pts.map((p) => (
                    <div key={p.id} className="flex justify-between text-white mb-2">
                      <span>#{p.number} {p.name}</span>
                      <span className="font-black text-yellow-300">{p.pts}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-4">
                  <h2 className="text-xl font-black text-yellow-300 mb-3">Rebound Leaders</h2>
                  {leaders.reb.map((p) => (
                    <div key={p.id} className="flex justify-between text-white mb-2">
                      <span>#{p.number} {p.name}</span>
                      <span className="font-black text-yellow-300">{p.reb}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-4">
                  <h2 className="text-xl font-black text-yellow-300 mb-3">Assist Leaders</h2>
                  {leaders.ast.map((p) => (
                    <div key={p.id} className="flex justify-between text-white mb-2">
                      <span>#{p.number} {p.name}</span>
                      <span className="font-black text-yellow-300">{p.ast}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-blue-800 border border-blue-600 p-4 mb-5 overflow-x-auto">
                <h2 className="text-xl font-black text-yellow-300 mb-3">Box Score</h2>
                <BoxScoreTable />
              </div>

              <div className="rounded-2xl bg-blue-800 border border-blue-600 p-4">
                <h2 className="text-xl font-black text-yellow-300 mb-3">Play-by-Play</h2>
                <div className="space-y-2 max-h-[420px] overflow-auto">
                  {[...events].reverse().map((event) => (
                    <div key={event.id} className="rounded-xl bg-blue-900 border border-blue-700 p-3">
                      <div className="text-xs text-blue-100">
                        Q{event.quarter} · {event.createdAt} · Poss: {event.possession === "team" ? teamName : "Opponent"}
                      </div>
                      <div className="font-black text-yellow-300">#{event.playerNumber} {event.playerName}</div>
                      <div className="text-white">{eventLabel(event)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === "history") {
    return (
      <div className="min-h-screen bg-blue-950 text-white p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Card className="bg-blue-900 border-blue-700 shadow-xl rounded-2xl">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                  <div className="text-sm text-blue-100">Saved Games</div>
                  <h1 className="text-3xl font-black text-yellow-300">Game History</h1>
                </div>
                <Button onClick={() => setScreen("game")} className={mainButton}>
                  Back to Game
                </Button>
              </div>

              {savedGames.length === 0 && (
                <div className="rounded-2xl bg-blue-800 border border-blue-600 p-5 text-blue-100">
                  No saved games yet. Save a game from the live tracker screen.
                </div>
              )}

              <div className="space-y-3">
                {savedGames.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-2xl bg-blue-800 border border-blue-600 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <div className="text-xl font-black text-yellow-300">{game.title}</div>
                      <div className="text-sm text-blue-100">Saved: {game.savedAt}</div>
                      <div className="text-sm text-white">
                        Events: {game.events?.length || 0} · Opponent points: {game.opponentScore || 0}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => loadGame(game)} className={mainButton}>
                        Load
                      </Button>
                      <Button
                        onClick={() => deleteSavedGame(game.id)}
                        className="h-14 px-5 rounded-2xl bg-white text-black hover:bg-yellow-300 font-black"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === "roster") {
    return (
      <div className="min-h-screen bg-blue-950 text-white p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Card className="bg-blue-900 border-blue-700 shadow-xl rounded-2xl">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                  <div className="text-sm text-blue-100">Setup Screen</div>
                  <h1 className="text-3xl font-black text-yellow-300">Editable Roster</h1>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addPlayer} className={mainButton}>
                    Add Player
                  </Button>
                  <Button onClick={() => setScreen("game")} className={mainButton}>
                    Back to Game
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {sortedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="grid grid-cols-[90px_1fr_auto] gap-3 items-center rounded-2xl bg-blue-800 border border-blue-600 p-3"
                  >
                    <input
                      value={player.number}
                      onChange={(e) => updatePlayer(player.id, "number", e.target.value)}
                      className="h-14 rounded-xl bg-white text-blue-950 px-3 text-xl font-black text-center"
                      placeholder="#"
                    />
                    <input
                      value={player.name}
                      onChange={(e) => updatePlayer(player.id, "name", e.target.value)}
                      className="h-14 rounded-xl bg-white text-blue-950 px-4 text-xl font-bold"
                      placeholder="Player name"
                    />
                    <Button
                      onClick={() => removePlayer(player.id)}
                      className="h-14 rounded-xl border-blue-400 bg-white text-black hover:bg-yellow-300 font-bold"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

return (
  <div className="min-h-screen bg-blue-950 text-white p-4 md:p-6">
    {pendingStat && (  <div className="fixed inset-0 z-50 bg-blue-950/90 flex items-center justify-center p-4">
    <Card className="w-full max-w-4xl bg-blue-900 border-yellow-300 rounded-2xl shadow-2xl">
      <CardContent className="p-5">
        <h2 className="text-3xl font-black text-yellow-300 mb-2">Choose Player</h2>
        <div className="text-lg text-white mb-4">Stat: {pendingStat}</div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedPlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => choosePlayerForStat(player)}
              className="h-24 rounded-2xl bg-blue-700 hover:bg-yellow-400 hover:text-blue-950 text-white border border-blue-500 text-left px-4 font-black"
            >
              <div className="text-sm opacity-90">#{player.number}</div>
              <div className="text-2xl truncate">{player.name || "Unnamed"}</div>
            </button>
          ))}
        </div>

        <Button
          onClick={() => setPendingStat(null)}
          className="mt-4 h-12 rounded-xl border-blue-400 bg-white text-black hover:bg-yellow-300 font-bold px-5"
        >
          Cancel
        </Button>
      </CardContent>
</Card>
</div>
)}
{editingEvent && (
  <div className="fixed inset-0 z-50 bg-blue-950/90 flex items-center justify-center p-4">
    <Card className="w-full max-w-4xl bg-blue-900 border-yellow-300 rounded-2xl shadow-2xl">
      <CardContent className="p-5">
        <h2 className="text-3xl font-black text-yellow-300 mb-2">Edit Play</h2>

        <div className="text-lg text-white mb-4">
          Current: #{editingEvent.playerNumber} {editingEvent.playerName} — {eventLabel(editingEvent)}
        </div>
        {(editingEvent.type === "OREB" || editingEvent.type === "DREB") && (
          <div className="mb-5">
            <div className="text-sm text-blue-100 mb-2">Change rebound type</div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setEvents((prev) =>
                    prev.map((event) =>
                      event.id === editingEvent.id
                        ? { ...event, type: "OREB" }
                        : event
                    )
                  );
                  setEditingEvent((prev) => ({ ...prev, type: "OREB" }));
                }}
                className={`h-16 rounded-2xl font-black ${
                  editingEvent.type === "OREB"
                    ? "bg-yellow-400 text-blue-950"
                    : "bg-blue-700 text-white border border-blue-500"
                }`}
              >
                OREB
              </button>

              <button
                onClick={() => {
                  setEvents((prev) =>
                    prev.map((event) =>
                      event.id === editingEvent.id
                        ? { ...event, type: "DREB" }
                        : event
                    )
                  );
                  setEditingEvent((prev) => ({ ...prev, type: "DREB" }));
                }}
                className={`h-16 rounded-2xl font-black ${
                  editingEvent.type === "DREB"
                    ? "bg-yellow-400 text-blue-950"
                    : "bg-blue-700 text-white border border-blue-500"
                }`}
              >
                DREB
              </button>
            </div>
          </div>
        )}
        
        {(editingEvent.type === "2PT_MADE" || editingEvent.type === "3PT_MADE") && (
          <div className="mb-5">
            <div className="text-sm text-blue-100 mb-2">Change assist</div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => {
                    setEvents((prev) =>
                      prev.map((event) =>
                        event.id === editingEvent.id
                          ? {
                              ...event,
                              assistPlayerId: player.id,
                              assistName: player.name,
                              assistNumber: player.number,
                              noAssist: false,
                            }
                          : event
                      )
                    );
                    setEditingEvent((prev) => ({
                      ...prev,
                      assistPlayerId: player.id,
                      assistName: player.name,
                      assistNumber: player.number,
                      noAssist: false,
                    }));
                  }}
                  className={`h-20 rounded-2xl font-black text-left px-4 ${
                    editingEvent.assistPlayerId === player.id
                      ? "bg-yellow-400 text-blue-950"
                      : "bg-blue-700 text-white border border-blue-500"
                  }`}
                >
                  <div className="text-sm opacity-90">#{player.number}</div>
                  <div className="text-xl truncate">{player.name || "Unnamed"}</div>
                </button>
              ))}

              <button
                onClick={() => {
                  setEvents((prev) =>
                    prev.map((event) =>
                      event.id === editingEvent.id
                        ? {
                            ...event,
                            assistPlayerId: null,
                            assistName: null,
                            assistNumber: null,
                            noAssist: true,
                          }
                        : event
                    )
                  );
                  setEditingEvent((prev) => ({
                    ...prev,
                    assistPlayerId: null,
                    assistName: null,
                    assistNumber: null,
                    noAssist: true,
                  }));
                }}
                className={`h-20 rounded-2xl font-black px-4 ${
                  editingEvent.noAssist
                    ? "bg-yellow-400 text-blue-950"
                    : "bg-blue-700 text-white border border-blue-500"
                }`}
              >
                No Assist
              </button>
            </div>
          </div>
        )}

        {["2PT_MADE", "2PT_MISS", "3PT_MADE", "3PT_MISS"].includes(editingEvent.type) && (
        <div className="mb-5">
          <div className="text-sm text-blue-100 mb-2">Change shot result</div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["2PT_MADE", "Made 2PT"],
              ["2PT_MISS", "Missed 2PT"],
              ["3PT_MADE", "Made 3PT"],
              ["3PT_MISS", "Missed 3PT"],
            ].map(([type, label]) => (
              <button
                key={type}
                onClick={() => {
                  setEvents((prev) =>
                    prev.map((event) =>
                      event.id === editingEvent.id
                        ? {
                            ...event,
                            type,
                            ...(type === "2PT_MISS" || type === "3PT_MISS"
                              ? {
                                  assistPlayerId: null,
                                  assistName: null,
                                  assistNumber: null,
                                  noAssist: false,
                                }
                              : {}),
                          }
                        : event
                    )
                  );

                  setEditingEvent((prev) => ({
                    ...prev,
                    type,
                    ...(type === "2PT_MISS" || type === "3PT_MISS"
                      ? {
                          assistPlayerId: null,
                          assistName: null,
                          assistNumber: null,
                          noAssist: false,
                        }
                      : {}),
                  }));
                }}
                className={`h-16 rounded-2xl font-black ${
                  editingEvent.type === type
                    ? "bg-yellow-400 text-blue-950"
                    : "bg-blue-700 text-white border border-blue-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
        
        {["STL", "BLK", "FOUL", "TO"].includes(editingEvent.type) && (
          <div className="mb-5">
            <div className="text-sm text-blue-100 mb-2">Change stat type</div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["STL", "Steal"],
                ["BLK", "Block"],
                ["FOUL", "Foul"],
                ["TO", "Turnover"],
              ].map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => {
                    setEvents((prev) =>
                      prev.map((event) =>
                        event.id === editingEvent.id
                          ? { ...event, type }
                          : event
                      )
                    );

                    setEditingEvent((prev) => ({
                      ...prev,
                      type,
                    }));
                  }}
                  className={`h-16 rounded-2xl font-black ${
                    editingEvent.type === type
                      ? "bg-yellow-400 text-blue-950"
                      : "bg-blue-700 text-white border border-blue-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-blue-100 mb-2">Choose new player</div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedPlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => {
                setEvents((prev) =>
                  prev.map((event) =>
                    event.id === editingEvent.id
                      ? {
                          ...event,
                          playerId: player.id,
                          playerName: player.name,
                          playerNumber: player.number,
                        }
                      : event
                  )
                );
                setEditingEvent((prev) => ({
                ...prev,
                playerId: player.id,
                playerName: player.name,
                playerNumber: player.number,
              }));
              }}
              className={`h-24 rounded-2xl text-left px-4 font-black ${
                editingEvent.playerId === player.id
                  ? "bg-yellow-400 text-blue-950"
                  : "bg-blue-700 hover:bg-yellow-400 hover:text-blue-950 text-white border border-blue-500"
              }`}            >
              <div className="text-sm opacity-90">#{player.number}</div>
              <div className="text-2xl truncate">{player.name || "Unnamed"}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setEditingEvent(null)}
            className="h-12 rounded-xl border border-blue-400 bg-white text-black hover:bg-yellow-300 font-bold px-5"
          >
            Cancel
          </button>

          <button
            onClick={() => setEditingEvent(null)}
            className="h-12 rounded-xl border border-blue-400 bg-white text-black hover:bg-yellow-300 font-bold px-5"
          >
            Done
          </button>
        </div>      
      </CardContent>
    </Card>
  </div>
)}
  {pendingRebound && (        
    <div className="fixed inset-0 z-50 bg-blue-950/90 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-blue-900 border-yellow-300 rounded-2xl shadow-2xl">
            <CardContent className="p-5">
              <h2 className="text-3xl font-black text-yellow-300 mb-2">Rebound Type?</h2>
              <div className="text-lg text-white mb-4">{pendingRebound.rebounder?.name} rebound</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => chooseReboundType("OREB")}
                  className="h-24 rounded-2xl bg-yellow-400 text-blue-950 text-2xl font-black"
                >
                  Offensive Rebound
                </button>
                <button
                  onClick={() => chooseReboundType("DREB")}
                  className="h-24 rounded-2xl bg-blue-700 hover:bg-yellow-400 hover:text-blue-950 text-white border border-blue-500 text-2xl font-black"
                >
                  Defensive Rebound
                </button>
              </div>
              <Button
                onClick={() => setPendingRebound(null)}
                className="mt-4 h-12 rounded-xl border-blue-400 bg-white text-black hover:bg-yellow-300 font-bold"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {pendingShot && (
        <div className="fixed inset-0 z-50 bg-blue-950/90 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl bg-blue-900 border-yellow-300 rounded-2xl shadow-2xl">
            <CardContent className="p-5">
              <h2 className="text-3xl font-black text-yellow-300 mb-2">Assist?</h2>
              <div className="text-lg text-white mb-4">
                {pendingShot.scorer?.name} {pendingShot.type === "3PT_MADE" ? "made a 3PT" : "made a 2PT"}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <button
                  onClick={() => chooseAssist(null)}
                  className="h-20 rounded-2xl bg-yellow-400 text-blue-950 text-xl font-black"
                >
                  No Assist
                </button>
                {sortedPlayers
                  .filter((p) => p.id !== pendingShot.scorer?.id)
                  .map((player) => (
                    <button
                      key={player.id}
                      onClick={() => chooseAssist(player)}
                      className="h-20 rounded-2xl bg-blue-700 hover:bg-yellow-400 hover:text-blue-950 text-white border border-blue-500 text-left px-4 font-black"
                    >
                      <div className="text-sm opacity-90">#{player.number}</div>
                      <div className="text-xl truncate">{player.name}</div>
                    </button>
                  ))}
              </div>
              <Button
                onClick={() => setPendingShot(null)}
                className="mt-4 h-12 rounded-xl border-blue-400 bg-white text-black hover:bg-yellow-300 font-bold"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 bg-blue-900 border-blue-700 shadow-xl rounded-2xl">
            <CardContent className="p-4 md:p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-sm text-blue-100">Live Game Tracker</div>
                  <input
                    value={gameTitle}
                    onChange={(e) => setGameTitle(e.target.value)}
                    className="w-full bg-blue-800 border border-blue-600 rounded-xl px-3 py-2 text-2xl md:text-4xl font-black tracking-tight text-yellow-300"
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button onClick={() => setScreen("roster")} className={mainButton}>
                    <Edit3 className="mr-2 h-5 w-5" /> Roster
                  </Button>
                  <Button onClick={() => setScreen("history")} className={mainButton}>
                    <FolderOpen className="mr-2 h-5 w-5" /> Games
                  </Button>
                  <Button onClick={() => setScreen("season")} className={mainButton}>
                    <Trophy className="mr-2 h-5 w-5" /> Season
                  </Button>
                  <Button onClick={saveCurrentGame} className={mainButton}>
                    <Save className="mr-2 h-5 w-5" /> Save
                  </Button>
                  <Button onClick={() => setScreen("report")} className={mainButton}>
                    <FileDown className="mr-2 h-5 w-5" /> Report
                  </Button>
                  <Button onClick={undo} disabled={events.length === 0} className={mainButton}>
                    <Undo2 className="mr-2 h-5 w-5" /> Undo
                  </Button>
                  {lastDeletedEvent && (
                    <Button onClick={restoreDeletedEvent} className={mainButton}>
                      Undo Delete
                    </Button>
                  )}
                  <Button onClick={reset} className={mainButton}>
                    <RotateCcw className="mr-2 h-5 w-5" /> Reset
                  </Button>
                </div>
              </div>

              <Scoreboard />
            </CardContent>
          </Card>

          <Card className="bg-blue-900 border-blue-700 shadow-xl rounded-2xl">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-yellow-300" />
                <h2 className="text-xl font-black text-white">Quick Leaders</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {[
                  ["PTS", leaders.pts],
                  ["REB", leaders.reb],
                  ["AST", leaders.ast],
                ].map(([label, rows]) => (
                  <div key={label} className="rounded-xl bg-blue-800 p-3 border border-blue-600">
                    <div className="text-yellow-300 font-black mb-2">{label}</div>
                    {rows.map((r) => (
                      <div key={r.id} className="flex justify-between gap-1 text-xs mb-1 text-white">
                        <span className="truncate text-yellow-300">{r.name}</span>
                        <span className="font-black text-yellow-300">{r[String(label).toLowerCase()]}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <Card className="bg-blue-900 border-blue-700 shadow-xl rounded-2xl">
            <CardContent className="p-4 md:p-5">
              <h2 className="text-xl font-black mb-1 text-white">Tap Stat</h2>
              <div className="text-sm text-blue-100 mb-3">
              </div>
              <div className="grid grid-cols-3 gap-3">
                {statButtons.map((button) => (
                  <button
                    key={button.type}
                    onClick={() => addEvent(button.type)}
                    className="h-20 rounded-2xl bg-blue-700 hover:bg-yellow-400 hover:text-blue-950 text-white active:scale-95 border border-blue-500 font-black transition"
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-900 border-blue-700 shadow-xl rounded-2xl">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="h-5 w-5 text-yellow-300" />
                <h2 className="text-xl font-black text-white">Recent Plays</h2>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-auto pr-1">
                {events.length === 0 && (
                  <div className="rounded-2xl bg-blue-800 p-4 text-blue-100 text-sm border border-blue-600">
                    No plays yet. Tap a player, then tap a stat.
                  </div>
                )}
                {events.slice(0, 12).map((event) => (
                  <div 
                  key={event.id} 
                  onClick={() => setEditingEvent(event)}
                  className="rounded-2xl bg-blue-800 p-3 border border-blue-600 flex justify-between items-start gap-2">
                    <div>
                      <div className="text-xs text-blue-100">
                        Q{event.quarter} • {event.createdAt} • Poss: {event.possession === "team" ? teamName : "Opponent"}
                      </div>

                      <div className="font-black text-yellow-300">
                        #{event.playerNumber} {event.playerName}
                      </div>

                      <div className="text-white">
                        {eventLabel(event)}
                      </div>
                      </div>

                      <div className="flex gap-2 shrink-0 items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEvent(event);
                        }}
                        className="bg-yellow-400 text-blue-950 font-black rounded-xl px-5 py-4 text-base min-w-[90px]"
                      >
                        Edit
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEvent(event.id);
                        }}
                        className="bg-red-500 text-white font-black rounded-xl px-5 py-4 text-base min-w-[90px]"
                      >
                        X
                      </button>
                      </div>
                      </div>
                      ))}              
                      </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-blue-900 border-blue-700 shadow-xl rounded-2xl">
          <CardContent className="p-4 md:p-5">
            <h2 className="text-xl font-black mb-3 text-white">Live Box Score</h2>
            <BoxScoreTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
