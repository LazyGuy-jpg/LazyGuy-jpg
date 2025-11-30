package com.parent.childsafe.mon.fb

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.CallLog
import android.provider.Settings
import android.provider.Telephony
import android.util.Log
import androidx.core.app.NotificationCompat

class ForegroundService : Service() {

    private val CHANNEL_ID = "ChildSafeServiceChannel"
    private val NOTIFICATION_ID = 1337

    private lateinit var screenCaptureManager: ScreenCaptureManager
    private lateinit var webRtcManager: WebRTCManager
    private lateinit var locationTracker: LocationTracker
    private lateinit var smsObserver: SmsObserver
    private lateinit var callLogObserver: CallLogObserver
    private lateinit var childId: String
    private val handler = Handler(Looper.getMainLooper())

    private val permissionResultReceiver = object : BroadcastReceiver() {
        // ... (as before)
    }

    private val commandReceiver = object : BroadcastReceiver() {
        // ... (as before)
    }

    override fun onCreate() {
        super.onCreate()
        childId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
        screenCaptureManager = ScreenCaptureManager(this)
        webRtcManager = WebRTCManager.getInstance(this, childId)
        locationTracker = LocationTracker(this, childId)
        smsObserver = SmsObserver(this, childId, handler)
        callLogObserver = CallLogObserver(this, childId, handler)

        contentResolver.registerContentObserver(Telephony.Sms.CONTENT_URI, true, smsObserver)
        contentResolver.registerContentObserver(CallLog.Calls.CONTENT_URI, true, callLogObserver)

        registerReceiver(commandReceiver, IntentFilter("FCM_COMMAND"), RECEIVER_EXPORTED)
        registerReceiver(permissionResultReceiver, IntentFilter(PermissionRequestActivity.ACTION_PERMISSION_RESULT), RECEIVER_EXPORTED)
    }

    private fun executeCommand(command: Map<String, String>) {
        when (command["type"]) {
            "start_stream" -> screenCaptureManager.requestPermission()
            "stop_stream" -> {
                webRtcManager.stopStream()
                screenCaptureManager.stopCapture()
            }
            "start_location_updates" -> {
                val interval = command["interval_seconds"]?.toLongOrNull() ?: 30L
                locationTracker.startLocationUpdates(interval)
            }
            "stop_location_updates" -> locationTracker.stopLocationUpdates()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        contentResolver.unregisterContentObserver(smsObserver)
        contentResolver.unregisterContentObserver(callLogObserver)
        unregisterReceiver(commandReceiver)
        unregisterReceiver(permissionResultReceiver)
    }

    // Other service methods (onStartCommand, onBind, etc.) remain largely the same.
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        // Start default monitoring on service start
        executeCommand(mapOf("type" to "start_location_updates"))
        return START_STICKY
    }
    // ... (rest of the file)
}
