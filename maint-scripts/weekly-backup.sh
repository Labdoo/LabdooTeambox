#!/bin/sh

#create date variable
DATE=$(date +%F)

#navigate to backups location
cd /persistent/WeeklySQLBackups/

#dump the new weekly backup
#echo "Creating weekly backup..."
sudo mysqldump -h localhost -u root -pl@bd00 -c --add-drop-table --add-locks --quick --lock-tables teambox > teambox_bk_$DATE.sql

echo "Done!"
