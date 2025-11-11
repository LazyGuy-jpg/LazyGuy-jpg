// This module will handle the WebSocket connection to the server.
document.addEventListener('DOMContentLoaded', function () {
    // We should only attempt to connect if we are on the dashboard page.
    if (window.location.pathname.includes('/dashboard')) {
        console.log("Dashboard detected, attempting WebSocket connection...");

        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                user.getIdToken().then(token => {
                    const childId = "some_child_id"; // This should be dynamic
                    const wsUrl = `ws://${window.location.host}/ws/media/${childId}?token=${token}`;

                    try {
                        const socket = new WebSocket(wsUrl);

                        socket.onopen = function(e) {
                            console.log("[open] Connection established");
                            console.log("Sending 'ping' to server");
                            socket.send("ping");
                        };

                        socket.onmessage = function(event) {
                            console.log(`[message] Data received from server: ${event.data}`);
                        };

                        socket.onclose = function(event) {
                            if (event.wasClean) {
                                console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
                            } else {
                                console.log('[close] Connection died');
                            }
                        };

                        socket.onerror = function(error) {
                            console.log(`[error] ${error.message}`);
                        };
                    } catch (e) {
                        console.error("WebSocket connection failed:", e);
                    }
                });
            } else {
                console.log("User not authenticated, WebSocket connection not started.");
            }
        });
    }
});
