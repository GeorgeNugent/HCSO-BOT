-- Run this once against the MySQL database that BOTH the FiveM server
-- and the Discord bot connect to.

CREATE TABLE IF NOT EXISTS owned_vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    spawn_code VARCHAR(20) NOT NULL UNIQUE,
    model VARCHAR(50) NOT NULL,
    plate VARCHAR(12) NOT NULL UNIQUE,
    owner_discord_id VARCHAR(32) NOT NULL,
    assigned_by VARCHAR(32) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_access (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    holder_discord_id VARCHAR(32) NOT NULL,
    granted_by VARCHAR(32) NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES owned_vehicles(id) ON DELETE CASCADE
);
