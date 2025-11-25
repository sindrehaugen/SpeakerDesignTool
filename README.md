# Speaker Design Tool v3.0

   

**A professional-grade, browser-based simulation engine for designing Low-Impedance (Low-Z) and Distributed (100V/70V) audio systems.**

[**Download Latest Version**](https://github.com/sindrehaugen/SpeakerDesignTool/archive/refs/heads/main.zip)

-----

## 📖 Overview

The **Speaker Design Tool** bridges the gap between theoretical electrical engineering and practical audio system design. Unlike simple calculators that only look at DC resistance, this tool features a comprehensive **Audio Physics Engine** that simulates the entire electrical signal chain.

From the amplifier rack to the speaker voice coil, it models complex cable impedance (thermal & reactive), voltage drops, and frequency-dependent losses. Designed for AV integrators and consultants, it ensures designs meet critical performance and safety standards (IEC 60268-3) before a single cable is pulled.

-----

## 🏗️ Architecture & Tech Stack

This project is built as a **Serverless Single Page Application (SPA)**. It requires no compilation, no build step, and no backend server. It runs entirely in the browser using modern ES6 modules.

  * **Core Framework:** [Vue.js 3](https://vuejs.org/) (via CDN) - Reactive UI and State Management.
  * **Styling:** [Tailwind CSS](https://tailwindcss.com/) (via CDN) - Utility-first styling.
  * **PDF Generation:** [jsPDF](https://github.com/parallax/jsPDF) & [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) - Client-side report generation.
  * **Persistence:** `localStorage` for auto-saving user preferences and custom databases.

### File Structure

```bash
v3/
├── Speaker Design Tool.html  # Main entry point
├── css/
│   └── style.css             # Custom overrides and animations
└── js/
    ├── core/
    │   ├── physics.js        # Complex Number class & AudioPhysics engine
    │   └── database.js       # Default equipment & Quality Standards
    ├── ui/
    │   ├── main.js           # Main App Logic (State, Actions, Report Gen)
    │   ├── views.js          # View Components (Calculator, Reports, DB)
    │   └── components.js     # UI Components (Modals, Tree Nodes)
    └── utils/
        └── io.js             # File I/O, CSV Parsing, Excel XML Export
```

-----

## ✨ Key Features

### 1\. Adaptive Quality Standards

The tool is context-aware. Instead of using a single fixed limit for "Pass/Fail", it evaluates your design against three distinct **Standard Modes**:

  * **High-End (Reference):** Strict tolerances (\< 5% Voltage Drop, \> 20 Damping Factor). Designed for concert venues, studios, and critical listening environments where audio fidelity is paramount.
  * **Average (BGM):** Balanced thresholds (\< 10% Voltage Drop). Optimized for retail, hospitality, and commercial background music systems where cost-efficiency and performance must meet.
  * **Speech (Paging):** Relaxed limits (\< 15% Voltage Drop). Ideal for 100V EVAC, voice paging, and industrial distributed systems where intelligibility and cable run length are the priority over spectral flatness.

**Dynamic Thresholding:** **The Audio Physics Engine** automatically shifts the trigger points for Warnings (Orange) and Errors (Red) based on the selected mode.

### 2\. The Audio Physics Engine

  * **Infinite Daisy Chaining:** Supports unlimited depth of speaker connections (e.g., `Amp -> Speaker 1 -> Speaker 2 -> ...`).
  * **Complex Impedance:** Calculates $Z = R + jX_L$. It accounts for **Inductive Reactance**, which causes high-frequency roll-off in long cable runs.
  * **Thermal Derating:** Automatically increases copper resistance by **0.393% per °C** based on the ambient temperature setting.

### 3\. Intelligent Workflows

  * **Segmented Cabling:** Supports dual-segment cable runs for real-world installation scenarios.
      * *Example:* Run a heavy-gauge backbone (e.g., 4mm² / 12AWG) for the long 50m distance to a junction box, then step down to a thinner, flexible cable (e.g., 1.5mm² / 16AWG) for the final 3m drop to the speaker to fit into small Euroblock terminals. The engine calculates the combined impedance vector of both segments.
  * **Cable Wizard (🪄):** A brute-force simulation tool. Select a speaker line, and the Wizard runs hundreds of simulations against your entire cable database to find the most cost-effective cable that meets your target Voltage Drop limit. **Works best in combination with the Brand Filter** to instantly find the optimal cable from a specific manufacturer (e.g., finding the perfect *Belden* cable for a specific run).
  * **Smart Brand Filtering:** The calculator includes dynamic filters above every equipment dropdown. Instantly narrow down huge databases to find specific products from manufacturers like *Bose*, *QSC*, or *Biamp*.
  * **Amplifier Channel Tracking:** The system tracks channel usage per amplifier instance (e.g., `A-1`). It visually greys out used channels to prevent over-subscribing an amplifier frame.
  * **Bridge Mode Support:** Toggles amplifier channels into Bridge-Tied Load (BTL) mode, doubling voltage swing and adjusting minimum load thresholds automatically.

### 4\. Data Portability

  * **Self-Contained Project Files:** Save projects as `.json`. You can choose to **embed your custom database** inside the project file, ensuring that if you send the file to a colleague, they see your exact equipment specs even if they don't have them in their library.
  * **Excel Integration:** Exports a multi-sheet `.xls` file containing Bill of Materials (BOM), Cabling Schedules, and Technical Data.

-----

## 📐 Technical Standards Reference

The tool evaluates your design dynamically based on your selected **Quality Standard**:

| Metric | High-End (Reference) | Average (BGM) | Speech (Paging) | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Voltage Drop** | Warning: \> 5% <br> Error: \> 7.5% | Warning: \> 10% <br> Error: \> 15% | Warning: \> 15% <br> Error: \> 22.5% | Dynamics, Compression |
| **Damping Factor** | Warning: \< 20 <br> Error: \< 10 | Warning: \< 10 <br> Error: \< 5 | Warning: \< 5 <br> Error: \< 2 | Bass Tightness |
| **HF Check Freq** | 10 kHz | 6 kHz | 4 kHz | Clarity / "Air" |

-----

## 💾 Database Management

The tool comes with a robust database manager. You can add items manually or import them via CSV.

### CSV Import Format

To bulk import equipment, create a `.csv` file with the following headers. (Order does not matter, headers are case-insensitive).

**1. Speakers**

```csv
brand, model, impedance, wattage_rms, wattage_peak, taps
JBL, Control 25-1, 8, 100, 200, "30,15,7.5,3.7"
Bose, DS16F, 8, 16, 64, "16,8,4,2,1"
```

**2. Cables**

```csv
brand, model, crossSection, resistance, capacitance, inductance
Belden, 5000UP, 2.5, 12.1, 120, 0.7
Generic, CAT6, 0.2, 140, 50, 0.5
```

*Note: `resistance` is in Ohms/km.*

**3. Amplifiers**

```csv
brand, model, watt_8, watt_4, watt_100v, channels_lowz
Crown, CDi 1000, 500, 700, 700, 2
Powersoft, Mezzo 604, 150, 150, 150, 4
```

-----

## 🚀 User Guide

### Step 1: Configuration

  * Open `Speaker Design Tool.html`.
  * Set **Project Name**.
  * Set **Temperature**: Critical for ceiling installs. A 40°C void increases resistance by \~8% compared to 20°C specs.
  * Select **Mode**: `Low-Z` for performance audio, `100V` for distributed paging.

### Step 2: Build the Chain

1.  Click **+ Add New Line**.
2.  **Select Amplifier:** Choose an existing amp or click `+ New...` to add one from the database.
3.  **Select Speaker & Cable:** Choose your components. Use the **Brand Filter** to quickly find your manufacturer.
4.  **Daisy Chaining:** Click the **Down Arrow (↓)** on a row to add a speaker connected *to* that speaker (series/parallel chain).

### Step 3: Analyze & Optimize

  * Check the **Status** column.
  * **Orange Warning:** Functional but sub-optimal (e.g., 12% drop in a BGM system).
  * **Red Error:** Critical failure (e.g., cable too thin, amp overloaded, impedance too low).
  * **Fix:** Click the **Wand (🪄)** icon next to the cable length to run the **Cable Wizard** and auto-select the correct gauge.

### Step 4: Generate Report

  * Go to the **Reports** tab.
  * Enter **Company/Designer** info.
  * Upload a **Logo** (JPG/PNG).
  * Click **Generate PDF** for a client presentation or **Export Excel** for the procurement team.

-----

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. You are free to use, modify, and distribute this software.
