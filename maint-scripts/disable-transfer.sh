#!/bin/sh

#copy the phpmyadmin conf to enabled
cp /etc/apache2/sites-available/phpmyadmin.conf /etc/apache2/sites-enabled/

#remove transfer conf from enabled
rm /etc/apache2/sites-enabled/transfer.conf

echo "Restarting apache..."
service apache2 restart

echo "Done!"
