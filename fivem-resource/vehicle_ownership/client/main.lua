local lastVehicle = nil

RegisterNetEvent('vehicle_ownership:notify', function(message)
    SetNotificationTextEntry('STRING')
    AddTextComponentSubstringPlayerName(message)
    DrawNotification(false, false)
end)

CreateThread(function()
    while true do
        Wait(500)

        local playerPed = PlayerPedId()
        local vehicle = GetVehiclePedIsIn(playerPed, false)

        if DoesEntityExist(vehicle) and vehicle ~= 0 then
            if vehicle ~= lastVehicle then
                lastVehicle = vehicle
                local plate = GetVehicleNumberPlateText(vehicle)
                if plate and plate ~= '' then
                    TriggerServerEvent('vehicle_ownership:checkVehicle', plate)
                end
            end
        else
            lastVehicle = nil
        end
    end
end)
