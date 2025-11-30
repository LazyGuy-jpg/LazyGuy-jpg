package com.parent.childsafe.mon.fb

import android.content.Intent
import android.provider.Settings
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class FCMService : FirebaseMessagingService() {

    private val client = OkHttpClient()
    private val serverUrl = BuildConfig.SERVER_URL

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCMService", "New FCM Token: $token")
        sendTokenToServer(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d("FCMService", "FCM Message Received from: ${remoteMessage.from}")

        remoteMessage.data.isNotEmpty().let {
            Log.d("FCMService", "Message data payload: " + remoteMessage.data)

            // Forward the command to the ForegroundService using a local broadcast
            val intent = Intent("FCM_COMMAND")
            intent.putExtra("command_data", HashMap(remoteMessage.data))
            sendBroadcast(intent)
        }
    }

    private fun sendTokenToServer(token: String) {
        val deviceId = getUniqueDeviceId()
        val json = JSONObject()
        json.put("child_id", deviceId)
        json.put("fcm_token", token)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        val request = Request.Builder()
            .url("$serverUrl/register-child")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("FCMService", "Failed to send token to server", e)
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    Log.d("FCMService", "Token sent to server successfully.")
                } else {
                    Log.e("FCMService", "Server responded with error: ${response.code}")
                }
                response.close()
            }
        })
    }

    private fun getUniqueDeviceId(): String {
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
    }
}
