// This file holds the default database for the Speaker Design Tool.
// This variable will be available globally to app.js.
// These default items are protected and cannot be deleted.

const DEFAULT_DATABASE = {
    speakers: {
        'Default Speaker': { 
            brand: 'Default', 
            impedance: 8, 
            wattage_rms: 100, 
            wattage_peak: 200, 
            max_spl: 100, 
            taps: '30,15,7.5', 
            type: 'Both', 
            category: 'small_fullrange' 
        }
    },
    cables: {
        'Default Cable 1.5mm²': { 
            brand: 'Generic', 
            model: 'OFC', 
            resistance: 12.1 
        }
    },
    amplifiers: {
        'Default Amplifier': { 
            brand: 'Default', 
            df: 100, 
            df_rated_at: 8, 
            min_load: 2, 
            watt_8: 250, 
            watt_4: 500, 
            watt_2: 0, 
            watt_100v: 500, 
            min_load_bridge: 4, 
            watt_bridge_8: 1000, 
            watt_bridge_4: 0
        }
    }
};