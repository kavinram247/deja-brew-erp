# Auth Testing Guide - Deja Brew ERP

## Step 1: MongoDB Verification
```bash
mongosh
use deja_brew_db
db.users.find({role: "owner"}).pretty()
db.users.findOne({role: "owner"}, {password_hash: 1})
```
Verify bcrypt hash starts with `$2b$`

## Step 2: API Testing
```bash
# Login
curl -c /tmp/cookies.txt -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@dejabrew.com","password":"BrewOwner2024"}'

# Check me
curl -b /tmp/cookies.txt http://localhost:8001/api/auth/me

# Logout
curl -c /tmp/cookies.txt -X POST http://localhost:8001/api/auth/logout
```

## Step 3: Frontend Testing
1. Go to /login
2. Enter owner@dejabrew.com / BrewOwner2024
3. Should redirect to /dashboard
4. Verify sidebar shows all 8 nav items (owner role)
5. Test logout button
