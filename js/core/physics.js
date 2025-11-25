/**
 * Speaker Design Tool v3.0 - Physics Engine
 * Status: Production Ready
 */

(function () {
    class ComplexNumber {
        constructor(real, imaginary) {
            this.real = real;
            this.imaginary = imaginary;
        }

        add(other) {
            return new ComplexNumber(this.real + other.real, this.imaginary + other.imaginary);
        }

        div(other) {
            const denom = other.real * other.real + other.imaginary * other.imaginary;
            if (denom === 0) return new ComplexNumber(0, 0);
            return new ComplexNumber(
                (this.real * other.real + this.imaginary * other.imaginary) / denom,
                (this.imaginary * other.real - this.real * other.imaginary) / denom
            );
        }

        magnitude() {
            return Math.sqrt((this.real * this.real) + (this.imaginary * this.imaginary));
        }
    }

    class AudioPhysics {
        constructor(config = {}) {
            this.defaults = {
                temp_c: config.base_temperature_c || 20,
                freq_low: 1000,
                freq_high: 10000
            };
            this.CONSTANTS = {
                RESISTIVITY: 1.68e-8, // Copper
                TEMP_COEFF: 0.00393
            };
        }

        getThermalResistance(resistanceOhms, currentTempC) {
            const temp = (currentTempC !== undefined) ? currentTempC : this.defaults.temp_c;
            return resistanceOhms * (1 + (this.CONSTANTS.TEMP_COEFF * (temp - 20)));
        }

        getCableImpedance(cable, lengthMeters, frequency, tempC) {
            if (!cable || !lengthMeters) return new ComplexNumber(0, 0);
            const r_base = (cable.resistance * lengthMeters * 2) / 1000; // Loop resistance
            const r_thermal = this.getThermalResistance(r_base, tempC);
            const L_val = cable.inductance !== undefined ? cable.inductance : 0.6; 
            const total_L_Henry = (L_val * lengthMeters * 2) / 1000000; 
            const xl = 2 * Math.PI * frequency * total_L_Henry;
            return new ComplexNumber(r_thermal, xl);
        }

        calculateTransmission(sourceVoltage, zLoadMagnitude, zCableComplex) {
            const zLoad = new ComplexNumber(zLoadMagnitude, 0);
            const zTotal = zCableComplex.add(zLoad);
            const iBranch = zTotal.magnitude() > 0 ? sourceVoltage / zTotal.magnitude() : 0;
            const vLoadMagnitude = iBranch * zLoad.magnitude();

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

        calculateElectricalSPLLoss(voltageAtLoad, sourceVoltage) {
            if (sourceVoltage <= 0 || voltageAtLoad <= 0) return 0;
            return 20 * Math.log10(voltageAtLoad / sourceVoltage);
        }

        calculateHFLoss(sourceVoltage, zLoad, cable, length, tempC, checkFreq = 10000) {
            if (!cable || !length) return { lossDb: 0, isAudible: false };
            const zLow = this.getCableImpedance(cable, length, 1000, tempC);
            const rLow = this.calculateTransmission(sourceVoltage, zLoad, zLow);
            const zHigh = this.getCableImpedance(cable, length, checkFreq, tempC);
            const rHigh = this.calculateTransmission(sourceVoltage, zLoad, zHigh);

            let db = 0;
            if (rLow.voltageAtLoad > 0 && rHigh.voltageAtLoad > 0) {
                db = 20 * Math.log10(rHigh.voltageAtLoad / rLow.voltageAtLoad);
            }
            return { lossDb: db, isAudible: Math.abs(db) > 0.5 };
        }
    }

    window.App.Core.Physics = {
        AudioPhysics,
        ComplexNumber
    };
    console.log("App.Core.Physics Loaded (v3.0)");
})();