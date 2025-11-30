package com.parent.childsafe.mon.fb

import android.content.Context
import android.util.Log
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import org.webrtc.*

class WebRTCManager private constructor(private val context: Context, private val childId: String) {

    private val peerConnectionFactory: PeerConnectionFactory
    private var peerConnection: PeerConnection? = null
    private val rtcConfig = PeerConnection.RTCConfiguration(listOf(
        PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
    ))
    private val sdpConstraints = MediaConstraints()
    private val firebaseRef = FirebaseDatabase.getInstance().getReference("sdp").child(childId)

    init {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context)
                .setEnableInternalTracer(true)
                .createInitializationOptions()
        )
        peerConnectionFactory = PeerConnectionFactory.builder().createPeerConnectionFactory()
    }

    companion object {
        @Volatile private var instance: WebRTCManager? = null

        fun getInstance(context: Context, childId: String): WebRTCManager {
            return instance ?: synchronized(this) {
                instance ?: WebRTCManager(context, childId).also { instance = it }
            }
        }
    }

    fun startStream(videoCapturer: VideoCapturer) {
        peerConnection = peerConnectionFactory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let { firebaseRef.child("ice_candidates").push().setValue(it) }
            }
            // Other observer methods...
            override fun onSignalingChange(p0: SignalingState?) {}
            override fun onIceConnectionChange(p0: PeerConnection.IceConnectionState?) {}
            override fun onIceConnectionReceivingChange(p0: Boolean) {}
            override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
            override fun onDataChannel(p0: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddStream(p0: MediaStream?) {}
            override fun onRemoveStream(p0: MediaStream?) {}
        })

        val videoSource = peerConnectionFactory.createVideoSource(videoCapturer.isScreencast)
        videoCapturer.initialize(SurfaceTextureHelper.create("ScreenCapture", null), context, videoSource.capturerObserver)
        videoCapturer.startCapture(1280, 720, 30)

        val videoTrack = peerConnectionFactory.createVideoTrack("video", videoSource)
        peerConnection?.addTrack(videoTrack)

        createOffer()
    }

    private fun createOffer() {
        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sessionDescription: SessionDescription?) {
                peerConnection?.setLocalDescription(this, sessionDescription)
                firebaseRef.child("offer").setValue(sessionDescription?.description)
            }
            override fun onCreateFailure(p0: String?) {}
            override fun onSetSuccess() {}
            override fun onSetFailure(p0: String?) {}
        }, sdpConstraints)
    }

    fun listenForAnswer() {
        firebaseRef.child("answer").addValueEventListener(object: ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val answerSdp = snapshot.getValue(String::class.java)
                if (answerSdp != null) {
                    val sdp = SessionDescription(SessionDescription.Type.ANSWER, answerSdp)
                    peerConnection?.setRemoteDescription(SdpObserverAdapter, sdp)
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }

    fun stopStream() {
        peerConnection?.close()
        firebaseRef.removeValue()
    }

    // SdpObserver adapter to simplify callbacks
    private object SdpObserverAdapter : SdpObserver {
        override fun onCreateSuccess(p0: SessionDescription?) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(p0: String?) {}
        override fun onSetFailure(p0: String?) {}
    }
}
