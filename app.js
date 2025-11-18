// --- CONSTANTS AND APP STATE ---
const CONSTANTS = {
    DEFAULT_VOLTAGE: 100,
    STORAGE_KEY: 'speakerDesignToolState'
};

let appState = {
    speakers: {},
    cables: {},
    amplifiers: {},
    lowZRows: [],
    highVRows: [],
    nextLowZId: 1,
    nextHighVId: 1,
};

// --- CORE SYSTEMS (Modal, Button, Navigation) ---

const ModalManager = {
    show: (modalId) => {
        document.getElementById(modalId)?.classList.add('active');
    },
    hide: (modalId) => {
        document.getElementById(modalId)?.classList.remove('active');
    }
};

const ButtonManager = {
    buttons: new Map(),
    register: (buttonId, options = {}) => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        ButtonManager.buttons.set(buttonId, {
            element: button,
            loadingText: options.loadingText || 'Processing...',
            onClick: options.onClick || (() => {}),
            originalText: button.textContent
        });
        button.addEventListener('click', (e) => {
            e.preventDefault();
            ButtonManager.handleClick(buttonId);
        });
    },
    handleClick: (buttonId) => {
        const config = ButtonManager.buttons.get(buttonId);
        if (!config || config.element.classList.contains('loading')) return;

        const button = config.element;
        button.textContent = config.loadingText;
        button.classList.add('loading');
        button.disabled = true;

        Promise.resolve(config.onClick()).catch(error => {
            console.error('Button action failed:', error);
            showMessage(`Error: ${error.message}`, 'Error');
        }).finally(() => {
            button.classList.remove('loading');
            button.textContent = config.originalText;
            button.disabled = false;
        });
    }
};

/**
 * Sets up navigation for a container (main nav, sub-nav)
 * @param {string} containerId - The ID of the navigation container (e.g., 'nav-buttons')
 * @param {string} buttonClass - The class of the buttons to track (e.g., 'nav-btn')
 * @param {string} viewClass - The class of the views to toggle (e.g., 'view')
 */
function setupNavigation(containerId, buttonClass, viewClass) {
    const navContainer = document.getElementById(containerId);
    if (!navContainer) return;
    
    const views = document.querySelectorAll(`.${viewClass}`);
    
    navContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button, a');
        if (!target) return;

        if (target.dataset.view) {
            e.preventDefault();
            const viewId = target.dataset.view;
            
            navContainer.querySelectorAll(`.${buttonClass}`).forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            
            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === viewId) {
                    view.classList.add('active');
                    
                    // --- FIX: RENDER CONTENT ON VIEW CHANGE ---
                    if (containerId === 'nav-buttons') {
                        // When opening Reports, generate summary AND render tables
                        if (viewId === 'view-report') {
                            generateReportSummary();
                            renderCalculationsView(); 
                        }
                        
                        if (viewId === 'view-database') {
                            renderAllDatabaseTables();
                            // Also ensure the correct sub-tab is shown
                            const activeDBTab = document.querySelector('#database-tabs .db-nav-btn.active');
                            if (activeDBTab) {
                                const subView = document.getElementById(activeDBTab.dataset.view);
                                if (subView) subView.classList.add('active');
                            } else {
                                // Default to speakers if no tab is active
                                document.getElementById('tab-db-speakers').click();
                            }
                        }
                        if (viewId === 'view-calculator') {
                             // Ensure the correct sub-tab is shown
                             const activeCalcTab = document.querySelector('#calculator-tabs .db-nav-btn.active');
                             if (activeCalcTab) {
                                const subView = document.getElementById(activeCalcTab.dataset.view);
                                if (subView) subView.classList.add('active');
                             } else {
                                // Default to Low-Z if no tab is active
                                document.getElementById('tab-low-z').click();
                             }
                        }
                    }
                     // This handles sub-tabs
                    if (containerId === 'database-tabs') {
                        renderDatabaseTable(viewId.replace('db-view-', ''));
                    }
                }
            });
        }
    });
}


// --- STATE MANAGEMENT (Load, Save) ---

function saveState() {
    localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(appState));
}

function loadState() {
    const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY);
    if (saved) {
        try {
            appState = JSON.parse(saved);
            // Ensure all DB fields exist and defaults are present
            appState.speakers = { ...structuredClone(DEFAULT_DATABASE.speakers), ...appState.speakers };
            appState.cables = { ...structuredClone(DEFAULT_DATABASE.cables), ...appState.cables };
            appState.amplifiers = { ...structuredClone(DEFAULT_DATABASE.amplifiers), ...appState.amplifiers };

        } catch (e) {
            console.error("Failed to parse saved state, resetting to default.", e);
            loadDefaultState();
        }
    } else {
        loadDefaultState();
    }
}

function loadDefaultState() {
    if (typeof DEFAULT_DATABASE !== 'undefined') {
        appState.speakers = structuredClone(DEFAULT_DATABASE.speakers);
        appState.cables = structuredClone(DEFAULT_DATABASE.cables);
        appState.amplifiers = structuredClone(DEFAULT_DATABASE.amplifiers);
    } else {
        console.error("DEFAULT_DATABASE is not loaded. Check database.js file.");
    }
}

function showMessage(message, title = 'Information') {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-text').textContent = message;
    ModalManager.show('message-modal');
}

function showConfirmationModal(message, onConfirm) {
    document.getElementById('confirmation-message').textContent = message;
    
    const oldOk = document.getElementById('confirm-ok');
    const newOk = oldOk.cloneNode(true);
    oldOk.parentNode.replaceChild(newOk, oldOk);
    
    newOk.onclick = () => {
        onConfirm();
        ModalManager.hide('confirmation-modal');
    };
    
    document.getElementById('confirm-cancel').onclick = () => ModalManager.hide('confirmation-modal');
    ModalManager.show('confirmation-modal');
}

// --- HELPER FUNCTIONS (CSV, etc) ---
function exportToCSV(data, filename) {
    if (!data || Object.keys(data).length === 0) {
        showMessage('Database is empty, nothing to export.', 'Info');
        return;
    }
    const firstKey = Object.keys(data)[0];
    const headers = Object.keys(data[firstKey]);
    const primaryKeyName = data === appState.cables ? 'name' : 'model'; // 'name' for cables, 'model' for others
    
    let csv = `${primaryKeyName},${headers.join(',')}\n`;
    
    for (const key in data) {
        csv += `"${key}",${headers.map(h => `"${data[key][h] || ''}"`).join(',')}\n`;
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleCSVImport(file, dbType) {
    if (!file) {
        showMessage('No file selected.', 'Error');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            if (lines.length < 2) {
                 showMessage('CSV file is empty or has no data.', 'Error');
                 return;
            }
            
            const headers = lines[0].trim().split(',').map(h => h.replace(/"/g, ''));
            const keyName = headers[0];
            let addedCount = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].trim().split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split CSV, handling quotes
                if (values.length !== headers.length) continue;
                
                const key = values[0].replace(/"/g, '');
                if (!key) continue;
                
                const obj = {};
                for (let j = 1; j < headers.length; j++) {
                    const header = headers[j];
                    let value = values[j].replace(/"/g, '');
                    // Try to convert numbers
                    if (value.trim() !== '' && !isNaN(value)) {
                        value = parseFloat(value);
                    }
                    obj[header] = value;
                }

                if (!appState[dbType][key]) {
                    appState[dbType][key] = obj;
                    addedCount++;
                }
            }
            saveState();
            renderAllDatabaseTables();
            populateSelects();
            showMessage(`Import complete. Added ${addedCount} new items.`, 'Success');
        } catch (error) {
            showMessage(`Failed to parse CSV: ${error.message}`, 'Error');
        }
    };
    reader.readAsText(file);
}

// --- CALCULATOR LOGIC ---

function createNode(treeType, parentId, inputs) {
    const isLowZ = treeType === 'low-z';
    const stateTree = isLowZ ? appState.lowZRows : appState.highVRows;
    const idPrefix = isLowZ ? 'L' : 'H';
    let id;
    let parent = null;

    if (parentId) {
        parent = findNode(treeType, parentId);
        if (parent) {
            const childCount = parent.children ? parent.children.length + 1 : 1;
            id = `${parentId}.${childCount}`;
        }
    }
    if (!id) {
        const nextId = isLowZ ? appState.nextLowZId++ : appState.nextHighVId++;
        id = `${idPrefix}-${nextId}`;
    }

    const node = { id, parentId: parentId || null, children: [], inputs, calculated: null, status: 'pending' };
    if (parent) parent.children.push(node);
    else stateTree.push(node);
    return node;
}

function findNode(treeType, nodeId) {
    const stateTree = treeType === 'low-z' ? appState.lowZRows : appState.highVRows;
    function searchInTree(nodes) {
        for (const node of nodes) {
            if (node.id === nodeId) return node;
            if (node.children) {
                const found = searchInTree(node.children);
                if (found) return found;
            }
        }
        return null;
    }
    return searchInTree(stateTree);
}

function getAmplifierPower(amplifier, load, isBridge) {
    if (!amplifier) return { power: 0, status: 'No Amp' };
    
    const loadNum = parseFloat(load);
    
    if (isBridge) {
        const minLoad = amplifier.min_load_bridge || 4;
        if (loadNum < minLoad) return { power: 0, status: 'Hazard' };
        if (loadNum < 8 && amplifier.watt_bridge_4) return { power: amplifier.watt_bridge_4, status: 'OK' };
        return { power: amplifier.watt_bridge_8 || 0, status: 'OK' }; // Use 8-ohm bridge rating
    } else {
        const minLoad = amplifier.min_load || 2;
        if (loadNum < minLoad) return { power: 0, status: 'Hazard' };
        if (loadNum < 4 && amplifier.watt_2) return { power: amplifier.watt_2, status: 'OK' };
        if (loadNum < 8 && amplifier.watt_4) return { power: amplifier.watt_4, status: 'OK' };
        return { power: amplifier.watt_8 || 0, status: 'OK' }; // Use 8-ohm rating
    }
}


function calculateLowZTree() {
    // --- NEW 2-PASS CALCULATION (v1.14) ---

    // Pass 1: Bubble up load calculations
    function calculateNodeLoad(node) {
        const speaker = appState.speakers[node.inputs.speakerModel];
        if (!speaker) {
             node.calculated = { status: 'Error' };
             // Return 0 impedance and power so it doesn't break parent calculation
             return { impedance: 0, power: 0 };
        }
        
        const cable1 = appState.cables[node.inputs.cable1Name];
        const length1 = node.inputs.length1;
        const cable2 = appState.cables[node.inputs.cable2Name];
        const length2 = node.inputs.length2;
        
        // R_leg is ONLY from Cable 1 (Main Run to junction)
        let legResistance = 0;
        if (cable1 && length1) legResistance = (cable1.resistance * length1 * 2) / 1000;

        // R_tap is ONLY from Cable 2 (Final Run from junction to speaker)
        let tapResistance = 0;
        if (cable2 && length2) tapResistance = (cable2.resistance * length2 * 2) / 1000;
        
        const parallelSpeakers = node.inputs.parallelSpeakers || 1;
        const speakerImpedance = speaker.impedance / parallelSpeakers;
        const speakerPower = speaker.wattage_rms * parallelSpeakers;

        // Calculate the impedance of THIS node's own speaker branch
        // Z_this = R_tap + Z_speaker
        const thisNodeBranchImpedance = speakerImpedance + tapResistance;

        let totalLoadImpedance = 0;
        let totalPower = 0;
        
        if (!node.children || node.children.length === 0) {
            // This is a leaf node (end of the line)
            // The total load is just its own branch impedance + the main cable run
            // Z_total = R_leg + (R_tap + Z_speaker)
            totalLoadImpedance = thisNodeBranchImpedance + legResistance;
            totalPower = speakerPower;
        } else {
            // This is a branch node.
            // We must calculate the parallel load of its *own branch* and all *children branches*
            
            let parallelImpedanceSum = 0; // This is 1/Z_total at the junction

            // 1. Add this node's own speaker branch
            if (thisNodeBranchImpedance > 0) {
                parallelImpedanceSum += 1 / thisNodeBranchImpedance;
            }
            totalPower = speakerPower;

            // 2. Add all children branches
            node.children.forEach(child => {
                const childLoad = calculateNodeLoad(child); // childLoad.impedance is the Z_total of that child's branch
                if (childLoad.impedance > 0) {
                    parallelImpedanceSum += 1 / childLoad.impedance;
                }
                totalPower += childLoad.power;
            });
            
            // Calculate the combined parallel load at the junction
            let combinedParallelLoad = 0;
            if (parallelImpedanceSum > 0) {
                 combinedParallelLoad = 1 / parallelImpedanceSum;
            }
            
            // The total load for this branch is the combined load + the main cable run (Cable 1)
            // Z_total = R_leg + ( (R_tap + Z_speaker) || Z_child_1 || Z_child_2 ... )
            totalLoadImpedance = combinedParallelLoad + legResistance;
        }

        node.calculated = {
            ...node.calculated,
            legResistance: legResistance, // Store R_leg (Cable 1)
            tapResistance: tapResistance, // Store R_tap (Cable 2)
            speakerImpedance: speakerImpedance,
            speakerPower: speakerPower,
            totalLoad: totalLoadImpedance, // Z_total for this branch (R_leg + Z_parallel_group)
            cumulativePower: totalPower, // P_total for this branch
        };
        
        return { impedance: totalLoadImpedance, power: totalPower };
    }

    // Pass 2: Push down voltage, current, and stats
    function calculateNodeStats(node, voltageAtNode, ampOutputImpedance, cumulativeCableResistance, voltageAtSource, parentCumulativePowerLoss = 0) {
        if (!node.calculated || node.calculated.status === 'Error') return;

        // This node's total branch impedance (calculated in Pass 1)
        const branchImpedance = node.calculated.totalLoad;
        if (branchImpedance === 0) return;

        // Calculate current, voltage, and power for THIS node's leg (Cable 1)
        const branchCurrent = voltageAtNode / branchImpedance;
        const voltageDropThisLeg = branchCurrent * node.calculated.legResistance;
        const voltageAtJunction = voltageAtNode - voltageDropThisLeg; // Voltage available after Cable 1
        const powerLossThisLeg = Math.pow(branchCurrent, 2) * node.calculated.legResistance;
        
        // Calculate stats for the *speaker* at this node
        const speaker = appState.speakers[node.inputs.speakerModel];
        const category = speaker ? speaker.category : 'satellite';
        const speakerImpedance = node.calculated.speakerImpedance;
        const tapResistance = node.calculated.tapResistance; // Get R_tap (Cable 2)
        const thisNodeBranchImpedance = speakerImpedance + tapResistance; // Z_this_branch

        // Calculate voltage AT THE SPEAKER (after R_tap)
        const voltageAtSpeaker = (thisNodeBranchImpedance > 0) 
            ? voltageAtJunction * (speakerImpedance / thisNodeBranchImpedance)
            : 0;
        
        // --- NEW: Calculate power loss in Cable 2 (Tap) ---
        const tapCurrent = (thisNodeBranchImpedance > 0) ? voltageAtJunction / thisNodeBranchImpedance : 0;
        const powerLossTap = Math.pow(tapCurrent, 2) * tapResistance;
        const cumulativeLossAtJunction = parentCumulativePowerLoss + powerLossThisLeg;
        const cumulativePowerLoss = cumulativeLossAtJunction + powerLossTap;
        // --- End New ---
        
        const powerAtThisSpeaker = speakerImpedance > 0 ? Math.pow(voltageAtSpeaker, 2) / speakerImpedance : 0;
        const splLoss = (node.calculated.speakerPower > 0 && powerAtThisSpeaker > 0) ? 10 * Math.log10(powerAtThisSpeaker / node.calculated.speakerPower) : 0;
        
        // DF is at the speaker terminals. Total R is R_cumulative_to_junction + R_tap
        const totalCableResistanceToSpeaker = cumulativeCableResistance + node.calculated.legResistance + tapResistance;
        const dampingFactor = speakerImpedance > 0 ? speakerImpedance / (totalCableResistanceToSpeaker + ampOutputImpedance) : 0;

        // Calculate cumulative voltage drop % *at the speaker*
        const voltageDropPercent = (voltageAtSource > 0) ? ((voltageAtSource - voltageAtSpeaker) / voltageAtSource) * 100 : 0;

        // --- Status Logic ---
        let vdWarningThreshold = 5.0; // 5% for satellite
        let vdHazardThreshold = 10.0; // 10% for satellite
        if (category === 'subwoofer' || category === 'large_fullrange') {
            vdWarningThreshold = 2.5;
            vdHazardThreshold = 5.0;
        }

        let status = 'OK';
        let statusMessage = 'OK';

        if (dampingFactor < 10 && dampingFactor > 0) {
            status = 'Hazard';
            statusMessage = 'Hazard: Low DF';
        } else if (dampingFactor < 20 && dampingFactor > 0) {
            status = 'Warning';
            statusMessage = 'Warning: Low DF';
        }
        
        if (voltageDropPercent > vdHazardThreshold) {
            status = 'Hazard';
            statusMessage = 'Hazard: High VD';
        } else if (voltageDropPercent > vdWarningThreshold && status !== 'Hazard') {
            status = 'Warning';
            statusMessage = 'Warning: High VD';
        }
        
        // Amp check is only for the root node
        if (!node.parentId) {
            const amplifier = appState.amplifiers[node.inputs.ampModel];
            if (amplifier) {
                const useBridge = node.inputs.useBridgeMode;
                const finalLoadOnAmp = node.calculated.totalLoad + ampOutputImpedance;
                const ampRating = getAmplifierPower(amplifier, finalLoadOnAmp, useBridge);
                
                if (ampRating.status === 'Hazard') {
                    status = 'Hazard';
                    statusMessage = 'Hazard: Amp Min Load';
                } else if (node.calculated.cumulativePower > ampRating.power) {
                    status = 'Hazard';
                    statusMessage = 'Hazard: Amp Overload';
                } else if (node.calculated.cumulativePower > ampRating.power * 0.9 && status !== 'Hazard') {
                    status = 'Warning';
                    statusMessage = 'Warning: Amp > 90%';
                }
            }
        }
        
        node.calculated = {
            ...node.calculated,
            voltageAtNode: voltageAtNode, // V before R_leg
            current: branchCurrent, // Current into R_leg
            powerLoss: powerLossThisLeg, // Power lost in R_leg (Cable 1)
            cumulativePowerLoss: cumulativePowerLoss, // <-- NEW: Total loss to this speaker
            dampingFactor: dampingFactor,
            voltageAtSpeaker: voltageAtSpeaker, // V at speaker (after R_tap)
            powerAtSpeaker: powerAtThisSpeaker,
            voltageDropPercent: voltageDropPercent,
            splLoss: splLoss,
            status: status,
            statusMessage: statusMessage
        };

        // Recurse for children
        if (node.children) {
            node.children.forEach(child => {
                // Pass voltage at the JUNCTION and cumulative cable R *to the junction*
                calculateNodeStats(child, voltageAtJunction, ampOutputImpedance, cumulativeCableResistance + node.calculated.legResistance, voltageAtSource, cumulativeLossAtJunction);
            });
        }
    }

    // --- Main execution for Low-Z ---
    let voltageAtSource = 0;
    appState.lowZRows.forEach(rootNode => {
        // Pass 1: Calculate all loads
        calculateNodeLoad(rootNode);
        
        let ampOutputImpedance = 0;
        const amplifier = appState.amplifiers[rootNode.inputs.ampModel];
        if (amplifier && amplifier.df > 0 && amplifier.df_rated_at > 0) {
            ampOutputImpedance = amplifier.df_rated_at / amplifier.df;
        }

        // V = sqrt(P*R)
        // P = Amp's rated power at this load
        // R = Total load of the line (Z_total_branches + Z_amp)
        const totalLoadAtAmp = rootNode.calculated.totalLoad + ampOutputImpedance;
        
        // Get the amp's power rating for this specific load
        const ampRating = getAmplifierPower(amplifier, totalLoadAtAmp, rootNode.inputs.useBridgeMode);
        
        voltageAtSource = (ampRating.power > 0 && totalLoadAtAmp > 0) 
            ? Math.sqrt(ampRating.power * totalLoadAtAmp) 
            : 0;
        
        // Pass 2: Calculate all stats
        calculateNodeStats(rootNode, voltageAtSource, ampOutputImpedance, 0, voltageAtSource, 0);
    });
}
    
function calculateHighVTree() {
    function calculateNodePower(node) {
        if (!node.children || node.children.length === 0) {
            const tapWatts = node.inputs.powerTap || 0;
            node.calculated = {
                powerAtThisNode: tapWatts,
                totalPower: tapWatts,
                voltage: 100
            };
        } else {
            let totalPower = node.inputs.powerTap || 0;
            node.children.forEach(child => {
                calculateNodePower(child);
                totalPower += child.calculated.totalPower;
            });
            node.calculated = {
                powerAtThisNode: node.inputs.powerTap || 0,
                totalPower: totalPower,
                voltage: 100
            };
        }
    }

    function calculateNodeVoltage(node, startVoltage = 100, cumulativePowerLoss = 0) {
        const cable1 = appState.cables[node.inputs.cable1Name];
        const length1 = node.inputs.length1;
        const cable2 = appState.cables[node.inputs.cable2Name];
        const length2 = node.inputs.length2;
        let legResistance = 0;
        if (cable1 && length1) legResistance += (cable1.resistance * length1 * 2) / 1000;
        if (cable2 && length2) legResistance += (cable2.resistance * length2 * 2) / 1000;
        
        const current = startVoltage > 0 ? node.calculated.totalPower / startVoltage : 0;
        const voltageDrop = current * legResistance;
        const voltageAtNode = startVoltage - voltageDrop;
        const powerLoss = Math.pow(current, 2) * legResistance;
        const totalPowerLoss = cumulativePowerLoss + powerLoss; // <-- NEW
        
        let status = 'OK';
        let statusMessage = 'OK';

        if (voltageAtNode < 90) {
            status = 'Hazard';
            statusMessage = 'Hazard: < 90V';
        } else if (voltageAtNode < 95) {
            status = 'Warning';
            statusMessage = 'Warning: < 95V';
        }
        
        if (!node.parentId) {
            const amplifier = appState.amplifiers[node.inputs.ampModel];
            if (amplifier && amplifier.watt_100v > 0) {
                if(node.calculated.totalPower > amplifier.watt_100v) {
                    status = 'Hazard';
                    statusMessage = 'Hazard: Amp Overload';
                } else if (node.calculated.totalPower > amplifier.watt_100v * 0.9 && status !== 'Hazard') {
                    status = 'Warning';
                    statusMessage = 'Warning: Amp > 90%';
                }
            }
        }
        node.calculated = {
            ...node.calculated,
            legResistance,
            voltage: startVoltage,
            voltageAtNode: voltageAtNode,
            voltageDrop: voltageDrop,
            current: current,
            powerLoss: powerLoss, // Loss in this leg
            cumulativePowerLoss: totalPowerLoss, // <-- NEW: Total loss to this node
            powerAtNode: node.calculated.powerAtThisNode * Math.pow(voltageAtNode / startVoltage, 2),
            status,
            statusMessage
        };
        if (node.children) node.children.forEach(child => {
            calculateNodeVoltage(child, voltageAtNode, totalPowerLoss); // <-- Pass cumulative loss
        });
    }
    appState.highVRows.forEach(rootNode => {
        calculateNodePower(rootNode);
        calculateNodeVoltage(rootNode, 100, 0); // <-- Start with 0
    });
}

// --- RENDER FUNCTIONS ---

// This function renders the main CALCULATOR view results
function renderTable(type) {
    const resultsDiv = document.getElementById(`${type}-results`);
    if (!resultsDiv) return;

    const rows = type === 'low-z' ? appState.lowZRows : appState.highVRows;
    if (rows.length === 0) {
        resultsDiv.innerHTML = '<p class="text-gray-500 p-4">No calculations yet.</p>';
        return;
    }

    function renderNode(node, level = 0) {
        const indent = level > 0 ? 'padding-left: 36px;' : 'padding-left: 16px;';
        
        const deleteFunc = `deleteNodeWrapper('${type}', '${node.id}')`;
        const bgColor = level === 0 ? (type === 'low-z' ? 'bg-blue-50' : 'bg-green-50') : 'bg-gray-50';

        if (!node.calculated || node.calculated.status === 'Error') {
            return `<div class="results-grid-row-low-z ${bgColor}" style="padding-left: ${level * 20 + 16}px;">
                <div data-label="ID" class="col-id font-semibold">${node.id}</div>
                <div data-label="Details" class="text-red-700 col-span-7">Error: Speaker "${node.inputs.speakerModel}" not found in database.</div>
                <div data-label="Status" class="col-status"><button onclick="${deleteFunc}" class="btn btn-round-sm btn-danger">&times;</button></div>
            </div>`;
        }
        
        const statusClass = node.calculated.status === 'OK' ? 'badge-green' :
            node.calculated.status === 'Warning' ? 'badge-yellow' : 'badge-red';
        
        let rowHtml = '';

        let cableRunHtml = '';
        const cable1 = node.inputs.cable1Name;
        const length1 = node.inputs.length1;
        const cable2 = node.inputs.cable2Name;
        const length2 = node.inputs.length2;
        if (cable1 && length1) cableRunHtml += `<div>${cable1} / ${length1}m</div>`;
        if (cable2 && length2) cableRunHtml += `<div>+ ${cable2} / ${length2}m</div>`;
        
        let resHtml = `Leg R: ${node.calculated.legResistance.toFixed(2)}Ω`;
        if (type === 'low-z' && node.calculated.tapResistance > 0) {
             resHtml += ` | Tap R: ${node.calculated.tapResistance.toFixed(2)}Ω`;
        }
        cableRunHtml += `<div class="text-xs text-gray-500 mt-1">${resHtml}</div>`;


        if (type === 'low-z') {
            const speaker = appState.speakers[node.inputs.speakerModel];
            
            let loadLabel = "Branch Load";
            let displayLoad = node.calculated.totalLoad;
            if (level === 0) {
                loadLabel = "Total Load (at Amp)";
                const amp = appState.amplifiers[node.inputs.ampModel];
                let ampR = 0;
                if(amp && amp.df > 0 && amp.df_rated_at > 0) {
                    ampR = amp.df_rated_at / amp.df;
                }
                displayLoad = node.calculated.totalLoad + ampR;
            }
            
            rowHtml = `
                <div class="results-grid-row-low-z ${bgColor}">
                    <div data-label="ID" class="col-id font-semibold text-gray-800" style="${indent}">${node.id}</div>
                    
                    <div data-label="Details">
                        <div class="font-medium">${node.inputs.speakerModel} (${node.inputs.parallelSpeakers || 1}x)</div>
                        <div class="text-sm text-gray-600">${speaker.impedance}Ω / ${speaker.wattage_rms}W RMS</div>
                        <div class="text-sm text-gray-500">Source: ${node.inputs.ampModel || node.parentId}</div>
                    </div>
                    
                    <div data-label="Cable Run">${cableRunHtml}</div>
                    
                    <div data-label="${loadLabel}">
                        <div>Load: ${displayLoad.toFixed(2)}Ω</div>
                        <div class="text-sm text-gray-600">Power: ${node.calculated.cumulativePower.toFixed(2)}W</div>
                    </div>
                    
                    <div data-label="Voltage Drop">${node.calculated.voltageDropPercent.toFixed(2)}%</div>
                    
                    <div data-label="Power Loss">${node.calculated.cumulativePowerLoss.toFixed(2)} W</div>
                    
                    <div data-label="SPL Loss">${node.calculated.splLoss.toFixed(2)} dB</div>
                    <div data-label="Total DF">${node.calculated.dampingFactor.toFixed(2)}</div>
                    
                    <div data-label="Status" class="col-status">
                        <span class="badge ${statusClass}">${node.calculated.statusMessage}</span>
                        <button onclick="${deleteFunc}" class="btn btn-round-sm btn-danger">&times;</button>
                    </div>
                </div>
            `;
        } else { // High-V
             rowHtml = `
                <div class="results-grid-row-high-v ${bgColor}">
                    <div data-label="ID" class="col-id font-semibold text-gray-800" style="${indent}">${node.id}</div>
                    
                    <div data-label="Details">
                        <div class="font-medium">${node.inputs.speakerModel}</div>
                        <div class="text-sm text-gray-600">${node.inputs.powerTap}W Tap</div>
                        <div class="text-sm text-gray-500">Source: ${node.inputs.ampModel || node.parentId}</div>
                    </div>
                    
                    <div data-label="Cable Run">${cableRunHtml}</div>
                    
                    <div data-label="Total Power (This Line)">${node.calculated.totalPower.toFixed(2)}W</div>
                    <div data-label="Voltage at Tap">${node.calculated.voltageAtNode.toFixed(2)}V</div>

                    <div data-label="Power Loss">${node.calculated.cumulativePowerLoss.toFixed(2)} W</div>
                    
                    <div data-label="Status" class="col-status">
                        <span class="badge ${statusClass}">${node.calculated.statusMessage}</span>
                        <button onclick="${deleteFunc}" class="btn btn-round-sm btn-danger">&times;</button>
                    </div>
                </div>
            `;
        }
        
        if (node.children) {
            node.children.forEach(child => {
                rowHtml += renderNode(child, level + 1);
            });
        }
        return rowHtml;
    }
    resultsDiv.innerHTML = rows.map(node => renderNode(node)).join('');
}

// This function renders the read-only CALCULATIONS view tables
function renderCalculationsView() {
    const lowZDiv = document.getElementById('low-z-calculations-list');
    const highVDiv = document.getElementById('high-v-calculations-list');
    if (!lowZDiv || !highVDiv) return;

    // --- Render Low-Z Table ---
    if (appState.lowZRows.length === 0) {
        lowZDiv.innerHTML = '<p class="text-gray-500">No Low-Z calculations.</p>';
    } else {
        let lowZHtml = `<div class="overflow-auto max-h-96"><table class="min-w-full">
            <thead class="sticky top-0 bg-gray-100">
                <tr>
                    <th>ID</th><th>Details</th><th>Cable Run</th><th>Load (Ω)</th>
                    <th>VD (%)</th><th>SPL Loss (dB)</th><th>DF</th><th>Power Loss (W)</th><th>Status</th>
                </tr>
            </thead><tbody>`;
        
        function traverseLowZ(nodes, level = 0) {
            nodes.forEach(node => {
                if (!node.calculated || node.calculated.status === 'Error') return;
                const speaker = appState.speakers[node.inputs.speakerModel] || {};
                const status = node.calculated.status;
                const statusClass = status === 'OK' ? 'badge-green' : (status === 'Warning' ? 'badge-yellow' : 'badge-red');
                
                let load = node.calculated.totalLoad;
                if (level === 0) {
                    const amp = appState.amplifiers[node.inputs.ampModel];
                    let ampR = 0;
                    if(amp && amp.df > 0 && amp.df_rated_at > 0) ampR = amp.df_rated_at / amp.df;
                    load += ampR;
                }

                lowZHtml += `
                    <tr>
                        <td style="padding-left: ${level * 16 + 8}px">${node.id}</td>
                        <td>${node.inputs.speakerModel} (${node.inputs.parallelSpeakers}x)<br><span class="text-xs text-gray-500">${speaker.impedance}Ω / ${speaker.wattage_rms}W</span></td>
                        <td>${node.inputs.cable1Name} / ${node.inputs.length1}m<br><span class="text-xs text-gray-500">${node.inputs.cable2Name || ''} / ${node.inputs.length2 || 0}m</span></td>
                        <td>${load.toFixed(2)}</td>
                        <td>${node.calculated.voltageDropPercent.toFixed(2)}</td>
                        <td>${node.calculated.splLoss.toFixed(2)}</td>
                        <td>${node.calculated.dampingFactor.toFixed(2)}</td>
                        <td>${node.calculated.cumulativePowerLoss.toFixed(2)} W</td>
                        <td><span class="badge ${statusClass}">${node.calculated.statusMessage}</span></td>
                    </tr>`;
                
                if (node.children) traverseLowZ(node.children, level + 1);
            });
        }
        traverseLowZ(appState.lowZRows);
        lowZDiv.innerHTML = lowZHtml + '</tbody></table></div>';
    }

    // --- Render High-V Table ---
    if (appState.highVRows.length === 0) {
        highVDiv.innerHTML = '<p class="text-gray-500">No 100V calculations.</p>';
    } else {
        let highVHtml = `<div class="overflow-auto max-h-96"><table class="min-w-full">
            <thead class="sticky top-0 bg-gray-100">
                <tr>
                    <th>ID</th><th>Details</th><th>Cable Run</th><th>Total Power (W)</th>
                    <th>V at Tap (V)</th><th>Power Loss (W)</th><th>Status</th>
                </tr>
            </thead><tbody>`;

        function traverseHighV(nodes, level = 0) {
            nodes.forEach(node => {
                if (!node.calculated || node.calculated.status === 'Error') return;
                const status = node.calculated.status;
                const statusClass = status === 'OK' ? 'badge-green' : (status === 'Warning' ? 'badge-yellow' : 'badge-red');

                highVHtml += `
                    <tr>
                        <td style="padding-left: ${level * 16 + 8}px">${node.id}</td>
                        <td>${node.inputs.speakerModel}<br><span class="text-xs text-gray-500">${node.inputs.powerTap}W Tap</span></td>
                        <td>${node.inputs.cable1Name} / ${node.inputs.length1}m<br><span class="text-xs text-gray-500">${node.inputs.cable2Name || ''} / ${node.inputs.length2 || 0}m</span></td>
                        <td>${node.calculated.totalPower.toFixed(2)}</td>
                        <td>${node.calculated.voltageAtNode.toFixed(2)}</td>
                        <td>${node.calculated.cumulativePowerLoss.toFixed(2)} W</td>
                        <td><span class="badge ${statusClass}">${node.calculated.statusMessage}</span></td>
                    </tr>`;
                
                if (node.children) traverseHighV(node.children, level + 1);
            });
        }
        traverseHighV(appState.highVRows);
        highVDiv.innerHTML = highVHtml + '</tbody></table></div>';
    }
}


function renderLowZTable() { renderTable('low-z'); }
function renderHighVTable() { renderTable('high-v'); }

// --- POPULATE SELECTS ---

function populateSpeakerSelects() {
    const speakerSelectIds = ['low-z-speaker', 'high-v-speaker'];
    speakerSelectIds.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Speaker --</option>';
        Object.entries(appState.speakers).forEach(([model, speaker]) => {
            const is100V = (speaker.taps && speaker.taps.trim() !== '');
            const isLowZ = (speaker.impedance > 0 && speaker.wattage_rms > 0);
            
            let text = `${model} (${speaker.brand || 'N/A'}) - `;
            let type = speaker.type || 'Both';
            
            if(isLowZ) text += `${speaker.impedance}Ω, ${speaker.wattage_rms}W`;
            if(is100V && isLowZ) text += ' / ';
            if(is100V) text += `100V (${speaker.taps}W)`;

            if ((selectId === 'low-z-speaker' && (type === 'Low-Z' || type === 'Both')) || 
                (selectId === 'high-v-speaker' && (type === '100V' || type === 'Both'))) {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = text;
                select.appendChild(option);
            }
        });
        if (appState.speakers[currentVal]) select.value = currentVal;
    });
}

function populateCableSelects() {
    const cableSelectIds = ['low-z-cable-1', 'low-z-cable-2', 'high-v-cable-1', 'high-v-cable-2'];
    cableSelectIds.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Cable --</option>';
        Object.entries(appState.cables).forEach(([name, item]) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = `${name} (${item.brand} - ${item.model}) - ${item.resistance}Ω/km`;
            select.appendChild(option);
        });
         if (appState.cables[currentVal]) select.value = currentVal;
    });
}

function populateAmplifierSelects() {
    const ampSelectIds = ['low-z-amp', 'high-v-amp'];
    ampSelectIds.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Amplifier --</option>';
        Object.entries(appState.amplifiers).forEach(([model, amp]) => {
            const option = document.createElement('option');
            option.value = model;
            let text = `${model} (${amp.brand || 'N/A'}) - `;
            if (selectId === 'low-z-amp') {
                text += `${amp.watt_8}W @ 8Ω / ${amp.watt_4}W @ 4Ω`;
            } else {
                text += `${amp.watt_100v || amp.watt_8}W @ 100V/8Ω`; // Show 100V or 8-ohm
            }
            option.textContent = text;
            select.appendChild(option);
        });
         if (appState.amplifiers[currentVal]) select.value = currentVal;
    });
}

function populateTapSelects() {
    const lowZTapSelect = document.getElementById('low-z-tap-id');
    const highVTapSelect = document.getElementById('high-v-tap-id');

    function addNodesToSelect(select, nodes, level = 0) {
        // --- NEW: Indent only once ---
        const indent = level > 0 ? '· ' : '';
        nodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = `${indent}${node.id} (${node.inputs.speakerModel})`;
            select.appendChild(option);
            if (node.children && node.children.length > 0) {
                addNodesToSelect(select, node.children, level + 1); // Pass level + 1 to handle recursion
            }
        });
    }

    if (lowZTapSelect) {
        lowZTapSelect.innerHTML = '<option value="">-- Select Tap --</option>';
        addNodesToSelect(lowZTapSelect, appState.lowZRows, 0);
    }
    if (highVTapSelect) {
        highVTapSelect.innerHTML = '<option value="">-- Select Tap --</option>';
        addNodesToSelect(highVTapSelect, appState.highVRows, 0);
    }
}

function populateHighVTaps(speakerModel) {
    const tapSelect = document.getElementById('high-v-powertap');
    if (!tapSelect) return;
    
    tapSelect.innerHTML = '';
    const speaker = appState.speakers[speakerModel];
    
    if (speaker && speaker.taps && speaker.taps.trim() !== '') {
        const taps = speaker.taps.split(',');
        tapSelect.innerHTML = '<option value="">-- Select Tap --</option>';
        taps.forEach(tap => {
            const val = parseFloat(tap);
            if (!isNaN(val) && val > 0) {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = `${val} W`;
                tapSelect.appendChild(option);
            }
        });
    } else {
         tapSelect.innerHTML = '<option value="">-- No Taps --</option>';
    }
}

function populateSelects() {
    populateSpeakerSelects();
    populateCableSelects();
    populateAmplifierSelects();
    populateTapSelects();
}

// --- CALCULATOR EVENT LISTENERS & BUTTONS ---

function initCalculatorButtons() {
    // Low-Z
    ButtonManager.register('add-low-z-calculation', {
        loadingText: 'Calculating...',
        onClick: () => {
            const ampModel = document.getElementById('low-z-amp').value;
            const parentId = document.getElementById('low-z-tap-id').value;
            const speakerModel = document.getElementById('low-z-speaker').value;
            const speaker = appState.speakers[speakerModel];
            
            if (!speaker) {
                showMessage('Please select a valid speaker.', 'Form Error');
                return;
            }
            
            const parallelSpeakers = parseInt(document.getElementById('low-z-parallel').value) || 1;
            const cable1Name = document.getElementById('low-z-cable-1').value;
            const length1 = parseFloat(document.getElementById('low-z-length-1').value) || 0;
            const cable2Name = document.getElementById('low-z-cable-2').value;
            const length2 = parseFloat(document.getElementById('low-z-length-2').value) || 0;
            const useBridgeMode = document.getElementById('low-z-bridge-mode').checked;

            if ((!ampModel && !parentId) || (ampModel && parentId)) {
                showMessage('Select EITHER an amplifier OR tap ID.', 'Form Error');
                return;
            }
            if (!speakerModel || !cable1Name || length1 <= 0) {
                showMessage('Please fill all required fields (Speaker, Main Cable, Length).', 'Form Error');
                return;
            }
            const inputs = { ampModel, parentId, speakerModel, parallelSpeakers, cable1Name, length1, cable2Name, length2, useBridgeMode };
            createNode('low-z', parentId, inputs);
            calculateLowZTree();
            renderLowZTable();
            populateTapSelects();
            saveState();
        }
    });

    ButtonManager.register('clear-low-z', {
        onClick: () => showConfirmationModal('Clear all Low-Z calculations?', () => {
            appState.lowZRows = [];
            renderLowZTable();
            populateTapSelects();
            saveState();
        })
    });
    
    ButtonManager.register('export-low-z', { onClick: () => exportCalculationToCSV('low-z') });
    ButtonManager.register('import-low-z', { onClick: () => document.getElementById('import-low-z-file').click() });
    document.getElementById('import-low-z-file')?.addEventListener('change', (e) => {
        handleProjectImport(e.target.files[0], 'low-z');
        e.target.value = null; // Reset file input
    });


    // High-V
    ButtonManager.register('add-high-v-calculation', {
        loadingText: 'Calculating...',
        onClick: () => {
            const ampModel = document.getElementById('high-v-amp').value;
            const parentId = document.getElementById('high-v-tap-id').value;
            const speakerModel = document.getElementById('high-v-speaker').value;
            const powerTap = parseFloat(document.getElementById('high-v-powertap').value) || 0;
            const cable1Name = document.getElementById('high-v-cable-1').value;
            const length1 = parseFloat(document.getElementById('high-v-length-1').value) || 0;
            const cable2Name = document.getElementById('high-v-cable-2').value;
            const length2 = parseFloat(document.getElementById('high-v-length-2').value) || 0;

            if ((!ampModel && !parentId) || (ampModel && parentId)) {
                showMessage('Select EITHER an amplifier OR tap ID.', 'Form Error');
                return;
            }
            if (!speakerModel || powerTap <= 0 || !cable1Name || length1 <= 0) {
                showMessage('Please fill all required fields (Speaker, Tap, Cable, Length).', 'Form Error');
                return;
            }
            const inputs = { ampModel, parentId, speakerModel, powerTap, cable1Name, length1, cable2Name, length2 };
            createNode('high-v', parentId, inputs);
            calculateHighVTree();
            renderHighVTable();
            populateTapSelects();
            saveState();
        }
    });
    
    ButtonManager.register('clear-high-v', {
        onClick: () => showConfirmationModal('Clear all High-V calculations?', () => {
            appState.highVRows = [];
            renderHighVTable();
            populateTapSelects();
            saveState();
        })
    });
    
    ButtonManager.register('export-high-v', { onClick: () => exportCalculationToCSV('high-v') });
    ButtonManager.register('import-high-v', { onClick: () => document.getElementById('import-high-v-file').click() });
    document.getElementById('import-high-v-file')?.addEventListener('change', (e) => {
        handleProjectImport(e.target.files[0], 'high-v');
        e.target.value = null; // Reset file input
    });
    
    // Event listener for 100V speaker select
    document.getElementById('high-v-speaker')?.addEventListener('change', (e) => {
        populateHighVTaps(e.target.value);
    });
}

function getProjectName() {
    return document.getElementById('project-name').value || 'Untitled Project';
}

function exportCalculationToCSV(type) {
    const rows = type === 'low-z' ? appState.lowZRows : appState.highVRows;
    if (rows.length === 0) {
        showMessage('No calculations to export', 'Warning');
        return;
    }
    
    const projectName = getProjectName();
    let csv = '';
    let filename = '';
    
    // Create a map of all nodes for easy parent/child lookup
    const nodeMap = new Map();
    function mapNodes(nodes) {
        nodes.forEach(node => {
            nodeMap.set(node.id, node);
            if (node.children) mapNodes(node.children);
        });
    }
    mapNodes(rows);

    const csvRows = [];
    
    if (type === 'low-z') {
        csv = 'id,parentId,ampModel,speakerModel,parallelSpeakers,cable1Name,length1,cable2Name,length2,useBridgeMode\n';
        filename = `${projectName} - Low-Z.csv`;
        nodeMap.forEach(node => {
            const i = node.inputs;
            csvRows.push([
                `"${node.id}"`, `"${node.parentId || ''}"`, `"${i.ampModel || ''}"`, `"${i.speakerModel}"`,
                i.parallelSpeakers, `"${i.cable1Name}"`, i.length1,
                `"${i.cable2Name || ''}"`, i.length2, i.useBridgeMode
            ].join(','));
        });
    } else {
        csv = 'id,parentId,ampModel,speakerModel,powerTap,cable1Name,length1,cable2Name,length2\n';
        filename = `${projectName} - 100V.csv`;
        nodeMap.forEach(node => {
            const i = node.inputs;
            csvRows.push([
                `"${node.id}"`, `"${node.parentId || ''}"`, `"${i.ampModel || ''}"`, `"${i.speakerModel}"`,
                i.powerTap, `"${i.cable1Name}"`, i.length1,
                `"${i.cable2Name || ''}"`, i.length2
            ].join(','));
        });
    }

    csv += csvRows.join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleProjectImport(file, type) {
    if (!file) {
        showMessage('No file selected.', 'Error');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            if (lines.length < 2) {
                 showMessage('Project file is empty or has no data.', 'Error');
                 return;
            }
            
            const headers = lines[0].trim().split(',').map(h => h.replace(/"/g, ''));
            
            const nodes = [];
            const nodeMap = new Map();
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].trim().split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split CSV, handling quotes
                if (values.length !== headers.length) continue;
                
                const inputs = {};
                headers.forEach((header, index) => {
                    let value = values[index].replace(/"/g, '');
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;
                    else if (value.trim() !== '' && !isNaN(value)) value = parseFloat(value);
                    else if (value === 'null' || value === '') value = null;
                    inputs[header] = value;
                });
                
                const node = {
                    id: inputs.id,
                    parentId: inputs.parentId,
                    inputs: inputs,
                    children: [],
                    calculated: null,
                    status: 'pending'
                };
                nodes.push(node);
                nodeMap.set(node.id, node);
            }
            
            // Reconstruct the tree
            const tree = [];
            nodes.forEach(node => {
                if (node.parentId && nodeMap.has(node.parentId)) {
                    nodeMap.get(node.parentId).children.push(node);
                } else {
                    tree.push(node);
                }
            });
            
            if (type === 'low-z') {
                appState.lowZRows = tree;
                calculateLowZTree();
                renderLowZTable();
            } else {
                appState.highVRows = tree;
                calculateHighVTree();
                renderHighVTable();
            }
            
            populateTapSelects();
            saveState();
            showMessage(`Project imported successfully.`, 'Success');
            
        } catch (error) {
            showMessage(`Failed to parse project file: ${error.message}`, 'Error');
            console.error(error);
        }
    };
    reader.readAsText(file);
}


// --- DATABASE VIEW LOGIC ---

function renderAllDatabaseTables() {
    renderDatabaseTable('speakers');
    renderDatabaseTable('cables');
    renderDatabaseTable('amplifiers');
}

function renderDatabaseTable(dbType) {
    const tableBody = document.getElementById(`${dbType}-database-table`);
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    const data = appState[dbType];
    const defaults = DEFAULT_DATABASE[dbType] || {};
    
    for (const key in data) {
        const item = data[key];
        const isDefault = key in defaults;
        
        const tr = document.createElement('tr');
        let cells = `<td>${key} ${isDefault ? '<span class="text-xs text-gray-500">(Default)</span>' : ''}</td>`;
        
        if (dbType === 'speakers') {
            cells += `<td>${item.brand || ''}</td><td>${item.impedance}</td><td>${item.wattage_rms}</td><td>${item.wattage_peak || ''}</td>
                      <td>${item.max_spl || ''}</td><td>${item.taps || ''}</td><td>${item.type || ''}</td><td>${item.category || ''}</td>`;
        } else if (dbType === 'cables') {
            cells += `<td>${item.brand || ''}</td><td>${item.model || ''}</td><td>${item.resistance}</td>`;
        } else if (dbType === 'amplifiers') {
            cells += `<td>${item.brand || ''}</td><td>${item.df || ''}</td><td>${item.df_rated_at || ''}</td><td>${item.min_load}</td>
                      <td>${item.watt_8 || ''}</td><td>${item.watt_4 || ''}</td><td>${item.watt_2 || ''}</td><td>${item.watt_100v || ''}</td>
                      <td>${item.min_load_bridge || ''}</td><td>${item.watt_bridge_8 || ''}</td><td>${item.watt_bridge_4 || ''}</td>`;
        }
        
        // --- NEW: Edit/Delete Buttons ---
        let actionButtons = `<button onclick="editDatabaseItem('${dbType}', '${key}')" class="db-action-btn edit-btn" title="Edit">&#9998;</button>`; // Pencil icon
        if (!isDefault) {
            actionButtons += `<button onclick="deleteDatabaseItem('${dbType}', '${key}')" class="db-action-btn delete-btn" title="Delete">&times;</button>`;
        }
        cells += `<td class="flex">${actionButtons}</td>`;
        
        tr.innerHTML = cells;
        tableBody.appendChild(tr);
    }
}

function deleteDatabaseItem(dbType, key) {
     if (key in (DEFAULT_DATABASE[dbType] || {})) {
         showMessage('Cannot delete a default item.', 'Error');
         return;
     }
     showConfirmationModal(`Are you sure you want to delete "${key}"? This cannot be undone.`, () => {
        delete appState[dbType][key];
        saveState();
        renderDatabaseTable(dbType);
        populateSelects(); // Update all dropdowns
        showMessage('Item deleted.', 'Success');
     });
}

function editDatabaseItem(dbType, key) {
    const item = appState[dbType][key];
    const isDefault = key in (DEFAULT_DATABASE[dbType] || {});
    
    if (dbType === 'speakers') {
        document.getElementById('db-speaker-original-key').value = key;
        document.getElementById('db-speaker-model').value = key;
        document.getElementById('db-speaker-brand').value = item.brand || '';
        document.getElementById('db-speaker-impedance').value = item.impedance || 0;
        document.getElementById('db-speaker-wattage_rms').value = item.wattage_rms || 0;
        document.getElementById('db-speaker-wattage_peak').value = item.wattage_peak || 0;
        document.getElementById('db-speaker-max_spl').value = item.max_spl || 0;
        document.getElementById('db-speaker-taps').value = item.taps || '';
        document.getElementById('db-speaker-type').value = item.type || 'Both';
        document.getElementById('db-speaker-category').value = item.category || 'satellite';
        
        document.getElementById('btn-add-speaker').textContent = 'Save Changes';
        document.getElementById('btn-cancel-edit-speaker').classList.remove('hidden');
        document.getElementById('db-speaker-model').disabled = isDefault; // Don't allow editing default key
    } 
    else if (dbType === 'cables') {
        document.getElementById('db-cable-original-key').value = key;
        document.getElementById('db-cable-name').value = key;
        document.getElementById('db-cable-brand').value = item.brand || '';
        document.getElementById('db-cable-model').value = item.model || '';
        document.getElementById('db-cable-resistance').value = item.resistance || 0;
        
        document.getElementById('btn-add-cable').textContent = 'Save Changes';
        document.getElementById('btn-cancel-edit-cable').classList.remove('hidden');
        document.getElementById('db-cable-name').disabled = isDefault;
    }
    else if (dbType === 'amplifiers') {
        document.getElementById('db-amp-original-key').value = key;
        document.getElementById('db-amp-model').value = key;
        document.getElementById('db-amp-brand').value = item.brand || '';
        document.getElementById('db-amp-df').value = item.df || 0;
        document.getElementById('db-amp-df_rated_at').value = item.df_rated_at || 0;
        document.getElementById('db-amp-min_load').value = item.min_load || 0;
        document.getElementById('db-amp-watt_8').value = item.watt_8 || 0;
        document.getElementById('db-amp-watt_4').value = item.watt_4 || 0;
        document.getElementById('db-amp-watt_2').value = item.watt_2 || 0;
        document.getElementById('db-amp-watt_100v').value = item.watt_100v || 0;
        document.getElementById('db-amp-min_load_bridge').value = item.min_load_bridge || 0;
        document.getElementById('db-amp-watt_bridge_8').value = item.watt_bridge_8 || 0;
        document.getElementById('db-amp-watt_bridge_4').value = item.watt_bridge_4 || 0;
        
        document.getElementById('btn-add-amplifier').textContent = 'Save Changes';
        document.getElementById('btn-cancel-edit-amplifier').classList.remove('hidden');
        document.getElementById('db-amp-model').disabled = isDefault;
    }
}

function cancelEdit(dbType) {
    if (dbType === 'speakers') {
        document.getElementById('form-add-speaker').reset();
        document.getElementById('db-speaker-original-key').value = '';
        document.getElementById('btn-add-speaker').textContent = 'Add Speaker';
        document.getElementById('btn-cancel-edit-speaker').classList.add('hidden');
        document.getElementById('db-speaker-model').disabled = false;
    } 
    else if (dbType === 'cables') {
        document.getElementById('form-add-cable').reset();
        document.getElementById('db-cable-original-key').value = '';
        document.getElementById('btn-add-cable').textContent = 'Add Cable';
        document.getElementById('btn-cancel-edit-cable').classList.add('hidden');
        document.getElementById('db-cable-name').disabled = false;
    }
    else if (dbType === 'amplifiers') {
        document.getElementById('form-add-amplifier').reset();
        document.getElementById('db-amp-original-key').value = '';
        document.getElementById('btn-add-amplifier').textContent = 'Add Amplifier';
        document.getElementById('btn-cancel-edit-amplifier').classList.add('hidden');
        document.getElementById('db-amp-model').disabled = false;
    }
}


function initDatabaseButtons() {
    // --- Speakers ---
    document.getElementById('form-add-speaker')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const model = document.getElementById('db-speaker-model').value.trim();
        const originalKey = document.getElementById('db-speaker-original-key').value;
        if (!model) {
            showMessage('Model name is required.', 'Error');
            return;
        }
        if (model !== originalKey && appState.speakers[model]) {
            showMessage('A speaker with this model name already exists.', 'Error');
            return;
        }
        
        const newData = {
            brand: document.getElementById('db-speaker-brand').value.trim(),
            impedance: parseFloat(document.getElementById('db-speaker-impedance').value) || 0,
            wattage_rms: parseFloat(document.getElementById('db-speaker-wattage_rms').value) || 0,
            wattage_peak: parseFloat(document.getElementById('db-speaker-wattage_peak').value) || 0,
            max_spl: parseFloat(document.getElementById('db-speaker-max_spl').value) || 0,
            taps: document.getElementById('db-speaker-taps').value.trim(),
            type: document.getElementById('db-speaker-type').value,
            category: document.getElementById('db-speaker-category').value
        };
        
        // If it was an edit and the key changed, delete the old one
        if (originalKey && model !== originalKey) {
            delete appState.speakers[originalKey];
        }
        
        appState.speakers[model] = newData;
        saveState();
        renderDatabaseTable('speakers');
        populateSelects();
        cancelEdit('speakers');
        showMessage(originalKey ? 'Speaker updated.' : 'Speaker added.', 'Success');
    });
    document.getElementById('btn-cancel-edit-speaker')?.addEventListener('click', () => cancelEdit('speakers'));
    ButtonManager.register('db-export-speakers', { onClick: () => exportToCSV(appState.speakers, 'speakers-db.csv') });
    ButtonManager.register('db-import-speakers', { onClick: () => document.getElementById('import-speaker-file').click() });
    ButtonManager.register('db-clear-speakers', { onClick: () => showConfirmationModal('Clear speaker database (Defaults will be kept)?', () => {
        appState.speakers = { ...structuredClone(DEFAULT_DATABASE.speakers) };
        saveState();
        renderDatabaseTable('speakers');
        populateSelects();
    })});
    document.getElementById('import-speaker-file')?.addEventListener('change', (e) => {
        handleCSVImport(e.target.files[0], 'speakers');
        e.target.value = null; // Reset file input
    });

    // --- Cables ---
    document.getElementById('form-add-cable')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('db-cable-name').value.trim();
        const originalKey = document.getElementById('db-cable-original-key').value;
        if (!name) {
            showMessage('Cable name is required.', 'Error');
            return;
        }
        if (name !== originalKey && appState.cables[name]) {
            showMessage('A cable with this name already exists.', 'Error');
            return;
        }
        
        const newData = {
            brand: document.getElementById('db-cable-brand').value.trim(),
            model: document.getElementById('db-cable-model').value.trim(),
            resistance: parseFloat(document.getElementById('db-cable-resistance').value) || 0,
        };
        
        if (originalKey && name !== originalKey) {
            delete appState.cables[originalKey];
        }
        
        appState.cables[name] = newData;
        saveState();
        renderDatabaseTable('cables');
        populateSelects();
        cancelEdit('cables');
        showMessage(originalKey ? 'Cable updated.' : 'Cable added.', 'Success');
    });
    document.getElementById('btn-cancel-edit-cable')?.addEventListener('click', () => cancelEdit('cables'));
    ButtonManager.register('db-export-cables', { onClick: () => exportToCSV(appState.cables, 'cables-db.csv') });
    ButtonManager.register('db-import-cables', { onClick: () => document.getElementById('import-cable-file').click() });
    ButtonManager.register('db-clear-cables', { onClick: () => showConfirmationModal('Clear cable database (Defaults will be kept)?', () => {
        appState.cables = { ...structuredClone(DEFAULT_DATABASE.cables) };
        saveState();
        renderDatabaseTable('cables');
        populateSelects();
    })});
    document.getElementById('import-cable-file')?.addEventListener('change', (e) => {
        handleCSVImport(e.target.files[0], 'cables');
        e.target.value = null;
    });
    
    // --- Amplifiers ---
    document.getElementById('form-add-amplifier')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const model = document.getElementById('db-amp-model').value.trim();
        const originalKey = document.getElementById('db-amp-original-key').value;
        if (!model) {
            showMessage('Model name is required.', 'Error');
            return;
        }
        if (model !== originalKey && appState.amplifiers[model]) {
            showMessage('An amplifier with this model name already exists.', 'Error');
            return;
        }
        
        const newData = {
            brand: document.getElementById('db-amp-brand').value.trim(),
            df: parseFloat(document.getElementById('db-amp-df').value) || 0,
            df_rated_at: parseFloat(document.getElementById('db-amp-df_rated_at').value) || 0,
            min_load: parseFloat(document.getElementById('db-amp-min_load').value) || 0,
            watt_8: parseFloat(document.getElementById('db-amp-watt_8').value) || 0,
            watt_4: parseFloat(document.getElementById('db-amp-watt_4').value) || 0,
            watt_2: parseFloat(document.getElementById('db-amp-watt_2').value) || 0,
            watt_100v: parseFloat(document.getElementById('db-amp-watt_100v').value) || 0,
            min_load_bridge: parseFloat(document.getElementById('db-amp-min_load_bridge').value) || 0,
            watt_bridge_8: parseFloat(document.getElementById('db-amp-watt_bridge_8').value) || 0,
            watt_bridge_4: parseFloat(document.getElementById('db-amp-watt_bridge_4').value) || 0
        };
        
        if (originalKey && model !== originalKey) {
            delete appState.amplifiers[originalKey];
        }
        
        appState.amplifiers[model] = newData;
        saveState();
        renderDatabaseTable('amplifiers');
        populateSelects();
        cancelEdit('amplifiers');
        showMessage(originalKey ? 'Amplifier updated.' : 'Amplifier added.', 'Success');
    });
    document.getElementById('btn-cancel-edit-amplifier')?.addEventListener('click', () => cancelEdit('amplifiers'));
    ButtonManager.register('db-export-amps', { onClick: () => exportToCSV(appState.amplifiers, 'amplifiers-db.csv') });
    ButtonManager.register('db-import-amps', { onClick: () => document.getElementById('import-amp-file').click() });
    ButtonManager.register('db-clear-amps', { onClick: () => showConfirmationModal('Clear amplifier database (Default will be kept)?', () => {
        appState.amplifiers = { ...structuredClone(DEFAULT_DATABASE.amplifiers) }; // Keep default
        saveState();
        renderDatabaseTable('amplifiers');
        populateSelects();
    })});
    document.getElementById('import-amp-file')?.addEventListener('change', (e) => {
        handleCSVImport(e.target.files[0], 'amplifiers');
        e.target.value = null;
    });
}

// --- REPORT VIEW LOGIC ---

function generateReportSummary() {
    // This just renders the summary boxes, not the full tables
    const reportContent = document.getElementById('report-content');
    if (!reportContent) return;

    let html = '<div class="space-y-6">';
    let totalNodes = 0;
    let hazardCount = 0;
    let warningCount = 0;

    // Low-Z Summary
    html += '<div><h3 class="text-lg font-semibold mb-3">Low-Impedance System Summary</h3>';
    if (appState.lowZRows.length === 0) {
        html += '<p class="text-gray-500">No Low-Z calculations</p>';
    } else {
        let totalPower = 0;
        let lowZNodes = 0;
        let lowZWarnings = 0;
        let lowZHazards = 0;

        function countLowZ(nodes) {
            nodes.forEach(node => {
                lowZNodes++;
                if (node.calculated && node.calculated.status !== 'Error') {
                    // Only sum power from root nodes
                    if (!node.parentId) {
                         totalPower += node.calculated.cumulativePower;
                    }
                    if (node.calculated.status === 'Hazard') lowZHazards++;
                    else if (node.calculated.status === 'Warning') lowZWarnings++;
                }
                if (node.children) countLowZ(node.children);
            });
        }
        countLowZ(appState.lowZRows);
        totalNodes += lowZNodes;
        warningCount += lowZWarnings;
        hazardCount += lowZHazards;

        html += `<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-blue-50 p-4 rounded"><div class="text-2xl font-bold">${lowZNodes}</div><div class="text-sm text-gray-600">Total Nodes</div></div>
            <div class="bg-green-50 p-4 rounded"><div class="text-2xl font-bold">${totalPower.toFixed(0)}W</div><div class="text-sm text-gray-600">Total Power</div></div>
            <div class="bg-yellow-50 p-4 rounded"><div class="text-2xl font-bold">${lowZWarnings}</div><div class="text-sm text-gray-600">Warnings</div></div>
            <div class="bg-red-50 p-4 rounded"><div class="text-2xl font-bold">${lowZHazards}</div><div class="text-sm text-gray-600">Hazards</div></div>
        </div>`;
    }
    html += '</div>';

    // High-V Summary
    html += '<div><h3 class="text-lg font-semibold mb-3">100V System Summary</h3>';
    if (appState.highVRows.length === 0) {
        html += '<p class="text-gray-500">No High-V calculations</p>';
    } else {
        let totalPower = 0;
        let highVNodes = 0;
        let highVWarnings = 0;
        let highVHazards = 0;

        function countHighV(nodes) {
            nodes.forEach(node => {
                highVNodes++;
                 if (node.calculated && node.calculated.status !== 'Error') {
                    if (!node.parentId) {
                        totalPower += node.calculated.totalPower;
                    }
                    if (node.calculated.status === 'Hazard') highVHazards++;
                    else if (node.calculated.status === 'Warning') highVWarnings++;
                 }
                if (node.children) countHighV(node.children);
            });
        }
        countHighV(appState.highVRows);
        totalNodes += highVNodes;
        warningCount += highVWarnings;
        hazardCount += highVHazards;

        html += `<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-blue-50 p-4 rounded"><div class="text-2xl font-bold">${highVNodes}</div><div class="text-sm text-gray-600">Total Nodes</div></div>
            <div class="bg-green-50 p-4 rounded"><div class="text-2xl font-bold">${totalPower.toFixed(0)}W</div><div class="text-sm text-gray-600">Total Power</div></div>
            <div class="bg-yellow-50 p-4 rounded"><div class="text-2xl font-bold">${highVWarnings}</div><div class="text-sm text-gray-600">Warnings</div></div>
            <div class="bg-red-50 p-4 rounded"><div class="text-2xl font-bold">${highVHazards}</div><div class="text-sm text-gray-600">Hazards</div></div>
        </div>`;
    }
    html += '</div></div>';
    reportContent.innerHTML = html;
}

function initReportButtons() {
    ButtonManager.register('generate-pdf', { 
        loadingText: 'Generating PDF...',
        onClick: () => generatePDFReport() 
    });
    ButtonManager.register('export-combined-csv', { 
        loadingText: 'Exporting...',
        onClick: () => showMessage('Combined CSV Export feature coming soon!', 'Info') 
    });
}

function generatePDFReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4'); // Use A4 portrait
    
    const company = document.getElementById('report-company-name').value || 'N/A';
    const project = document.getElementById('report-project-name').value || 'N/A';
    const designer = document.getElementById('report-designer-name').value || 'N/A';
    
    // --- PDF Header ---
    doc.setFontSize(18);
    doc.text("Speaker Design Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Company: ${company}`, 14, 30);
    doc.text(`Project: ${project}`, 14, 36);
    doc.text(`Designer: ${designer}`, 14, 42);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 48);
    
    let yPos = 60;
    
    // --- Low-Z Table ---
    if (appState.lowZRows.length > 0) {
        doc.setFontSize(14);
        doc.text("Low-Impedance (Low-Z) Calculations", 14, yPos);
        yPos += 8;
        
        const lowZHead = [['ID', 'Details', 'Cable Run', 'Load', 'VD (%)', 'SPL (dB)', 'DF', 'Status']];
        const lowZBodyRows = [];
        const lowZBodyInfo = []; // Store level and status
        
        function traverseLowZ(nodes, level = 0) {
            nodes.forEach(node => {
                if (!node.calculated || node.calculated.status === 'Error') return;

                const speaker = appState.speakers[node.inputs.speakerModel] || {};
                const details = `${node.inputs.speakerModel} (${node.inputs.parallelSpeakers || 1}x)\n${speaker.impedance || 'N/A'}Ω / ${speaker.wattage_rms || 'N/A'}W RMS\nSource: ${node.inputs.ampModel || node.parentId}`;

                let cableRun = '';
                if (node.inputs.cable1Name && node.inputs.length1) cableRun += `${node.inputs.cable1Name} / ${node.inputs.length1}m\n`;
                if (node.inputs.cable2Name && node.inputs.length2) cableRun += `+ ${node.inputs.cable2Name} / ${node.inputs.length2}m\n`;
                let resHtml = `Leg R: ${node.calculated.legResistance.toFixed(2)}Ω`;
                if (node.calculated.tapResistance > 0) resHtml += ` | Tap R: ${node.calculated.tapResistance.toFixed(2)}Ω`;
                cableRun += resHtml;

                let loadLabel = (level === 0) ? "Total Load (at Amp)" : "Branch Load";
                let displayLoad = node.calculated.totalLoad;
                if (level === 0) {
                    const amp = appState.amplifiers[node.inputs.ampModel];
                    let ampR = 0;
                    if(amp && amp.df > 0 && amp.df_rated_at > 0) ampR = amp.df_rated_at / amp.df;
                    displayLoad += ampR;
                }
                const load = `${loadLabel}:\n${displayLoad.toFixed(2)}Ω\nPower: ${node.calculated.cumulativePower.toFixed(2)}W`;
                
                lowZBodyRows.push([
                    ' '.repeat(level*2) + node.id,
                    details,
                    cableRun,
                    load,
                    node.calculated.voltageDropPercent.toFixed(2),
                    node.calculated.splLoss.toFixed(2),
                    node.calculated.dampingFactor.toFixed(2),
                    node.calculated.statusMessage
                ]);
                lowZBodyInfo.push({ level: level, status: node.calculated.status }); // Store info
                
                if(node.children) traverseLowZ(node.children, level + 1);
            });
        }
        traverseLowZ(appState.lowZRows);
        
        doc.autoTable({
            startY: yPos,
            head: lowZHead,
            body: lowZBodyRows,
            theme: 'grid',
            headStyles: { fillColor: [243, 244, 246], textColor: [0,0,0], fontSize: 8, halign: 'center' },
            styles: { cellPadding: 1.5, fontSize: 7.5, valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 15 }, // ID
                1: { cellWidth: 38 }, // Details
                2: { cellWidth: 38 }, // Cable Run
                3: { cellWidth: 28 }, // Load
                4: { cellWidth: 12, halign: 'center' }, // VD
                5: { cellWidth: 12, halign: 'center' }, // SPL
                6: { cellWidth: 12, halign: 'center' }, // DF
                7: { cellWidth: 20 }  // Status
            },
            willDrawCell: function(data) {
                if (data.section === 'body') {
                    let info = lowZBodyInfo[data.row.index];
                    let bgColor = (info.level === 0) ? [239, 246, 255] : [249, 250, 251]; // blue or gray
                    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                }
            },
            didDrawCell: function(data) {
                if (data.section === 'body' && data.column.index === 7) { // Status column
                    let info = lowZBodyInfo[data.row.index];
                    let color;
                    if (info.status === 'Warning') {
                        color = [254, 249, 195]; // bg-yellow-100
                    } else if (info.status === 'Hazard') {
                        color = [254, 226, 226]; // bg-red-100
                    } else if (info.status === 'OK') {
                        color = [220, 252, 231]; // bg-green-100
                    }
                    
                    if (color) {
                        doc.setFillColor(color[0], color[1], color[2]);
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                        // Redraw the text
                        doc.setTextColor(0, 0, 0);
                        doc.setFontSize(data.cell.styles.fontSize);
                        const textY = data.cell.y + data.cell.height / 2 + (data.cell.styles.fontSize / 3);
                        doc.text(data.cell.text, data.cell.x + data.cell.padding('left'), textY, { valign: 'middle' });
                    }
                }
            }
        });
        yPos = doc.autoTable.previous.finalY + 15;
    }

    // --- High-V Table ---
     if (appState.highVRows.length > 0) {
        if (yPos > 250) { // Check for page break
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(14);
        doc.text("High-Impedance (100V) Calculations", 14, yPos);
        yPos += 8;
        
        const highVHead = [['ID', 'Details', 'Cable Run', 'Total Power (This Line)', 'Voltage at Tap', 'Status']];
        const highVBodyRows = [];
        const highVBodyInfo = []; // Store level and status
        
        function traverseHighV(nodes, level = 0) {
            nodes.forEach(node => {
                if (!node.calculated || node.calculated.status === 'Error') return;

                const details = `${node.inputs.speakerModel}\n${node.inputs.powerTap}W Tap\nSource: ${node.inputs.ampModel || node.parentId}`;
                
                let cableRun = '';
                if (node.inputs.cable1Name && node.inputs.length1) cableRun += `${node.inputs.cable1Name} / ${node.inputs.length1}m\n`;
                if (node.inputs.cable2Name && node.inputs.length2) cableRun += `+ ${node.inputs.cable2Name} / ${node.inputs.length2}m\n`;
                cableRun += `Leg R: ${node.calculated.legResistance.toFixed(2)}Ω`;

                highVBodyRows.push([
                    ' '.repeat(level*2) + node.id,
                    details,
                    cableRun,
                    node.calculated.totalPower.toFixed(2) + 'W',
                    node.calculated.voltageAtNode.toFixed(2) + 'V',
                    node.calculated.statusMessage
                ]);
                highVBodyInfo.push({ level: level, status: node.calculated.status }); // Store info

                if(node.children) traverseHighV(node.children, level + 1);
            });
        }
        traverseHighV(appState.highVRows);
        
        doc.autoTable({
            startY: yPos,
            head: highVHead,
            body: highVBodyRows,
            theme: 'grid',
            headStyles: { fillColor: [243, 244, 246], textColor: [0,0,0], fontSize: 8, halign: 'center' },
            styles: { cellPadding: 1.5, fontSize: 7.5, valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 15 }, // ID
                1: { cellWidth: 40 }, // Details
                2: { cellWidth: 40 }, // Cable Run
                3: { cellWidth: 25, halign: 'center' }, // Total Power
                4: { cellWidth: 25, halign: 'center' }, // Voltage
                5: { cellWidth: 30 }  // Status
            },
             willDrawCell: function(data) {
                if (data.section === 'body') {
                    let info = highVBodyInfo[data.row.index];
                    let bgColor = (info.level === 0) ? [240, 253, 244] : [249, 250, 251]; // green or gray
                    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                }
            },
            didDrawCell: function(data) {
                if (data.section === 'body' && data.column.index === 5) { // Status column
                    let info = highVBodyInfo[data.row.index];
                    let color;
                    if (info.status === 'Warning') {
                        color = [254, 249, 195]; // bg-yellow-100
                    } else if (info.status === 'Hazard') {
                        color = [254, 226, 226]; // bg-red-100
                    } else if (info.status === 'OK') {
                        color = [220, 252, 231]; // bg-green-100
                    }
                    
                    if (color) {
                        doc.setFillColor(color[0], color[1], color[2]);
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                        // Redraw the text
                        doc.setTextColor(0, 0, 0);
                        doc.setFontSize(data.cell.styles.fontSize);
                        const textY = data.cell.y + data.cell.height / 2 + (data.cell.styles.fontSize / 3);
                        doc.text(data.cell.text, data.cell.x + data.cell.padding('left'), textY, { valign: 'middle' });
                    }
                }
            }
        });
    }
    
    doc.save(`Report-${project.replace(/ /g, '_') || 'System'}.pdf`);
}

// --- GLOBAL DELETE WRAPPER ---
// This is needed because the 'onclick' attribute can't see the specific delete functions directly
function deleteNodeWrapper(type, nodeId) {
    if (type === 'low-z') deleteLowZNode(nodeId);
    if (type === 'high-v') deleteHighVNode(nodeId);
}

function deleteLowZNode(nodeId) {
    showConfirmationModal(`Delete node ${nodeId} and all its children?`, () => {
        findAndRemoveNode(appState.lowZRows, nodeId);
        calculateLowZTree();
        renderLowZTable();
        populateTapSelects();
        saveState();
    });
}

function deleteHighVNode(nodeId) {
     showConfirmationModal(`Delete node ${nodeId} and all its children?`, () => {
        findAndRemoveNode(appState.highVRows, nodeId);
        calculateHighVTree();
        renderHighVTable();
        populateTapSelects();
        saveState();
    });
}

function findAndRemoveNode(nodes, nodeId) {
    for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].id === nodeId) {
            nodes.splice(i, 1);
            return true;
        }
        if (nodes[i].children) {
            if (findAndRemoveNode(nodes[i].children, nodeId)) {
                return true;
            }
        }
    }
    return false;
}


// --- INITIALIZATION ---

function init() {
    // Load state from localStorage or defaults
    loadState(); 
    
    // Set up main navigation
    setupNavigation('nav-buttons', 'nav-btn', 'view');
    
    // Set up sub-navigation tabs
    setupNavigation('calculator-tabs', 'db-nav-btn', 'db-view');
    setupNavigation('database-tabs', 'db-nav-btn', 'db-view');
    
    // Register all buttons
    initCalculatorButtons();
    initDatabaseButtons();
    initReportButtons();
    
    // Modal close buttons
    document.getElementById('message-ok')?.addEventListener('click', () => ModalManager.hide('message-modal'));
    document.getElementById('confirm-cancel')?.addEventListener('click', () => ModalManager.hide('confirmation-modal'));
    // 'confirm-ok' is now handled dynamically in showConfirmationModal

    // Populate all <select> dropdowns
    populateSelects();
    
    // Initial render of tables
    renderLowZTable();
    renderHighVTable();
    // renderAllDatabaseTables(); // This is called by setupNavigation if view is active
    
    // Show the default calculator view
    document.getElementById('calculator-view-low-z').classList.add('active');
    
    console.log('Speaker Design Tool v1.14 Initialized (with Logic Fix)');
}

// Start the application
document.addEventListener('DOMContentLoaded', init);