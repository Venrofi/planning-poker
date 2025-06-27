# Planning Poker App

A real-time collaborative estimation tool built with Angular 18 and Firebase.

## Quick Start

```bash
npm install
npm start
```

The app will be available at `http://localhost:4200/`

## Prerequisites

- Node.js 20 or higher
- Firebase project (for real-time functionality)

## Firebase Setup

1. **Create Firebase Project**

   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Register a web application

2. **Enable Realtime Database**

   - In Firebase console, go to "Realtime Database"
   - Create database and set rules:

   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```

   ⚠️ **Note**: These are permissive rules for development. Use proper security rules for production.

3. **Configure Environment**

   - Copy `src/environments/environment.template.ts` to `src/environments/environment.ts`
   - Add your Firebase config:

   ```typescript
   export const environment = {
     production: false,
     firebase: {
       apiKey: "your-api-key",
       authDomain: "your-project.firebaseapp.com",
       databaseURL: "https://your-project.firebaseio.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "123456789",
       appId: "your-app-id",
     },
   };
   ```

## Development

| Command              | Description              |
|----------------------| ------------------------ |
| `npm start`          | Start development server |
| `npm run build-prod` | Build for production     |
| `npm test`           | Run unit tests           |
| `npm run lint`       | Run linting              |

## Architecture

- **Standalone Components**: Modern Angular architecture
- **Signal-based State**: Reactive state management
- **Service Layer**: Clean separation of concerns
- **Real-time Sync**: Firebase Realtime Database integration

## Key Services

- `RoomStateService` - Manages room state and participants
- `PokerService` - Handles voting and card selection logic
- `UserSessionService` - User authentication and session management
- `NotificationService` - Real-time notifications and alerts
