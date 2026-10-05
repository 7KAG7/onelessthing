# One Less Thing

Minimal app that reads weather data and suggests outfit tiles.

## Mobile app foundation

The repository includes a bare React Native app in [`mobile/`](mobile/README.md), alongside the existing Vite website. Its checked-in iOS project is `mobile/ios/OneLessThing.xcodeproj`; install CocoaPods dependencies on a Mac and open `mobile/ios/OneLessThing.xcworkspace` in Xcode to run it. With no API URL configured, development builds show a clearly labeled sample preview; edit `apiBaseUrl` in `mobile/config/environment.json` for live weather. See the [Mac setup instructions](mobile/README.md#ios-development-on-a-mac).

- [Frontend design and backend recommendations](docs/MOBILE_PRODUCT.md)
- [Mobile setup and implemented scope](mobile/README.md)
- [Versioned API contract](src/mobile/README.md)
- [AWS serverless scaffold and migration](docs/AWS_MOBILE.md)
- [Xcode release and App Store checklist](docs/MOBILE_RELEASE.md)
- [Verification scope and remaining checks](docs/VERIFICATION.md)

The mobile screens, local preferences/saved outfits, live API integration code and undeployed AWS scaffold are implemented. Xcode compilation, native-device testing, signing, archive validation and App Store submission have not been verified in the Linux environment. Cloud account sync remains future work. No production deployment is changed by adding these files.

## Existing web production

Production URL: `https://onelessthing.life`

Hosting setup:

- AWS Lightsail Ubuntu instance
- GoDaddy DNS for `onelessthing.life`
- `nginx` as reverse proxy
- `pm2` running the Node app
- HTTPS via Let's Encrypt / Certbot

## Local development

### Backend

```bash
npm install
npm run dev
```

Backend runs on `http://localhost:3000`.

### Frontend

```bash
cd client
npm install
npm run dev
```

Vite runs on `http://localhost:4173` and proxies `/api` to `http://localhost:3000`.

## Environment variables

Create a root `.env` file with:

```env
OPENWEATHER_API_KEY=your_openweather_key
JWT_SECRET=replace_with_a_long_random_secret
AMAZON_ASSOCIATE_TAG=your_tag_if_you_have_one
PORT=3000
NODE_ENV=production
```

## Build

```bash
npm run build
```

This builds:

- the backend into `dist/`
- the frontend into `client/dist/`

## AWS deployment notes

This project is currently deployed as a single Node app on AWS Lightsail.

High-level flow:

1. Create a Lightsail Ubuntu instance.
2. Open ports `22`, `80`, and `443`.
3. Attach a static IP to the instance.
4. Point GoDaddy DNS to that static IP.
5. Install `nginx`, Node.js 20, and `pm2` on the server.
6. Copy or clone the repo to `/var/www/onelessthing`.
7. Install dependencies and run `npm run build`.
8. Start the app with `pm2`.
9. Configure `nginx` to proxy traffic to `127.0.0.1:3000`.
10. Use Certbot to enable HTTPS for `onelessthing.life` and `www.onelessthing.life`.

### GoDaddy DNS

Records used:

- `A` record: host `@` -> AWS Lightsail static IP
- `CNAME` record: host `www` -> `onelessthing.life`

### Server setup

Install runtime dependencies:

```bash
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Copy app and build:

```bash
cd /var/www/onelessthing
npm install
cd client
npm install
cd ..
npm run build
```

Start with PM2:

```bash
cd /var/www/onelessthing
pm2 start dist/server.js --name onelessthing
pm2 save
pm2 startup
```

### nginx

Example site config:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name onelessthing.life www.onelessthing.life;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d onelessthing.life -d www.onelessthing.life
```

## Notes

- User data is currently stored in `data/users.json`.
- Because storage is file-backed right now, the app is best kept on a single server.
- If this grows, the next upgrade would be moving persistent data to a managed database.
