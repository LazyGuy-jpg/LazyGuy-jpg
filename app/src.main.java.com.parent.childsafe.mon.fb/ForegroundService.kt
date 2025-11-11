package com.parent.childsafe.mon.fb

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
import android.util.Log
import androidx.core.app.NotificationCompat

class ForegroundService : Service() {

    private val CHANNEL_ID = "ChildSafeServiceChannel"
    private val NOTIFICATION_ID = 1337

    private val commandReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "FCM_COMMAND") {
                val commandData = intent.getSerializableExtra("command_data") as? HashMap<String, String>
                commandData?.let {
                    executeCommand(it)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        // Register the broadcast receiver
        registerReceiver(commandReceiver, IntentFilter("FCM_COMMAND"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d("ForegroundService", "Service starting...")

        createNotificationChannel()
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)

        return START_STICKY
    }

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
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "ChildSafe Monitoring Service",
                NotificationManager.IMPORTANCE_NONE
            ).apply {
                description = "Channel for the persistent monitoring service."
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(serviceChannel)
        }
    }

    fun executeCommand(command: Map<String, String>) {
        val commandType = command["type"]
        Log.d("ForegroundService", "Executing command: $commandType with payload: $command")
        // TODO: Implement actual command logic (lock, locate, etc.)
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        // Unregister the receiver to avoid memory leaks
        unregisterReceiver(commandReceiver)
        Log.d("ForegroundService", "Service is being destroyed.")
    }
}
