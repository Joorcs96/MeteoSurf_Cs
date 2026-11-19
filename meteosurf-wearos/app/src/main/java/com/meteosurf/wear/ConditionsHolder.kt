package com.meteosurf.wear

import android.view.View
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

/**
 * Pagina de condiciones del spot. Por ahora con datos de ejemplo;
 * en el futuro se reciben del movil via WCSession/Wearable Data Layer.
 */
class ConditionsHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {

    fun bind() {
        val spot = itemView.findViewById<TextView>(R.id.spotName)
        val height = itemView.findViewById<TextView>(R.id.waveHeight)
        val period = itemView.findViewById<TextView>(R.id.periodValue)
        val wind = itemView.findViewById<TextView>(R.id.windValue)
        val stars = itemView.findViewById<TextView>(R.id.ratingStars)

        // Datos de ejemplo del spot Gurugu (Castellon)
        spot.text = "Gurugu"
        height.text = "0.8"
        period.text = "6 s"
        wind.text = "Terral"
        stars.text = "★★★★☆"
    }
}
