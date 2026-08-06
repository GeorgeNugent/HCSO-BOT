Config = {}

Config.MySQL = {
    host = GetConvar('vehicle_ownership_db_host', 'na05-sql.pebblehost.com'),
    port = GetConvarInt('vehicle_ownership_db_port', 3306),
    database = GetConvar('vehicle_ownership_db_name', 'customer_1560437_fivem'),
    user = GetConvar('vehicle_ownership_db_user', 'customer_1560437_fivem'),
    password = GetConvar('vehicle_ownership_db_password', ''),
}

Config.AuthToken = GetConvar('vehicle_ownership_auth_token', 'HendryCountyProject')
Config.HttpEndpoint = GetConvar('vehicle_ownership_http_endpoint', '/vehicle-ownership')

Config.Debug = GetConvarBool('vehicle_ownership_debug', false)
