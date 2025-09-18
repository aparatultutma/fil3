# Fal Engine Flat
Tüm dosyalar kök dizinde; klasör yok. Railway/Render için en basit kurulum.

## İçerik
- index.js
- package.json
- noRepeatGuard.js
- symbols_hikayeli_v1.json
- symbols_with_culture_notes.json

## Deploy
1. GitHub repo oluştur, bu zip’in içindekileri yükle.
2. Railway → New Project → Deploy from GitHub → Start Command: node index.js
3. Test:
curl -X POST https://<URL>/v1/readings/generate -H "Content-Type: application/json" -d '{"user_id":"u42","symbols":["Kuş","Anahtar","Ay"],"culture_mode":true,"lang":"tr","region":"TR"}'
