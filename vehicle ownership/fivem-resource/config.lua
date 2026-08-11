Config = {}

-- Front-of-player offset (in metres) where the vehicle spawns
Config.SpawnForwardOffset = 3.0

Config.Notify = function(src, msg)
    TriggerClientEvent('chat:addMessage', src, { args = { '^2[Vehicles]', msg } })
end
