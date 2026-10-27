# DatingAppAi

A mobile app that turns your Google Photos into a ready-to-paste Tinder and Hinge profile. You pick a big batch of photos; Claude scores every one, chooses and orders the best set for each app, and writes your Tinder bio and Hinge prompt answers.

Two limits shape how it works:

- **Google Photos only shares the photos you pick.** Since March 2025, apps can't read a whole library. The app uses the [Google Photos Picker API](https://developers.google.com/photos/picker): you select 30–100+ photos in Google's own picker, and the AI narrows them down.
- **Tinder and Hinge have no public API for profiles.** The app saves the chosen photos to your camera roll in order and gives you copy buttons for the text. You paste it in yourself.

## Layout

```
apps/mobile      Expo (expo-router) app: sign in, questionnaire, pick, results
apps/api         Node + Hono backend: Google Picker, photo prep, Claude pipeline
packages/shared  zod schemas, Tinder/Hinge limits, the Hinge prompt list, photo and writing rules
```

### How a profile is made (`apps/api/src/pipeline`)

1. **prep**: auto-rotate, strip all EXIF/GPS, resize (1600px kept for upload, 1024px for Claude), drop near-duplicates by perceptual hash.
2. **score**: Claude scores photos 10 at a time, with your "this is me" photos first so it can find you in group shots. It returns quality scores, shot type, and flags such as face hidden, possible ex, or someone else's kid.
3. **assemble**: Claude sees the top 15 photos plus your questionnaire and writes both profiles as structured JSON.
4. **validate**: enforces the limits in `packages/shared/src/platforms.ts` (photo counts, character limits, prompts on Hinge's real list, a solo face shot first) and asks Claude to shorten anything over the limit.

Nothing is stored in a database. Jobs and photos live in memory and are dropped after an hour, or when the user taps "Start over".

## Setup

Requires Node 22 and pnpm 10.

```sh
pnpm install
cp apps/api/.env.example apps/api/.env       # set ANTHROPIC_API_KEY and APP_ACCESS_CODE
cp apps/mobile/.env.example apps/mobile/.env # set the API URL and Google client ids
```

### Try the pipeline without the app

Put some photos in a folder. Name one or two clear selfies `me1.jpg` and `me2.jpg` (or pass `--me`), then run:

```sh
cd apps/api && set -a && . ./.env && set +a && cd ../..
pnpm score ./fixtures/sam --questionnaire ./fixtures/sam.json
```

This writes `out/profile.json` plus `out/tinder/` and `out/hinge/` with the chosen photos numbered in order. The questionnaire file uses the `Questionnaire` schema in `packages/shared/src/schemas.ts`, for example:

```json
{ "firstName": "Sam", "age": 29, "job": "ER nurse", "interests": ["bouldering", "ramen"], "tone": "funny",
  "funFacts": ["I've been to 31 countries"], "platforms": ["tinder", "hinge"] }
```

### Google Cloud (one time)

1. Create a project in Google Cloud Console and enable the **Photos Picker API**.
2. Under **Google Auth Platform**, set up the OAuth consent screen. Leave it in **Testing** and add each friend's Google account as a test user (up to 100). Testing mode means Google's app verification isn't needed. Add the scope `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
3. Create OAuth clients: **Web** (its id is `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), **iOS** with bundle id `com.datingappai.app` (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and its reversed id is `GOOGLE_IOS_URL_SCHEME`), and **Android** with package `com.datingappai.app` and your signing key's SHA-1 (run `npx eas-cli credentials` to see it).

### Run it

```sh
pnpm --filter @datingappai/api dev   # API on :8787
cd apps/mobile
npx eas-cli build --profile development --platform ios   # or android; Google sign-in needs a dev build, not Expo Go
npx expo start --dev-client
```

To share with friends, deploy the API (for example on Fly.io or Railway, using `apps/api/Dockerfile` built from the repo root) and set `APP_ACCESS_CODE` there. Then build with `--profile preview` for Android, or with `production` plus `eas submit` for TestFlight.

## Checks

```sh
pnpm test        # vitest; Claude and Google are stubbed
pnpm typecheck
```
