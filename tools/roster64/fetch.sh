UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"
for t in atlanta-hawks boston-celtics brooklyn-nets charlotte-hornets chicago-bulls cleveland-cavaliers dallas-mavericks denver-nuggets detroit-pistons golden-state-warriors houston-rockets indiana-pacers los-angeles-clippers los-angeles-lakers memphis-grizzlies miami-heat milwaukee-bucks minnesota-timberwolves new-orleans-pelicans new-york-knicks oklahoma-city-thunder orlando-magic philadelphia-76ers phoenix-suns portland-trail-blazers sacramento-kings san-antonio-spurs toronto-raptors utah-jazz washington-wizards; do
  [ -s "t_$t.html" ] || curl -s -A "$UA" "https://www.2kratings.com/teams/$t" -o "t_$t.html"
  sleep 1.5
done
ls t_*.html | wc -l
