#!/bin/sh
echo "Starting reindexing..."
date
cd /var/www/teambox/
sudo bundle exec rake ts:rebuild RAILS_ENV=production
sudo rm -f /var/run/teamboxrake.lockrun
echo "Done reindexing."
date
