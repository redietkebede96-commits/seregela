-- SQL Schema for SUGU Transport Coordination

-- 1. Students Table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  destination TEXT,
  type TEXT CHECK (type IN ('walking', 'car_owner')),
  assigned_vehicle_id UUID, -- Forward reference
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Vehicles Table
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('car', 'bus')),
  owner_id UUID REFERENCES students(id) ON DELETE CASCADE,
  destination TEXT,
  total_seats INTEGER NOT NULL DEFAULT 4,
  tariff TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add Foreign Key constraint to students (circular ref handled by nullable)
ALTER TABLE students ADD CONSTRAINT fk_assigned_vehicle FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

-- 3. Row Level Security (RLS)
-- For this coordination app, we'll allow public access for demonstration as per user credentials.
-- In production, these would be locked down to authenticated users.

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access" ON vehicles FOR ALL USING (true) WITH CHECK (true);
