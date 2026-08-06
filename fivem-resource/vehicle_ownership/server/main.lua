local function logDebug(message, data)
    if Config.Debug then
        print('[vehicle_ownership] ' .. tostring(message), data and json.encode(data) or '')
    end
end

local function getPlayerIdentifier(source)
    local identifiers = {
        GetPlayerIdentifier(source, 0),
        GetPlayerIdentifier(source, 1),
        GetPlayerIdentifier(source, 2),
        GetPlayerIdentifier(source, 3)
    }

    for _, identifier in ipairs(identifiers) do
        if identifier and identifier ~= '' then
            return identifier
        end
    end

    return nil
end

local function getVehicleRecordByPlate(plate)
    local result = MySQL.scalar.await('SELECT id FROM vehicle_ownership WHERE plate = ?', { plate })
    return result
end

local function getVehicleRecordByPlateValue(plate)
    local result = MySQL.single.await('SELECT * FROM vehicle_ownership WHERE plate = ?', { plate })
    return result
end

local function getVehicleRecordById(vehicleId)
    local result = MySQL.single.await('SELECT * FROM vehicle_ownership WHERE id = ?', { vehicleId })
    return result
end

local function parseAllowedDrivers(raw)
    if not raw or raw == '' then
        return {}
    end

    local success, decoded = pcall(json.decode, raw)
    if success and type(decoded) == 'table' then
        return decoded
    end

    return {}
end

local function serializeAllowedDrivers(drivers)
    return json.encode(drivers or {})
end

local function canUseVehicle(playerId, vehicleRecord)
    if not vehicleRecord then
        return false
    end

    local ownerId = tostring(vehicleRecord.owner_id or '')
    local driverList = parseAllowedDrivers(vehicleRecord.allowed_drivers)

    if ownerId ~= '' and tostring(playerId) == ownerId then
        return true
    end

    for _, driverId in ipairs(driverList) do
        if tostring(driverId) == tostring(playerId) then
            return true
        end
    end

    return false
end

local function handleImport(body)
    local model = tostring(body.model or '')
    local plate = tostring(body.plate or '')
    local owner = tostring(body.owner or '')
    local importedBy = tostring(body.imported_by or '')

    if model == '' or plate == '' or owner == '' then
        return { success = false, message = 'Missing model, plate, or owner.' }
    end

    local vin = 'VIN-' .. tostring(math.random(100000, 999999))

    MySQL.insert.await('INSERT INTO vehicle_ownership (model, plate, vin, owner_id, allowed_drivers, imported_by, import_date, metadata) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)', {
        model,
        plate,
        vin,
        owner,
        '[]',
        importedBy,
        json.encode({ imported_via = 'discord' })
    })

    return {
        success = true,
        message = 'Vehicle imported successfully.',
        model = model,
        plate = plate,
        owner = owner
    }
end

local function handleAssign(body)
    local vehicleId = tonumber(body.vehicle_id)
    local newOwner = tostring(body.new_owner or '')

    if not vehicleId or vehicleId <= 0 or newOwner == '' then
        return { success = false, message = 'Invalid vehicle id or new owner.' }
    end

    MySQL.update.await('UPDATE vehicle_ownership SET owner_id = ? WHERE id = ?', { newOwner, vehicleId })

    return {
        success = true,
        message = 'Vehicle ownership updated successfully.',
        vehicle_id = vehicleId,
        new_owner = newOwner
    }
end

local function handleAddDriver(body)
    local vehicleId = tonumber(body.vehicle_id)
    local driverId = tostring(body.driver_id or '')

    if not vehicleId or vehicleId <= 0 or driverId == '' then
        return { success = false, message = 'Invalid vehicle id or driver id.' }
    end

    local vehicle = getVehicleRecordById(vehicleId)
    if not vehicle then
        return { success = false, message = 'Vehicle not found.' }
    end

    local drivers = parseAllowedDrivers(vehicle.allowed_drivers)
    local exists = false
    for _, existingDriver in ipairs(drivers) do
        if tostring(existingDriver) == driverId then
            exists = true
            break
        end
    end

    if not exists then
        table.insert(drivers, driverId)
        MySQL.update.await('UPDATE vehicle_ownership SET allowed_drivers = ? WHERE id = ?', { serializeAllowedDrivers(drivers), vehicleId })
    end

    return {
        success = true,
        message = 'Driver added successfully.',
        vehicle_id = vehicleId,
        driver_id = driverId
    }
end

local function handleRemoveDriver(body)
    local vehicleId = tonumber(body.vehicle_id)
    local driverId = tostring(body.driver_id or '')

    if not vehicleId or vehicleId <= 0 or driverId == '' then
        return { success = false, message = 'Invalid vehicle id or driver id.' }
    end

    local vehicle = getVehicleRecordById(vehicleId)
    if not vehicle then
        return { success = false, message = 'Vehicle not found.' }
    end

    local drivers = parseAllowedDrivers(vehicle.allowed_drivers)
    local filtered = {}
    for _, existingDriver in ipairs(drivers) do
        if tostring(existingDriver) ~= driverId then
            table.insert(filtered, existingDriver)
        end
    end

    MySQL.update.await('UPDATE vehicle_ownership SET allowed_drivers = ? WHERE id = ?', { serializeAllowedDrivers(filtered), vehicleId })

    return {
        success = true,
        message = 'Driver removed successfully.',
        vehicle_id = vehicleId,
        driver_id = driverId
    }
end

local function handleRevert(body)
    local vehicleId = tonumber(body.vehicle_id)
    if not vehicleId or vehicleId <= 0 then
        return { success = false, message = 'Invalid vehicle id.' }
    end

    MySQL.update.await('UPDATE vehicle_ownership SET owner_id = ? WHERE id = ?', { '', vehicleId })

    return {
        success = true,
        message = 'Ownership reverted successfully.',
        vehicle_id = vehicleId
    }
end

local function handleList(body)
    local discordId = tostring(body.discordId or '')
    if discordId == '' then
        return { success = false, message = 'Missing discordId.' }
    end

    local vehicles = MySQL.query.await('SELECT * FROM vehicle_ownership WHERE owner_id = ? OR allowed_drivers LIKE ?', { discordId, '%' .. discordId .. '%' })
    return {
        success = true,
        vehicles = vehicles or {}
    }
end

local function handleVehicleOwnershipRequest(req, res)
    local body = nil
    if req.body and req.body ~= '' then
        body = json.decode(req.body)
    end

    if not body then
        res.writeHead(400)
        res.end(json.encode({ success = false, message = 'Invalid JSON body.' }))
        return
    end

    if Config.AuthToken ~= '' and req.headers and req.headers.authorization ~= ('Bearer ' .. Config.AuthToken) then
        res.writeHead(401)
        res.end(json.encode({ success = false, message = 'Unauthorized.' }))
        return
    end

    local action = tostring(body.action or '')
    local result = nil

    if action == 'import' then
        result = handleImport(body)
    elseif action == 'assign' then
        result = handleAssign(body)
    elseif action == 'add_driver' then
        result = handleAddDriver(body)
    elseif action == 'remove_driver' then
        result = handleRemoveDriver(body)
    elseif action == 'revert' then
        result = handleRevert(body)
    elseif action == 'list' then
        result = handleList(body)
    else
        result = { success = false, message = 'Unsupported action.' }
    end

    res.writeHead(200, { ['Content-Type'] = 'application/json' })
    res.end(json.encode(result))
end

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end

    if not MySQL then
        print('[vehicle_ownership] oxmysql is required and was not found.')
        return
    end

    MySQL.ready(function()
        MySQL.query('CREATE TABLE IF NOT EXISTS vehicle_ownership (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  model VARCHAR(100) NOT NULL,\n  plate VARCHAR(20) NOT NULL,\n  vin VARCHAR(100) DEFAULT NULL,\n  owner_id VARCHAR(100) NOT NULL,\n  allowed_drivers TEXT DEFAULT NULL,\n  imported_by VARCHAR(100) DEFAULT NULL,\n  import_date DATETIME DEFAULT CURRENT_TIMESTAMP,\n  metadata TEXT DEFAULT NULL\n)', {})
        print('[vehicle_ownership] Database table ready.')
    end)
end)

RegisterNetEvent('vehicle_ownership:checkVehicle', function(plate)
    local source = source
    local playerId = getPlayerIdentifier(source)
    if not playerId then
        TriggerClientEvent('vehicle_ownership:notify', source, 'Unable to resolve your identity.')
        return
    end

    local record = getVehicleRecordByPlateValue(plate)
    if not record then
        return
    end

    if not canUseVehicle(playerId, record) then
        TriggerClientEvent('vehicle_ownership:notify', source, 'You are not authorised to drive this vehicle.')

        local entity = GetVehiclePedIsIn(GetPlayerPed(source), false)
        if entity and entity ~= 0 then
            DeleteVehicle(entity)
        end
    end
end)

SetHttpHandler(function(req, res)
    if req.path == Config.HttpEndpoint then
        handleVehicleOwnershipRequest(req, res)
    end
end)
