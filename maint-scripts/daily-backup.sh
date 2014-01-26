#!/bin/sh

#navigate to backups location
cd /persistent/DailySQLBackups/

#rename current backup as yesterday
echo "Renaming yesterday's backup..."
sudo mv teambox_bk_yesterday.sql teambox_bk_yesterday_temp.sql && sudo mv teambox_bk.sql teambox_bk_yesterday.sql && sudo rm teambox_bk_yesterday_temp.sql

#dump the new backup
echo "Creating today's backup..."
sudo mysqldump -h localhost -u root -pl@bd00 -c --add-drop-table --add-locks --quick --lock-tables teambox > teambox_bk.sql

echo "Done!"
