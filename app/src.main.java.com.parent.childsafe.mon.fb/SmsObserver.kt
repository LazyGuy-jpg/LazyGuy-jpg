package com.parent.childsafe.mon.fb

import android.content.Context
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.provider.Telephony
import android.util.Log
import com.google.firebase.database.FirebaseDatabase

data class SmsMessage(
    val address: String? = null,
    val body: String? = null,
    val date: Long = 0,
    val type: String? = null // "inbox" or "sent"
)

class SmsObserver(
    private val context: Context,
    private val childId: String,
    handler: Handler
) : ContentObserver(handler) {

    private val firebaseRef = FirebaseDatabase.getInstance().getReference("sms").child(childId)

    override fun onChange(selfChange: Boolean, uri: Uri?) {
        super.onChange(selfChange, uri)
        Log.d("SmsObserver", "SMS change detected: $uri")
        queryLastSms()
    }

    private fun queryLastSms() {
        try {
            val cursor = context.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                null,
                null,
                null,
                "date DESC LIMIT 1"
            )

            cursor?.use {
                if (it.moveToFirst()) {
                    val address = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS))
                    val body = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.BODY))
                    val date = it.getLong(it.getColumnIndexOrThrow(Telephony.Sms.DATE))
                    val type = when (it.getInt(it.getColumnIndexOrThrow(Telephony.Sms.TYPE))) {
                        Telephony.Sms.MESSAGE_TYPE_INBOX -> "inbox"
                        Telephony.Sms.MESSAGE_TYPE_SENT -> "sent"
                        else -> "unknown"
                    }

                    val sms = SmsMessage(address, body, date, type)
                    firebaseRef.push().setValue(sms)
                    Log.d("SmsObserver", "Logged new SMS from/to: $address")
                }
            }
        } catch (e: Exception) {
            Log.e("SmsObserver", "Error querying SMS", e)
        }
    }
}
