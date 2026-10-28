import { Player, Match, MatchEvent, MatchRoster, PlayerRating, PlayerStats, GroupSettings } from '../types/database';

export function calculatePlayerStats(
  players: Player[],
  matches: Match[],
  rosters: MatchRoster[],
  events: MatchEvent[],
  ratings: PlayerRating[],
  settings?: Partial<GroupSettings>
): PlayerStats[] {
  const finishedMatches = matches.filter(m => m.status === 'finished');
  const finishedMatchIds = new Set(finishedMatches.map(m => m.id));

  const weightRatings = settings?.overall_weight_ratings ?? 50;
  const weightStats = settings?.overall_weight_stats ?? 30;
  const weightTeam = settings?.overall_weight_team ?? 20;

  return players.map(player => {
    // Player's rosters in finished matches
    const playerRosters = rosters.filter(
      r => r.player_id === player.id && finishedMatchIds.has(r.match_id)
    );

    const matchesPlayed = playerRosters.length;

    // Calculate goals and assists
    const goals = events.filter(
      e => e.player_id === player.id && e.event_type === 'goal' && finishedMatchIds.has(e.match_id)
    ).length;

    const assists = events.filter(
      e => e.assist_player_id === player.id && e.event_type === 'goal' && finishedMatchIds.has(e.match_id)
    ).length;

    // Calculate wins, draws, losses
    let wins = 0;
    let draws = 0;
    let losses = 0;

    playerRosters.forEach(roster => {
      const match = finishedMatches.find(m => m.id === roster.match_id);
      if (!match) return;

      const team = roster.team;
      if (team === 'A') {
        if (match.score_a > match.score_b) wins++;
        else if (match.score_a === match.score_b) draws++;
        else losses++;
      } else if (team === 'B') {
        if (match.score_b > match.score_a) wins++;
        else if (match.score_b === match.score_a) draws++;
        else losses++;
      }
    });

    const winRate = matchesPlayed > 0 ? Number(((wins / matchesPlayed) * 100).toFixed(1)) : 0;
    const goalsPerMatch = matchesPlayed > 0 ? Number((goals / matchesPlayed).toFixed(2)) : 0;

    // Calculate ratings
    const playerRatings = ratings.filter(r => r.evaluated_player_id === player.id && finishedMatchIds.has(r.match_id));
    const ratingsCount = playerRatings.length;

    let averageRating = player.base_rating || 6.5;
    if (ratingsCount > 0) {
      const totalScore = playerRatings.reduce((sum, r) => sum + Number(r.rating), 0);
      averageRating = Number((totalScore / ratingsCount).toFixed(2));
    }

    // MVP counts
    const mvpCount = finishedMatches.filter(m => m.mvp_player_id === player.id).length;

    // Overall Index (0 - 100)
    // 1. Rating component (0-100)
    const ratingScore = averageRating * 10;

    // 2. Stats contribution component (normalized goals + assists per game)
    // 1 goal or 1 assist per match is a great benchmark (~75-90 pts)
    const statFactor = matchesPlayed > 0 ? Math.min(((goals * 1.0 + assists * 0.7) / matchesPlayed) * 45, 100) : 50;

    // 3. Team performance component (Win % + Draw points)
    const teamScore = matchesPlayed > 0 ? (wins * 3 + draws * 1) / (matchesPlayed * 3) * 100 : 50;

    // Weighted Overall
    let rawOverall = (
      (ratingScore * weightRatings) +
      (statFactor * weightStats) +
      (teamScore * weightTeam)
    ) / 100;

    // Sample confidence damping: if player has very few games, smooth towards base rating
    if (matchesPlayed < 3) {
      const confidence = matchesPlayed / 3;
      const baseOverall = (player.base_rating || 6.5) * 10;
      rawOverall = rawOverall * confidence + baseOverall * (1 - confidence);
    }

    const overallIndex = Math.min(99, Math.max(40, Math.round(rawOverall)));

    return {
      player_id: player.id,
      player,
      matches_played: matchesPlayed,
      wins,
      draws,
      losses,
      win_rate: winRate,
      goals,
      assists,
      goals_per_match: goalsPerMatch,
      average_rating: averageRating,
      ratings_count: ratingsCount,
      overall_index: overallIndex,
      mvp_count: mvpCount,
    };
  });
}
