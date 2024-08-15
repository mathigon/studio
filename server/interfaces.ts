// =============================================================================
// Course Interfaces
// (c) Mathigon
// =============================================================================


import express from 'express';


export interface Step {
  id: string;
  title: string;
  html: string;
  goals: string[];
  keywords: string[];
}

export interface Section {
  id: string;
  url: string;
  locked?: boolean;  // True if the section is still under development.
  autoTranslated?: boolean;  // True if the section has been translated by Google.

  title: string;
  thumbnail: string;
  background: string;

  steps: string[];
  goals: number;
  duration: number;  // in minutes
  next: {courseId?: string, sectionId: string};
}

export interface Course {
  id: string;
  title: string;
  description: string;
  color: string;
  nextCourse: string;
  prevCourse: string;

  locale: string;
  availableLocales: string[];

  icon?: string;
  hero?: string,
  author?: string;
  trailer?: string;
  level?: string;

  sections: Section[];
  steps: Record<string, Step>;
  goals: number;

  biosJSON: string;
  glossJSON: string;
  hintsJSON: string;
}

// -----------------------------------------------------------------------------

export interface SectionProgressData {
  progress: number;
  completed: boolean;
  activeStep: string;
  steps: {scores: string[], data: any}[];
  messages: {content: string, kind: string}[]
}

export interface APIResponse<T> {
  status: number;
  error?: Error;
  message?: string;
  data?: T
}

export interface CourseRequestOptions {
  sendFeedback?: (req: express.Request, course: Course) => APIResponse<void>|undefined;
  askTutor?: (req: express.Request, course: Course) => APIResponse<undefined>|undefined;
}

export interface ServerOptions {
  sessionSecret: string;
  csrfBlocklist?: string[];
  maxBodySize?: string;
  cacheAge?: number;  // Cache duration for static files (in ms)
}

// -----------------------------------------------------------------------------

export interface Config {
  siteName: string;
  description: string;
  domain: string;
  contentDir: string;

  privacyURL: string;
  googleAnalytics?: string;
  banner: string;  // Comment string shown at the start of minified JS/CSS files
  locales: string[];
  sitemap: string[];

  search: {
    enabled: boolean;
    popular?: string;
    // TODO More options
  }

  header: {
    logo: string;
    title: string;
    titleString: string;
    links: {
      title: string;
      icon: string;
      url: string;
    }[]
  }

  footer: {
    rows: {
      links: {
        title: string;
        url: string;
      }[]
    }[],
    copyright: string;
  }

  accounts: {
    enabled: boolean;
    teachers: boolean;
    parents: boolean;
    restricted: boolean;
    minAge?: number;
    privacyPolicy?: string;
    termsOfUse?: string;
    address?: string;
    supportEmail?: string;
    cronNotificationsEmail?: string;
    sendgridKey?: string;
    mongoServer?: string;
    oAuth?: Record<string, {clientId: string, clientSecret: string}>;
  }

  social: {
    facebook?: {
      page: string;
      appId: string;
    }
    twitter?: {
      handle: string;  // Without @
    }
    instagram?: {
      handle: string;
    }
    youtube?: {
      channel: string;
    }
    pinterest?: boolean;
    reddit?: boolean;
    googleClassroom?: boolean;
  }
  courses: {
    revealAll: boolean;
    biosPath?: string;
    feedback?: boolean;
    showLocked?: boolean;
    // TODO More options
  }
  tutor: {
    enabled: boolean;
    name?: string;
    icon?: string;
    // TODO More options
  }
}
