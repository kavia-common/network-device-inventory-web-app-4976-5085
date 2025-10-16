-- 002_indexes.sql
-- Indexes for devices table

-- Unique constraints are already declared on columns; additional indexes to speed lookups
CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices (ip_address);
CREATE INDEX IF NOT EXISTS idx_devices_mac_address ON devices (mac_address);
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices (device_type);
