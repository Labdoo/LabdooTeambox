#!/bin/sh
echo "Starting e-mail scrape..."
date
cd /var/www/teambox/
sudo bundle exec rake mail:inbox RAILS_ENV=production
sudo rm -f /var/run/teamboxrake.lockrun
echo "Done processing."
date
