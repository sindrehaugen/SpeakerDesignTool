# **Speaker Design Tool v2.3.6**

*Download ZIP-file:* https://github.com/sindrehaugen/SpeakerDesignTool/archive/refs/heads/main.zip

A professional-grade, browser-based calculator for designing Low-Impedance (Low-Z) and High-Impedance (100V) audio systems.

## **📖 Overview**

The **Speaker Design Tool** bridges the gap between electrical engineering and audio system design. It features a comprehensive **Physics Engine** that simulates the electrical signal chain: from the amplifier, through the complex impedance of cabling (thermal & reactive), to the electrical voltage at the speaker terminals.

Designed for AV integrators and system designers, it ensures your designs meet critical performance and safety standards before installation begins.

## **✨ Key Features**

### **🚀 Advanced Physics Engine**
* **Complex Impedance Modeling:** Calculates $Z = \sqrt{R^2 + X_L^2}$ rather than just DC resistance ($R$), ensuring accuracy for long cable runs and high frequencies.
* **Thermal Derating:** Simulates the increase in copper resistance due to ambient temperature rise (0.393% per °C).
* **High-Frequency Loss Analysis:** Calculates audible treble roll-off caused by cable capacitance ($C$) acting as a low-pass filter.
* **Dynamic Headroom Analysis:** Automatically warns if the total speaker load exceeds safe amplifier capacity relative to the chosen Quality Standard.

### **🛠️ Professional Workflow**
* **Three Quality Standards:**
    * **High-End:** Strict limits for critical listening and concert audio (< 5% Drop).
    * **Average:** Balanced settings for commercial BGM and retail (< 10% Drop).
    * **Speech:** Optimized for intelligibility and paging systems (< 15-25% Drop).
* **Dual Topology Calculator:**
    * **Low-Z Mode:** Tracks Min/Nom Load, Voltage Drop, Damping Factor, and Electrical dB Loss.
    * **100V Mode:** Tracks Transformer Saturation risks, Voltage at Tap, and Total Power.
* **Smart Project Portability:**
    * **Robust CSV Import:** Automatically resolves conflicts if device IDs change between computers.
    * **Data Verification:** Checks Brand/Model names against your database to ensure data integrity.
* **Database Manager:** Full CRUD (Create, Read, Update, Delete) support with CSV bulk import/export.

## **📐 Technical Standards & Thresholds**

The tool evaluates your design dynamically based on your selected **Quality Standard**:

| Metric | High-End (Reference) | Average (Commercial) | Speech Only (Paging) | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Voltage Drop** | **Warning:** > 5%<br>**Error:** > 10% | **Warning:** > 10%<br>**Error:** > 20% | **Warning:** > 15%<br>**Error:** > 25% | Dynamics, Headroom, Saturation |
| **Damping Factor** | **Warning:** < 20<br>**Error:** < 10 | **Warning:** < 10<br>**Error:** < 5 | **Warning:** < 5<br>**Error:** < 2 | Bass tightness, Transient response |
| **Headroom Safety** | **Limit:** 80% Load | **Limit:** 90% Load | **Limit:** 95% Load | Amplifier Clipping/Shutdown |
| **HF Check Freq** | 10 kHz | 6 kHz | 4 kHz | Treble Roll-off / Clarity |

## **📚 Included Database Library**

The tool comes pre-loaded with specifications for professional equipment from manufacturers including:
**Amadeus Labs, Audac, Biamp, Blaze Audio, Bose Professional, Crown, EAW, JBL, K-array, Lab Gruppen, LD Systems, LEA Professional, Martin Audio, Powersoft, QSC, Yamaha**, and more.

## **🧮 Math & Formulas**

We calculate voltage drop using vector math to account for phase angles between the inductive cable and resistive load.

* **Cable Resistance ($R_{hot}$):** $R_{20} \cdot (1 + 0.00393 \cdot (T_{amb} - 20))$
* **Inductive Reactance ($X_L$):** $2 \cdot \pi \cdot f \cdot L$
* **Total Impedance ($Z$):** $\sqrt{R_{hot}^2 + X_L^2}$
* **Electrical SPL Loss:** $20 \cdot \log_{10}(V_{load} / V_{source})$

## **🚀 Quick Start**

1.  **Configure:** Set your **Project Name** and **Ambient Temperature** (top bar).
2.  **Select Standard:** Choose **High-End**, **Average**, or **Speech** based on the venue type.
3.  **Select Mode:** Toggle between **Low-Z** and **100V**.
4.  **Build:** Select an amplifier and start adding speakers.
    * **Daisy Chaining:** To chain speakers, add a new calculation and set the "Source" dropdown to the ID of the previous speaker.
5.  **Analyze:** Watch the live dashboard for **Warnings** or **Errors**.
6.  **Report:** Go to the **Reports** tab to generate a comprehensive PDF documentation package.

## **📄 License**

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. You are free to use, modify, and distribute this software.
