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
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat

class ForegroundService : Service() {

    private val CHANNEL_ID = "ChildSafeServiceChannel"
    private val NOTIFICATION_ID = 1337

    private lateinit var screenCaptureManager: ScreenCaptureManager
    private lateinit var webRtcManager: WebRTCManager
    private lateinit var childId: String

    private val permissionResultReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == PermissionRequestActivity.ACTION_PERMISSION_RESULT) {
                val resultCode = intent.getIntExtra(PermissionRequestActivity.EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
                val data = intent.getParcelableExtra<Intent>(PermissionRequestActivity.EXTRA_RESULT_DATA)

                if (resultCode == Activity.RESULT_OK && data != null) {
                    Log.d("ForegroundService", "MediaProjection permission granted. Starting stream.")
                    screenCaptureManager.startCapture(resultCode, data)
                    screenCaptureManager.videoCapturer?.let {
                        webRtcManager.startStream(it)
                        webRtcManager.listenForAnswer()
                    }
                } else {
                    Log.w("ForegroundService", "MediaProjection permission denied.")
                }
            }
        }
    }

    private val commandReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "FCM_COMMAND") {
                val commandData = intent.getSerializableExtra("command_data") as? HashMap<String, String>
                commandData?.let { executeCommand(it) }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        childId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
        screenCaptureManager = ScreenCaptureManager(this)
        webRtcManager = WebRTCManager.getInstance(this, childId)

        registerReceiver(commandReceiver, IntentFilter("FCM_COMMAND"), RECEIVER_EXPORTED)
        registerReceiver(permissionResultReceiver, IntentFilter(PermissionRequestActivity.ACTION_PERMISSION_RESULT), RECEIVER_EXPORTED)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        return START_STICKY
    }

    private fun executeCommand(command: Map<String, String>) {
        when (command["type"]) {
            "start_stream" -> screenCaptureManager.requestPermission()
            "stop_stream" -> {
                webRtcManager.stopStream()
                screenCaptureManager.stopCapture()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(commandReceiver)
        unregisterReceiver(permissionResultReceiver)
    }

    // Other methods (createNotification, onBind, etc.) remain the same
    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("System Service")
            .setContentText("Monitoring service is running.")
            .setSmallIcon(android.R.drawable.ic_lock_silent_mode)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "ChildSafe Service", NotificationManager.IMPORTANCE_NONE)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
    override fun onBind(intent: Intent?): IBinder? = null
}
