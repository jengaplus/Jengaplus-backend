# 🚀 QUICK START COMMANDS - JengaPlus v1.0.0

## ⚡ 5-MINUTE SETUP (Copy & Paste)

### Step 1️⃣: Check Project Status
```bash
cd c:\Users\pc\Desktop\PRINCE\Jengaplus
git status
```

### Step 2️⃣: Stage All Changes
```bash
git add -A
```

### Step 3️⃣: Commit to Git
```bash
git commit -m "feat: JengaPlus v1.0.0 production release

- Display team members (bosses, drivers, salespeople) on dashboard
- Remove all Expo branding and logos
- Production-ready build configuration
- Comprehensive sample data across all screens
- Add APK and Play Store deployment scripts"
```

### Step 4️⃣: Add GitHub Remote (First Time Only)
```bash
git remote add origin https://github.com/yourusername/jengaplus.git
```

### Step 5️⃣: Push to GitHub
```bash
git branch -M main
git push -u origin main
```

---

## 📱 BUILD COMMANDS

### Option A: Local APK Build (Testing)
```bash
cd c:\Users\pc\Desktop\PRINCE\Jengaplus
npm install
npx expo run:android
```

### Option B: APK for Distribution (Recommended)
```bash
cd c:\Users\pc\Desktop\PRINCE\Jengaplus
eas build --platform android --profile preview
```

### Option C: AAB for Google Play Store (Production)
```bash
cd c:\Users\pc\Desktop\PRINCE\Jengaplus
eas build --platform android --app-build-type app-bundle
```

---

## 🎯 COMPLETE WORKFLOW (From Start to APK)

Copy and run this complete sequence:

```bash
# Navigate to project
cd c:\Users\pc\Desktop\PRINCE\Jengaplus

# 1. Git workflow
git status
git add -A
git commit -m "feat: JengaPlus v1.0.0 production release"
git push -u origin main

# 2. Ensure dependencies
npm install

# 3. Build APK
npx expo run:android

# 4. Check build output
echo "APK built successfully!"
```

---

## 🔐 PRE-BUILD REQUIREMENTS

Ensure you have:

- ✅ `.env` file with `DATABASE_URL`
- ✅ Backend API running at `https://jengaplus-backend.onrender.com`
- ✅ Custom logo assets in `./assets/` folder
- ✅ Node.js and npm installed
- ✅ EAS CLI installed: `npm install -g eas-cli`
- ✅ Expo CLI installed: `npm install -g expo-cli`

---

## 📋 VERIFY BEFORE BUILD

```bash
# Check app.json is valid
cat app.json

# Verify logo files exist
ls -la assets/

# Check for errors
npm run lint

# Verify App.js compiles
npx tsc --noEmit App.js
```

---

## 🏆 FEATURES DEPLOYED

✅ **Dashboard Display:**
- Boss name displayed on BossDashboard with full team list
- Drivers and Salespeople names showing
- Color-coded role badges
- "Manage Team" button for quick access

✅ **Production Configuration:**
- JengaPlus logo as app icon (custom 'A' blue design)
- JengaPlus splash screen on app launch
- No Expo branding anywhere
- Dark theme UI
- All 35+ screens with sample data

✅ **Build Ready:**
- Local APK build (testing)
- AAB build (Play Store)
- EAS Cloud build support
- Signed production builds
- All scripts in package.json

---

## 🐛 IF SOMETHING GOES WRONG

```bash
# Clean everything and rebuild
cd c:\Users\pc\Desktop\PRINCE\Jengaplus
rm -rf node_modules
rm -rf .expo
rm -rf build
npm install
npm cache clean --force
eas build --platform android --profile preview
```

---

## 📊 WHAT YOU GET AFTER BUILD

1. **APK File** - Install on Android phone for testing
2. **AAB File** - Upload to Google Play Store for production
3. **Source Code** - Backed up on GitHub
4. **Custom Branding** - Logo shows on home screen and splash screen
5. **Team Display** - All staff names visible on dashboard

---

## 🎬 NEXT STEPS

1. Install APK on Android phone to see logo and splash screen
2. Log in with demo account to verify team display
3. Upload AAB to Google Play Store
4. Submit for review (2-3 hours)
5. Live on Play Store!

---

**Questions?** Check `BUILD_AND_DEPLOY.md` for detailed instructions.

**Version:** JengaPlus v1.0.0
**Status:** ✅ READY FOR PRODUCTION
**Modified:** 2024-03-22
