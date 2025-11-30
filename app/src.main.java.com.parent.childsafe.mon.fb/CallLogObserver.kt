package com.parent.childsafe.mon.fb

import android.content.Context
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.provider.CallLog
import android.util.Log
import com.google.firebase.database.FirebaseDatabase

data class CallLogEntry(
    val number: String? = null,
    val duration: Long = 0,
    val date: Long = 0,
    val type: String? = null // "incoming", "outgoing", "missed"
)

class CallLogObserver(
    private val context: Context,
    private val childId: String,
    handler: Handler
) : ContentObserver(handler) {

    private val firebaseRef = FirebaseDatabase.getInstance().getReference("call_logs").child(childId)

    override fun onChange(selfChange: Boolean, uri: Uri?) {
        super.onChange(selfChange, uri)
        Log.d("CallLogObserver", "Call log change detected: $uri")
        queryLastCall()
    }

    private fun queryLastCall() {
        try {
            val cursor = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                null,
                null,
                null,
                "date DESC LIMIT 1"
            )

            cursor?.use {
                if (it.moveToFirst()) {
                    val number = it.getString(it.getColumnIndexOrThrow(CallLog.Calls.NUMBER))
                    val duration = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DURATION))
                    val date = it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DATE))
                    val type = when (it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.TYPE))) {
                        CallLog.Calls.INCOMING_TYPE -> "incoming"
                        CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                        CallLog.Calls.MISSED_TYPE -> "missed"
                        else -> "unknown"
                    }

                    val call = CallLogEntry(number, duration, date, type)
                    firebaseRef.push().setValue(call)
                    Log.d("CallLogObserver", "Logged new call with: $number")
                }
            }
        } catch (e: Exception) {
            Log.e("CallLogObserver", "Error querying call log", e)
        }
    }
}
