// This module will handle fetching and displaying FCM diagnostics.
document.addEventListener('DOMContentLoaded', function () {
    const sendButton = document.getElementById('send-fcm-button');
    if (sendButton) {
        sendButton.addEventListener('click', () => {
            const payloadInput = document.getElementById('fcm-command-payload');
            const childId = "some_child_id"; // This should be dynamically set

            try {
                const command = JSON.parse(payloadInput.value);

                // We need the user's auth token to make API calls
                firebase.auth().currentUser.getIdToken().then(token => {
                    fetch('/send-fcm', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            child_id: childId,
                            command: command
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log('FCM send response:', data);
                        alert('FCM command sent successfully (see console).');
                    })
                    .catch(error => {
                        console.error('Error sending FCM command:', error);
                        alert('Error sending FCM command.');
                    });
                });

            } catch (e) {
                alert('Invalid JSON in command payload.');
            }
        });
    }
});
