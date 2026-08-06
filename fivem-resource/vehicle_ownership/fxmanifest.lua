fx_version 'cerulean'
game 'gta5'

author 'HCSO Bot Integration'
description 'Discord-linked vehicle ownership system for FiveM'
version '1.0.0'

server_scripts {
  '@oxmysql/lib/MySQL.lua',
  'server/main.lua'
}

client_scripts {
  'client/main.lua'
}

shared_scripts {
  'shared/config.lua'
}
