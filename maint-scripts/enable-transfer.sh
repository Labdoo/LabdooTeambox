#!/bin/sh

#copy the transfer conf to enabled
cp /etc/apache2/sites-available/transfer.conf /etc/apache2/sites-enabled/

#remove phpmyadmin conf from enabled
rm /etc/apache2/sites-enabled/phpmyadmin.conf

echo "Restarting apache..."
service apache2 restart

echo "Done!"
