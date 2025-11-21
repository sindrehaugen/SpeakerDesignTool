/**
 * Speaker Design Tool v2.0.2 - Main Logic
 * Changes: 
 * - Version bump to v2.0.2
 * - Consolidated features: Project Save/Load, Headroom Checks, "Error" status.
 * - Added Unique ID generation on DB Import to handle duplicate model names.
 */

const { createApp, reactive, computed, watch, onMounted, ref } = Vue;

const app = createApp({
    setup() {
        const APP_VERSION = 'v2.0.2'; 
        
        // --- STATE ---
        let savedDb;
        try { savedDb = JSON.parse(localStorage.getItem('sdt_database_v2')); } catch (e) { savedDb = null; }

        if (!savedDb || !savedDb.speakers || !savedDb.cables || !savedDb.amplifiers) {
            savedDb = JSON.parse(JSON.stringify(DEFAULT_DATABASE));
        }

        const database = reactive(savedDb);
        const globalSettings = reactive({ temp_c: SYSTEM_DEFAULTS.physics.base_temperature_c });
        const physics = new AudioPhysics(globalSettings);

        const project = reactive({ name: 'Untitled Project' });
        
        const lowZRoots = ref([]);
        const highVRoots = ref([]);
        
        const currentView = ref('calculator');
        const calculatorMode = ref('low-z'); 
        
        const dbTab = ref('speakers');
        const dbEditMode = ref(false);
        const reportForm = reactive({ company: '', designer: '', notes: '' });
        
        const dbImportInput = ref(null);
        const projectImportInput = ref(null); 

        const dbForm = reactive({
            id: '', brand: '', impedance: 8, wattage_rms: 100, wattage_peak: 200,
            max_spl: 100, taps: '', type: 'Both', category: 'small_fullrange',
            resistance: 0, capacitance: 0, inductance: 0,
            watt_8: 0, watt_4: 0, watt_2: 0, watt_100v: 0, df: 100, min_load: 2
        });

        const inputForm = reactive({
            parentId: null, ampModel: '', speakerModel: '', cableModel: '',
            length: 10, hasTapCable: false, cableModel2: '', length2: 3,
            listenerDistance: 10,
            parallelCount: 1, tapPower: 30, useBridgeMode: false
        });

        // --- COMPUTED ---
        const speakerOptions = computed(() => {
            const m = calculatorMode.value === 'low-z' ? 'Lo-Z' : '100V';
            const list = [];
            for (const [id, s] of Object.entries(database.speakers)) {
                if (s.type === 'Both' || s.type === m) {
                    const brand = s.brand ? s.brand : 'Generic';
                    // Use the saved model name if available, otherwise fallback to ID
                    const name = s.model || id; 
                    const detail = m === 'Lo-Z' ? `${s.impedance}Ω` : '100V';
                    // ID is still used as the value, but label shows the friendly name
                    list.push({ id: id, label: `${brand} - ${name} (${detail})` });
                }
            }
            return list.sort((a,b) => a.label.localeCompare(b.label));
        });

        const cableOptions = computed(() => {
            const list = [];
            for (const [id, c] of Object.entries(database.cables)) {
                const brand = c.brand ? c.brand : 'Generic';
                const model = c.model && c.model !== id ? c.model : '';
                let label = `${brand}`;
                if(model) label += ` - ${model}`;
                label += ` (${id})`; 
                list.push({ id: id, label: label });
            }
            return list.sort((a,b) => a.label.localeCompare(b.label));
        });

        const ampOptions = computed(() => {
            const list = [];
            for (const [id, a] of Object.entries(database.amplifiers)) {
                const brand = a.brand ? a.brand : 'Generic';
                const name = a.model || id; // Use model name if available
                let details = calculatorMode.value === 'low-z' 
                    ? `${a.watt_8}W@8Ω` 
                    : `${a.watt_100v || a.watt_8}W@100V`;
                list.push({ id: id, label: `${brand} - ${name} (${details})` });
            }
            return list.sort((a,b) => a.label.localeCompare(b.label));
        });

        const activeRootNodes = computed(() => calculatorMode.value === 'low-z' ? lowZRoots.value : highVRoots.value);
        
        const activeFlatList = computed(() => {
            const l = [];
            const t = (ns) => ns.forEach(n => { l.push(n); if (n.children) t(n.children); });
            t(activeRootNodes.value);
            return l;
        });

        const flatLowZList = computed(() => {
            const l = [];
            const t = (ns) => ns.forEach(n => { l.push(n); if (n.children) t(n.children); });
            t(lowZRoots.value);
            return l;
        });
        
        const flatHighVList = computed(() => {
            const l = [];
            const t = (ns) => ns.forEach(n => { l.push(n); if (n.children) t(n.children); });
            t(highVRoots.value);
            return l;
        });

        const currentDbData = computed(() => database[dbTab.value]);

        const getDeviceLabel = (type, id) => {
            if (!id) return '-';
            if (!database[type]) return id;
            const item = database[type][id];
            // Display Model name preferentially over the ID
            return item ? `${item.brand} ${item.model || id}` : id;
        };

        // --- COMPLEX MATH HELPERS ---
        const cAdd = (a, b) => ({ real: a.real + b.real, imaginary: a.imaginary + b.imaginary });
        const cDiv = (a, b) => {
            const denom = b.real * b.real + b.imaginary * b.imaginary;
            if (denom === 0) return { real: 0, imaginary: 0 };
            return {
                real: (a.real * b.real + a.imaginary * b.imaginary) / denom,
                imaginary: (a.imaginary * b.real - a.real * b.imaginary) / denom
            };
        };
        const cInv = (a) => cDiv({ real: 1, imaginary: 0 }, a);
        const cMag = (a) => Math.sqrt(a.real * a.real + a.imaginary * a.imaginary);

        const getEffectiveNodeImpedance = (node, useMinZ = true) => {
            const speaker = database.speakers[node.speakerModel];
            if (!speaker) return { real: 999999, imaginary: 0 }; 

            const zVal = (useMinZ && speaker.z_min) ? speaker.z_min : speaker.impedance;
            const zSpeakerEffective = zVal / (node.parallelCount || 1);
            let zTotal = { real: zSpeakerEffective, imaginary: 0 };

            if (node.children && node.children.length > 0) {
                let admittance = cInv(zTotal);
                node.children.forEach(child => {
                    const childLoad = getEffectiveNodeImpedance(child, useMinZ);
                    const cable = database.cables[child.cableModel];
                    let childCableZ = { real: 0, imaginary: 0 };
                    if(cable) {
                        const len = child.length || 0;
                        const r_base = (cable.resistance * len * 2) / 1000; 
                        const r_hot = r_base * (1 + (0.00393 * (globalSettings.temp_c - 20)));
                        const L_val = cable.inductance !== undefined ? cable.inductance : 0.6;
                        const xl = 2 * Math.PI * 1000 * ((L_val * len * 2) / 1000000);
                        childCableZ = { real: r_hot, imaginary: xl };
                        if(child.cableModel2 && child.length2) {
                             const c2 = database.cables[child.cableModel2];
                             if(c2) {
                                 const r2_base = (c2.resistance * child.length2 * 2) / 1000;
                                 const r2_hot = r2_base * (1 + (0.00393 * (globalSettings.temp_c - 20)));
                                 const xl2 = 2 * Math.PI * 1000 * ((0.6 * child.length2 * 2) / 1000000);
                                 childCableZ.real += r2_hot;
                                 childCableZ.imaginary += xl2;
                             }
                        }
                    }
                    const branchZ = cAdd(childLoad, childCableZ);
                    const branchY = cInv(branchZ);
                    admittance = cAdd(admittance, branchY);
                });
                zTotal = cInv(admittance);
            }
            return zTotal;
        };

        // --- CALCULATION ENGINE ---
        const calculateAll = () => {
            if (Object.keys(database.speakers).length === 0) return;
            lowZRoots.value.forEach(root => { try { calculateLowZBranch(root); } catch(e) { console.error(e); } });
            highVRoots.value.forEach(root => { try { calculateHighVBranch(root); } catch(e) { console.error(e); } });
        };

        const getTotalRMS = (node) => {
            const speaker = database.speakers[node.speakerModel];
            let rms = speaker ? (speaker.wattage_rms * (node.parallelCount || 1)) : 0;
            if (node.children) {
                node.children.forEach(c => rms += getTotalRMS(c));
            }
            return rms;
        };

        const calculateLowZBranch = (node, parentVolts = null, parentCumulativeR = 0, rootSourceVoltage = null, rootAmpModel = null) => {
            const speaker = database.speakers[node.speakerModel];
            const cable1 = database.cables[node.cableModel];
            
            if (!speaker || !cable1) { node.results = { status: 'Error', statusMsg: 'Missing Data' }; return; }

            let sourceVoltage = parentVolts;
            let ampZ = 0;
            let currentRootVoltage = rootSourceVoltage;
            let currentRootAmp = rootAmpModel;

            const useBridge = node.inputs?.useBridgeMode || node.useBridgeMode || false;
            const parallel = node.inputs?.parallelCount || node.parallelCount || 1;
            
            if (!node.parentId) {
                const ampModel = node.inputs?.ampModel || node.ampModel;
                const rootAmp = database.amplifiers[ampModel];
                if(rootAmp) {
                    const power = useBridge ? (rootAmp.watt_bridge_8 || 0) : rootAmp.watt_8;
                    sourceVoltage = Math.sqrt(power * 8); // Ref voltage @ 8Ω
                    currentRootVoltage = sourceVoltage; 
                    currentRootAmp = rootAmp;
                    ampZ = 8 / (rootAmp.df || 100);
                }
            }
            const safeVolts = sourceVoltage || 100;
            const safeRootVolts = currentRootVoltage || safeVolts;

            const zMain = physics.getCableImpedance(cable1, node.length, 1000, globalSettings.temp_c);
            let zTotalCable = zMain;
            
            const cm2 = node.inputs?.cableModel2 || node.cableModel2;
            const l2 = node.inputs?.length2 || node.length2;
            
            if (cm2 && l2 > 0) {
                const cable2 = database.cables[cm2];
                if (cable2) zTotalCable = zTotalCable.add(physics.getCableImpedance(cable2, l2, 1000, globalSettings.temp_c));
            }

            const zEffectiveMin = getEffectiveNodeImpedance(node, true);
            const zEffectiveNom = getEffectiveNodeImpedance(node, false);
            const zMinMagnitude = cMag(zEffectiveMin); 
            
            const tx = physics.calculateTransmission(safeVolts, zMinMagnitude, zTotalCable);
            const totalDropPercent = safeRootVolts > 0 ? ((safeRootVolts - tx.voltageAtLoad) / safeRootVolts) * 100 : 0;

            const electricalLossDb = physics.calculateElectricalSPLLoss(tx.voltageAtLoad, safeRootVolts);
            const cumulativeR = parentCumulativeR + tx.cableResistance;
            const zSpeakerNom = (speaker.impedance) / parallel;
            const totalDF = physics.calculateDampingFactor(zSpeakerNom, ampZ, cumulativeR);
            const hfCheck = physics.calculateHFLoss(safeVolts, zMinMagnitude, cable1, node.length, globalSettings.temp_c);
            
            let status = 'OK';
            let statusMsg = '';

            // Voltage & DF Checks
            if (totalDropPercent > 5) { status = 'Warning'; statusMsg = 'High VD'; }
            if (totalDF < 20 && status !== 'Error') { status = 'Warning'; statusMsg = 'Low DF'; }
            if (totalDropPercent > 10) { status = 'Error'; statusMsg = 'High VD'; }
            if (totalDF < 10) { status = 'Error'; statusMsg = 'Low DF'; }

            // HEADROOM CHECK
            if (currentRootAmp && !node.parentId) {
                const totalWatts = getTotalRMS(node);
                let ampCapacity = currentRootAmp.watt_8;
                const systemNominalZ = cMag(cAdd(zEffectiveNom, zTotalCable));
                
                if (useBridge) {
                    if (systemNominalZ < 6 && currentRootAmp.watt_bridge_4) ampCapacity = currentRootAmp.watt_bridge_4;
                    else if (currentRootAmp.watt_bridge_8) ampCapacity = currentRootAmp.watt_bridge_8;
                } else {
                    if (systemNominalZ < 3 && currentRootAmp.watt_2) ampCapacity = currentRootAmp.watt_2;
                    else if (systemNominalZ < 6 && currentRootAmp.watt_4) ampCapacity = currentRootAmp.watt_4;
                }

                const isHeavy = speaker.category === 'subwoofer' || speaker.category === 'large_fullrange';
                const thresholdPct = isHeavy ? 0.80 : 0.85;
                
                if (ampCapacity > 0 && totalWatts > (ampCapacity * thresholdPct)) {
                    const level = status === 'Error' ? 'Error' : 'Warning'; 
                    status = level;
                    statusMsg = 'Low Headroom';
                }
            }

            node.results = {
                minLoad: cMag(cAdd(zEffectiveMin, zTotalCable)),
                nomLoad: cMag(cAdd(zEffectiveNom, zTotalCable)),
                voltageAtSpeaker: tx.voltageAtLoad,
                dropPercent: totalDropPercent, 
                powerLoss: tx.powerSource - tx.powerLoad,
                splLoss: electricalLossDb, 
                totalDF: totalDF,
                hfLoss: hfCheck,
                status: status,
                statusMessage: statusMsg
            };

            if (node.children) {
                node.children.forEach(child => calculateLowZBranch(child, tx.voltageAtLoad, cumulativeR, safeRootVolts, currentRootAmp));
            }
        };

        const calculateHighVBranch = (node, parentVolts = 100, rootAmpModel = null) => {
            const cable = database.cables[node.cableModel];
            const speaker = database.speakers[node.speakerModel];
            if (!cable || !speaker) return;
            
            let currentRootAmp = rootAmpModel;
            if(!node.parentId) {
                 const ampModel = node.inputs?.ampModel || node.ampModel;
                 currentRootAmp = database.amplifiers[ampModel];
            }

            const zCable = physics.getCableImpedance(cable, node.length, 1000, globalSettings.temp_c);
            const totalP = getTotalPower(node);
            const current = totalP / (parentVolts || 100);
            const dropVolts = current * zCable.magnitude();
            const voltsAtNode = parentVolts - dropVolts;
            const dropPercent = ((100 - voltsAtNode) / 100) * 100; 
            const powerLoss = Math.pow(current, 2) * zCable.real;

            let status = 'OK';
            let statusMsg = '';
            if (voltsAtNode < 95) { status = 'Warning'; statusMsg = 'Low V'; }
            if (voltsAtNode < 90) { status = 'Error'; statusMsg = 'Low V'; }

            if (currentRootAmp && !node.parentId) {
                const ampCap = currentRootAmp.watt_100v || currentRootAmp.watt_8;
                const isHeavy = speaker.category === 'subwoofer' || speaker.category === 'large_fullrange';
                const thresholdPct = isHeavy ? 0.80 : 0.85;

                if(ampCap > 0 && totalP > (ampCap * thresholdPct)) {
                     const level = status === 'Error' ? 'Error' : 'Warning';
                     status = level;
                     statusMsg = 'Low Headroom';
                }
            }

            const hfCheck = physics.calculateHFLoss(parentVolts, (Math.pow(parentVolts, 2) / (totalP || 1)), cable, node.length, globalSettings.temp_c);
            
            node.results = {
                voltageAtSpeaker: voltsAtNode,
                dropPercent: dropPercent,
                dropVolts: dropVolts,
                totalPower: totalP,
                powerLoss: powerLoss,
                hfLoss: hfCheck,
                status: status,
                statusMessage: statusMsg
            };

            if (node.children) node.children.forEach(child => calculateHighVBranch(child, voltsAtNode, currentRootAmp));
        };

        const getTotalPower = (node) => {
            let p = node.tapPower || 0; 
            if (node.children) node.children.forEach(child => p += getTotalPower(child));
            return p;
        };

        const reportSummary = computed(() => {
            let totalNodes = 0, totalPower = 0, warnings = 0, errors = 0;
            const process = (list) => list.forEach(n => {
                totalNodes++;
                if(n.results) {
                    if (n.results.status === 'Warning') warnings++;
                    if (n.results.status === 'Error') errors++;
                    if(n.tapPower) totalPower += n.tapPower; 
                    else if (n.results.minLoad > 0 && !n.parentId) totalPower += Math.pow(n.results.voltageAtSpeaker, 2) / n.results.minLoad;
                }
            });
            process(flatLowZList.value);
            process(flatHighVList.value);
            return { totalNodes, totalPower, warnings, errors };
        });

        const createNodeStruct = (id) => ({
            id, parentId: inputForm.parentId, speakerModel: inputForm.speakerModel,
            cableModel: inputForm.cableModel, length: inputForm.length,
            cableModel2: inputForm.hasTapCable ? inputForm.cableModel2 : null,
            length2: inputForm.hasTapCable ? inputForm.length2 : 0,
            parallelCount: inputForm.parallelCount, tapPower: inputForm.tapPower,
            inputs: { ...inputForm },
            userLabel: '', 
            ampModel: !inputForm.parentId ? inputForm.ampModel : null,
            useBridgeMode: inputForm.useBridgeMode, children: [], results: {}
        });

        const addNode = () => {
            const isLowZ = calculatorMode.value === 'low-z';
            const prefix = isLowZ ? 'L' : 'H';
            const targetRoots = isLowZ ? lowZRoots : highVRoots;
            let newId;
            if (!inputForm.parentId) {
                newId = `${prefix}-${targetRoots.value.length + 1}`;
                targetRoots.value.push(createNodeStruct(newId));
            } else {
                const parent = activeFlatList.value.find(n => n.id === inputForm.parentId);
                if (parent) {
                    if (!parent.children) parent.children = [];
                    newId = `${parent.id}.${parent.children.length + 1}`;
                    parent.children.push(createNodeStruct(newId));
                }
            }
            calculateAll();
        };

        const deleteNode = (id) => {
            if (!confirm("Delete?")) return;
            const rem = (ns) => {
                const idx = ns.findIndex(n => n.id === id);
                if (idx > -1) { ns.splice(idx, 1); return true; }
                for (let n of ns) if (n.children && rem(n.children)) return true;
                return false;
            };
            rem(lowZRoots.value);
            rem(highVRoots.value);
            calculateAll();
        };
        
        const clearCurrentResults = () => {
            if(confirm("Clear current calculations?")) {
                if(calculatorMode.value === 'low-z') lowZRoots.value = [];
                else highVRoots.value = [];
            }
        };

        // --- SAVE / LOAD PROJECT ---
        const triggerProjectImport = () => {
            if (projectImportInput.value) projectImportInput.value.click();
        };

        const exportProjectCsv = () => {
            const rows = [['Type', 'ID', 'ParentID', 'Name', 'AmpModel', 'SpeakerModel', 'CableModel', 'Length', 'CableModel2', 'Length2', 'Parallel', 'TapPower', 'Bridge']];
            
            const serializeNode = (node, type) => {
                rows.push([
                    type, node.id, node.parentId || '', node.userLabel || '', 
                    node.inputs.ampModel || '', node.inputs.speakerModel, 
                    node.inputs.cableModel, node.inputs.length,
                    node.inputs.cableModel2 || '', node.inputs.length2 || 0,
                    node.inputs.parallelCount, node.inputs.tapPower,
                    node.inputs.useBridgeMode ? '1' : '0'
                ]);
                if(node.children) node.children.forEach(c => serializeNode(c, type));
            };

            lowZRoots.value.forEach(n => serializeNode(n, 'Low-Z'));
            highVRoots.value.forEach(n => serializeNode(n, '100V'));

            const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
            const link = document.createElement("a");
            link.href = encodeURI(csvContent);
            link.download = `${project.name || 'Untitled'} - Calculations.csv`;
            link.click();
        };

        const loadProjectCsv = (e) => {
            const file = e.target.files[0]; if(!file) return;
            const r = new FileReader();
            r.onload = (ev) => {
                const lines = ev.target.result.split('\n');
                if(lines.length < 2) return alert("Invalid File");
                
                if(confirm("This will overwrite current calculations. Continue?")) {
                    lowZRoots.value = [];
                    highVRoots.value = [];
                    
                    const nodes = [];
                    for(let i=1; i<lines.length; i++) {
                        const line = lines[i].trim();
                        if(!line) continue;
                        const cols = line.split(',');
                        
                        if(cols.length < 12) continue;

                        const node = {
                            id: cols[1],
                            parentId: cols[2] || null,
                            userLabel: cols[3],
                            speakerModel: cols[5],
                            cableModel: cols[6],
                            length: parseFloat(cols[7]),
                            cableModel2: cols[8],
                            length2: parseFloat(cols[9]),
                            parallelCount: parseFloat(cols[10]),
                            tapPower: parseFloat(cols[11]),
                            ampModel: cols[4],
                            useBridgeMode: cols[12] === '1',
                            inputs: {},
                            children: [], results: {},
                            type: cols[0]
                        };
                        
                        node.inputs = {
                            ampModel: node.ampModel, speakerModel: node.speakerModel,
                            cableModel: node.cableModel, length: node.length,
                            cableModel2: node.cableModel2, length2: node.length2,
                            parallelCount: node.parallelCount, tapPower: node.tapPower,
                            useBridgeMode: node.useBridgeMode,
                            hasTapCable: !!node.cableModel2
                        };
                        
                        nodes.push(node);
                    }

                    nodes.forEach(n => {
                        const targetList = n.type === 'Low-Z' ? lowZRoots.value : highVRoots.value;
                        if(!n.parentId) {
                            targetList.push(n);
                        } else {
                            const parent = nodes.find(p => p.id === n.parentId);
                            if(parent) {
                                if(!parent.children) parent.children = [];
                                parent.children.push(n);
                            }
                        }
                    });
                    
                    calculateAll();
                    alert("Project Loaded Successfully.");
                }
                e.target.value = null;
            };
            r.readAsText(file);
        };

        // --- DB Logic ---
        const saveDbItem = () => {
            const type = dbTab.value;
            const id = dbForm.id;
            if(!id) return;
            const item = { ...dbForm };
            delete item.id;
            if(type !== 'speakers') { delete item.impedance; delete item.taps; }
            if(type !== 'cables') { delete item.resistance; }
            database[type][id] = item;
            dbEditMode.value = false;
            alert("Saved.");
        };

        const editDbItem = (key) => {
            Object.assign(dbForm, database[dbTab.value][key]);
            dbForm.id = key;
            dbEditMode.value = true;
        };
        
        const deleteDbItem = (t, k) => {
             if(DEFAULT_DATABASE[t][k]) return alert("Cannot delete default.");
             if(confirm("Delete?")) delete database[t][k];
        };
        
        const resetDbForm = () => { dbEditMode.value=false; dbForm.id=''; };
        const resetDbDefaults = () => { if(confirm("Reset?")) Object.assign(database, JSON.parse(JSON.stringify(DEFAULT_DATABASE))); };
        
        const exportDbCsv = () => {
            const data = database[dbTab.value];
            const csv = "data:text/csv;charset=utf-8," + Object.keys(data).map(k => `${k},${Object.values(data[k]).join(',')}`).join("\n");
            const link = document.createElement("a");
            link.href = encodeURI(csv); link.download = `${dbTab.value}.csv`;
            link.click();
        };

        const triggerDbImport = () => {
            if (dbImportInput.value) dbImportInput.value.click();
            else alert("Import input not initialized.");
        };
        
        // UPDATED: Import handler that generates unique IDs
        const handleDbImport = (e) => {
             const file = e.target.files[0]; if(!file) return;
             const r = new FileReader();
             r.onload = (ev) => {
                 const lines = ev.target.result.split('\n');
                 if(lines.length < 2) return alert("Invalid File");
                 
                 const headers = lines[0].split(',').map(h => h.replace(/['"]+/g, '').trim().toLowerCase());
                 let c=0;
                 
                 for(let i=1; i<lines.length; i++) {
                     const line = lines[i].trim();
                     if(!line) continue;
                     const vals = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                     if(vals.length >= headers.length) {
                         // 1. Capture Model Name
                         const modelName = vals[0].replace(/['"]+/g, '').trim();
                         if(!modelName) continue;

                         // 2. Generate Unique ID
                         let newId;
                         do {
                             newId = Math.floor(10000 + Math.random() * 90000).toString();
                         } while (database[dbTab.value][newId]);

                         const obj={};
                         // 3. Save Model Name explicitly
                         obj.model = modelName;

                         const dbKeys = Object.keys(DEFAULT_DATABASE[dbTab.value][Object.keys(DEFAULT_DATABASE[dbTab.value])[0]]);
                         
                         dbKeys.forEach(key => {
                             const idx = headers.indexOf(key.toLowerCase());
                             if(idx > 0) {
                                 let val = vals[idx].replace(/['"]+/g, '').trim();
                                 const isNumericField = !['brand', 'taps', 'model', 'type', 'category'].includes(key.toLowerCase());
                                 const looksLikeNumber = /^-?\d*(\.\d+)?$/.test(val);
                                 if(isNumericField && looksLikeNumber) val = parseFloat(val);
                                 obj[key] = val;
                             }
                         });
                         
                         database[dbTab.value][newId] = obj; 
                         c++;
                     }
                 }
                 alert(`Imported ${c} items.`);
                 e.target.value = null;
             };
             r.readAsText(file);
        };

        const getSpeakerTaps = (m) => {
            const s = database.speakers[m];
            return s && s.taps ? s.taps.toString().split(',').map(t => parseFloat(t)) : [];
        };
        
        const getStatusClass = (s) => s==='OK'?'badge-ok':(s==='Warning'?'badge-warn':'badge-danger');

        // --- PDF ---
        const generatePdf = () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            
            doc.setFillColor(24, 24, 27); doc.rect(0,0,210,25,'F');
            doc.setTextColor(255); doc.setFontSize(14); doc.text("Audio Systems Design Report", 14, 12);
            doc.setFontSize(8); doc.text(`Generated by Speaker Design Tool ${APP_VERSION}`, 14, 18);
            
            doc.setTextColor(0); doc.setFontSize(10);
            let y = 40;
            doc.text(`Project: ${project.name}`, 14, y);
            doc.text(`Company: ${reportForm.company}`, 14, y+6);
            doc.text(`Designer: ${reportForm.designer}`, 14, y+12);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);
            y += 20;

            const bom = {};
            const addToBom = (key, type, qty) => {
                if(!bom[key]) bom[key] = { type, qty: 0 };
                bom[key].qty += qty;
            };

            const scanNodes = (nodes) => {
                nodes.forEach(n => {
                    if(!n.parentId) {
                        const ampId = n.inputs?.ampModel || n.ampModel;
                        const ampName = getDeviceLabel('amplifiers', ampId);
                        addToBom(ampName, 'Amplifier Ch.', 1);
                    }
                    
                    const spkId = n.inputs?.speakerModel || n.speakerModel;
                    const spkName = getDeviceLabel('speakers', spkId);
                    addToBom(spkName, 'Speaker', n.inputs?.parallelCount || n.parallelCount || 1);
                    
                    const c1Id = n.inputs?.cableModel || n.cableModel;
                    const c1Name = getDeviceLabel('cables', c1Id);
                    addToBom(c1Name, 'Cable (m)', n.inputs?.length || n.length);
                    
                    const c2Id = n.inputs?.cableModel2 || n.cableModel2;
                    const l2 = n.inputs?.length2 || n.length2;
                    if(c2Id && l2 > 0) {
                        const c2Name = getDeviceLabel('cables', c2Id);
                        addToBom(c2Name, 'Cable (m)', l2);
                    }
                    
                    if(n.children) scanNodes(n.children);
                });
            };
            scanNodes(lowZRoots.value);
            scanNodes(highVRoots.value);

            const bomBody = Object.entries(bom).map(([k, v]) => [k, v.type, v.qty]);
            doc.autoTable({
                startY: y,
                head: [['Item', 'Type', 'Quantity / Length']],
                body: bomBody,
                theme: 'striped',
                headStyles: { fillColor: [82, 82, 91] },
                styles: { fontSize: 8 }
            });
            y = doc.lastAutoTable.finalY + 15;

            const buildRows = (list, mode) => {
                const r = [];
                const t = (ns) => ns.forEach(n => {
                    const res = n.results || {};
                    const len = n.inputs?.length || n.length;
                    const len2 = n.inputs?.length2 || n.length2;
                    
                    const deviceName = getDeviceLabel('speakers', n.speakerModel);
                    const label = n.userLabel ? `(${n.userLabel}) ` : '';

                    let cableStr = `${len}m`;
                    if(len2) cableStr += ` + ${len2}m`;

                    r.push([
                        n.id, label + deviceName, 
                        cableStr,
                        mode==='low-z' ? `${res.minLoad?.toFixed(2)}Ω` : `${res.totalPower?.toFixed(1)}W`,
                        mode==='low-z' ? `${res.nomLoad?.toFixed(2)}Ω` : '-',
                        mode==='low-z' ? `${res.dropPercent?.toFixed(2)}%` : `${res.voltageAtSpeaker?.toFixed(1)}V`,
                        `${res.powerLoss?.toFixed(1)}W`,
                        mode==='low-z' ? `${res.splLoss?.toFixed(2)}dB` : `${res.voltageAtSpeaker?.toFixed(1)}V`,
                        res.status
                    ]);
                    if(n.children) t(n.children);
                });
                t(list);
                return r;
            };

            if(lowZRoots.value.length > 0) {
                doc.text("Low-Impedance Systems", 14, y);
                doc.autoTable({
                    startY: y+5,
                    head: [['ID','Device','Cable','Min Load','Nom Load','V.Drop','Loss','Elec. Loss','Status']],
                    body: buildRows(lowZRoots.value, 'low-z'),
                    headStyles: { fillColor: [63, 63, 70] },
                    styles: { fontSize: 8 }
                });
                y = doc.lastAutoTable.finalY + 15;
            }

            if(highVRoots.value.length > 0) {
                doc.text("100V Systems", 14, y);
                doc.autoTable({
                    startY: y+5,
                    head: [['ID','Device','Cable','Power','-','V @ Tap','Loss','V @ Speaker','Status']],
                    body: buildRows(highVRoots.value, 'high-v'),
                    headStyles: { fillColor: [63, 63, 70] },
                    styles: { fontSize: 8 }
                });
            }
            doc.save(`${project.name || 'Audio_System'}_Report.pdf`);
        };

        watch(globalSettings, calculateAll, { deep: true });
        watch(database, (v) => localStorage.setItem('sdt_database_v2', JSON.stringify(v)), { deep: true });

        onMounted(() => {
            if (Object.keys(database.amplifiers).length > 0) inputForm.ampModel = Object.keys(database.amplifiers)[0];
            if (Object.keys(database.speakers).length > 0) inputForm.speakerModel = Object.keys(database.speakers)[0];
            if (Object.keys(database.cables).length > 0) {
                inputForm.cableModel = Object.keys(database.cables)[0];
                inputForm.cableModel2 = Object.keys(database.cables)[0];
            }
            
            calculateAll();
        });

        return {
            APP_VERSION, database, globalSettings, project, reportForm, 
            currentView, calculatorMode, dbTab, dbEditMode, dbForm, inputForm,
            activeRootNodes, activeFlatList, flatLowZList, flatHighVList, 
            speakerOptions, cableOptions, ampOptions, currentDbData, reportSummary,
            dbImportInput, projectImportInput, getDeviceLabel, 
            addNode, deleteNode, clearCurrentResults,
            saveDbItem, editDbItem, deleteDbItem, resetDbForm, resetDbDefaults,
            exportDbCsv, triggerDbImport, handleDbImport, generatePdf,
            exportProjectCsv, triggerProjectImport, loadProjectCsv,
            getSpeakerTaps, getStatusClass
        };
    }
});

app.component('tree-node', {
    template: '#tree-node-template',
    props: ['node', 'mode', 'getLabel'], 
    emits: ['delete'],
    setup(props) {
        const getStatusClass = (s) => s==='OK'?'badge-ok':(s==='Warning'?'badge-warn':'badge-danger');
        return { getStatusClass };
    }
});

app.mount('#app');
