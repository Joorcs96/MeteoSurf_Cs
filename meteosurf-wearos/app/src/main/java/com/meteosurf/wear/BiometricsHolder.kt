package com.meteosurf.wear

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.view.View
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

/**
 * Pagina de biometria. Lee el sensor de pulso del reloj (TYPE_HEART_RATE)
 * y lo muestra en vivo. Requiere permiso BODY_SENSORS.
 */
class BiometricsHolder(
    private val activity: MainActivity,
    itemView: View
) : RecyclerView.ViewHolder(itemView), SensorEventListener {

    private val sensorManager =
        activity.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val heartRateSensor: Sensor? =
        sensorManager.getDefaultSensor(Sensor.TYPE_HEART_RATE)
    private val bpmView: TextView = itemView.findViewById(R.id.bpmValue)

    fun bind() {
        bpmView.text = "--"
        heartRateSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
    }

    fun stop() {
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type == Sensor.TYPE_HEART_RATE) {
            val bpm = event.values.firstOrNull()?.toInt() ?: 0
            if (bpm > 0) bpmView.text = bpm.toString()
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
