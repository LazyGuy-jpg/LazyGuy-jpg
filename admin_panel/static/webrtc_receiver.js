// This module manages the WebRTC connection using Firebase for signaling.
document.addEventListener('DOMContentLoaded', function () {
    if (!window.location.pathname.includes('/dashboard')) return;

    const videoElement = document.getElementById('screen-video');
    const childId = document.querySelector('meta[name="child-id"]').getAttribute('content');
    if (!childId) return;

    let peerConnection;
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const db = firebase.database();
    const sdpRef = db.ref(`sdp/${childId}`);

    // This should be triggered by a user action. For now, we'll start listening automatically.
    console.log(`Listening for WebRTC offers for child: ${childId}`);

    // 1. Listen for an offer from the child device.
    sdpRef.child('offer').on('value', async (snapshot) => {
        const offerSdp = snapshot.val();
        if (offerSdp) {
            console.log('Received SDP Offer from child via Firebase');
            peerConnection = new RTCPeerConnection(config);

            peerConnection.ontrack = (event) => {
                console.log("Received remote video track.");
                videoElement.srcObject = event.streams[0];
            };

            // Listen for ICE candidates from the child
            sdpRef.child('ice_candidates').on('child_added', (candSnapshot) => {
                const candidate = candSnapshot.val();
                if (candidate) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            });

            await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));

            // 2. Create an answer and write it back to Firebase.
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            sdpRef.child('answer').set(answer.sdp);
            console.log('Sent SDP Answer to child via Firebase');
        }
    });

    // Cleanup when the page is closed
    window.addEventListener('beforeunload', () => {
        sdpRef.child('offer').off();
        sdpRef.child('answer').remove();
        if (peerConnection) {
            peerConnection.close();
        }
    });
});
