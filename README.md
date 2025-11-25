**## Speaker Design Tool v3.0**

  

**A professional-grade, browser-based simulation engine for designing Low-Impedance (Low-Z) and Distributed (100V/70V) audio systems.**

[**Download Latest Version**](https://github.com/sindrehaugen/SpeakerDesignTool/archive/refs/heads/main.zip)

-----

## 📖 Overview

The **Speaker Design Tool** bridges the gap between theoretical electrical engineering and practical audio system design. Unlike simple calculators that only look at DC resistance, this tool features a comprehensive **Physics Engine** that simulates the entire electrical signal chain.

From the amplifier rack to the speaker voice coil, it models complex cable impedance (thermal & reactive), voltage drops, and frequency-dependent losses. Designed for AV integrators and consultants, it ensures designs meet critical performance and safety standards (IEC 60268-3) before a single cable is pulled.

-----

## ✨ What's New in v3.0

  * **Recursive Calculation Engine:** Now supports infinite "Daisy Chain" depth with hierarchical ID generation (`L-1`, `L-1.1`, `L-1.2`).
  * **Advanced Reporting Suite:**
      * **PDF:** Client-ready reports with custom logos, project summaries, and visual status indicators.
      * **Excel/BOM:** One-click export of Bill of Materials and Cabling Schedules.
  * **Scientific Deep Dive:** Integrated technical reference view explaining the math behind audio transmission.
  * **Cable Wizard:** Brute-force simulation to automatically find the most cost-effective cable that meets your voltage drop targets.

-----

## 🚀 Key Features

### 1\. Advanced Physics Engine

  * **Complex Impedance Modeling:** Calculates $Z = R + jX_L$ rather than just Resistance ($R$). This ensures accuracy for long cable runs where inductance causes high-frequency roll-off.
  * **Thermal Thermodynamics:** Automatically applies linear thermal derating to copper cabling based on ambient temperature inputs (0.393% resistance increase per °C).
  * **Dynamic Headroom Analysis:** Monitors amplifier loading in real-time, warning of clipping risks or low damping factors.

### 2\. Dual Topology Support

  * **Low-Z Mode (4Ω/8Ω):**
      * Tracks Minimum vs. Nominal Load.
      * Calculates Damping Factor at the speaker terminal.
      * Bridge Mode (BTL) support.
  * **High-V Mode (100V/70V):**
      * Tracks Transformer Saturation risks.
      * Calculates exact voltage at every tap.
      * Total Power summation.

### 3\. Smart Database & Portability

  * **Embedded Database:** Includes `speakers_db.csv`, `amplifiers_db.csv`, and `cables_db.csv` with specs from major manufacturers (Bose, QSC, Yamaha, Audac, etc.).
  * **CRUD Management:** Add, Edit, or Delete equipment directly within the browser.
  * **Smart Save:** Projects are saved as `.json` files. You can choose to **bundle your database** inside the save file, ensuring the project works on any computer regardless of their local library.

-----

## 📐 Technical Standards

The tool evaluates your design dynamically based on your selected **Quality Standard**:

| Metric | High-End (Reference) | Average (BGM) | Speech (Paging) | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Voltage Drop** | Warning: \> 5% <br> Error: \> 7.5% | Warning: \> 10% <br> Error: \> 15% | Warning: \> 15% <br> Error: \> 22.5% | Dynamics, Compression |
| **Damping Factor** | Warning: \< 20 <br> Error: \< 10 | Warning: \< 10 <br> Error: \< 5 | Warning: \< 5 <br> Error: \< 2 | Bass Tightness |
| **HF Check Freq** | 10 kHz | 6 kHz | 4 kHz | Clarity / "Air" |

-----

## 🧮 The Math

We utilize vector mathematics to account for phase angles between the inductive cable properties and the resistive load.

1.  **Thermal Resistance ($R_{hot}$):**
    $$R_{hot} = R_{20} \cdot [1 + 0.00393 \cdot (T_{amb} - 20)]$$
2.  **Complex Impedance ($Z$):**
    $$Z_{cable} = R_{hot} + j \cdot (2\pi \cdot f \cdot L)$$
3.  **Electrical SPL Loss:**
    $$L_{dB} = 20 \cdot \log_{10} \left( \frac{V_{load}}{V_{source}} \right)$$

-----

## 🛠️ Quick Start

1.  **Download:** Get the latest release and unzip the folder.
2.  **Launch:** Open `Speaker Design Tool.html` in any modern web browser (Chrome, Edge, Firefox, Safari). No internet connection or installation required.
3.  **Configure:** Set your project name and ambient temperature (e.g., 40°C for ceiling voids).
4.  **Build:**
      * Select **Low-Z** or **100V** mode.
      * Add an Amplifier.
      * Add a Speaker Line.
      * Use the **Down Arrow (↓)** to daisy-chain speakers.
5.  **Analyze:** Watch the dashboard for colored Status indicators. Use the **Cable Wizard (🪄)** to fix voltage drop issues.
6.  **Export:** Go to the **Reports** tab to generate your PDF documentation or Excel BOM.

-----

## 📦 Included Library

The tool comes pre-populated with specifications for professional equipment from:

  * **Speakers:** Audac, Biamp, Bose Professional, Blaze Audio, EAW, JBL Professional, K-array, LD Systems, Martin Audio, QSC, Sonance, Yamaha.
  * **Amplifiers:** Crown, LEA Professional, Powersoft, Lab Gruppen, Dynacord.
  * **Cables:** Belden, Canare, Klotz, Sommer, Van Damme, West Penn.

-----

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. You are free to use, modify, and distribute this software.
