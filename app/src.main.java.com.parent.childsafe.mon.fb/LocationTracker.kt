package com.parent.childsafe.mon.fb

import android.annotation.SuppressLint
import android.content.Context
import android.os.Looper
import android.util.Log
import com.google.android.gms.location.*
import com.google.firebase.database.FirebaseDatabase

data class GpsLocation(
    val latitude: Double = 0.0,
    val longitude: Double = 0.0,
    val timestamp: Long = 0
)

class LocationTracker(private val context: Context, private val childId: String) {

    private val fusedLocationClient: FusedLocationProviderClient = LocationServices.getFusedLocationProviderClient(context)
    private val firebaseRef = FirebaseDatabase.getInstance().getReference("gps").child(childId)
    private var locationCallback: LocationCallback? = null

    @SuppressLint("MissingPermission") // Permissions are checked in the service before calling.
    fun startLocationUpdates(intervalSeconds: Long) {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalSeconds * 1000)
            .setWaitForAccurateLocation(false)
            .setMinUpdateIntervalMillis(intervalSeconds * 1000 / 2)
            .setMaxUpdateDelayMillis(intervalSeconds * 1000 * 2)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    Log.d("LocationTracker", "New location: ${location.latitude}, ${location.longitude}")
                    val gpsLocation = GpsLocation(
                        latitude = location.latitude,
                        longitude = location.longitude,
                        timestamp = System.currentTimeMillis()
                    )
                    firebaseRef.setValue(gpsLocation)
                }
            }
        }

        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback!!, Looper.getMainLooper())
        Log.d("LocationTracker", "Started location updates.")
    }

    fun stopLocationUpdates() {
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
            locationCallback = null
            Log.d("LocationTracker", "Stopped location updates.")
        }
    }
}
