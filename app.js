/**
 * Speaker Design Tool v2.3.6
 * Fixes: Auto-Repair Database (Corrupt Types), Smart Keyword Scanning for Import
 */

const { createApp, reactive, computed, watch, onMounted, ref } = Vue;

// --- CONFIGURATION PROFILES ---
const QUALITY_PROFILES = {
    'high-end': {
        label: 'High-End / Reference',
        description: 'Strict limits for critical listening, concert PA, and studios.',
        thresholds: {
            lowz_vd_warn: 5.0, lowz_vd_err: 10.0,
            highv_vd_warn: 5.0, highv_vd_err: 10.0,
            df_warn: 20, df_err: 10,
            headroom_warn: 0.80,
            hf_check_freq: 10000
        }
    },
    'average': {
        label: 'Commercial / BGM',
        description: 'Standard balance for retail, hospitality, and background music.',
        thresholds: {
            lowz_vd_warn: 10.0, lowz_vd_err: 15.0,
            highv_vd_warn: 10.0, highv_vd_err: 20.0,
            df_warn: 10, df_err: 5,
            headroom_warn: 0.90,
            hf_check_freq: 6000
        }
    },
    'speech': {
        label: 'Speech Only',
        description: 'Optimized for intelligibility and paging; tolerates higher loss.',
        thresholds: {
            lowz_vd_warn: 15.0, lowz_vd_err: 25.0,
            highv_vd_warn: 15.0, highv_vd_err: 25.0,
            df_warn: 5, df_err: 2,
            headroom_warn: 0.95,
            hf_check_freq: 4000
        }
    }
};

const app = createApp({
    setup() {
        const APP_VERSION = 'v2.3.6'; 
        
        // --- STATE ---
        let savedDb;
        try { savedDb = JSON.parse(localStorage.getItem('sdt_database_v2')); } catch (e) { savedDb = null; }

        if (!savedDb || !savedDb.speakers || !savedDb.cables || !savedDb.amplifiers) {
            savedDb = JSON.parse(JSON.stringify(DEFAULT_DATABASE));
        }

        // --- AUTO-REPAIR DATABASE ON LOAD ---
        // Fixes issues where "Type" became a number due to CSV shifting
        let dbDirty = false;
        if (savedDb.speakers) {
            for (const key in savedDb.speakers) {
                const s = savedDb.speakers[key];
                const validTypes = ['Lo-Z', '100V', 'Both', 'Active'];
                
                // If type is missing or invalid (e.g. it's a number like "7.5" from a bad import)
                if (!s.type || !validTypes.includes(s.type)) {
                    // Guess based on data
                    if (s.impedance && (s.taps || s.wattage_100v)) s.type = 'Both';
                    else if (s.impedance) s.type = 'Lo-Z';
                    else if (s.taps) s.type = '100V';
                    else s.type = 'Both'; // Fallback
                    dbDirty = true;
                }
            }
        }
        if (dbDirty) {
            localStorage.setItem('sdt_database_v2', JSON.stringify(savedDb));
            console.log("Database auto-repaired.");
        }

        const database = reactive(savedDb);
        const globalSettings = reactive({ temp_c: SYSTEM_DEFAULTS.physics.base_temperature_c });
        const physics = new AudioPhysics(globalSettings);

        const project = reactive({ name: 'Untitled Project' });
        
        const lowZRoots = ref([]);
        const highVRoots = ref([]);
        
        const currentView = ref('calculator');
        const calculatorMode = ref('low-z'); 
        const qualityMode = ref('high-end');

        const dbTab = ref('speakers');
        const dbEditMode = ref(false);
        const reportForm = reactive({ company: '', designer: '', notes: '' });
        
        const dbImportInput = ref(null);
        const projectImportInput = ref(null); 

        const dbForm = reactive({
            id: '', brand: '', model: '', impedance: 8, wattage_rms: 100, wattage_peak: 200,
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

        // --- COMPUTED HELPERS ---
        const currentProfile = computed(() => QUALITY_PROFILES[qualityMode.value]);

        const findIdByProps = (type, brand, model) => {
            const dbSet = database[type];
            if (!dbSet) return null;
            if (model && dbSet[model]) return model;
            if (brand && model) {
                const qBrand = brand.trim().toLowerCase();
                const qModel = model.trim().toLowerCase();
                for (const [id, item] of Object.entries(dbSet)) {
                    const dbBrand = (item.brand || '').trim().toLowerCase();
                    const dbModel = (item.model || id).trim().toLowerCase();
                    if (dbBrand === qBrand && dbModel === qModel) return id;
                }
            }
            return null; 
        };

        const getDeviceLabel = (type, id) => {
            if (!id) return '-';
            if (!database[type]) return id;
            const item = database[type][id];
            return item ? `${item.brand} ${item.model || id}` : id;
        };
        
        const getDeviceDetails = (type, id) => {
            const item = database[type]?.[id];
            if (!item) return { id: '', brand: '', model: id || '' };
            return { id: id, brand: item.brand || 'Generic', model: item.model || id };
        };

        const speakerOptions = computed(() => {
            const m = calculatorMode.value === 'low-z' ? 'Lo-Z' : '100V';
            const list = [];
            for (const [id, s] of Object.entries(database.speakers)) {
                const type = s.type || 'Both'; // Default to Both if undefined
                if (type === 'Both' || type === m) {
                    const brand = s.brand ? s.brand : 'Generic';
                    const name = s.model || id; 
                    const detail = m === 'Lo-Z' ? `${s.impedance}Ω` : '100V';
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
                list.push({ id: id, label: label });
            }
            return list.sort((a,b) => a.label.localeCompare(b.label));
        });

        const ampOptions = computed(() => {
            const list = [];
            for (const [id, a] of Object.entries(database.amplifiers)) {
                const brand = a.brand ? a.brand : 'Generic';
                const name = a.model || id; 
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

        const currentDbData = computed(() => {
            const raw = database[dbTab.value];
            return Object.entries(raw).map(([k, v]) => ({ ...v, id: k })).sort((a, b) => {
                const ba = (a.brand || '').toString().toLowerCase();
                const bb = (b.brand || '').toString().toLowerCase();
                if (ba < bb) return -1;
                if (ba > bb) return 1;
                
                const ma = (a.model || a.id).toString().toLowerCase();
                const mb = (b.model || b.id).toString().toLowerCase();
                return ma.localeCompare(mb);
            });
        });

        // --- PHYSICS ENGINE ---
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

        // --- CALCULATION LOOP ---
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
            const limits = currentProfile.value.thresholds;
            
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
                    sourceVoltage = Math.sqrt(power * 8);
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
            const hfCheck = physics.calculateHFLoss(safeVolts, zMinMagnitude, cable1, node.length, globalSettings.temp_c, limits.hf_check_freq);
            
            let status = 'OK';
            let statusMsg = '';

            if (totalDropPercent > limits.lowz_vd_warn) { status = 'Warning'; statusMsg = 'High VD'; }
            if (totalDF < limits.df_warn && status !== 'Error') { status = 'Warning'; statusMsg = 'Low DF'; }
            if (totalDropPercent > limits.lowz_vd_err) { status = 'Error'; statusMsg = 'Critical VD'; }
            if (totalDF < limits.df_err) { status = 'Error'; statusMsg = 'Critical DF'; }

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

                const thresholdPct = limits.headroom_warn; 
                
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
            const limits = currentProfile.value.thresholds;

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
            if (dropPercent > limits.highv_vd_warn) { status = 'Warning'; statusMsg = 'Low V'; }
            if (dropPercent > limits.highv_vd_err) { status = 'Error'; statusMsg = 'Critical V'; }

            if (currentRootAmp && !node.parentId) {
                const ampCap = currentRootAmp.watt_100v || currentRootAmp.watt_8;
                const thresholdPct = limits.headroom_warn;

                if(ampCap > 0 && totalP > (ampCap * thresholdPct)) {
                     const level = status === 'Error' ? 'Error' : 'Warning';
                     status = level;
                     statusMsg = 'Low Headroom';
                }
            }

            const hfCheck = physics.calculateHFLoss(parentVolts, (Math.pow(parentVolts, 2) / (totalP || 1)), cable, node.length, globalSettings.temp_c, limits.hf_check_freq);
            
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

        const triggerProjectImport = () => {
            if (projectImportInput.value) projectImportInput.value.click();
        };

        // --- ROBUST CSV EXPORT ---
        const exportProjectCsv = () => {
            const headers = [
                'Type', 'ID', 'ParentID', 'UserLabel',
                'AmpID', 'AmpBrand', 'AmpModel',
                'SpeakerID', 'SpeakerBrand', 'SpeakerModel',
                'CableID', 'CableBrand', 'CableModel', 'Length',
                'Cable2ID', 'Cable2Brand', 'Cable2Model', 'Length2',
                'Parallel', 'TapPower', 'Bridge'
            ];
            const rows = [headers];
            
            const serializeNode = (node, type) => {
                const amp = node.inputs.ampModel ? getDeviceDetails('amplifiers', node.inputs.ampModel) : {id:'', brand:'', model:''};
                const spk = getDeviceDetails('speakers', node.inputs.speakerModel);
                const cab = getDeviceDetails('cables', node.inputs.cableModel);
                const cab2 = node.inputs.cableModel2 ? getDeviceDetails('cables', node.inputs.cableModel2) : {id:'', brand:'', model:''};

                rows.push([
                    type, node.id, node.parentId || '', node.userLabel || '', 
                    amp.id, amp.brand, amp.model,
                    spk.id, spk.brand, spk.model,
                    cab.id, cab.brand, cab.model, node.inputs.length,
                    cab2.id, cab2.brand, cab2.model, node.inputs.length2 || 0,
                    node.inputs.parallelCount, node.inputs.tapPower,
                    node.inputs.useBridgeMode ? '1' : '0'
                ]);
                if(node.children) node.children.forEach(c => serializeNode(c, type));
            };

            lowZRoots.value.forEach(n => serializeNode(n, 'Low-Z'));
            highVRoots.value.forEach(n => serializeNode(n, '100V'));

            const escapeCsv = (str) => {
                if (str === null || str === undefined) return '';
                const s = String(str);
                if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
                return s;
            };

            const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(escapeCsv).join(",")).join("\n");
            const link = document.createElement("a");
            link.href = encodeURI(csvContent);
            link.download = `${project.name || 'Untitled'} - Calculations_v2.3.csv`;
            link.click();
        };

        // --- SMART CSV IMPORT (FIXED FOR UNQUOTED TAPS & KEYWORD SCANNING) ---
        const loadProjectCsv = (e) => {
            const file = e.target.files[0]; if(!file) return;
            const r = new FileReader();
            r.onload = (ev) => {
                const lines = ev.target.result.split('\n');
                if(lines.length < 2) return alert("Invalid File");
                
                if(confirm("This will overwrite current calculations. Continue?")) {
                    lowZRoots.value = [];
                    highVRoots.value = [];
                    
                    const resolutionCache = {};

                    const resolveDevice = (type, csvId, csvBrand, csvModel) => {
                        if(!csvId && !csvModel) return null; 
                        
                        const typeLabel = type.slice(0,-1); 
                        const cacheKey = `${type}:${csvId}:${csvBrand}:${csvModel}`;
                        if(resolutionCache[cacheKey]) return resolutionCache[cacheKey];

                        const dbItem = database[type][csvId];
                        if (dbItem) {
                            const dbBrand = (dbItem.brand || '').trim().toLowerCase();
                            const dbModel = (dbItem.model || csvId).trim().toLowerCase();
                            const cBrand = (csvBrand || '').trim().toLowerCase();
                            const cModel = (csvModel || '').trim().toLowerCase();

                            if (dbBrand === cBrand && dbModel === cModel) return csvId; 
                            
                            const betterMatchId = findIdByProps(type, csvBrand, csvModel);
                            if (betterMatchId) {
                                if (confirm(`Conflict for ${typeLabel}:\nFile ID: ${csvId} (${csvBrand} ${csvModel})\nDB ID: ${csvId} (${dbItem.brand} ${dbItem.model||csvId})\n\nFound exact match elsewhere in DB (ID: ${betterMatchId}).\nUse exact match?`)) {
                                    resolutionCache[cacheKey] = betterMatchId;
                                    return betterMatchId;
                                }
                            } else {
                                if (!confirm(`Conflict for ${typeLabel}:\nFile ID: ${csvId} (${csvBrand} ${csvModel})\nDB ID: ${csvId} (${dbItem.brand} ${dbItem.model||csvId})\n\nNo exact match found. Keep using DB item?`)) {
                                    return null; 
                                }
                            }
                            return csvId;
                        }

                        const matchId = findIdByProps(type, csvBrand, csvModel);
                        if (matchId) {
                            if (confirm(`${typeLabel} ID '${csvId}' not found.\nFound matching: ${csvBrand} ${csvModel} (ID: ${matchId}).\n\nMap to this device?`)) {
                                resolutionCache[cacheKey] = matchId;
                                return matchId;
                            }
                        }
                        
                        console.warn(`Skipping ${typeLabel}: ${csvId} (${csvBrand} ${csvModel}) not found.`);
                        return null;
                    };

                    const parseLine = (text) => {
                        const res = [];
                        let cur = ''; let inQuote = false;
                        for (let i=0; i<text.length; i++) {
                            const c = text[i];
                            if (c === '"') {
                                if (inQuote && text[i+1] === '"') { cur += '"'; i++; } 
                                else { inQuote = !inQuote; }
                            } else if (c === ',' && !inQuote) { res.push(cur); cur = ''; } 
                            else { cur += c; }
                        }
                        res.push(cur);
                        return res;
                    };

                    for(let i=1; i<lines.length; i++) {
                        const line = lines[i].trim();
                        if(!line) continue;
                        const cols = parseLine(line).map(s => s.trim());
                        
                        let nodeData = {};

                        if (cols.length >= 20) {
                            const [
                                type, id, parentId, label,
                                aId, aB, aM,
                                sId, sB, sM,
                                cId, cB, cM, len,
                                c2Id, c2B, c2M, len2,
                                par, tap, bridge
                            ] = cols;

                            nodeData = {
                                type, id, parentId: parentId || null, userLabel: label,
                                length: parseFloat(len), length2: parseFloat(len2),
                                parallelCount: parseFloat(par), tapPower: parseFloat(tap),
                                useBridgeMode: bridge === '1',
                                ampId: resolveDevice('amplifiers', aId, aB, aM) || (aM ? findIdByProps('amplifiers', aB, aM) : null),
                                spkId: resolveDevice('speakers', sId, sB, sM),
                                cabId: resolveDevice('cables', cId, cB, cM),
                                cab2Id: (c2Id || c2M) ? resolveDevice('cables', c2Id, c2B, c2M) : null
                            };

                        } else if (cols.length >= 16) {
                            // V2.1/2.2 Format
                            const [type, id, parentId, label, aB, aM, sB, sM, cB, cM, len, c2B, c2M, len2, par, tap, bridge] = cols;
                            nodeData = {
                                type, id, parentId: parentId || null, userLabel: label,
                                length: parseFloat(len), length2: parseFloat(len2),
                                parallelCount: parseFloat(par), tapPower: parseFloat(tap),
                                useBridgeMode: bridge === '1',
                                ampId: findIdByProps('amplifiers', aB, aM) || aM,
                                spkId: findIdByProps('speakers', sB, sM),
                                cabId: findIdByProps('cables', cB, cM),
                                cab2Id: (c2B || c2M) ? findIdByProps('cables', c2B, c2M) : null
                            };
                        } else if (cols.length >= 12) {
                            // V2.0 Legacy
                            const [type, id, parentId, label, aId, sId, cId, len, c2Id, len2, par, tap, bridge] = cols;
                            nodeData = {
                                type, id, parentId: parentId || null, userLabel: label,
                                length: parseFloat(len), length2: parseFloat(len2),
                                parallelCount: parseFloat(par), tapPower: parseFloat(tap),
                                useBridgeMode: bridge === '1',
                                ampId: aId, spkId: sId, cabId: cId, cab2Id: c2Id
                            };
                        } else { continue; }

                        if ((!nodeData.parentId && !database.amplifiers[nodeData.ampId]) || !database.speakers[nodeData.spkId] || !database.cables[nodeData.cabId]) {
                            continue;
                        }

                        const node = {
                            id: nodeData.id, parentId: nodeData.parentId, userLabel: nodeData.userLabel,
                            speakerModel: nodeData.spkId, cableModel: nodeData.cabId, length: nodeData.length,
                            cableModel2: nodeData.cab2Id, length2: nodeData.length2,
                            parallelCount: nodeData.parallelCount, tapPower: nodeData.tapPower,
                            ampModel: nodeData.ampId, useBridgeMode: nodeData.useBridgeMode,
                            inputs: {}, children: [], results: {}, type: nodeData.type
                        };
                        
                        node.inputs = {
                            ampModel: node.ampModel, speakerModel: node.speakerModel,
                            cableModel: node.cableModel, length: node.length,
                            cableModel2: node.cableModel2, length2: node.length2,
                            parallelCount: node.parallelCount, tapPower: node.tapPower,
                            useBridgeMode: node.useBridgeMode, hasTapCable: !!node.cableModel2
                        };
                        
                        const targetList = node.type === 'Low-Z' ? lowZRoots.value : highVRoots.value;
                        if(!node.parentId) {
                            targetList.push(node);
                        } else {
                            const findParent = (nodes) => {
                                for(let n of nodes) {
                                    if(n.id === node.parentId) return n;
                                    if(n.children) { const found = findParent(n.children); if(found) return found; }
                                }
                                return null;
                            };
                            const parent = findParent(targetList);
                            if(parent) {
                                if(!parent.children) parent.children = [];
                                parent.children.push(node);
                            }
                        }
                    }
                    
                    calculateAll();
                    alert("Project Loaded Successfully.");
                }
                e.target.value = null;
            };
            r.readAsText(file);
        };

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
        
        const handleDbImport = (e) => {
             const file = e.target.files[0]; if(!file) return;
             const r = new FileReader();
             r.onload = (ev) => {
                 const lines = ev.target.result.split('\n');
                 if(lines.length < 2) return alert("Invalid File");
                 
                 const headers = lines[0].split(',').map(h => h.replace(/['"]+/g, '').trim().toLowerCase());
                 let c=0;
                 
                 const tapsIdx = headers.indexOf('taps');
                 const validKeywords = ['Lo-Z', '100V', 'Both', 'Active'];

                 for(let i=1; i<lines.length; i++) {
                     const line = lines[i].trim();
                     if(!line) continue;
                     const vals = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                     
                     if(vals.length >= headers.length) {
                         let modelName = vals[0].replace(/['"]+/g, '').trim();
                         if(!modelName) continue;

                         let newId;
                         do {
                             newId = Math.floor(10000 + Math.random() * 90000).toString();
                         } while (database[dbTab.value][newId]);

                         const obj={};
                         obj.model = modelName; 

                         const dbKeys = Object.keys(DEFAULT_DATABASE[dbTab.value][Object.keys(DEFAULT_DATABASE[dbTab.value])[0]]);
                         
                         // SMART COLUMN ALIGNMENT (SCAN FOR TYPE)
                         // If columns shifted due to taps, find 'type' by looking for keywords
                         let typeShiftIndex = -1;
                         if (dbTab.value === 'speakers' && vals.length > headers.length) {
                             // Scan from the end backwards to find type
                             for(let k=vals.length-1; k >= 0; k--) {
                                 const val = vals[k].replace(/['"]+/g, '').trim();
                                 if(validKeywords.includes(val)) {
                                     typeShiftIndex = k;
                                     break;
                                 }
                             }
                         }

                         dbKeys.forEach(key => {
                             const idx = headers.indexOf(key.toLowerCase());
                             if(idx > 0) {
                                 let val = '';
                                 
                                 // SPECIAL LOGIC FOR SPEAKERS WITH SHIFTED COLS
                                 if (dbTab.value === 'speakers' && typeShiftIndex !== -1) {
                                     const typeHeaderIdx = headers.indexOf('type');
                                     const catHeaderIdx = headers.indexOf('category');
                                     
                                     if (key.toLowerCase() === 'taps') {
                                         // Taps is everything between start of taps and type
                                         const endOfTaps = typeShiftIndex; 
                                         val = vals.slice(tapsIdx, endOfTaps).join(',').replace(/['"]+/g, '').trim();
                                     } else if (key.toLowerCase() === 'type') {
                                         val = vals[typeShiftIndex].replace(/['"]+/g, '').trim();
                                     } else if (key.toLowerCase() === 'category') {
                                         // Category is usually after type
                                         if (typeShiftIndex + 1 < vals.length) {
                                             val = vals[typeShiftIndex + 1].replace(/['"]+/g, '').trim();
                                         }
                                     } else if (idx < tapsIdx) {
                                         // Fields before taps are safe
                                         val = vals[idx].replace(/['"]+/g, '').trim();
                                     }
                                 } else {
                                     // Normal processing
                                     val = vals[idx].replace(/['"]+/g, '').trim();
                                 }

                                 const isNumericField = !['brand', 'taps', 'model', 'type', 'category'].includes(key.toLowerCase());
                                 const looksLikeNumber = /^-?\d*(\.\d+)?$/.test(val);
                                 if(isNumericField && looksLikeNumber && val !== '') val = parseFloat(val);
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

        // --- PDF GENERATION ---
        const generatePdf = () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4');
            
            doc.setFillColor(24, 24, 27); doc.rect(0,0,297,25,'F');
            doc.setTextColor(255); doc.setFontSize(14); doc.text("Audio Systems Design Report", 14, 12);
            doc.setFontSize(8); doc.text(`Generated by Speaker Design Tool ${APP_VERSION} | Standard: ${QUALITY_PROFILES[qualityMode.value].label}`, 14, 18);
            
            doc.setTextColor(0); doc.setFontSize(10);
            let y = 40;
            doc.text(`Project: ${project.name}`, 14, y);
            doc.text(`Company: ${reportForm.company}`, 14, y+6);
            doc.text(`Designer: ${reportForm.designer}`, 14, y+12);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 250, y);
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
                    const label = n.userLabel || '';
                    
                    const sourceLabel = !n.parentId ? getDeviceLabel('amplifiers', n.ampModel) : n.parentId;
                    const loadDetail = mode === 'low-z' ? `${n.parallelCount}x Parallel` : `${n.tapPower}W Tap`;
                    const detailsStr = `${sourceLabel} | ${loadDetail}`;

                    let cableStr = `${getDeviceLabel('cables', n.cableModel)} (${len}m)`;
                    if(len2) cableStr += ` + ${getDeviceLabel('cables', n.cableModel2)} (${len2}m)`;

                    r.push([
                        n.id, 
                        label, 
                        deviceName + '\n' + detailsStr, 
                        cableStr,
                        mode==='low-z' ? `${res.minLoad?.toFixed(2)}Ω` : `${res.totalPower?.toFixed(1)}W`,
                        mode==='low-z' ? `${res.nomLoad?.toFixed(2)}Ω` : '-',
                        mode==='low-z' ? `${res.dropPercent?.toFixed(2)}%` : `${res.dropVolts?.toFixed(1)}V`,
                        `${res.powerLoss?.toFixed(1)}W`,
                        mode==='low-z' ? `${res.splLoss?.toFixed(2)}dB` : `${res.voltageAtSpeaker?.toFixed(1)}V`,
                        res.status
                    ]);
                    if(n.children) t(n.children);
                });
                t(list);
                return r;
            };

            const headersLowZ = [['ID','Name','Details','Cable','Min Load (Z)','Nom Load','V Drop %','P Loss','Elec. Loss','Status']];
            const headersHighV = [['ID','Name','Details','Cable','Total Power','-','V Drop V','P Loss','V @ Spk','Status']];

            if(lowZRoots.value.length > 0) {
                doc.text("Low-Impedance Systems", 14, y);
                doc.autoTable({
                    startY: y+5,
                    head: headersLowZ,
                    body: buildRows(lowZRoots.value, 'low-z'),
                    headStyles: { fillColor: [63, 63, 70] },
                    styles: { fontSize: 7 },
                    columnStyles: { 2: { cellWidth: 50 }, 3: { cellWidth: 40 } }
                });
                y = doc.lastAutoTable.finalY + 15;
            }

            if(highVRoots.value.length > 0) {
                doc.text("100V Systems", 14, y);
                doc.autoTable({
                    startY: y+5,
                    head: headersHighV,
                    body: buildRows(highVRoots.value, 'high-v'),
                    headStyles: { fillColor: [63, 63, 70] },
                    styles: { fontSize: 7 },
                    columnStyles: { 2: { cellWidth: 50 }, 3: { cellWidth: 40 } }
                });
            }
            doc.save(`${project.name || 'Audio_System'}_Report.pdf`);
        };

        watch(globalSettings, calculateAll, { deep: true });
        watch(qualityMode, calculateAll); 
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
            currentView, calculatorMode, qualityMode, QUALITY_PROFILES, currentProfile,
            dbTab, dbEditMode, dbForm, inputForm,
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
