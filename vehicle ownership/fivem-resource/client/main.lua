RegisterNetEvent('vehicleownership:spawn', function(model, plate)
    local hash = GetHashKey(model)

    RequestModel(hash)
    local waited = 0
    while not HasModelLoaded(hash) and waited < 5000 do
        Wait(50)
        waited = waited + 50
    end

    if not HasModelLoaded(hash) then
        TriggerEvent('chat:addMessage', { args = { '^1[Vehicles]', 'Failed to load that vehicle model.' } })
        return
    end

    local ped = PlayerPedId()
    local spawnCoords = GetOffsetFromEntityInWorldCoords(ped, 0.0, Config.SpawnForwardOffset, 0.0)
    local groundZ = select(2, GetGroundZFor_3dCoord(spawnCoords.x, spawnCoords.y, spawnCoords.z + 5.0, 0))
    local heading = GetEntityHeading(ped)

    local veh = CreateVehicle(hash, spawnCoords.x, spawnCoords.y, groundZ, heading, true, false)
    SetVehicleNumberPlateText(veh, plate)
    SetVehicleOnGroundProperly(veh)
    SetPedIntoVehicle(ped, veh, -1)
    SetModelAsNoLongerNeeded(hash)
end)
