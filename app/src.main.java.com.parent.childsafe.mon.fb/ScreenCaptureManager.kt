package com.parent.childsafe.mon.fb

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.util.Log
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.VideoCapturer

class ScreenCaptureManager(private val context: Context) {

    private var mediaProjectionManager: MediaProjectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    private var mediaProjection: MediaProjection? = null
    var videoCapturer: VideoCapturer? = null

    fun startCapture(resultCode: Int, data: Intent) {
        mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)

        videoCapturer = ScreenCapturerAndroid(data, object : MediaProjection.Callback() {
            override fun onStop() {
                Log.d("ScreenCapture", "MediaProjection stopped.")
            }
        })
    }

    fun requestPermission() {
        val intent = Intent(context, PermissionRequestActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun stopCapture() {
        mediaProjection?.stop()
        (videoCapturer as? ScreenCapturerAndroid)?.stopCapture()
        mediaProjection = null
        videoCapturer = null
    }
}
