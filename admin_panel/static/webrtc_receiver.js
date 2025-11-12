// This module will manage the WebRTC connection for receiving video streams.
document.addEventListener('DOMContentLoaded', function () {
    if (!window.location.pathname.includes('/dashboard')) return;

    const videoElement = document.getElementById('screen-video');
    const childId = document.querySelector('meta[name="child-id"]').getAttribute('content');

    if (!childId) {
        console.error("Child ID is missing from the page.");
        return;
    }

    let peerConnection;
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            user.getIdToken().then(token => {
                const wsUrl = `ws://${window.location.host}/ws/media/${childId}?token=${token}`;
                const socket = new WebSocket(wsUrl);

                socket.onmessage = async (event) => {
                    const data = JSON.parse(event.data);

                    if (data.type === 'offer') {
                        console.log('Received SDP Offer');
                        peerConnection = new RTCPeerConnection(config);

                        peerConnection.ontrack = (event) => {
                            videoElement.srcObject = event.streams[0];
                        };

                        await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);

                        socket.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }));
                    } else if (data.type === 'candidate') {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    }
                };

                socket.onopen = () => console.log(`WebRTC signaling socket connected for child: ${childId}`);
                socket.onerror = (err) => console.error("Socket Error:", err);
            });
        }
    });
});
