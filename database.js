/**
 * Speaker Design Tool v2.5 - Default Database
 */

const SYSTEM_DEFAULTS = {
    physics: {
        base_temperature_c: 20,
        temp_coefficient_copper: 0.00393,
        default_frequency_check: 10000
    }
};

const DEFAULT_DATABASE = {
    speakers: {
        'Default Speaker': { 
            brand: 'Generic', 
            impedance: 8, 
            wattage_rms: 100, 
            wattage_peak: 200, 
            max_spl: 100, 
            taps: '30,15,7.5', 
            type: 'Both', 
            category: 'small_fullrange',
            z_min: 6.4
        }
    },
    cables: {
        'Default Cable 1.5mm²': { 
            brand: 'Generic', 
            model: 'OFC Standard', 
            resistance: 12.1, 
            capacitance: 120, 
            inductance: 0.70
        },
        'Default Cable 2.5mm²': { 
            brand: 'Generic', 
            model: 'OFC Pro', 
            resistance: 7.41, 
            capacitance: 110, 
            inductance: 0.65 
        },
        'Default Cable 4.0mm²': { 
            brand: 'Generic', 
            model: 'OFC Heavy', 
            resistance: 4.61, 
            capacitance: 100, 
            inductance: 0.60 
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
            watt_bridge_4: 0,
            max_voltage_peak: 63.2
        }
    }
};