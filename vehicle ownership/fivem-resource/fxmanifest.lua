fx_version 'cerulean'
game 'gta5'

author 'Hendry County Project Vehicle Ownership System'
description 'N/A nigga'
version '1.0.0'

shared_scripts {
    'config.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}

client_scripts {
    'client/main.lua'
}

dependencies {
    'oxmysql'
}
