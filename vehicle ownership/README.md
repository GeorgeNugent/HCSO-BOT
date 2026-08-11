# Vehicle Ownership System (Discord + FiveM)

Two pieces sharing one MySQL database:

- `fivem-resource/` — server resource: `/spawncar`, `/givevehicle`, `/revertvehicle`, `/mycars`
- `discord-bot/` — Discord bot: `/assign-vehicle` (staff), `/mycars` (buttons: Give Access / Revert All Access)

## 1. Database
Create a MySQL database (or reuse your existing FiveM DB) and run:
```
database/schema.sql
```

## 2. FiveM resource
1. Copy `fivem-resource/` into your `resources/` folder, rename it something like `vehicleownership`.
2. Make sure `oxmysql` is installed and started before this resource, and that it's configured to point at the same database.
3. Add to `server.cfg`:
   ```
   ensure oxmysql
   ensure vehicleownership
   ```
4. Your server needs the **Discord identifier** enabled (players must have Discord linked and your server needs a valid Discord App ID configured) — this is what lets the script match an in-game player to a Discord ID. See FiveM's docs on Discord Rich Presence / identifiers if you haven't set this up before.

## 3. Discord bot
```
cd discord-bot
npm install
cp .env.example .env   # fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID, DB_*, STAFF_ROLE_ID
npm run deploy         # registers the slash commands
npm start
```

- `STAFF_ROLE_ID` gates who can use `/assign-vehicle`. Leave blank to allow anyone (not recommended).
- `code` in `/assign-vehicle` is optional — leave it blank and the bot generates a random 6-character code.

## How ownership works
- `owned_vehicles` — one row per vehicle, tied to one **owner** (set by staff via `/assign-vehicle`).
- `vehicle_access` — rows added when an owner shares a car with someone via the "Give Access" button (or `/givevehicle` in-game). Deleted entirely when the owner hits "Revert All Access" (or `/revertvehicle`).
- Anyone in either table for a given vehicle can run `/spawncar <code>` in-game.

## Extending it
- Right now "Revert All Access" clears every shared holder at once, matching what you described. If you later want to revoke one specific person instead of everyone, that's a small addition — a select menu listing current holders with a per-person "Remove" button — happy to add it.
- Swap `Config.Notify` in `config.lua` for your framework's notify (ESX/QBCore) instead of raw chat messages if you want nicer in-game UI.
