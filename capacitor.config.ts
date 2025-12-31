import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apex.aspiral',
  appName: 'aSpiral',
  webDir: 'dist',

  // Server configuration
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: ['*.apexbiz.io', '*.supabase.co']
  },

  // iOS-specific
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'aSpiral'
  },

  // Android-specific (WebGL/Three.js optimizations)
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false // Set true for dev builds
  },

  // Plugins
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#4a1a6b',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#4a1a6b'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
