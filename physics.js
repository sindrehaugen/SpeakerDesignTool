/**
 * Speaker Design Tool v2.6 - Physics Engine
 * Added: Acoustic Propagation (Inverse Square Law) & Speed of Sound
 */
class AudioPhysics {
    constructor(config = {}) {
        this.defaults = { temp_c: config.base_temperature_c || 20, freq_low: 1000, freq_high: 10000 };
        this.CONSTANTS = { RESISTIVITY: 1.68e-8, TEMP_COEFF: 0.00393 };
    }

    // --- Electrical ---

    getThermalResistance(resistanceOhms, currentTempC) {
        const temp = (currentTempC !== undefined) ? currentTempC : this.defaults.temp_c;
        return resistanceOhms * (1 + (this.CONSTANTS.TEMP_COEFF * (temp - 20)));
    }

    getCableImpedance(cable, lengthMeters, frequency, tempC) {
        if (!cable || !lengthMeters) return new ComplexNumber(0, 0);
        const r_base = (cable.resistance * lengthMeters * 2) / 1000; 
        const r_thermal = this.getThermalResistance(r_base, tempC);
        const L_val = cable.inductance !== undefined ? cable.inductance : 0.6;
        const xl = 2 * Math.PI * frequency * ((L_val * lengthMeters * 2) / 1000000);
        return new ComplexNumber(r_thermal, xl);
    }

    calculateTransmission(sourceVoltage, zLoadMagnitude, zCableComplex) {
        const zLoad = new ComplexNumber(zLoadMagnitude, 0);
        const zTotal = zCableComplex.add(zLoad);
        const iBranch = zTotal.magnitude() > 0 ? sourceVoltage / zTotal.magnitude() : 0;
        const vLoadMagnitude = iBranch * zLoad.magnitude();
        
        // Power Calcs
        const powerLoad = Math.pow(iBranch, 2) * zLoadMagnitude;
        const powerSource = Math.pow(iBranch, 2) * (zLoadMagnitude + zCableComplex.real);
        
        const dropPercent = sourceVoltage > 0 ? ((sourceVoltage - vLoadMagnitude) / sourceVoltage) * 100 : 0;

        return {
            voltageAtLoad: vLoadMagnitude,
            current: iBranch,
            dropPercent: dropPercent,
            powerLoad: powerLoad,
            powerSource: powerSource,
            cableResistance: zCableComplex.real,
            totalImpedance: zTotal.magnitude()
        };
    }

    calculateDampingFactor(speakerImpedance, ampOutputImpedance, totalCableResistance) {
        const denom = ampOutputImpedance + totalCableResistance;
        return denom > 0 ? speakerImpedance / denom : 0;
    }

    calculateElectricalSPLLoss(voltageAtLoad, sourceVoltage) {
        if (sourceVoltage <= 0 || voltageAtLoad <= 0) return 0;
        return 20 * Math.log10(voltageAtLoad / sourceVoltage);
    }

    calculateHFLoss(sourceVoltage, zLoad, cable, length, tempC) {
        if (!cable || !length) return { lossDb: 0, isAudible: false };
        const zLow = this.getCableImpedance(cable, length, this.defaults.freq_low, tempC);
        const rLow = this.calculateTransmission(sourceVoltage, zLoad, zLow);
        const zHigh = this.getCableImpedance(cable, length, this.defaults.freq_high, tempC);
        const rHigh = this.calculateTransmission(sourceVoltage, zLoad, zHigh);
        let db = 0;
        if (rLow.voltageAtLoad > 0 && rHigh.voltageAtLoad > 0) {
            db = 20 * Math.log10(rHigh.voltageAtLoad / rLow.voltageAtLoad);
        }
        return { lossDb: db, isAudible: Math.abs(db) > 0.5 };
    }
    
    get100VImpedance(tapPower, lineVoltage = 100) {
        return tapPower > 0 ? Math.pow(lineVoltage, 2) / tapPower : 999999;
    }

    // --- Acoustic (New in v2.6) ---

    /**
     * Calculates the speed of sound based on temperature.
     * c = 331.3 + (0.606 * T)
     */
    getSpeedOfSound(tempC) {
        return 331.3 + (0.606 * (tempC || 20));
    }

    /**
     * Calculates the required delay time for time alignment.
     * t = d / c
     */
    calculateDelayTime(distanceMeters, tempC) {
        if (!distanceMeters || distanceMeters <= 0) return 0;
        const c = this.getSpeedOfSound(tempC);
        return (distanceMeters / c) * 1000; // Result in ms
    }

    /**
     * Calculates SPL at the listener position.
     * Accounts for: Max SPL of speaker, Power Compression (Voltage Drop), and Distance Loss.
     */
    calculateAcousticSPL(maxSpl1m, electricalLossDb, distanceMeters) {
        if (!maxSpl1m) return 0;
        
        // 1. Start with Max SPL at 1m (Theoretical max output)
        // 2. Subtract Electrical Loss (Voltage Drop in cable reduces output)
        const splAtSource = maxSpl1m + electricalLossDb; // electricalLossDb is negative
        
        // 3. Subtract Distance Loss (Inverse Square Law: -6dB per doubling of distance)
        // Formula: SPL_dist = SPL_1m - 20 * log10(distance)
        let distanceLoss = 0;
        if (distanceMeters > 1) {
            distanceLoss = 20 * Math.log10(distanceMeters);
        }
        
        return splAtSource - distanceLoss;
    }
}

class ComplexNumber {
    constructor(real, imaginary) { this.real = real; this.imaginary = imaginary; }
    add(other) { return new ComplexNumber(this.real + other.real, this.imaginary + other.imaginary); }
    magnitude() { return Math.sqrt((this.real * this.real) + (this.imaginary * this.imaginary)); }
}