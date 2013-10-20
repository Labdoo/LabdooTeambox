#!/bin/sh
echo "Starting e-mail scrape..."
date
cd /var/www/teambox/
bundle exec rake mail:inbox RAILS_ENV=production
rm -f /var/run/teamboxrake.lockrun
echo "Done processing."
date
