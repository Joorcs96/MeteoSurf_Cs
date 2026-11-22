import SwiftUI

struct WatchSummaryView: View {
    @ObservedObject var workoutManager: WorkoutManager
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("RESUMEN DE SESIÓN")
                    .font(.system(size: 13, weight: .black))
                    .foregroundColor(Color(red: 0.22, green: 0.74, blue: 0.97))
                
                Text(workoutManager.selectedSpot.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.gray)
                
                Divider()
                
                SummaryRow(title: "Olas Surfeadas", value: "\(workoutManager.waveCount)")
                SummaryRow(title: "Velocidad Máxima", value: String(format: "%.1f km/h", workoutManager.topSpeedKmH))
                SummaryRow(title: "Distancia en Olas", value: "\(longestWaveDistance) m (máx)")
                SummaryRow(title: "Tiempo en Agua", value: formatTime(workoutManager.elapsedTime))
                SummaryRow(title: "Pulsaciones Medias", value: workoutManager.heartRate > 0 ? "\(Int(workoutManager.heartRate)) bpm" : "--")
                SummaryRow(title: "Oxígeno SpO2", value: "\(Int(workoutManager.oxygenSaturation))%")
                SummaryRow(title: "Remadas Totales", value: "\(workoutManager.paddleStrokes)")
                SummaryRow(title: "Calorías Quemadas", value: "\(Int(workoutManager.activeCalories)) kcal")
                SummaryRow(title: "Ruta 3D Guardada", value: "\(workoutManager.gpsRoute.count) pts")
                
                Button("GUARDAR Y CERRAR") {
                    workoutManager.showingSummary = false
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.01, green: 0.52, blue: 0.78))
                .padding(.top, 8)
            }
            .padding(.horizontal, 6)
        }
    }
    
    private var longestWaveDistance: Int {
        workoutManager.completedWaves.map { $0.distanceMeters }.max() ?? 0
    }
    
    private func formatTime(_ seconds: TimeInterval) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%02d:%02d", mins, secs)
    }
}

struct SummaryRow: View {
    let title: String
    let value: String
    
    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 11))
                .foregroundColor(.gray)
            Spacer()
            Text(value)
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(.white)
        }
    }
}
