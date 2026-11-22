import SwiftUI
import WatchKit

struct WatchSessionView: View {
    @ObservedObject var workoutManager: WorkoutManager
    @State private var showingEndConfirmation = false
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // PESTAÑA 0: MODO OLA Y MÉTRICAS PRINCIPALES (ALTO CONTRASTE EXTERIOR)
            WaveLiveHudView(workoutManager: workoutManager)
                .tag(0)
            
            // PESTAÑA 1: BIOMETRÍA Y RENDIMIENTO FÍSICO
            BiometricsPageView(workoutManager: workoutManager)
                .tag(1)
            
            // PESTAÑA 2: DESGLOSE DE OLAS SURFEADAS
            WavesListView(workoutManager: workoutManager)
                .tag(2)
            
            // PESTAÑA 3: CONTROLES EN EL AGUA (WATER LOCK / PAUSA / FIN)
            WaterControlsView(
                workoutManager: workoutManager,
                showingEndConfirmation: $showingEndConfirmation
            )
            .tag(3)
        }
        .tabViewStyle(.page)
        .confirmationDialog("¿Finalizar sesión de surf?", isPresented: $showingEndConfirmation) {
            Button("Finalizar y Guardar", role: .destructive) {
                workoutManager.endWorkout()
            }
            Button("Continuar Surfeando", role: .cancel) {}
        }
    }
}

// MARK: - Pestaña 0: HUD Rápido y Modo Ola en Tiempo Real
struct WaveLiveHudView: View {
    @ObservedObject var workoutManager: WorkoutManager
    
    var body: some View {
        VStack(spacing: 4) {
            // Cabecera: Estado dinámico y cronómetro
            HStack {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                Text(workoutManager.currentStatus)
                    .font(.system(size: 11, weight: .black))
                    .foregroundColor(statusColor)
                Spacer()
                Text(formatTime(workoutManager.elapsedTime))
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 4)
            
            if workoutManager.inWave {
                // ==============================================
                // VISTA EN LA OLA: MÁXIMA VISIBILIDAD BAJO EL AGUA
                // ==============================================
                VStack(spacing: 2) {
                    Text("VELOCIDAD")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.51))
                    
                    HStack(alignment: .firstTextBaseline, spacing: 2) {
                        Text(String(format: "%.1f", workoutManager.currentSpeedKmH))
                            .font(.system(size: 52, weight: .black, design: .rounded))
                            .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.51)) // Verde neón
                        Text("KM/H")
                            .font(.system(size: 11, weight: .black))
                            .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.51))
                    }
                    
                    // Datos de planeo de la ola actual
                    HStack(spacing: 12) {
                        Text("\(workoutManager.currentWaveDistance) m")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                        Text("·")
                            .foregroundColor(.gray)
                        Text("\(Int(workoutManager.currentWaveTime)) s")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                        if let turn = workoutManager.lastTurnLabel {
                            Text("·")
                                .foregroundColor(.gray)
                            Text(turn)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(Color(red: 0.22, green: 0.74, blue: 0.97))
                        }
                    }
                }
                .padding(.vertical, 4)
                .frame(maxWidth: .infinity)
                .background(Color(red: 0.02, green: 0.20, blue: 0.12).opacity(0.85))
                .cornerRadius(10)
            } else {
                // ==============================================
                // VISTA DE ESPERA / LINEUP: CONTADOR Y ÚLTIMA OLA
                // ==============================================
                VStack(spacing: 0) {
                    Text("\(workoutManager.waveCount)")
                        .font(.system(size: 44, weight: .black, design: .rounded))
                        .foregroundColor(Color(red: 0.22, green: 0.74, blue: 0.97)) // Cian Surfline
                    Text("OLAS SURFEADAS")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.gray)
                }
                
                // Tarjeta de la Última Ola
                if let last = workoutManager.lastWave {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text("ÚLTIMA OLA #\(last.waveNumber)")
                                .font(.system(size: 9, weight: .black))
                                .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.51))
                            Spacer()
                            Text(String(format: "%.1f km/h", last.topSpeedKmH))
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                        }
                        Text("\(last.distanceMeters) m · \(last.durationSeconds) s · \(last.turnsCount) giros")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundColor(.gray)
                    }
                    .padding(6)
                    .frame(maxWidth: .infinity)
                    .background(Color(white: 0.12))
                    .cornerRadius(8)
                }
                
                // Fila inferior de métricas rápidas
                HStack(spacing: 8) {
                    HStack(spacing: 3) {
                        Image(systemName: "heart.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.red)
                        Text(workoutManager.heartRate > 0 ? "\(Int(workoutManager.heartRate))" : "--")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                    }
                    Spacer()
                    Text("\(workoutManager.paddleStrokes) remadas")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.gray)
                }
                .padding(.horizontal, 6)
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, 4)
    }
    
    private var statusColor: Color {
        switch workoutManager.currentStatus {
        case "EN LA OLA":
            return Color(red: 0.06, green: 0.73, blue: 0.51) // Verde
        case "REMANDO":
            return Color(red: 0.22, green: 0.74, blue: 0.97) // Cian
        case "PAUSADO":
            return Color.yellow
        default:
            return Color.gray
        }
    }
    
    private func formatTime(_ seconds: TimeInterval) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%02d:%02d", mins, secs)
    }
}

// MARK: - Pestaña 1: Biometría y Rendimiento Cardíaco
struct BiometricsPageView: View {
    @ObservedObject var workoutManager: WorkoutManager
    
    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text("BIOMETRÍA Y ESFUERZO")
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.gray)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                // Pulsaciones
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("PULSACIONES")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.gray)
                        Text(workoutManager.heartRate > 0 ? "\(Int(workoutManager.heartRate)) BPM" : "-- BPM")
                            .font(.system(size: 18, weight: .black))
                            .foregroundColor(.red)
                    }
                    Spacer()
                    // Zona cardíaca
                    Text(heartRateZoneLabel)
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color.red.opacity(0.2))
                        .foregroundColor(.red)
                        .cornerRadius(6)
                }
                .padding(8)
                .background(Color(white: 0.12))
                .cornerRadius(8)
                
                // Oxígeno SpO2 y Calorías
                HStack(spacing: 6) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("OXÍGENO")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.gray)
                        Text("\(Int(workoutManager.oxygenSaturation))%")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(Color(red: 0.22, green: 0.74, blue: 0.97))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(6)
                    .background(Color(white: 0.12))
                    .cornerRadius(8)
                    
                    VStack(alignment: .leading, spacing: 1) {
                        Text("CALORÍAS")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.gray)
                        Text("\(Int(workoutManager.activeCalories)) kcal")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.orange)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(6)
                    .background(Color(white: 0.12))
                    .cornerRadius(8)
                }
                
                // Remadas y Distancia en el Mar
                HStack(spacing: 6) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("REMADAS")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.gray)
                        Text("\(workoutManager.paddleStrokes)")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(6)
                    .background(Color(white: 0.12))
                    .cornerRadius(8)
                    
                    VStack(alignment: .leading, spacing: 1) {
                        Text("DISTANCIA")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.gray)
                        Text(String(format: "%.2f km", Double(workoutManager.totalDistanceMeters) / 1000.0))
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(6)
                    .background(Color(white: 0.12))
                    .cornerRadius(8)
                }
            }
            .padding(.horizontal, 4)
        }
    }
    
    private var heartRateZoneLabel: String {
        let hr = workoutManager.heartRate
        if hr < 110 { return "CALENTAMIENTO" }
        if hr < 140 { return "AERÓBICA" }
        if hr < 165 { return "INTENSA" }
        return "MÁXIMA"
    }
}

// MARK: - Pestaña 2: Desglose de Olas de la Sesión
struct WavesListView: View {
    @ObservedObject var workoutManager: WorkoutManager
    
    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text("HISTORIAL DE OLAS (\(workoutManager.completedWaves.count))")
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(Color(red: 0.22, green: 0.74, blue: 0.97))
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                if workoutManager.completedWaves.isEmpty {
                    Text("Aún no has cogido ninguna ola.\nSupera 11 km/h para registrar tu primera ola.")
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                        .padding(.top, 20)
                } else {
                    ForEach(workoutManager.completedWaves.reversed()) { w in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text("OLA #\(w.waveNumber)")
                                    .font(.system(size: 11, weight: .black))
                                    .foregroundColor(Color(red: 0.06, green: 0.73, blue: 0.51))
                                Spacer()
                                Text(String(format: "%.1f km/h", w.topSpeedKmH))
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            
                            HStack {
                                Text("\(w.distanceMeters) m")
                                Text("·")
                                Text("\(w.durationSeconds) s")
                                Text("·")
                                Text("\(w.turnsCount) giros")
                            }
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.gray)
                        }
                        .padding(6)
                        .frame(maxWidth: .infinity)
                        .background(Color(white: 0.12))
                        .cornerRadius(8)
                    }
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

// MARK: - Pestaña 3: Controles en el Agua
struct WaterControlsView: View {
    @ObservedObject var workoutManager: WorkoutManager
    @Binding var showingEndConfirmation: Bool
    
    var body: some View {
        VStack(spacing: 8) {
            // Botón Bloqueo de Agua
            Button {
                workoutManager.lockWater()
            } label: {
                HStack {
                    Image(systemName: "drop.fill")
                        .foregroundColor(.blue)
                    Text("BLOQUEO DE AGUA")
                        .font(.system(size: 11, weight: .bold))
                }
            }
            .tint(Color(red: 0.05, green: 0.25, blue: 0.45))
            
            // Botón Pausar / Reanudar
            Button {
                workoutManager.togglePause()
            } label: {
                HStack {
                    Image(systemName: workoutManager.isPaused ? "play.fill" : "pause.fill")
                    Text(workoutManager.isPaused ? "REANUDAR" : "PAUSAR")
                        .font(.system(size: 11, weight: .bold))
                }
            }
            .tint(workoutManager.isPaused ? Color.green : Color.orange)
            
            // Botón Finalizar Sesión
            Button(role: .destructive) {
                showingEndConfirmation = true
            } label: {
                HStack {
                    Image(systemName: "xmark.circle.fill")
                    Text("FINALIZAR SESIÓN")
                        .font(.system(size: 11, weight: .bold))
                }
            }
        }
        .padding(.horizontal, 6)
    }
}
