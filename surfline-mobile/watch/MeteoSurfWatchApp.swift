import SwiftUI

@main
struct MeteoSurfWatchApp: App {
    @StateObject private var workoutManager = WorkoutManager()
    
    var body: some Scene {
        WindowGroup {
            NavigationView {
                if workoutManager.isRunning {
                    WatchSessionView(workoutManager: workoutManager)
                } else {
                    WatchStartView(workoutManager: workoutManager)
                }
            }
            .sheet(isPresented: $workoutManager.showingSummary) {
                WatchSummaryView(workoutManager: workoutManager)
            }
            .task {
                _ = await workoutManager.requestAuthorization()
            }
        }
    }
}

struct WatchStartView: View {
    @ObservedObject var workoutManager: WorkoutManager
    
    let spots = ["Planetario", "Gurugu", "Piramides", "Voramar", "Burriana"]
    @State private var selectedIndex = 0
    
    var body: some View {
        VStack(spacing: 10) {
            Text("METEOSURF CS")
                .font(.system(size: 13, weight: .black))
                .foregroundColor(Color(red: 0.22, green: 0.74, blue: 0.97))
            
            Picker("Spot", selection: $selectedIndex) {
                ForEach(0..<spots.count, id: \.self) { i in
                    Text(spots[i]).tag(i)
                }
            }
            .frame(height: 50)
            
            Button {
                workoutManager.startWorkout(spotName: spots[selectedIndex])
            } label: {
                HStack {
                    Image(systemName: "figure.surfing")
                    Text("ENTRAR AL AGUA")
                        .font(.system(size: 11, weight: .bold))
                }
            }
            .tint(Color(red: 0.01, green: 0.52, blue: 0.78))
        }
    }
}
