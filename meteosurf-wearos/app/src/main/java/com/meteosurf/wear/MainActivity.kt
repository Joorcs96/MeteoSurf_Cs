package com.meteosurf.wear

import android.app.Activity
import android.os.Bundle
import androidx.viewpager2.widget.ViewPager2
import com.meteosurf.wear.databinding.ActivityMainBinding

/**
 * Actividad principal de MeteoSurf para Wear OS 2 (Xiaomi Mi Watch 2019).
 * Pantalla redonda 326x326. Usa un ViewPager2 vertical con dos pantallas
 * deslizables: condiciones del spot y biometria (pulso).
 */
class MainActivity : Activity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.pager.orientation = ViewPager2.ORIENTATION_VERTICAL
        binding.pager.adapter = SurfPagerAdapter(this)
    }
}
