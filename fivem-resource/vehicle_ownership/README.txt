Vehicle Ownership FiveM Resource
================================

1. Place this folder in your server's resources directory.
2. Rename the folder to vehicle_ownership if needed.
3. Add this to your server.cfg:
   ensure oxmysql
   ensure vehicle_ownership

4. Set these server variables in your server.cfg:
   set vehicle_ownership_db_host "na05-sql.pebblehost.com"
   set vehicle_ownership_db_port 3306
   set vehicle_ownership_db_name "customer_1560437_fivem"
   set vehicle_ownership_db_user "customer_1560437_fivem"
   set vehicle_ownership_db_password "YOUR_DB_PASSWORD"
   set vehicle_ownership_auth_token "super-secret-token"
   set vehicle_ownership_http_endpoint "/vehicle-ownership"

5. The Discord bot is already configured to POST to /vehicle-ownership with the same auth token.

6. In game, the resource will reject unauthorized vehicle usage using the owner_id and allowed_drivers values.
