-- Add rounds and current_round to games table
ALTER TABLE games
ADD COLUMN total_rounds integer DEFAULT 3,
ADD COLUMN current_round integer DEFAULT 1;

-- Add score and turn_order to players table
ALTER TABLE players
ADD COLUMN score integer DEFAULT 0,
ADD COLUMN turn_order integer DEFAULT 0;