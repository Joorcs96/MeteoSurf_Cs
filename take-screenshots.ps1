$sizes = @(
  @{ w = 360; h = 740; name = "360x740" },
  @{ w = 390; h = 844; name = "390x844" },
  @{ w = 430; h = 932; name = "430x932" },
  @{ w = 844; h = 390; name = "844x390" }
)

playwright-cli open http://localhost:8765

foreach ($s in $sizes) {
  $w = $s.w
  $h = $s.h
  $name = $s.name

  Write-Host "Taking screenshots for $name"

  playwright-cli resize $w $h
  Start-Sleep -Seconds 1
  
  # Oscuro
  playwright-cli set-color-scheme dark
  Start-Sleep -Seconds 1
  playwright-cli screenshot --filename ".capturas/diseno/portada-oscuro-$name.png"
  playwright-cli click "css=.spot-card >> nth=0"
  Start-Sleep -Seconds 1
  playwright-cli screenshot --filename ".capturas/diseno/ficha-oscuro-$name.png"

  # Claro
  playwright-cli set-color-scheme light
  playwright-cli reload
  Start-Sleep -Seconds 2
  playwright-cli screenshot --filename ".capturas/diseno/portada-claro-$name.png"
  playwright-cli click "css=.spot-card >> nth=0"
  Start-Sleep -Seconds 1
  playwright-cli screenshot --filename ".capturas/diseno/ficha-claro-$name.png"
  
  # Reset to home
  playwright-cli reload
  Start-Sleep -Seconds 2
}

playwright-cli close
