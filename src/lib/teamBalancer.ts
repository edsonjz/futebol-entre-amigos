import { Player, MatchRoster } from '../types/database';

export interface BalanceResult {
  teamA: Player[];
  teamB: Player[];
  teamAAvgRating: number;
  teamBAvgRating: number;
  difference: number;
  explanation: string;
}

export function shufflePlayers<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Random lottery (Sorteio Puro)
 */
export function drawRandomTeams(players: Player[], playersPerTeam?: number): BalanceResult {
  const shuffled = shufflePlayers(players);
  const half = playersPerTeam || Math.ceil(shuffled.length / 2);
  
  const teamA = shuffled.slice(0, half);
  const teamB = shuffled.slice(half, half * 2);

  const avgA = teamA.length ? Number((teamA.reduce((acc, p) => acc + (p.base_rating || 6.5), 0) / teamA.length).toFixed(1)) : 0;
  const avgB = teamB.length ? Number((teamB.reduce((acc, p) => acc + (p.base_rating || 6.5), 0) / teamB.length).toFixed(1)) : 0;

  return {
    teamA,
    teamB,
    teamAAvgRating: avgA,
    teamBAvgRating: avgB,
    difference: Number(Math.abs(avgA - avgB).toFixed(1)),
    explanation: 'Sorteio aleatório realizado sem considerar notas ou posições.'
  };
}

/**
 * Smart Skill & Position Balancer (Equilíbrio Inteligente)
 * Considers: Goalkeepers, player overall ratings, and positions.
 */
export function balanceTeams(players: Player[], playersPerTeam?: number): BalanceResult {
  if (players.length < 2) {
    return {
      teamA: players,
      teamB: [],
      teamAAvgRating: players[0]?.base_rating || 0,
      teamBAvgRating: 0,
      difference: players[0]?.base_rating || 0,
      explanation: 'Poucos jogadores para formar duas equipes.'
    };
  }

  // Separate Goalkeepers
  const goalkeepers = players.filter(p => p.preferred_position === 'Goleiro');
  const outfieldPlayers = players.filter(p => p.preferred_position !== 'Goleiro');

  // Sort outfield players by rating descending
  const sortedOutfield = [...outfieldPlayers].sort((a, b) => (b.base_rating || 6.5) - (a.base_rating || 6.5));

  const teamA: Player[] = [];
  const teamB: Player[] = [];

  // Distribute goalkeepers first if available
  if (goalkeepers.length >= 2) {
    // Sort GKs by rating
    goalkeepers.sort((a, b) => (b.base_rating || 6.5) - (a.base_rating || 6.5));
    teamA.push(goalkeepers[0]);
    teamB.push(goalkeepers[1]);

    // If more than 2 goalkeepers, add remaining to outfield pool
    for (let i = 2; i < goalkeepers.length; i++) {
      sortedOutfield.push(goalkeepers[i]);
    }
  } else if (goalkeepers.length === 1) {
    teamA.push(goalkeepers[0]);
  }

  // Snake draft distribution for outfield players to balance strength
  // Pattern: A, B, B, A, A, B, B, A...
  let pickA = teamA.length <= teamB.length;
  
  for (const player of sortedOutfield) {
    const sumA = teamA.reduce((sum, p) => sum + (p.base_rating || 6.5), 0);
    const sumB = teamB.reduce((sum, p) => sum + (p.base_rating || 6.5), 0);

    // If size difference is noticeable, enforce balance in numbers
    if (teamA.length < teamB.length) {
      teamA.push(player);
    } else if (teamB.length < teamA.length) {
      teamB.push(player);
    } else {
      // If sizes are equal, give to the team with lower current sum
      if (sumA <= sumB) {
        teamA.push(player);
      } else {
        teamB.push(player);
      }
    }
  }

  const avgA = teamA.length ? Number((teamA.reduce((acc, p) => acc + (p.base_rating || 6.5), 0) / teamA.length).toFixed(1)) : 0;
  const avgB = teamB.length ? Number((teamB.reduce((acc, p) => acc + (p.base_rating || 6.5), 0) / teamB.length).toFixed(1)) : 0;
  const diff = Number(Math.abs(avgA - avgB).toFixed(1));

  let explanation = `Equilíbrio calculado com base nas notas individuais e posições. `;
  if (goalkeepers.length >= 2) {
    explanation += `1 goleiro alocado para cada lado. `;
  } else if (goalkeepers.length === 1) {
    explanation += `Apenas 1 goleiro cadastrado (Time A). `;
  } else {
    explanation += `Sem goleiros específicos cadastrados. `;
  }
  explanation += `Diferença média estimada de ${diff} pontos entre os times.`;

  return {
    teamA,
    teamB,
    teamAAvgRating: avgA,
    teamBAvgRating: avgB,
    difference: diff,
    explanation
  };
}

/**
 * Generate default tactical coordinates for starters on the virtual pitch
 * pitch_x: 0-100 (horizontal field, left=goal A, right=goal B, or top/bottom for vertical)
 * In our visual pitch:
 * Team A defends Left (x: 5% to 45%)
 * Team B defends Right (x: 95% to 55%)
 */
export function generateDefaultPitchCoordinates(
  roster: Partial<MatchRoster>[],
  team: 'A' | 'B'
): Partial<MatchRoster>[] {
  const starters = roster.filter(r => r.is_starter);
  const count = starters.length;

  // Coordinate templates based on number of starters
  const coords: { x: number; y: number }[] = [];

  if (team === 'A') {
    // Goalkeeper
    coords.push({ x: 8, y: 50 });

    if (count === 5) {
      // 1-2-1 Futsal
      coords.push({ x: 22, y: 32 }); // Defensor
      coords.push({ x: 22, y: 68 });
      coords.push({ x: 38, y: 50 }); // Meia/Pivô
    } else if (count === 6) {
      // 2-2-1
      coords.push({ x: 20, y: 30 });
      coords.push({ x: 20, y: 70 });
      coords.push({ x: 34, y: 35 });
      coords.push({ x: 34, y: 65 });
      coords.push({ x: 44, y: 50 });
    } else if (count === 7) {
      // 2-3-1 Society Standard
      coords.push({ x: 18, y: 30 }); // Zag Esq
      coords.push({ x: 18, y: 70 }); // Zag Dir
      coords.push({ x: 32, y: 20 }); // Meia Ala Esq
      coords.push({ x: 30, y: 50 }); // Meia Central
      coords.push({ x: 32, y: 80 }); // Meia Ala Dir
      coords.push({ x: 44, y: 50 }); // Atacante/Pivô
    } else if (count === 8) {
      // 3-3-1
      coords.push({ x: 18, y: 25 });
      coords.push({ x: 16, y: 50 });
      coords.push({ x: 18, y: 75 });
      coords.push({ x: 32, y: 25 });
      coords.push({ x: 30, y: 50 });
      coords.push({ x: 32, y: 75 });
      coords.push({ x: 44, y: 50 });
    } else if (count === 11) {
      // 4-3-3 Campo
      coords.push({ x: 18, y: 15 }); // Lat D
      coords.push({ x: 16, y: 38 }); // Zag
      coords.push({ x: 16, y: 62 }); // Zag
      coords.push({ x: 18, y: 85 }); // Lat E
      coords.push({ x: 28, y: 30 }); // Vol
      coords.push({ x: 28, y: 70 }); // Vol
      coords.push({ x: 34, y: 50 }); // Meia
      coords.push({ x: 43, y: 20 }); // Ponta D
      coords.push({ x: 45, y: 50 }); // Centroavante
      coords.push({ x: 43, y: 80 }); // Ponta E
    } else {
      // Generic evenly spaced formation
      for (let i = 1; i < count; i++) {
        const x = 16 + Math.floor((i - 1) / 3) * 12;
        const y = 20 + (((i - 1) % 3) + 1) * 20;
        coords.push({ x: Math.min(x, 46), y: Math.min(y, 85) });
      }
    }
  } else {
    // Team B mirrors Team A (Right side: 100 - x)
    // Goalkeeper
    coords.push({ x: 92, y: 50 });

    if (count === 5) {
      coords.push({ x: 78, y: 32 });
      coords.push({ x: 78, y: 68 });
      coords.push({ x: 62, y: 50 });
    } else if (count === 6) {
      coords.push({ x: 80, y: 30 });
      coords.push({ x: 80, y: 70 });
      coords.push({ x: 66, y: 35 });
      coords.push({ x: 66, y: 65 });
      coords.push({ x: 56, y: 50 });
    } else if (count === 7) {
      coords.push({ x: 82, y: 30 });
      coords.push({ x: 82, y: 70 });
      coords.push({ x: 68, y: 20 });
      coords.push({ x: 70, y: 50 });
      coords.push({ x: 68, y: 80 });
      coords.push({ x: 56, y: 50 });
    } else if (count === 8) {
      coords.push({ x: 82, y: 25 });
      coords.push({ x: 84, y: 50 });
      coords.push({ x: 82, y: 75 });
      coords.push({ x: 68, y: 25 });
      coords.push({ x: 70, y: 50 });
      coords.push({ x: 68, y: 75 });
      coords.push({ x: 56, y: 50 });
    } else if (count === 11) {
      coords.push({ x: 82, y: 15 });
      coords.push({ x: 84, y: 38 });
      coords.push({ x: 84, y: 62 });
      coords.push({ x: 82, y: 85 });
      coords.push({ x: 72, y: 30 });
      coords.push({ x: 72, y: 70 });
      coords.push({ x: 66, y: 50 });
      coords.push({ x: 57, y: 20 });
      coords.push({ x: 55, y: 50 });
      coords.push({ x: 57, y: 80 });
    } else {
      for (let i = 1; i < count; i++) {
        const x = 84 - Math.floor((i - 1) / 3) * 12;
        const y = 20 + (((i - 1) % 3) + 1) * 20;
        coords.push({ x: Math.max(x, 54), y: Math.min(y, 85) });
      }
    }
  }

  return starters.map((item, index) => ({
    ...item,
    pitch_x: coords[index]?.x ?? (team === 'A' ? 25 : 75),
    pitch_y: coords[index]?.y ?? 50,
  }));
}
