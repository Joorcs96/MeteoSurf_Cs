package com.meteosurf.wear

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView

/**
 * Adaptador de las pantallas deslizables del reloj.
 * Pagina 0: condiciones del spot. Pagina 1: biometria (pulso).
 */
class SurfPagerAdapter(private val activity: MainActivity) :
    RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    override fun getItemViewType(position: Int): Int = position

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            0 -> ConditionsHolder(
                inflater.inflate(R.layout.page_conditions, parent, false)
            )
            else -> BiometricsHolder(
                activity,
                inflater.inflate(R.layout.page_biometrics, parent, false)
            )
        }
    }

    override fun getItemCount(): Int = 2

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        if (holder is ConditionsHolder) holder.bind()
        if (holder is BiometricsHolder) holder.bind()
    }

    override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
        super.onViewRecycled(holder)
        if (holder is BiometricsHolder) holder.stop()
    }
}
