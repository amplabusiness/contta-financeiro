
ALTER TABLE accounting_entry_lines 
ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES cost_centers(id);
