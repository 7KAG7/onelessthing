# Deploy OneLessThing To AWS

This guide assumes:

- AWS Lightsail or EC2 running Ubuntu 24.04 or 22.04
- Domain `onelessthing.life` is managed in GoDaddy
- App will live at `/var/www/onelessthing`

## 1. Create the server

In AWS:

- Create a Lightsail instance or EC2 `t3.micro`
- Choose Ubuntu
- Allow inbound traffic on ports `22`, `80`, and `443`
- Note the public IPv4 address

## 2. Point GoDaddy DNS to AWS

In GoDaddy DNS for `onelessthing.life`:

- Add `A` record: host `@` -> your AWS public IPv4
- Add `CNAME` record: host `www` -> `onelessthing.life`

DNS can take a little while to propagate.

## 3. Install system packages

SSH into the server and run:

```bash
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
pm2 -v
```

## 4. Copy the app to the server

If you use git on the server:

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <your-repo-url> onelessthing
cd onelessthing
```

If the repo is not online yet, copy it from your computer with `scp` or use GitHub first.

## 5. Install dependencies and build

```bash
cd /var/www/onelessthing
npm install
cd client
npm install
cd ..
npm run build
```

That creates:

- backend build in `dist/`
- frontend build in `client/dist/`

## 6. Create production environment variables

Create `/var/www/onelessthing/.env`:

```env
OPENWEATHER_API_KEY=your_openweather_key
JWT_SECRET=replace_with_a_long_random_secret
AMAZON_ASSOCIATE_TAG=your_tag_if_you_have_one
PORT=3000
NODE_ENV=production
```

Generate a strong JWT secret with:

```bash
openssl rand -base64 32
```

## 7. Start the app with PM2

This repo includes [`ecosystem.config.cjs`](/Users/ghana/code/onelessthing/ecosystem.config.cjs).

```bash
cd /var/www/onelessthing
pm2 start ecosystem.config.cjs
pm2 status
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` so the app restarts after reboots.

Useful PM2 commands:

```bash
pm2 logs onelessthing
pm2 restart onelessthing
pm2 stop onelessthing
```

## 8. Configure nginx

This repo includes [`deploy/nginx-onelessthing.conf`](/Users/ghana/code/onelessthing/deploy/nginx-onelessthing.conf).

Copy it into nginx:

```bash
sudo cp /var/www/onelessthing/deploy/nginx-onelessthing.conf /etc/nginx/sites-available/onelessthing
sudo ln -s /etc/nginx/sites-available/onelessthing /etc/nginx/sites-enabled/onelessthing
sudo nginx -t
sudo systemctl reload nginx
```

If the default nginx site is still enabled, remove it:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Add HTTPS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d onelessthing.life -d www.onelessthing.life
```

Choose the redirect option when prompted so HTTP forwards to HTTPS.

## 10. Verify the app

Check these:

- `https://onelessthing.life`
- `https://www.onelessthing.life`
- `https://onelessthing.life/api/weather?city=Boston`

If the app does not load:

- `pm2 logs onelessthing`
- `sudo journalctl -u nginx -n 100 --no-pager`
- `sudo nginx -t`

## 11. Future deploys

After code changes:

```bash
cd /var/www/onelessthing
git pull
npm install
cd client
npm install
cd ..
npm run build
pm2 restart onelessthing
```

## Notes for this app

- User accounts are stored in [`data/users.json`](/Users/ghana/code/onelessthing/data/users.json), so this should stay on one server for now.
- Back up `data/users.json` before major deploys.
- The app now serves the Vite frontend build from `client/dist` in production, with a fallback to the legacy `public/` frontend if the build is missing.
