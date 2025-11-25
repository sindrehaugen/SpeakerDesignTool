/**
 * Speaker Design Tool v3.0 - Default Database
 * Status: Production Ready
 */

(function () {
    const SYSTEM_DEFAULTS = {
        physics: {
            base_temperature_c: 20,
            temp_coefficient_copper: 0.00393,
            default_frequency_check: 10000
        }
    };

    const QUALITY_PROFILES = {
        'high-end': { name: 'Hi-End', maxDrop: 5, color: 'emerald' },
        'average': { name: 'BGM', maxDrop: 10, color: 'amber' },
        'speech': { name: 'Speech', maxDrop: 15, color: 'blue' }
    };

    const DEFAULT_DATABASE = {
        speakers: {
            'Default Speaker': {
                id: 'Default Speaker',
                brand: 'Generic',
                model: 'Standard 8Ω',
                impedance: 8,
                wattage_rms: 100,
                wattage_peak: 200,
                max_spl: 100,
                taps: [30, 15, 7.5],
                type: 'Both',
                category: 'small_fullrange',
                z_min: 6.4
            }
        },
        cables: {
            'Default Cable 1.5mm²': {
                id: 'Default Cable 1.5mm²',
                brand: 'Generic',
                model: 'OFC Standard 1.5mm²',
                resistance: 12.1,
                capacitance: 120,
                inductance: 0.70
            },
            'Default Cable 2.5mm²': {
                id: 'Default Cable 2.5mm²',
                brand: 'Generic',
                model: 'OFC Pro 2.5mm²',
                resistance: 7.41,
                capacitance: 110,
                inductance: 0.65
            },
            'Default Cable 4.0mm²': {
                id: 'Default Cable 4.0mm²',
                brand: 'Generic',
                model: 'OFC Heavy 4.0mm²',
                resistance: 4.61,
                capacitance: 100,
                inductance: 0.60
            }
        },
        amplifiers: {
            'Default Amplifier': {
                id: 'Default Amplifier',
                brand: 'Generic',
                model: 'PowerAmp 500',
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
                max_voltage_peak: 63.2,
                channels_lowz: 2, // Added default channels
                channels_100v: 2
            }
        }
    };

    // Attach to Global Namespace
    window.App.Core.Database = {
        DEFAULTS: SYSTEM_DEFAULTS,
        DATA: DEFAULT_DATABASE,
        PROFILES: QUALITY_PROFILES
    };
    console.log("App.Core.Database Loaded (v3.0)");
})();
