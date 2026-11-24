CREATE SCHEMA IF NOT EXISTS campus;

CREATE TABLE IF NOT EXISTS campus.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text NOT NULL,
  number text NOT NULL,
  space_id text,
  purposes text[] NOT NULL CHECK (cardinality(purposes) > 0),
  capacity integer CHECK (capacity BETWEEN 0 AND 1000),
  computer_count integer CHECK (computer_count BETWEEN 0 AND 1000),
  computer_count_source text CHECK (computer_count_source IN ('inventory', 'estimate', 'verified')),
  UNIQUE (building_id, number),
  UNIQUE (building_id, space_id)
);

CREATE OR REPLACE FUNCTION campus.clear_old_computer_count_source()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.computer_count IS NULL OR (
    NEW.computer_count IS DISTINCT FROM OLD.computer_count
    AND NEW.computer_count_source IS NOT DISTINCT FROM OLD.computer_count_source
  ) THEN
    NEW.computer_count_source := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER clear_old_computer_count_source
BEFORE UPDATE OF computer_count ON campus.rooms
FOR EACH ROW EXECUTE FUNCTION campus.clear_old_computer_count_source();
