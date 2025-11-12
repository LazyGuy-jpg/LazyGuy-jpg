// This module will handle the Leaflet map and data display from Firebase.
document.addEventListener('DOMContentLoaded', function () {
    if (!window.location.pathname.includes('/dashboard')) return;

    const childId = document.querySelector('meta[name="child-id"]').getAttribute('content');
    if (!childId) return;

    // --- Initialize Leaflet Map ---
    const map = L.map('map').setView([51.505, -0.09], 13); // Default view
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    let marker = L.marker([51.505, -0.09]).addTo(map);

    // --- Firebase Listeners ---
    const db = firebase.database();

    // GPS Listener
    const gpsRef = db.ref(`gps/${childId}`);
    gpsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const latLng = [data.latitude, data.longitude];
            map.setView(latLng, 16);
            marker.setLatLng(latLng).bindPopup(`Last seen: ${new Date(data.timestamp).toLocaleTimeString()}`).openPopup();
            console.log("Updated map with new location:", latLng);
        }
    });

    // SMS Listener
    const smsRef = db.ref(`sms/${childId}`).limitToLast(10);
    const smsList = document.getElementById('sms-list');
    smsRef.on('value', (snapshot) => {
        smsList.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const sms = childSnapshot.val();
            const item = document.createElement('li');
            item.textContent = `[${sms.type}] To/From ${sms.address}: ${sms.body.substring(0, 30)}...`;
            smsList.prepend(item);
        });
    });

    // Call Log Listener
    const callLogRef = db.ref(`call_logs/${childId}`).limitToLast(10);
    const callLogList = document.getElementById('call-log-list');
    callLogRef.on('value', (snapshot) => {
        callLogList.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const call = childSnapshot.val();
            const item = document.createElement('li');
            item.textContent = `[${call.type}] With ${call.number} for ${call.duration}s`;
            callLogList.prepend(item);
        });
    });
});
