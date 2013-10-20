#!/bin/sh

#copy the proxy conf to enabled
cp /etc/apache2/sites-available/proxy.conf /etc/apache2/sites-enabled/

#remove maintenance conf from enabled
rm /etc/apache2/sites-enabled/maintenance.conf

echo "Restarting apache..."
service apache2 restart

echo "Done!"
