# **Speaker Design Tool v2.0**

A professional-grade, browser-based calculator for designing Low-Impedance (Low-Z) and High-Impedance (100V/70V) audio systems.

## **📖 Overview**

Designed for AV integrators and system designers, it ensures your designs meet critical performance standards before installation begins.

## **✨ Key Features**

### **🚀 Advanced Physics Engine**

* **Complex Impedance Modeling:** Calculates $Z \= \\sqrt{R^2 \+ X\_L^2}$ rather than just DC resistance ($R$), ensuring accuracy for long cable runs and high frequencies.  
* **Thermal Derating:** Simulates the increase in copper resistance due to ambient temperature rise (0.393% per °C), critical for fire safety and attic/conduit runs.  
* **High-Frequency Loss Analysis:** Calculates audible treble roll-off caused by cable capacitance ($C$) acting as a low-pass filter.  
* **Acoustic Propagation:** Uses the Inverse Square Law to predict the actual SPL at the listener's position.

### **🛠️ Professional Workflow**

* **Dual Topology Calculator:**  
  * **Low-Z Mode:** For performance audio (Subs, Arrays). Tracks Voltage Drop, Damping Factor, and SPL Loss.  
  * **100V/70V Mode:** For distributed audio (Paging, BGM). Tracks Transformer Saturation and Total Power.  
* **Time Alignment:** Automatically calculates the required delay time (ms) for fill speakers based on distance and air temperature.  
* **Bill of Materials (BOM):** Automatically generates an equipment list for your project reports.  
* **Database Manager:** Full CRUD (Create, Read, Update, Delete) support for your inventory of Speakers, Cables, and Amplifiers.  
* **Unified Reporting:** One-click PDF generation with detailed technical breakdowns and pass/fail status against industry standards.

## **📐 Technical Standards & Thresholds**

The tool evaluates your design against the following professional standards:

| Metric | Application | Warning Threshold | Critical Hazard | Impact |
| :---- | :---- | :---- | :---- | :---- |
| **Voltage Drop** | Subwoofers / Main PA | \> 2.5% | \> 5.0% | Loss of headroom, weak transient response. |
| **Voltage Drop** | Fill / Satellite | \> 5.0% | \> 10.0% | Audible compression, amplifier strain. |
| **Damping Factor** | Low-Z Systems | \< 20 | \< 10 | "Muddy" bass, loss of cone control. |
| **100V Line Voltage** | Distributed Systems | \< 95V | \< 90V | Transformer saturation, distortion. |

## **🧮 Math & Formulas**

### **1\. Electrical Transmission**

We calculate voltage drop using vector math to account for phase angles between the inductive cable and resistive load.

* **Cable Resistance (**$R\_{hot}$**):** $R\_{20} \\cdot (1 \+ 0.00393 \\cdot (T\_{amb} \- 20))$  
* **Inductive Reactance (**$X\_L$**):** $2 \\cdot \\pi \\cdot f \\cdot L$  
* **Total Impedance (**$Z$**):** $\\sqrt{R\_{hot}^2 \+ X\_L^2}$


## **🚀 Quick Start**

1. **Run:** Open Speaker Design Tool.html in any modern web browser (Chrome, Edge, Firefox).  
2. **Configure:** Set your project name and ambient temperature (top right).  
3. **Build:** Select an amplifier and start adding speakers. Use the "Source" dropdown to daisy-chain speakers together.  
4. **Analyze:** Watch the live dashboard for Warnings or Hazards.  
5. **Report:** Go to the **Reports** tab to generate a PDF documentation package.

## **📄 License**

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. You are free to use, modify, and distribute this software.
