# Attendance App – Setup & Requirements

This document describes the settings and requirements you need to configure for the Attendance & Time Tracking app to work in development and production.

---

## 1. Firebase (Authentication)

### What you need

- A **Firebase project** with **Authentication** enabled.
- **Email/Password** sign-in method turned on.
- **Web app** registered in the project to get the config object.

### Steps

1. Go to [Firebase Console](https://console.firebase.google.com/) and create or select a project.
2. Enable **Authentication**:
   - In the left sidebar, click **Build → Authentication**.
   - Click **Get started**.
   - Open the **Sign-in method** tab.
   - Enable **Email/Password** (first provider in the list). Save.
3. Register a **Web app** (needed for the config keys):
   - Project overview → **</>** (Web).
   - Register app (e.g. name: "Attendance App").
   - Copy the `firebaseConfig` object (or note the values).
4. Create a **`.env`** file in the **root of the Expo project** (`attendanceApp/`) with:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

5. Replace each value with the ones from your Firebase project (same as in the Web app config).
6. **Do not commit `.env`** to version control. Add `.env` to `.gitignore` if it is not already there.

### Optional (production)

- In **Authentication → Settings**, configure **Authorized domains** if you use web or custom domains.
- Consider enabling **Email link** or **Email verification** if you want verified emails.

---

## 2. Backend: Separate Express API (attendanceApi)

The backend is a **separate Express project** (`attendanceApi/`), not inside the Expo app.

- **Location**: `attendanceApi/` at the repo root. It exposes `/api/users`, `/api/attendance`, `/api/holidays`, `/api/commitment` (and `/api/health`).
- **Client**: When `EXPO_PUBLIC_API_ORIGIN` is set in the **Expo** `.env` (e.g. `https://your-api.vercel.app` or `http://localhost:3000`), the app calls this backend instead of local storage. The backend connects to MongoDB using `MONGODB_URI`.

So you have two ways to use data:
1. **Local only**: Do not set `EXPO_PUBLIC_API_ORIGIN`. Data stays in AsyncStorage (no backend, no MongoDB needed).
2. **Backend + MongoDB**: Deploy the Express backend (e.g. to Vercel), set `MONGODB_URI` in the **backend** env, and set `EXPO_PUBLIC_API_ORIGIN` in the **Expo** app to your backend URL.

---

## 3. MongoDB (Database)

The **Express backend** connects to MongoDB using a **connection string** (server-only). The app can also use **local storage (AsyncStorage)** when not using the backend. To use **MongoDB Atlas** with the backend:

### Setup with Atlas connection string

1. In [MongoDB Atlas](https://cloud.mongodb.com), open your project and cluster (e.g. **quizearn-cluster**).
2. Click **Connect** on the cluster, then **Drivers** (or "Connect your application").
3. Copy the **connection string**. Replace `<password>` with your database user password.
4. Add to your **backend** environment: create a `.env` file in **`attendanceApi/`** (see section below). Do **not** put `MONGODB_URI` in the Expo app or use `EXPO_PUBLIC_` for it.

```env
MONGODB_URI=mongodb+srv://youruser:yourpassword@cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

5. Optional: `MONGODB_DATABASE=attendance` (default). Collections are created on first write.

### Security (MongoDB)

- **Atlas**: Use **Network Access** (IP allowlist or VPC) and **Database Access** (roles with least privilege).
- **Connection string**: Never put it in client code or `EXPO_PUBLIC_` env vars; it is only used by the Express backend.

---

## 4. Notifications (Check-in / Check-out Reminders)

### What you need

- **expo-notifications** is already in the project and used for **local** (scheduled) reminders.
- User can set “Remind if not checked in by” and “Remind if not checked out by” in **Settings**; the app schedules daily triggers at those times.

### Configuration already in the project

- **app.json**: `expo-notifications` is added under `plugins` so that notification icons and behavior are configured for iOS/Android.
- **Permissions**: The app requests notification permission when the user turns **Reminders** on in Settings.
- **Scheduling**: When reminders are enabled, the app schedules two daily notifications (check-in and check-out times).

### What you should configure

1. **iOS**
   - In **app.json** you can add under `expo.plugins`:
     - `["expo-notifications", { "sounds": [] }]` (already used) is enough for default behavior.
   - For **production**, in Xcode/Apple Developer:
     - Enable **Push Notifications** capability if you later add push (optional).
     - For **local** notifications only, no extra capability is required beyond the plugin.

2. **Android**
   - **expo-notifications** sets a default channel. For custom “Attendance” channel name or importance, you can extend the plugin config in **app.json**:
     - e.g. `["expo-notifications", { "defaultChannel": "attendance-reminders" }]`.
   - On Android 13+, the app will prompt for **POST_NOTIFICATIONS** when the user enables reminders (handled by the library).

3. **Testing**
   - Use a **physical device**; scheduled notifications often do not fire in the iOS Simulator or Android Emulator.
   - Ensure the device is not in “Do Not Disturb” or “Battery optimization” blocking the app.

### Optional: Push notifications (future)

If you later want **push** (e.g. from a backend):
- **Firebase Cloud Messaging (FCM)** for Android and **APNs** for iOS.
- In Firebase: enable **Cloud Messaging**, download `google-services.json` (Android) and upload APNs key (iOS).
- In the app: use `expo-notifications` with FCM/APNs (Expo has guides for this). This is **not** required for the current local reminders.

---

## 4. Environment variables summary

### Expo app (`attendanceApp/.env`)

| Variable | Required for | Description |
|----------|--------------|-------------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Auth | From Firebase Web app config |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth | `*.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Auth | Project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Auth | `*.appspot.com` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Auth | Sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase Auth | App ID |
| `EXPO_PUBLIC_API_ORIGIN` | Backend (optional) | Backend URL with no trailing slash (e.g. `https://your-api.vercel.app`). Omit for local-only data. |

### Express backend (`attendanceApi/.env`)

| Variable | Required for | Description |
|----------|--------------|-------------|
| `MONGODB_URI` | Backend | Atlas connection string (Connect → Drivers). **Do not** use in Expo or EXPO_PUBLIC_. |
| `MONGODB_DATABASE` | Backend (optional) | Database name (default: attendance) |
| `PORT` | Local dev (optional) | Port for `npm start` (default: 3000). Ignored on Vercel. |

---

## 5. Running the app

1. Install dependencies (from `attendanceApp/`):

```bash
npm install
```

2. Add the Firebase variables to `.env` as above (required for login/register).
3. Start the dev server:

```bash
npx expo start
```

4. Without Firebase config, the app will show “Firebase not configured” when trying to sign in; add the env vars and restart.

---

## 6. Deploying the backend to Vercel

Deploy the **Express backend** (`attendanceApi/`) as its own Vercel project so the app can call it from the web (or any client).

### Deploy the backend

1. In Vercel, create a **new project** and import the repo (or the `attendanceApi` folder only if you use a monorepo setup).
2. Set **Root Directory** to `attendanceApi` if the repo root is the whole repo.
3. Add **Environment Variables** in the Vercel project for the backend:
   - **`MONGODB_URI`** (required): your MongoDB Atlas connection string.
   - **`MONGODB_DATABASE`** (optional): e.g. `attendance`.
4. Deploy. Your API will be at e.g. `https://attendance-api-xxx.vercel.app`. Test: `https://attendance-api-xxx.vercel.app/api/health` should return `{"ok":true}`.

### Point the app at the backend

- In the **Expo** app (and in the Vercel project for the **frontend**, if you deploy it to Vercel), set **`EXPO_PUBLIC_API_ORIGIN`** to your **backend** URL with **no trailing slash** (e.g. `https://attendance-api-xxx.vercel.app`).  
  If this is wrong or empty, the browser will try to call the wrong origin and you will see CORS or network errors when logging in or loading data.
- The **frontend** Vercel project only needs Firebase and `EXPO_PUBLIC_API_ORIGIN`; it does **not** need `MONGODB_URI` (that stays in the backend project).

---

## 7. Deploying to Firebase Hosting

Firebase Hosting can serve the **web app** (static HTML + JS). It does **not** run the Expo API routes (`/api/users`, etc.) unless you add **Cloud Functions** and wire them in `firebase.json`.

### Steps

1. **Install Firebase CLI** (once):  
   `npm install -g firebase-tools`

2. **Log in and select project**:  
   `firebase login`  
   `firebase use <your-project-id>`  
   (Use the same Firebase project as your app’s Auth, e.g. `personalattendancesystemapp`.)

3. **Initialize Hosting** (if not already):  
   `firebase init hosting`  
   - “What do you want to use as your public directory?” → **`dist`**  
   - Single-page app / overwrite → **No** (we use the prepared structure).  
   The repo already has a `firebase.json` that uses `dist` as `public`.

4. **Build and prepare for Firebase**:  
   `npm run firebase-build`  
   This runs `expo export` and then `scripts/firebase-prepare.js`, which copies `dist/client/_expo` and `dist/server/*.html` into `dist/` so Hosting can serve them at `/`, `/_expo/...`, `/login`, etc.

5. **Deploy**:  
   `firebase deploy --only hosting`  
   Or in one go:  
   `npm run firebase-deploy`

Your site will be at `https://<project-id>.web.app` and `https://<project-id>.firebaseapp.com`.

### API / backend on Firebase

- **Hosting only** serves static files. Requests to `/api/users` etc. will **404** unless you add **Cloud Functions** and rewrites in `firebase.json` to send `/api/**` to a function that talks to MongoDB.
- To use the app without a backend, leave **`EXPO_PUBLIC_API_ORIGIN`** unset in the build so the app uses **local storage (AsyncStorage)** only.
- If you set `EXPO_PUBLIC_API_ORIGIN` to your Firebase Hosting URL, set the same in **Firebase Hosting environment** (e.g. via Firebase Console or CI) so the client calls the right origin; you still need Cloud Functions (or another backend) to implement the API.

---

## 8. Optional features (already in the app)

- **Timezone**: Stored with the user profile; used for date calculations and reports.
- **Rounding**: In Settings, user can choose to round worked time to 5 or 10 minutes; used in reports.
- **Offline**: Data is stored locally (AsyncStorage). When you add MongoDB (Data API or backend), you can add a sync layer that pushes/pulls when online.

If you want, the next step can be implementing the MongoDB Data API (or backend) switch in `services/data.ts` and wiring it to the env variables above.
