UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"
for t in $(cat classic.txt); do [ -s "h_$t.html" ] || curl -s -A "$UA" "https://www.2kratings.com/teams/$t" -o "h_$t.html"; sleep 1.2; done
