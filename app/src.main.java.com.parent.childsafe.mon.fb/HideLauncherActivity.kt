package com.parent.childsafe.mon.fb

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

class HideLauncherActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Start the persistent foreground service
        val serviceIntent = Intent(this, ForegroundService::class.java)
        startForegroundService(serviceIntent)

        // 2. Hide the launcher icon
        hideIcon()

        // 3. Finish the activity
        finish()
    }

    private fun hideIcon() {
        try {
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            val prefs = EncryptedSharedPreferences.create(
                "app_prefs_encrypted",
                masterKeyAlias,
                applicationContext,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )

            val isHidden = prefs.getBoolean("is_hidden", false)

            if (!isHidden) {
                val componentName = ComponentName(this, HideLauncherActivity::class.java)
                packageManager.setComponentEnabledSetting(
                    componentName,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                )
                prefs.edit().putBoolean("is_hidden", true).apply()
            }
        } catch (e: Exception) {
            // Handle error, e.g., log it
            e.printStackTrace()
        }
    }
}
