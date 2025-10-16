-- 003_seed.sql
-- Optional seed data

INSERT INTO devices (name, ip_address, mac_address, device_type, location, status, last_ping)
VALUES
  ('Core Router', '192.168.1.1', '00:11:22:33:44:55', 'router', 'Data Center', 'online', NULL)
ON CONFLICT (ip_address) DO NOTHING;

INSERT INTO devices (name, ip_address, mac_address, device_type, location, status, last_ping)
VALUES
  ('Edge Switch', '192.168.1.2', '66:77:88:99:AA:BB', 'switch', 'Office A', 'offline', NULL)
ON CONFLICT (ip_address) DO NOTHING;
