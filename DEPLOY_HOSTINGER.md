# Deploying to Hostinger (Business Plan - Node.js)

## Prerequisites
- Hostinger Business plan with Node.js enabled
- MySQL database created via Hostinger hPanel

## Step 1: Create MySQL Database
1. Go to hPanel → Databases → MySQL Databases
2. Create a new database (e.g., `u123456789_ecom`)
3. Note: database name, username, password, and host (usually `localhost`)

## Step 2: Upload Files
1. Go to hPanel → Files → File Manager (or use SSH/Git)
2. Upload the entire project to your domain's root directory (e.g., `/home/u123456789/domains/yourdomain.com/`)

## Step 3: Configure Environment
1. Edit `server/.env` with your Hostinger MySQL credentials:
   ```
   PORT=3000
   NODE_ENV=production
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=u123456789_ecom
   DB_USER=u123456789_ecom
   DB_PASSWORD=your_db_password
   JWT_SECRET=generate_a_strong_random_string_here
   JWT_EXPIRE=7d
   CLIENT_URL=https://yourdomain.com
   ```

## Step 4: Build Frontend
```bash
cd client
npm install
npm run build
```

## Step 5: Install Server Dependencies
```bash
cd server
npm install --production
```

## Step 6: Setup Node.js App in hPanel
1. Go to hPanel → Advanced → Node.js
2. Create a new Node.js application:
   - Node.js version: 18.x or 20.x
   - Application root: `domains/yourdomain.com/server`
   - Application startup file: `src/index.js`
   - Application URL: yourdomain.com
3. Click "Create"

## Step 7: Seed Database (First Time)
Via SSH:
```bash
cd ~/domains/yourdomain.com/server
node src/seed.js
```

## Step 8: Restart Application
In hPanel → Node.js → Click "Restart" on your app

## Default Credentials
- Admin: admin@store.com / admin123
- Customer: john@example.com / password123

## Notes
- The Node.js server serves both the API (`/api/*`) and the React frontend (static files)
- Hostinger's Node.js uses Passenger, which handles port binding automatically
- SSL is free and automatic on Hostinger
- Max 75 MySQL connections — the pool is configured for 10 (sufficient)
