// =============================================================================
// Global Type Declarations
// (c) Mathigon
// =============================================================================


import {Step} from './components/step/step';


declare module '*.pug' {
  const value: string;
  export default value;
}

// Added by the build progress to distinguish between different build modes.
declare const ENV: 'WEB'|'MOBILE';

declare interface Window {
  // These global variables may be injected by a mobile app version.
  showWelcomeMessage?: boolean;
  ReactNativeWebView?: any;
  progressData?: any;

  // This global variable may be inlined in the template.
  user?: {name: string};
}

// Global variable exposed by the functions.ts files for courses.
// TODO Better code splitting to avoid duplication.
declare global{
  const StepFunctions: Record<string, (step: Step) => void>|undefined;
}
