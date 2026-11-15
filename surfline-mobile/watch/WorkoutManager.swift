import Foundation
import HealthKit
import CoreMotion
import CoreLocation
import WatchKit
import WatchConnectivity

public struct WatchWaveRecord: Identifiable, Codable {
    public var id: String
    public var waveNumber: Int
    public var topSpeedKmH: Double
    public var distanceMeters: Int
    public var durationSeconds: Int
    public var turnsCount: Int
    public var maneuvers: [String]
    public var timestamp: TimeInterval
}

public struct WatchGpsPoint: Codable {
    public var lat: Double
    public var lon: Double
    public var speedKmH: Double
    public var heading: Double
    public var altitude: Double
    public var timestamp: TimeInterval
}

@MainActor
public class WorkoutManager: NSObject, ObservableObject {
    public let healthStore = HKHealthStore()
    private let motionManager = CMMotionManager()
    private let locationManager = CLLocationManager()
    
    @Published public var selectedSpot: String = "Planetario"
    @Published public var isRunning: Bool = false
    @Published public var isPaused: Bool = false
    @Published public var currentStatus: String = "ESPERANDO"
    @Published public var inWave: Bool = false
    
    // Métricas en tiempo real
    @Published public var waveCount: Int = 0
    @Published public var topSpeedKmH: Double = 0.0
    @Published public var currentSpeedKmH: Double = 0.0
    @Published public var heartRate: Double = 0.0
    @Published public var oxygenSaturation: Double = 98.0
    @Published public var activeCalories: Double = 0.0
    @Published public var paddleStrokes: Int = 0
    @Published public var totalDistanceMeters: Int = 0
    @Published public var elapsedTime: TimeInterval = 0.0
    @Published public var showingSummary: Bool = false
    
    // Ola actual y última ola
    @Published public var lastWave: WatchWaveRecord? = nil
    @Published public var completedWaves: [WatchWaveRecord] = []
    @Published public var currentWaveTime: TimeInterval = 0.0
    @Published public var currentWaveDistance: Int = 0
    @Published public var currentWaveTurns: Int = 0
    @Published public var lastTurnLabel: String? = nil
    
    // Recorrido GPS completo sincronizado
    @Published public var gpsRoute: [WatchGpsPoint] = []
    
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var timer: Timer?
    
    // Detección cinemática en muñeca
    private var lastPeakTime: TimeInterval = 0
    private var isArmedForPaddle: Bool = true
    private var waveStartTime: TimeInterval = 0
    private var waveStartLocation: CLLocation?
    private var lastWaveLocation: CLLocation?
    private var waveSpeedLowSince: TimeInterval = 0
    private var currentManeuvers: [String] = []
    private var accumulatedTurnAngle: Double = 0.0
    
    public override init() {
        super.init()
        setupWatchConnectivity()
        setupLocationManager()
    }
    
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = 1.0
    }
    
    // MARK: - Autorizaciones de Salud y Localización
    public func requestAuthorization() async -> Bool {
        locationManager.requestWhenInUseAuthorization()
        
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        
        let typesToShare: Set<HKSampleType> = [
            HKQuantityType.workoutType(),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.distancePaddleSports)
        ]
        
        let typesToRead: Set<HKObjectType> = [
            HKQuantityType(.heartRate),
            HKQuantityType(.oxygenSaturation),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.distancePaddleSports),
            HKQuantityType.workoutType()
        ]
        
        do {
            try await healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead)
            return true
        } catch {
            print("Error solicitando autorización HealthKit: \(error)")
            return false
        }
    }
    
    // MARK: - Inicio de Sesión de Surf
    public func startWorkout(spotName: String) {
        selectedSpot = spotName
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .surfingSports
        configuration.locationType = .outdoor
        
        do {
            session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            builder = session?.associatedWorkoutBuilder()
            
            builder?.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )
            
            session?.delegate = self
            builder?.delegate = self
            
            let startDate = Date()
            session?.startActivity(with: startDate)
            builder?.beginCollection(withStart: startDate) { success, error in
                if success {
                    print("Live collection de surf iniciada correctamente")
                }
            }
            
            // Iniciar GPS en agua
            locationManager.startUpdatingLocation()
            
            isRunning = true
            isPaused = false
            currentStatus = "ESPERANDO"
            waveCount = 0
            topSpeedKmH = 0.0
            currentSpeedKmH = 0.0
            heartRate = 0.0
            oxygenSaturation = 98.0
            activeCalories = 0.0
            paddleStrokes = 0
            totalDistanceMeters = 0
            elapsedTime = 0.0
            inWave = false
            completedWaves = []
            gpsRoute = []
            lastWave = nil
            
            // Activar Bloqueo de Agua para evitar pulsaciones accidentales por gotas de mar
            WKInterfaceDevice.current().enableWaterLock()
            
            // Iniciar sensores cinemáticos a 25 Hz
            startMotionSensors()
            
            // Cronómetro de sesión
            timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard let self = self, self.isRunning, !self.isPaused else { return }
                    self.elapsedTime += 1.0
                    if self.inWave {
                        self.currentWaveTime = Date().timeIntervalSince1970 - self.waveStartTime
                    }
                }
            }
            
            // Vibración inicial de confirmación
            WKInterfaceDevice.current().play(.start)
        } catch {
            print("Error creando HKWorkoutSession para surf: \(error)")
        }
    }
    
    // MARK: - Bloqueo Manual de Agua
    public func lockWater() {
        WKInterfaceDevice.current().enableWaterLock()
    }
    
    // MARK: - Pausar / Reanudar Sesión
    public func togglePause() {
        guard let session = session else { return }
        if isPaused {
            session.resume()
            isPaused = false
            currentStatus = inWave ? "EN LA OLA" : "ESPERANDO"
            WKInterfaceDevice.current().play(.start)
        } else {
            session.pause()
            isPaused = true
            currentStatus = "PAUSADO"
            WKInterfaceDevice.current().play(.stop)
        }
    }
    
    // MARK: - Fin de Sesión
    public func endWorkout() {
        guard let session = session, let builder = builder else { return }
        
        timer?.invalidate()
        timer = nil
        stopMotionSensors()
        locationManager.stopUpdatingLocation()
        
        if inWave {
            finishCurrentWave()
        }
        
        session.end()
        builder.endCollection(withEnd: Date()) { [weak self] success, error in
            builder.finishWorkout { workout, error in
                Task { @MainActor [weak self] in
                    guard let self = self else { return }
                    self.isRunning = false
                    self.isPaused = false
                    self.showingSummary = true
                    self.syncSessionWithPhone()
                    WKInterfaceDevice.current().play(.success)
                }
            }
        }
    }
    
    // MARK: - Sensores Cinemáticos (Acelerómetro + Giroscopio)
    private func startMotionSensors() {
        guard motionManager.isDeviceMotionAvailable else { return }
        
        motionManager.deviceMotionUpdateInterval = 1.0 / 25.0 // 25 Hz
        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, error in
            guard let self = self, let motion = motion else { return }
            self.processMotionSample(motion)
        }
    }
    
    private func stopMotionSensors() {
        if motionManager.isDeviceMotionActive {
            motionManager.stopDeviceMotionUpdates()
        }
    }
    
    private func processMotionSample(_ motion: CMDeviceMotion) {
        guard isRunning, !isPaused else { return }
        let userAccel = motion.userAcceleration
        let rotRate = motion.rotationRate
        let forwardArmAccel = hypot(userAccel.x, userAccel.y)
        let now = Date().timeIntervalSince1970
        
        if inWave {
            // Detección de giros y maniobras con el giroscopio durante la ola
            let degPerSecZ = abs(rotRate.z * (180.0 / .pi))
            accumulatedTurnAngle += degPerSecZ * (1.0 / 25.0)
            
            if accumulatedTurnAngle > 40.0 {
                let maneuverName: String
                if degPerSecZ > 75.0 && accumulatedTurnAngle > 80.0 {
                    maneuverName = "Snap radical"
                } else if accumulatedTurnAngle > 70.0 {
                    maneuverName = "Cutback"
                } else {
                    maneuverName = "Bottom turn"
                }
                
                if !currentManeuvers.contains(maneuverName) {
                    currentManeuvers.append(maneuverName)
                    currentWaveTurns += 1
                    lastTurnLabel = "\(maneuverName) (\(Int(accumulatedTurnAngle))°)"
                    WKInterfaceDevice.current().play(.click)
                }
                accumulatedTurnAngle = 0.0
            }
        } else {
            // Detección de remadas en muñeca
            if isArmedForPaddle {
                if forwardArmAccel > 0.32 {
                    let interval = now - lastPeakTime
                    if interval >= 0.55 && interval <= 2.2 {
                        paddleStrokes += 1
                        lastPeakTime = now
                        isArmedForPaddle = false
                        currentStatus = "REMANDO"
                    } else if interval > 2.2 {
                        paddleStrokes += 1
                        lastPeakTime = now
                        isArmedForPaddle = false
                        currentStatus = "REMANDO"
                    }
                }
            } else if forwardArmAccel < 0.15 {
                isArmedForPaddle = true
            }
        }
    }
    
    // MARK: - Procesamiento de Ubicación GPS
    public func handleLocationUpdate(_ location: CLLocation) {
        guard isRunning, !isPaused else { return }
        
        let speedMps = max(0.0, location.speed)
        let speedKmH = speedMps * 3.6
        currentSpeedKmH = round(speedKmH * 10) / 10
        if speedKmH > topSpeedKmH {
            topSpeedKmH = currentSpeedKmH
        }
        
        let now = location.timestamp.timeIntervalSince1970
        let heading = location.course >= 0 ? location.course : 0.0
        
        // Guardar punto para mapa 3D
        let point = WatchGpsPoint(
            lat: location.coordinate.latitude,
            lon: location.coordinate.longitude,
            speedKmH: currentSpeedKmH,
            heading: heading,
            altitude: location.altitude,
            timestamp: now
        )
        gpsRoute.append(point)
        
        // Acumular distancia total
        if let prev = lastWaveLocation {
            let dist = location.distance(from: prev)
            totalDistanceMeters += Int(dist)
        }
        lastWaveLocation = location
        
        // Lógica de detección de olas: umbral > 11 km/h
        if !inWave {
            if speedKmH >= 11.0 {
                startWave(at: location, speedKmH: speedKmH, now: now)
            } else if speedKmH > 2.5 {
                currentStatus = "REMANDO"
            } else {
                currentStatus = "ESPERANDO"
            }
        } else {
            // En la ola: acumular distancia de planeo
            if let startLoc = waveStartLocation {
                currentWaveDistance = Int(location.distance(from: startLoc))
            }
            
            // Condición de final de ola: velocidad < 6 km/h durante 2.2 segundos
            if speedKmH < 6.0 {
                if waveSpeedLowSince == 0 {
                    waveSpeedLowSince = now
                } else if (now - waveSpeedLowSince) > 2.2 {
                    finishCurrentWave()
                }
            } else {
                waveSpeedLowSince = 0
            }
        }
    }
    
    private func startWave(at location: CLLocation, speedKmH: Double, now: TimeInterval) {
        inWave = true
        currentStatus = "EN LA OLA"
        waveStartTime = now
        waveStartLocation = location
        waveSpeedLowSince = 0
        currentWaveDistance = 0
        currentWaveTurns = 0
        currentWaveTime = 0
        currentManeuvers = []
        accumulatedTurnAngle = 0
        lastTurnLabel = nil
        
        // Doble vibración háptica al coger la ola
        WKInterfaceDevice.current().play(.directionUp)
    }
    
    private func finishCurrentWave() {
        guard inWave else { return }
        inWave = false
        waveCount += 1
        currentStatus = "ESPERANDO"
        
        let dur = max(1, Int(Date().timeIntervalSince1970 - waveStartTime))
        let waveRecord = WatchWaveRecord(
            id: "wave_\(Date().timeIntervalSince1970)",
            waveNumber: waveCount,
            topSpeedKmH: currentSpeedKmH > 0 ? currentSpeedKmH : topSpeedKmH,
            distanceMeters: max(10, currentWaveDistance),
            durationSeconds: dur,
            turnsCount: currentWaveTurns,
            maneuvers: currentManeuvers,
            timestamp: waveStartTime
        )
        
        lastWave = waveRecord
        completedWaves.append(waveRecord)
        
        // Pulso háptico de ola finalizada con éxito
        WKInterfaceDevice.current().play(.success)
        
        // Sincronizar actualización con el iPhone
        syncSessionWithPhone()
    }
    
    // MARK: - Sincronización con iPhone (WatchConnectivity)
    private func setupWatchConnectivity() {
        if WCSession.isSupported() {
            let wcSession = WCSession.default
            wcSession.delegate = self
            wcSession.activate()
        }
    }
    
    public func syncSessionWithPhone() {
        guard WCSession.default.isReachable else { return }
        
        let wavesDict = completedWaves.map { w -> [String: Any] in
            return [
                "id": w.id,
                "waveNumber": w.waveNumber,
                "topSpeedKmH": w.topSpeedKmH,
                "distanceMeters": w.distanceMeters,
                "durationSeconds": w.durationSeconds,
                "turnsCount": w.turnsCount,
                "maneuvers": w.maneuvers,
                "timestamp": w.timestamp
            ]
        }
        
        let gpsDict = gpsRoute.map { p -> [String: Any] in
            return [
                "lat": p.lat,
                "lon": p.lon,
                "speedKmH": p.speedKmH,
                "heading": p.heading,
                "altitude": p.altitude,
                "timestamp": p.timestamp
            ]
        }
        
        let sessionData: [String: Any] = [
            "spotName": selectedSpot,
            "waves": waveCount,
            "topSpeed": topSpeedKmH,
            "currentSpeed": currentSpeedKmH,
            "heartRate": heartRate,
            "oxygenSaturation": oxygenSaturation,
            "calories": activeCalories,
            "strokes": paddleStrokes,
            "totalDistanceMeters": totalDistanceMeters,
            "elapsedTime": elapsedTime,
            "status": currentStatus,
            "inWave": inWave,
            "completedWaves": wavesDict,
            "gpsRoute": gpsDict
        ]
        
        WCSession.default.sendMessage(sessionData, replyHandler: nil) { error in
            print("Error enviando telemetría al iPhone: \(error)")
        }
    }
}

// MARK: - CLLocationManagerDelegate
extension WorkoutManager: CLLocationManagerDelegate {
    nonisolated public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }
        Task { @MainActor in
            self.handleLocationUpdate(latest)
        }
    }
    
    nonisolated public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("CLLocationManager error en Apple Watch: \(error)")
    }
}

// MARK: - HKWorkoutSessionDelegate
extension WorkoutManager: @preconcurrency HKWorkoutSessionDelegate {
    public func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        // Estado del workout
    }
    
    public func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("HKWorkoutSession falló: \(error)")
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate
extension WorkoutManager: @preconcurrency HKLiveWorkoutBuilderDelegate {
    public func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
        // Eventos en vivo
    }
    
    public func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }
            
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                
                // Actualizar Frecuencia Cardíaca
                if quantityType == HKQuantityType(.heartRate) {
                    if let statistics = workoutBuilder.statistics(for: quantityType) {
                        let bpmUnit = HKUnit.count().unitDivided(by: .minute())
                        if let value = statistics.mostRecentQuantity()?.doubleValue(for: bpmUnit) {
                            self.heartRate = round(value)
                        }
                    }
                }
                
                // Actualizar Calorías Activas
                if quantityType == HKQuantityType(.activeEnergyBurned) {
                    if let statistics = workoutBuilder.statistics(for: quantityType) {
                        let kcalUnit = HKUnit.kilocalorie()
                        if let value = statistics.sumQuantity()?.doubleValue(for: kcalUnit) {
                            self.activeCalories = round(value)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - WCSessionDelegate
extension WorkoutManager: @preconcurrency WCSessionDelegate {
    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Activación WCSession completada
    }
}
