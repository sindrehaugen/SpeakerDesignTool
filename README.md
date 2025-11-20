# **Speaker Design Tool v2.0.2**

A professional-grade, browser-based calculator for designing Low-Impedance (Low-Z) and High-Impedance (100V) audio systems.

## **📖 Overview**

The **Speaker Design Tool** bridges the gap between electrical engineering and audio system design. It features a comprehensive **Physics Engine** that simulates the electrical signal chain: from the amplifier, through the complex impedance of cabling (thermal & reactive), to the electrical voltage at the speaker terminals.

Designed for AV integrators and system designers, it ensures your designs meet critical performance and safety standards before installation begins.

## **✨ Key Features**

### **🚀 Advanced Physics Engine**

* **Complex Impedance Modeling:** Calculates $Z = \sqrt{R^2 + X_L^2}$ rather than just DC resistance ($R$), ensuring accuracy for long cable runs and high frequencies.
* **Thermal Derating:** Simulates the increase in copper resistance due to ambient temperature rise (0.393% per °C), critical for fire safety and attic/conduit runs.
* **High-Frequency Loss Analysis:** Calculates audible treble roll-off caused by cable capacitance ($C$) acting as a low-pass filter.
* **Headroom Analysis:** Automatically warns if the total speaker load exceeds safe amplifier capacity (80% for subs/large, 85% for small/satellites).

### **🛠️ Professional Workflow**

* **Dual Topology Calculator:**
    * **Low-Z Mode:** For performance audio (Subs, Arrays). Tracks Min/Nom Load, Voltage Drop, Damping Factor, and Electrical dB Loss.
    * **100V Mode:** For distributed audio (Paging, BGM). Tracks Transformer Saturation, Voltage at Tap, and Total Power.
* **Project Management:** Save and Load your entire calculation tree as a CSV file to continue work later.
* **Custom Labeling:** Name individual cable runs (e.g., "Lobby Left", "Bar Sub") for easier identification.
* **Bill of Materials (BOM):** Automatically generates an equipment list for your project reports.
* **Database Manager:** Full CRUD (Create, Read, Update, Delete) support for your inventory of Speakers, Cables, and Amplifiers.
* **Unified Reporting:** One-click PDF generation with detailed technical breakdowns, pass/fail status, and equipment pick-lists.

## **📐 Technical Standards & Thresholds**

The tool evaluates your design against the following professional standards:

| Metric | Application | Warning Threshold | Critical Error | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Voltage Drop** | Subwoofers / Main PA | > 2.5% | > 5.0% | Loss of headroom, weak transient response. |
| **Voltage Drop** | Fill / Satellite | > 5.0% | > 10.0% | Audible compression, amplifier strain, heat. |
| **Damping Factor** | Low-Z Systems | < 20 | < 10 | "Muddy" bass, loss of cone control. |
| **100V Line Voltage** | Distributed Systems | < 95V | < 90V | Transformer saturation, distortion. |
| **Headroom** | Amp Loading | > 80-85% | > 100% | Clipping, amplifier protection shutdown. |

## **🧮 Math & Formulas**

### **Electrical Transmission**

We calculate voltage drop using vector math to account for phase angles between the inductive cable and resistive load.

* **Cable Resistance ($R_{hot}$):** $R_{20} \cdot (1 + 0.00393 \cdot (T_{amb} - 20))$
* **Inductive Reactance ($X_L$):** $2 \cdot \pi \cdot f \cdot L$
* **Total Impedance ($Z$):** $\sqrt{R_{hot}^2 + X_L^2}$
* **Electrical SPL Loss:** $20 \cdot \log_{10}(V_{load} / V_{source})$

## **🚀 Quick Start**

1.  **Run:** Open `Speaker Design Tool.html` in any modern web browser (Chrome, Edge, Firefox).
2.  **Configure:** Set your **Project Name** and **Ambient Temperature** (top right).
3.  **Select Mode:** Toggle between **Low-Z** and **100V**.
4.  **Build:** Select an amplifier and start adding speakers.
    * **Daisy Chaining:** To chain speakers, add a new calculation and set the "Source" dropdown to the ID of the previous speaker.
5.  **Analyze:** Watch the live dashboard for **Warnings** or **Errors**.
6.  **Save/Report:** Use "Save Project" to backup your work, or go to the **Reports** tab to generate a PDF documentation package.

## **📄 License**

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. You are free to use, modify, and distribute this software.
