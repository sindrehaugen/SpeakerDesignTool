/**
 * Speaker Design Tool v2.0 - Main Logic
 * Fixes: CSV Import, Dropdown Labels, Explanations Restoration
 */

const { createApp, reactive, computed, watch, onMounted, ref } = Vue;

const app = createApp({
    setup() {
        const APP_VERSION = 'v2.0'; // Updated Version
        
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
        
        // Persistence
        const lowZRoots = ref([]);
        const highVRoots = ref([]);
        
        const currentView = ref('calculator');
        const calculatorMode = ref('low-z'); 
        
        const dbTab = ref('speakers');
        const dbEditMode = ref(false);
        const reportForm = reactive({ company: '', designer: '', notes: '' });
        
        // File Input Ref for robust triggering
        const dbImportInput = ref(null);

        // Forms
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

        // --- COMPUTED DATA FOR SELECTS ---
        
        const speakerOptions = computed(() => {
            const m = calculatorMode.value === 'low-z' ? 'Lo-Z' : '100V';
            const list = [];
            for (const [id, s] of Object.entries(database.speakers)) {
                if (s.type === 'Both' || s.type === m) {
                    const brand = s.brand ? s.brand : 'Generic';
                    const detail = m === 'Lo-Z' ? `${s.impedance}Ω` : '100V';
                    // Format: Brand - Model (Detail)
                    list.push({
                        id: id,
                        label: `${brand} - ${id} (${detail})`
                    });
                }
            }
            return list.sort((a,b) => a.label.localeCompare(b.label));
        });

        const cableOptions = computed(() => {
            const list = [];
            for (const [id, c] of Object.entries(database.cables)) {
                const brand = c.brand ? c.brand : 'Generic';
                const model = c.model && c.model !== id ? c.model : '';
                // Format: Brand - Model (Name/Gauge)
                // ID is usually the name like "2.5mm²" or "14AWG"
                let label = `${brand}`;
                if(model) label += ` - ${model}`;
                label += ` (${id})`; // Show the gauge/name as detail
                
                list.push({ id: id, label: label });
            }
            return list.sort((a,b) => a.label.localeCompare(b.label));
        });

        const ampOptions = computed(() => {
            const list = [];
            for (const [id, a] of Object.entries(database.amplifiers)) {
                const brand = a.brand ? a.brand : 'Generic';
                let details = calculatorMode.value === 'low-z' 
                    ? `${a.watt_8}W@8Ω` 
                    : `${a.watt_100v || a.watt_8}W@100V`;
                // Format: Brand - Model (Detail)
                list.push({ id: id, label: `${brand} - ${id} (${details})` });
            }
            return list.sort((a,b) => a.label.localeCompare(b.label));
        });

        // --- ACTIVE DATA HELPERS ---
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

        // --- ENGINE ---
        const calculateAll = () => {
            if (Object.keys(database.speakers).length === 0) return;
            lowZRoots.value.forEach(root => { try { calculateLowZBranch(root); } catch(e) { console.error(e); } });
            highVRoots.value.forEach(root => { try { calculateHighVBranch(root); } catch(e) { console.error(e); } });
        };

        const calculateLowZBranch = (node, parentVolts = null, parentCumulativeR = 0) => {
            const speaker = database.speakers[node.speakerModel];
            const cable1 = database.cables[node.cableModel];
            const amp = database.amplifiers[node.ampModel];

            if (!speaker || !cable1) { node.results = { status: 'Error', statusMsg: 'Missing Data' }; return; }

            let sourceVoltage = parentVolts;
            let ampZ = 0;
            if (!node.parentId && amp) {
                const power = node.useBridgeMode ? (amp.watt_bridge_8 || 0) : amp.watt_8;
                sourceVoltage = Math.sqrt(power * 8);
                ampZ = 8 / (amp.df || 100);
            }
            const safeVolts = sourceVoltage || 100;

            const zMain = physics.getCableImpedance(cable1, node.length, 1000, globalSettings.temp_c);
            let zTotalNode = zMain;
            if (inputForm.hasTapCable && node.cableModel2 && node.length2 > 0) {
                const cable2 = database.cables[node.cableModel2];
                if (cable2) zTotalNode = zTotalNode.add(physics.getCableImpedance(cable2, node.length2, 1000, globalSettings.temp_c));
            }

            const zSpeakerNom = speaker.impedance / (node.parallelCount || 1);
            const zLoadMagnitude = speaker.z_min ? (speaker.z_min / (node.parallelCount || 1)) : zSpeakerNom;

            const tx = physics.calculateTransmission(safeVolts, zLoadMagnitude, zTotalNode);
            const electricalLossDb = physics.calculateElectricalSPLLoss(tx.voltageAtLoad, safeVolts);
            const cumulativeR = parentCumulativeR + tx.cableResistance;
            const totalDF = physics.calculateDampingFactor(zSpeakerNom, ampZ, cumulativeR);
            const hfCheck = physics.calculateHFLoss(safeVolts, zLoadMagnitude, cable1, node.length, globalSettings.temp_c);

            const acousticSPL = physics.calculateAcousticSPL(speaker.max_spl, electricalLossDb, node.inputs.listenerDistance);
            const delayMs = physics.calculateDelayTime(node.inputs.listenerDistance, globalSettings.temp_c);

            let status = 'OK';
            let statusMsg = '';
            if (tx.dropPercent > 5) { status = 'Warning'; statusMsg = 'High VD'; }
            if (totalDF < 20 && status !== 'Hazard') { status = 'Warning'; statusMsg = 'Low DF'; }
            
            if (tx.dropPercent > 10) { status = 'Hazard'; statusMsg = 'High VD'; }
            if (totalDF < 10) { status = 'Hazard'; statusMsg = 'Low DF'; }

            node.results = {
                load: zLoadMagnitude + zTotalNode.magnitude(),
                voltageAtSpeaker: tx.voltageAtLoad,
                dropPercent: tx.dropPercent,
                powerLoss: tx.powerSource - tx.powerLoad,
                splLoss: electricalLossDb,
                totalDF: totalDF,
                hfLoss: hfCheck,
                acousticSPL: acousticSPL, 
                delayMs: delayMs,         
                status: status,
                statusMessage: statusMsg
            };

            if (node.children) {
                node.children.forEach(child => calculateLowZBranch(child, tx.voltageAtLoad, cumulativeR));
            }
        };

        const calculateHighVBranch = (node, parentVolts = 100) => {
            const cable = database.cables[node.cableModel];
            const speaker = database.speakers[node.speakerModel];
            if (!cable || !speaker) return;

            const zCable = physics.getCableImpedance(cable, node.length, 1000, globalSettings.temp_c);
            const totalP = getTotalPower(node);
            const current = totalP / (parentVolts || 100);
            const dropVolts = current * zCable.magnitude();
            const voltsAtNode = parentVolts - dropVolts;
            const dropPercent = (dropVolts / parentVolts) * 100;
            const powerLoss = Math.pow(current, 2) * zCable.real;

            let status = 'OK';
            let statusMsg = '';
            if (voltsAtNode < 95) { status = 'Warning'; statusMsg = 'Low V'; }
            if (voltsAtNode < 90) { status = 'Hazard'; statusMsg = 'Low V'; }

            const effectiveLoadZ = Math.pow(parentVolts, 2) / (totalP || 1);
            const hfCheck = physics.calculateHFLoss(parentVolts, effectiveLoadZ, cable, node.length, globalSettings.temp_c);
            
            const electricalLossDb = physics.calculateElectricalSPLLoss(voltsAtNode, parentVolts);
            const acousticSPL = physics.calculateAcousticSPL(speaker.max_spl, electricalLossDb, node.inputs.listenerDistance);
            const delayMs = physics.calculateDelayTime(node.inputs.listenerDistance, globalSettings.temp_c);

            node.results = {
                voltageAtSpeaker: voltsAtNode,
                dropPercent: dropPercent,
                dropVolts: dropVolts,
                totalPower: totalP,
                powerLoss: powerLoss,
                hfLoss: hfCheck,
                acousticSPL: acousticSPL,
                delayMs: delayMs,
                status: status,
                statusMessage: statusMsg
            };

            if (node.children) node.children.forEach(child => calculateHighVBranch(child, voltsAtNode));
        };

        const getTotalPower = (node) => {
            let p = node.tapPower || 0;
            if (node.children) node.children.forEach(child => p += getTotalPower(child));
            return p;
        };

        const reportSummary = computed(() => {
            let totalNodes = 0, totalPower = 0, warnings = 0, hazards = 0;
            const process = (list) => list.forEach(n => {
                totalNodes++;
                if(n.results) {
                    if (n.results.status === 'Warning') warnings++;
                    if (n.results.status === 'Hazard') hazards++;
                    if(n.tapPower) totalPower += n.tapPower; 
                    else if (n.results.load > 0 && !n.parentId) totalPower += Math.pow(n.results.voltageAtSpeaker, 2) / n.results.load;
                }
            });
            process(flatLowZList.value);
            process(flatHighVList.value);
            return { totalNodes, totalPower, warnings, hazards };
        });

        const addNode = () => {
            const prefix = calculatorMode.value === 'low-z' ? 'L' : 'H';
            const targetList = activeRootNodes.value;
            
            let newId;
            if (!inputForm.parentId) {
                newId = `${prefix}-${targetList.length + 1}`;
                targetList.push(createNodeStruct(newId));
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

        const createNodeStruct = (id) => ({
            id, parentId: inputForm.parentId, speakerModel: inputForm.speakerModel,
            cableModel: inputForm.cableModel, length: inputForm.length,
            cableModel2: inputForm.hasTapCable ? inputForm.cableModel2 : null,
            length2: inputForm.hasTapCable ? inputForm.length2 : 0,
            listenerDistance: inputForm.listenerDistance,
            parallelCount: inputForm.parallelCount, tapPower: inputForm.tapPower,
            ampModel: !inputForm.parentId ? inputForm.ampModel : null,
            useBridgeMode: inputForm.useBridgeMode, children: [], results: {}
        });

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

        // FIX: Use Vue Ref for robust triggering
        const triggerDbImport = () => {
            if (dbImportInput.value) {
                dbImportInput.value.click();
            } else {
                alert("Import input not initialized.");
            }
        };
        
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
                     
                     // Fix: Standard CSV split regex (handles quoted fields containing commas)
                     const vals = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                     
                     if(vals.length >= headers.length) {
                         const id = vals[0].replace(/['"]+/g, '').trim();
                         if(!id) continue;

                         const obj={};
                         const dbKeys = Object.keys(DEFAULT_DATABASE[dbTab.value][Object.keys(DEFAULT_DATABASE[dbTab.value])[0]]);
                         
                         dbKeys.forEach(key => {
                             const idx = headers.indexOf(key.toLowerCase());
                             if(idx > 0) {
                                 let val = vals[idx].replace(/['"]+/g, '').trim();
                                 if(!isNaN(parseFloat(val)) && isFinite(val)) val = parseFloat(val);
                                 obj[key] = val;
                             }
                         });
                         database[dbTab.value][id] = obj; 
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
            
            // Smaller Header
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
                    if(!n.parentId) addToBom(n.inputs.ampModel, 'Amplifier', 1);
                    addToBom(n.inputs.speakerModel, 'Speaker', n.inputs.parallelCount || 1);
                    addToBom(n.inputs.cableModel, 'Cable (m)', n.inputs.length);
                    if(n.inputs.cableModel2) addToBom(n.inputs.cableModel2, 'Cable (m)', n.inputs.length2);
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
                headStyles: { fillColor: [82, 82, 91] }
            });
            y = doc.lastAutoTable.finalY + 15;

            const buildRows = (list, mode) => {
                const r = [];
                const t = (ns) => ns.forEach(n => {
                    const res = n.results || {};
                    r.push([
                        n.id, n.speakerModel, 
                        `${n.length}m / ${n.inputs.listenerDistance}m`,
                        mode==='low-z' ? `${res.load?.toFixed(2)}Ω` : `${res.totalPower?.toFixed(1)}W`,
                        mode==='low-z' ? `${res.dropPercent?.toFixed(2)}%` : `${res.voltageAtSpeaker?.toFixed(1)}V`,
                        `${res.powerLoss?.toFixed(1)}W`,
                        `${res.acousticSPL?.toFixed(1)}dB`,
                        `${res.delayMs?.toFixed(1)}ms`,
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
                    head: [['ID','Device','Dist','Load','V.Drop','Loss','SPL@Ear','Delay','Status']],
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
                    head: [['ID','Device','Dist','Power','V @ Tap','Loss','SPL@Ear','Delay','Status']],
                    body: buildRows(highVRoots.value, 'high-v'),
                    headStyles: { fillColor: [63, 63, 70] },
                    styles: { fontSize: 8 }
                });
            }
            doc.save('Audio_Systems_Design_Report.pdf');
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
        });

        return {
            APP_VERSION, database, globalSettings, project, reportForm, 
            currentView, calculatorMode, dbTab, dbEditMode, dbForm, inputForm,
            activeRootNodes, activeFlatList, flatLowZList, flatHighVList, 
            speakerOptions, cableOptions, ampOptions, currentDbData, reportSummary,
            activeRootNodes, dbImportInput, // Exposed Ref
            addNode, deleteNode, clearCurrentResults,
            saveDbItem, editDbItem, deleteDbItem, resetDbForm, resetDbDefaults,
            exportDbCsv, triggerDbImport, handleDbImport, generatePdf,
            getSpeakerTaps, getStatusClass
        };
    }
});

app.component('tree-node', {
    template: '#tree-node-template',
    props: ['node', 'mode'],
    emits: ['delete'],
    setup(props) {
        const getStatusClass = (s) => s==='OK'?'badge-ok':(s==='Warning'?'badge-warn':'badge-danger');
        return { getStatusClass };
    }
});

app.mount('#app');