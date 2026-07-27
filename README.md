# Converter Hub

A multi-category unit converter — the practical project for our EC2 + Nginx + Let's Encrypt classes. Full-stack Node.js app with a real SQLite database, designed to be deployed on a single EC2 instance.

**Stack:** Express (backend + API) · better-sqlite3 (database) · vanilla HTML/CSS/JS (frontend, no framework/build step needed)

## What It Does

- Converts values across 8 categories: Length, Weight, Temperature, Area, Volume, Speed, Time, Digital Storage
- Every conversion is logged to a local SQLite file (`converter-hub.db`) — the "Recent Log" panel on the page reads this back live
- `/health` endpoint — the same style of endpoint you'd point an ALB Target Group's health check at
- `/api/categories`, `/api/convert`, `/api/history` — the three API routes the frontend calls

## Project Structure
```
converter-hub/
├── server.js           # Express app + conversion logic + SQLite setup
├── package.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## Running Locally
```bash
npm install
npm start
# Visit http://localhost:3000
```

---

## Deploying on EC2 (matches what we covered in class)

### 1. Launch & prepare the instance
```bash
# Ubuntu 22.04, t3.micro is enough
sudo apt update
sudo apt install -y nodejs npm build-essential python3
node -v   # confirm Node is installed
```
`build-essential` + `python3` are needed because `better-sqlite3` compiles a small native module on install.

### 2. Get the app onto the instance
```bash
# via git clone, or scp the project folder up, then:
cd converter-hub
npm install
```

### 3. Run it persistently with PM2
Running `node server.js` directly dies the moment you close your SSH session. PM2 keeps it running, restarts it on crash, and can restart it on instance reboot.
```bash
sudo npm install -g pm2
pm2 start server.js --name converter-hub
pm2 save
pm2 startup            # follow the printed command to enable on-boot startup
```
Useful PM2 commands: `pm2 status`, `pm2 logs converter-hub`, `pm2 restart converter-hub`.

### 4. Put Nginx in front of it (reverse proxy)
The app listens on `localhost:3000` — it should never face the internet directly.
```nginx
server {
    listen 80;
    server_name converterhub.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/converter-hub   # paste the config above
sudo ln -s /etc/nginx/sites-available/converter-hub /etc/nginx/sites-enabled/
sudo nginx -t          # check syntax
sudo systemctl reload nginx
```

### 5. Point your domain at the instance
- Route 53 → create an **A record** for your domain pointing at the instance's **Elastic IP** (allocate + attach one first, so the IP survives restarts)

### 6. Secure it with Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d converterhub.example.com
sudo certbot renew --dry-run    # confirm auto-renewal works
```

### 7. Verify
```bash
curl -I https://converterhub.example.com     # expect HTTP/2 200
curl -I http://converterhub.example.com      # expect 301 redirect to HTTPS
```
Then check it in a browser, and run it through [SSL Labs](https://www.ssllabs.com/ssltest/) for a final grade.

---

## Stretch Goal (from Class 2)
Once this works on a single instance, try the *other* HTTPS pattern: put this same app behind an **ALB with an ACM certificate** instead of Nginx + Certbot — register the instance in a Target Group, add an HTTPS listener with the ACM cert, and compare the two approaches side by side.
