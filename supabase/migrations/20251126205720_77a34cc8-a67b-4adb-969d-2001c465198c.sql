-- Add has_voted column to players table
ALTER TABLE players ADD COLUMN has_voted BOOLEAN DEFAULT false;