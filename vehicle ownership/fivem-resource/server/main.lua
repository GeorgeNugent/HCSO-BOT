-- Requires: server has a valid Discord App ID configured so player
-- identifiers include a "discord:<id>" entry. See FiveM docs on
-- Discord Rich Presence / the discord identifier for setup.

local function GetDiscordId(src)
    for _, id in ipairs(GetPlayerIdentifiers(src)) do
        if string.find(id, 'discord:') then
            return string.gsub(id, 'discord:', '')
        end
    end
    return nil
end

local function GetVehicleByCode(code)
    local result = MySQL.query.await('SELECT * FROM owned_vehicles WHERE spawn_code = ?', { code })
    return result and result[1] or nil
end

local function IsOwner(vehicle, discordId)
    return discordId ~= nil and vehicle.owner_discord_id == discordId
end

local function HasSharedAccess(vehicleId, discordId)
    if not discordId then return false end
    local result = MySQL.query.await(
        'SELECT 1 FROM vehicle_access WHERE vehicle_id = ? AND holder_discord_id = ?',
        { vehicleId, discordId }
    )
    return result and #result > 0
end

-- /spawncar <code>
RegisterCommand('spawncar', function(src, args)
    local code = args[1]
    if not code then
        Config.Notify(src, 'Usage: /spawncar [code]')
        return
    end

    local discordId = GetDiscordId(src)
    if not discordId then
        Config.Notify(src, 'Could not verify your Discord account. Ask an admin.')
        return
    end

    local vehicle = GetVehicleByCode(code)
    if not vehicle then
        Config.Notify(src, 'Invalid spawn code.')
        return
    end

    local authorized = IsOwner(vehicle, discordId) or HasSharedAccess(vehicle.id, discordId)
    if not authorized then
        Config.Notify(src, 'You are not authorized to spawn this vehicle.')
        return
    end

    TriggerClientEvent('vehicleownership:spawn', src, vehicle.model, vehicle.plate)
end, false)

-- /givevehicle <code> <player server id>
RegisterCommand('givevehicle', function(src, args)
    local code = args[1]
    local targetId = tonumber(args[2])

    if not code or not targetId then
        Config.Notify(src, 'Usage: /givevehicle [code] [player id]')
        return
    end

    local discordId = GetDiscordId(src)
    local vehicle = GetVehicleByCode(code)

    if not vehicle then
        Config.Notify(src, 'Invalid spawn code.')
        return
    end

    if not IsOwner(vehicle, discordId) then
        Config.Notify(src, 'Only the vehicle owner can give access.')
        return
    end

    local targetDiscordId = GetDiscordId(targetId)
    if not targetDiscordId then
        Config.Notify(src, 'That player has no linked Discord account.')
        return
    end

    MySQL.insert.await(
        'INSERT INTO vehicle_access (vehicle_id, holder_discord_id, granted_by) VALUES (?, ?, ?)',
        { vehicle.id, targetDiscordId, discordId }
    )

    Config.Notify(src, ('Access to %s given.'):format(vehicle.model))
    Config.Notify(targetId, ('You were given access to a %s. Use /spawncar %s'):format(vehicle.model, code))
end, false)

-- /revertvehicle <code>  (owner only, pulls back ALL shared access)
RegisterCommand('revertvehicle', function(src, args)
    local code = args[1]
    if not code then
        Config.Notify(src, 'Usage: /revertvehicle [code]')
        return
    end

    local discordId = GetDiscordId(src)
    local vehicle = GetVehicleByCode(code)

    if not vehicle then
        Config.Notify(src, 'Invalid spawn code.')
        return
    end

    if not IsOwner(vehicle, discordId) then
        Config.Notify(src, 'Only the vehicle owner can revert access.')
        return
    end

    MySQL.query.await('DELETE FROM vehicle_access WHERE vehicle_id = ?', { vehicle.id })
    Config.Notify(src, ('All shared access to %s has been revoked.'):format(vehicle.model))
end, false)

-- /mycars  (in-game mirror of the Discord command)
RegisterCommand('mycars', function(src)
    local discordId = GetDiscordId(src)
    if not discordId then
        Config.Notify(src, 'Could not verify your Discord account.')
        return
    end

    local owned = MySQL.query.await('SELECT * FROM owned_vehicles WHERE owner_discord_id = ?', { discordId })
    local shared = MySQL.query.await([[
        SELECT ov.* FROM vehicle_access va
        JOIN owned_vehicles ov ON ov.id = va.vehicle_id
        WHERE va.holder_discord_id = ?
    ]], { discordId })

    Config.Notify(src, '--- Owned Vehicles ---')
    for _, v in ipairs(owned) do
        Config.Notify(src, ('%s | Plate: %s | Code: %s'):format(v.model, v.plate, v.spawn_code))
    end

    Config.Notify(src, '--- Shared With You ---')
    for _, v in ipairs(shared) do
        Config.Notify(src, ('%s | Plate: %s | Code: %s'):format(v.model, v.plate, v.spawn_code))
    end
end, false)
