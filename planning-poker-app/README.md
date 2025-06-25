# PlanningPoker

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.1.4.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Firebase Configuration

This application uses Firebase for real-time communication. To set up your own Firebase instance:

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Register your web application in the Firebase project
3. Enable Realtime Database in the Firebase console
4. Set up Realtime Database rules (for basic testing, you can use):

   ```
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```

   Note: These rules allow anyone to read/write to your database. For production, use more restrictive rules.

5. Copy `src/environments/environment.template.ts` to `src/environments/environment.ts`
6. Update the Firebase configuration in `environment.ts` with your own Firebase project details

Note: The `environment.ts` file is excluded from version control to protect your Firebase credentials. Never commit API keys or credentials to public repositories.
