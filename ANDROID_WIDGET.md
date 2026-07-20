# Getting a real home screen widget after PWABuilder

## Why this is a separate step
PWABuilder (pwabuilder.com, Microsoft's tool) wraps Bond into a **Trusted Web
Activity** — a genuine Android app that opens your site full-screen with no
browser chrome, publishable to the Play Store or as a standalone APK. That
part works today, as-is, with zero code changes.

A home screen **widget**, though, is a different piece of native Android UI
that lives outside your app entirely (Android's `AppWidgetProvider` API). It
has to be written in Kotlin and compiled into the Android project PWABuilder
generates. This can't be done from web code — but once you have that
generated project open in Android Studio, adding one is a normal, well-trodden
Android feature. Below is a working starting point.

## Steps

### 1. Generate the Android project
Go to [pwabuilder.com](https://www.pwabuilder.com), enter your Vercel URL,
choose **Android**, download the generated Android Studio project.

### 2. Add a widget provider
In the generated project, create `app/src/main/java/.../BondWidgetProvider.kt`:

```kotlin
class BondWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            val prefs = context.getSharedPreferences("bond_widget", Context.MODE_PRIVATE)
            val message = prefs.getString("latest_message", "Open Bond to see your partner's note")
            val sender = prefs.getString("latest_sender", "Bond")

            val views = RemoteViews(context.packageName, R.layout.bond_widget)
            views.setTextViewText(R.id.widget_sender, sender)
            views.setTextViewText(R.id.widget_message, message)

            val intent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            manager.updateAppWidget(id, views)
        }
    }
}
```

Register it in `AndroidManifest.xml`:
```xml
<receiver android:name=".BondWidgetProvider" android:exported="false">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data android:name="android.appwidget.provider"
        android:resource="@xml/bond_widget_info" />
</receiver>
```

### 3. Keep the widget's data fresh
The widget reads from `SharedPreferences`, not from the web app's IndexedDB
(they're separate worlds). Use `WorkManager` to periodically poll a small
public Supabase Edge Function (a v2 of `send-push` that instead returns the
latest message preview for a given user token) and write the result into
`SharedPreferences`, then call `AppWidgetManager.updateAppWidget`. A 15-minute
periodic `WorkManager` job is the standard pattern here — true real-time
push-to-widget requires Firebase Cloud Messaging with a data-only message
waking a `BroadcastReceiver`, which is a further step up if you want instant
updates instead of 15-minute polling.

## Realistic scope
This is genuinely a few hours of native Android work for someone comfortable
in Kotlin — it's not a copy-paste-and-done file, since widget layouts and
polling intervals need tuning to your actual UI. I've given you a correct,
working shape to build from rather than a placeholder.
