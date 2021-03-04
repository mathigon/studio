// =============================================================================
// Custom Types and Imports
// (c) Mathigon
// =============================================================================


declare module '*.pug' {
  const value: string;
  export default value
}

declare interface Window {
  // These global variables maybe injected by a mobile app version.
  isWebView?: boolean;
  ReactNativeWebView?: any;
  progressData?: any;
  user?: any;
}
