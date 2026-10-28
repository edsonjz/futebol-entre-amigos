export type ModalityType = 'society' | 'futsal' | 'campo' | 'custom';

export type MatchStatus = 
  | 'scheduled' 
  | 'callup_open' 
  | 'ready' 
  | 'in_progress' 
  | 'finished' 
  | 'cancelled';

export type UserRole = 'admin' | 'organizer' | 'player' | 'visitor';

export type PlayerPosition = 
  | 'Goleiro' 
  | 'Zagueiro' 
  | 'Lateral' 
  | 'Meio-campo' 
  | 'Atacante';

export type DominantFoot = 'Destro' | 'Canhoto' | 'Ambidestro';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  preferred_position: PlayerPosition;
  dominant_foot: DominantFoot;
  created_at?: string;
  updated_at?: string;
}

export interface GroupSettings {
  overall_weight_ratings: number; // e.g. 50%
  overall_weight_stats: number;   // e.g. 30%
  overall_weight_team: number;    // e.g. 20%
  enable_finances: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  created_by: string | null;
  default_modality: ModalityType;
  default_players_per_team: number;
  settings: GroupSettings;
  created_at?: string;
  updated_at?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: UserRole;
  status: 'active' | 'inactive';
  joined_at?: string;
  profile?: Profile;
}

export interface Player {
  id: string;
  group_id: string;
  user_id?: string | null;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  preferred_position: PlayerPosition;
  dominant_foot: DominantFoot;
  base_rating: number; // 0 - 10
  shirt_number?: number | null;
  notes?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Season {
  id: string;
  group_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface Match {
  id: string;
  group_id: string;
  season_id?: string | null;
  title: string;
  match_date: string;
  location: string | null;
  modality: ModalityType;
  players_per_team: number;
  starters_count: number;
  subs_count: number;
  periods: number;
  period_duration_minutes: number;
  status: MatchStatus;
  current_period: number;
  current_minute: number;
  team_a_name: string;
  team_a_color: string;
  team_b_name: string;
  team_b_color: string;
  score_a: number;
  score_b: number;
  mvp_player_id?: string | null;
  created_by?: string | null;
  notes?: string | null;
  finished_at?: string | null;
  created_at?: string;
  updated_at?: string;
  mvp?: Player;
}

export interface MatchRoster {
  id: string;
  match_id: string;
  player_id: string;
  team: 'A' | 'B' | 'UNASSIGNED';
  is_starter: boolean;
  position: PlayerPosition;
  pitch_x: number; // 0-100 percentage
  pitch_y: number; // 0-100 percentage
  shirt_number?: number | null;
  confirmed_attendance: boolean;
  player?: Player;
}

export type MatchEventType = 
  | 'goal' 
  | 'own_goal' 
  | 'substitution' 
  | 'yellow_card' 
  | 'red_card' 
  | 'period_end';

export interface MatchEvent {
  id: string;
  match_id: string;
  team: 'A' | 'B';
  event_type: MatchEventType;
  player_id?: string | null;
  assist_player_id?: string | null;
  minute: number;
  period: number;
  details?: string | null;
  created_at: string;
  player?: Player;
  assist_player?: Player;
}

export interface PlayerRating {
  id: string;
  match_id: string;
  evaluated_player_id: string;
  evaluator_id: string;
  rating: number; // 0 - 10
  technical?: number | null;
  tactical?: number | null;
  physical?: number | null;
  teamwork?: number | null;
  comment?: string | null;
  created_at?: string;
}

export interface PlayerStats {
  player_id: string;
  player: Player;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  win_rate: number;
  goals: number;
  assists: number;
  goals_per_match: number;
  average_rating: number;
  ratings_count: number;
  overall_index: number; // 0 to 100
  mvp_count: number;
  clean_sheets?: number;
}
