# TradeLine247 ProGuard Rules
# ================================
# Properly configured for Capacitor + WebView apps

# Keep line numbers for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ================================
# Capacitor Core Rules
# ================================

# Keep Capacitor plugin classes
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.* class * { *; }
-keep @com.getcapacitor.PluginMethod public * { *; }

# Keep Capacitor core
-keep class com.getcapacitor.** { *; }

# Keep JavaScript interfaces for WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView JavaScript bridge
-keepattributes JavascriptInterface

# ================================
# Android X / Support Library
# ================================

-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ================================
# Cordova Plugins (if any)
# ================================

-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# ================================
# Firebase / FCM Push Notifications
# ================================

-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# ================================
# OkHttp (if used)
# ================================

-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# ================================
# Gson (if used for JSON)
# ================================

-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# ================================
# Enums
# ================================

-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ================================
# Serializable classes
# ================================

-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ================================
# Native Methods
# ================================

-keepclasseswithmembernames class * {
    native <methods>;
}

# ================================
# Optimization Settings
# ================================

# Don't warn about missing classes that are optional
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.codehaus.mojo.animal_sniffer.**

# Remove logging in release builds for security
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
