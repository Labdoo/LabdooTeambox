#!/bin/sh

#copy the maintenance conf to enabled
sudo cp /etc/apache2/sites-available/maintenance.conf /etc/apache2/sites-enabled/

#remove proxy conf from enabled
sudo rm /etc/apache2/sites-enabled/proxy.conf

echo "Restarting apache..."
sudo service apache2 restart

echo "Done!"
