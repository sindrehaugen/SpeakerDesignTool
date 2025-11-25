/**
 * Speaker Design Tool v3.0 - Main Entry
 * Status: Production Ready
 * Fixes: Added Channel Count to Amplifier Validation
 */

(function () {
    const { createApp, reactive, computed, onMounted, ref, provide, watch } = Vue;

    const app = createApp({
        setup() {
            // --- 1. STATE INITIALIZATION ---
            let initialDb = window.App.Core.Database.DATA;
            try { 
                const stored = localStorage.getItem('sdt_database_v3'); 
                if (stored) initialDb = JSON.parse(stored); 
            } catch (e) { console.warn("DB Load Error", e); }

            const state = reactive({
                mode: 'low-z', 
                qualityMode: 'high-end',
                projectInfo: { name: 'Project 1', date: new Date().toISOString().split('T')[0] },
                reportInfo: { company: '', designer: '', logoUrl: '' },
                settings: { temp_c: 25 },
                database: initialDb, 
                ampRack: {}, 
                lowZRoots: [], 
                highVRoots: []
            });

            try { 
                const p = JSON.parse(localStorage.getItem('sdt_user_prefs')); 
                if(p) Object.assign(state.reportInfo, p); 
            } catch(e){}

            watch(()=>state.database,(v)=>localStorage.setItem('sdt_database_v3',JSON.stringify(v)),{deep:true});
            watch(()=>state.reportInfo,(v)=>localStorage.setItem('sdt_user_prefs',JSON.stringify(v)),{deep:true});

            // --- 2. REACTIVE REFS ---
            const currentView = ref('calculator'); 
            const showAmpModal = ref(false); 
            const pendingAmpNode = ref(null); 
            const showSaveModal = ref(false); 
            const wizardState = reactive({ visible: false, candidates: [], limit: 5 }); 
            const missingDataState = reactive({ visible: false, title: '', instruction: '', fields: [], initialData: {} });
            
            window.App.State = state; 
            window.App.Actions = {};

            // --- 3. PHYSICS ENGINE SETUP ---
            const physics = new window.App.Core.Physics.AudioPhysics({ base_temperature_c: state.settings.temp_c });
            
            const Complex = window.App.Core.Physics.ComplexNumber;
            if (Complex && !Complex.prototype.div) { 
                Complex.prototype.div = function(o) { 
                    const d = o.real*o.real + o.imaginary*o.imaginary; 
                    if (d === 0) return new Complex(0, 0); 
                    return new Complex((this.real*o.real + this.imaginary*o.imaginary)/d, (this.imaginary*o.real - this.real*o.imaginary)/d); 
                }; 
            }

            // Recursive Impedance Calculator
            const getEffectiveZ = (node, useMin = true) => { 
                if (!node) return new Complex(999999, 0); 
                const spk = state.database.speakers[node.speakerId]; 
                if(!spk) return new Complex(999999, 0); 
                
                const parallel = parseFloat(node.parallelCount) || 1; 
                const val = useMin ? (parseFloat(spk.z_min)||parseFloat(spk.impedance)) : parseFloat(spk.impedance); 
                const zNode = new Complex(val / parallel, 0); 
                
                if(!node.children || node.children.length === 0) return zNode; 
                
                let totalAdmittance = new Complex(1,0).div(zNode); 
                node.children.forEach(child => { 
                    const childZ = getEffectiveZ(child, useMin); 
                    const cab1 = state.database.cables[child.cableId]; 
                    let zCab = cab1 ? physics.getCableImpedance(cab1, parseFloat(child.length)||0, 1000, state.settings.temp_c) : new Complex(0,0); 
                    if(child.useCable2 && child.cable2Id) { 
                        const cab2 = state.database.cables[child.cable2Id]; 
                        if(cab2) zCab = zCab.add(physics.getCableImpedance(cab2, parseFloat(child.length2)||0, 1000, state.settings.temp_c)); 
                    } 
                    const branchZ = childZ.add(zCab); 
                    const branchY = new Complex(1,0).div(branchZ); 
                    totalAdmittance = totalAdmittance.add(branchY); 
                }); 
                return new Complex(1,0).div(totalAdmittance); 
            };

            const getTotalWatts = (node) => { 
                let w = parseFloat(node.tapPower) || 0; 
                if(node.children) node.children.forEach(c => w += getTotalWatts(c)); 
                return w; 
            };
            
            const getTotalRMS = (node) => { 
                const spk = state.database.speakers[node.speakerId]; 
                let p = spk ? (parseFloat(spk.wattage_rms) * (parseFloat(node.parallelCount) || 1)) : 0; 
                if (node.children) node.children.forEach(c => p += getTotalRMS(c)); 
                return p; 
            };

            // --- 4. ACTIONS IMPLEMENTATION ---
            const actions = {
                // Node Management
                addNode(parentId) {
                    const mode = state.mode;
                    const prefix = mode === 'low-z' ? 'L' : 'H';
                    let newId = '';
                    
                    const getLastNum = (idStr) => {
                        if(!idStr) return 0;
                        const parts = idStr.split('.');
                        const lastSeg = parts[parts.length-1]; 
                        const cleanNum = lastSeg.replace(/^[LH]-/, '');
                        return parseInt(cleanNum) || 0;
                    };

                    let parentNode = null;
                    const roots = mode === 'low-z' ? state.lowZRoots : state.highVRoots;

                    if (!parentId) {
                        let max = 0;
                        roots.forEach(n => {
                            const num = getLastNum(n.id);
                            if (num > max) max = num;
                        });
                        newId = `${prefix}-${max + 1}`;
                    } else {
                        const findParent = (nodes) => {
                            for (let n of nodes) {
                                if (n.id === parentId) return n;
                                if (n.children) {
                                    const found = findParent(n.children);
                                    if (found) return found;
                                }
                            }
                            return null;
                        };
                        parentNode = findParent(roots);
                        
                        if (parentNode) {
                            let max = 0;
                            if (parentNode.children) {
                                parentNode.children.forEach(c => {
                                    const num = getLastNum(c.id);
                                    if (num > max) max = num;
                                });
                            }
                            newId = `${parentNode.id}.${max + 1}`;
                        } else {
                            newId = `${prefix}-${Math.floor(Math.random()*10000)}`; 
                        }
                    }
                    
                    const newNode = {
                        id: newId,
                        parentId: parentId || null,
                        userLabel: '',
                        ampInstanceId: '', ampChannel: null, useBridgeMode: false,
                        speakerId: 'Default Speaker', parallelCount: 1, tapPower: 0,
                        cableId: 'Default Cable 1.5mm²', length: 20,
                        useCable2: false, cable2Id: '', length2: 0,
                        children: [],
                        results: { status: 'Pending', dropPercent: 0, minLoad: 0 }
                    };

                    if (parentNode) {
                        newNode.speakerId = parentNode.speakerId;
                        newNode.cableId = parentNode.cableId;
                        newNode.length = 5; 
                        newNode.tapPower = parentNode.tapPower;
                        newNode.parallelCount = 1;
                    }

                    if (parentNode) {
                        if (!parentNode.children) parentNode.children = [];
                        parentNode.children.push(newNode);
                    } else {
                        roots.push(newNode);
                    }
                    
                    actions.calculateAll();
                },

                deleteNode(id) {
                    const remove = (nodes) => {
                        const idx = nodes.findIndex(n => n.id === id);
                        if (idx > -1) {
                            nodes.splice(idx, 1);
                            return true;
                        }
                        for (let n of nodes) {
                            if (n.children && remove(n.children)) return true;
                        }
                        return false;
                    };
                    remove(state.mode === 'low-z' ? state.lowZRoots : state.highVRoots);
                    actions.calculateAll();
                },

                loadProject(file) { 
                    const r=new FileReader(); 
                    r.onload=(e)=>{ 
                        try{ 
                            const d=JSON.parse(e.target.result); 
                            if (d.lowZ) { state.lowZRoots = d.lowZ; delete d.lowZ; }
                            if (d.highV) { state.highVRoots = d.highV; delete d.highV; }
                            Object.assign(state, d); 
                            if(d.database && confirm("Merge embedded database?")) {
                                Object.assign(state.database.speakers, d.database.speakers || {});
                                Object.assign(state.database.cables, d.database.cables || {});
                                Object.assign(state.database.amplifiers, d.database.amplifiers || {});
                            }
                            alert("Project Loaded Successfully"); 
                            actions.calculateAll(); 
                        } catch(err){ alert("Load Failed: " + err.message); } 
                    }; 
                    r.readAsText(file); 
                },

                saveProject() { showSaveModal.value = true; },
                handleSaveSelect(includeDb) { window.App.Utils.IO.exportProjectJSON(state, includeDb); showSaveModal.value = false; },

                // --- EQUIPMENT VALIDATION ---
                validateEquipment(type, id) {
                    if (!id || id.startsWith('Default')) return;
                    
                    const item = state.database[type][id];
                    const missingFields = [];
                    
                    // Defined checks per type
                    const checks = {
                        speakers: [
                            { key: 'impedance', label: 'Impedance (Ω)' },
                            { key: 'wattage_rms', label: 'Power RMS (W)' },
                            { key: 'z_min', label: 'Min Impedance (Ω)' }
                        ],
                        cables: [
                            { key: 'resistance', label: 'Resistance (Ω/km)' },
                            { key: 'capacitance', label: 'Capacitance (pF/m)' },
                            { key: 'inductance', label: 'Inductance (µH/m)' }
                        ],
                        amplifiers: [
                            { key: 'watt_8', label: 'Power 8Ω (W)' },
                            { key: 'watt_4', label: 'Power 4Ω (W)' },
                            { key: 'watt_100v', label: 'Power 100V (W)' },
                            { key: 'df', label: 'Damping Factor' },
                            { key: 'channels_lowz', label: 'Channels (Low-Z)' } // Added Check
                        ]
                    };

                    const targetChecks = checks[type] || [];

                    if (!item) {
                        missingFields.push(...targetChecks);
                    } else {
                        targetChecks.forEach(field => {
                            const val = item[field.key];
                            // Check for undefined, null, or empty strings. 
                            // We allow 0, but key fields like resistance shouldn't be 0 ideally.
                            // For safety, we flag it if it's strictly undefined/null or empty string.
                            if (val === undefined || val === null || val === '') {
                                missingFields.push(field);
                            }
                        });
                    }

                    if (missingFields.length > 0) {
                        missingDataState.title = id;
                        missingDataState.instruction = "Some technical specifications are missing. Please enter '0' if a field is not applicable to this product.";
                        missingDataState.fields = missingFields;
                        
                        missingDataState.initialData = item ? { ...item } : { id: id, brand: 'Unknown', model: 'Imported', type: type };
                        
                        // Ensure fields exist for reactivity
                        missingFields.forEach(f => {
                            if (missingDataState.initialData[f.key] === undefined) {
                                missingDataState.initialData[f.key] = null; 
                            }
                        });

                        missingDataState.visible = true;
                    }
                },
                
                saveMissingData(formData) {
                    let type = 'speakers';
                    if (formData.type) type = formData.type;
                    else if (formData.resistance !== undefined) type = 'cables';
                    else if (formData.watt_8 !== undefined) type = 'amplifiers';
                    
                    if (!state.database[type]) state.database[type] = {};
                    state.database[type][formData.id] = formData;
                    missingDataState.visible = false;
                    actions.calculateAll();
                },

                openAmpModal(n) { pendingAmpNode.value=n; showAmpModal.value=true; },
                handleAmpSelection(id) { 
                    const n=pendingAmpNode.value; 
                    if(n){ 
                        const cid=`A-${Object.keys(state.ampRack).length+1}`; 
                        state.ampRack[cid]={id:cid,modelId:id,channelsUsed:[]}; 
                        n.ampInstanceId=cid; 
                        n.ampChannel=null; 
                        showAmpModal.value=false;
                        
                        // Trigger validation
                        actions.validateEquipment('amplifiers', id);
                        
                        actions.calculateAll();
                    } 
                },

                runCableWizard(node, brandFilter) {
                    const profile = window.App.Core.Database.PROFILES[state.qualityMode];
                    const limit = profile.maxDrop;
                    const cands = [];
                    const db = state.database.cables;
                    
                    Object.values(db).forEach(cable => {
                        if (brandFilter && cable.brand !== brandFilter) return;
                        
                        const zCab = physics.getCableImpedance(cable, node.length, 1000, state.settings.temp_c);
                        let zLoad = 8;
                        if (state.mode === 'low-z') {
                            const spk = state.database.speakers[node.speakerId];
                            if (spk) zLoad = (spk.z_min || spk.impedance) / (node.parallelCount || 1);
                        } else {
                            const w = node.tapPower || 10;
                            zLoad = (100*100) / w;
                        }

                        const tx = physics.calculateTransmission(100, zLoad, zCab);
                        const drop = 100 - tx.voltageAtLoad; 
                        
                        if (drop < limit * 1.5) { 
                            cands.push({ ...cable, drop: drop });
                        }
                    });

                    cands.sort((a,b) => a.drop - b.drop);
                    wizardState.candidates = cands;
                    wizardState.limit = limit;
                    wizardState.targetNode = node;
                    wizardState.visible = true;
                },

                applyWizardSelection(id) {
                    if (wizardState.targetNode) {
                        wizardState.targetNode.cableId = id;
                        wizardState.visible = false;
                        actions.calculateAll();
                    }
                },

                setMode(m) { state.mode=m; actions.calculateAll(); },

                calculateAll() {
                    const db = state.database;
                    const profile = window.App.Core.Database.PROFILES[state.qualityMode];
                    let checkFreq = state.qualityMode === 'high-end' ? 10000 : (state.qualityMode === 'speech' ? 4000 : 6000);
                    const limits = { maxDrop: profile.maxDrop, headroom_warn: 0.80, hf_freq: checkFreq };
                    
                    const calcBranch = (node, parentVolts, rootVolts, rootAmpInstance) => {
                        try {
                            node.results = node.results || {};
                            
                            const speaker = db.speakers[node.speakerId]; 
                            const cable = db.cables[node.cableId];
                            
                            if (!speaker || !cable) { 
                                node.results.status='Error'; 
                                node.results.statusMessage = !speaker ? 'No Speaker' : 'No Cable';
                                return; 
                            }
                            
                            let sV=parentVolts, rV=rootVolts, rAmp=rootAmpInstance;
                            
                            if (!node.parentId) {
                                if (node.ampInstanceId && state.ampRack[node.ampInstanceId]) { 
                                    rAmp = state.ampRack[node.ampInstanceId]; 
                                    const m = db.amplifiers[rAmp.modelId]; 
                                    if(m){ 
                                        const p = node.useBridgeMode ? m.watt_bridge_8 : m.watt_8; 
                                        sV = state.mode==='low-z' ? Math.sqrt((p||0)*8) : 100; 
                                        rV = sV; 
                                    } 
                                } else {
                                    sV = state.mode === 'low-z' ? Math.sqrt(100*8) : 100;
                                    rV = sV;
                                }
                            }
                            
                            const safeV=sV||100, safeRV=rV||safeV;
                            
                            let zCab = physics.getCableImpedance(cable, node.length, 1000, state.settings.temp_c);
                            if(node.useCable2 && node.cable2Id) { 
                                const c2=db.cables[node.cable2Id]; 
                                if(c2) zCab=zCab.add(physics.getCableImpedance(c2, node.length2||0, 1000, state.settings.temp_c)); 
                            }
                            
                            let zMinMag=8, zNomMag=8, totalP_100v=0;
                            if(state.mode === 'low-z') { 
                                const zMinC = getEffectiveZ(node, true); 
                                const zNomC = getEffectiveZ(node, false); 
                                zMinMag = zMinC.magnitude(); 
                                zNomMag = zNomC.magnitude(); 
                            } else { 
                                totalP_100v = getTotalWatts(node); 
                                zMinMag = totalP_100v > 0 ? (100*100)/totalP_100v : 9999; 
                                zNomMag = zMinMag; 
                            }
                            
                            const tx = physics.calculateTransmission(safeV, zMinMag, zCab);
                            const drop = safeRV > 0 ? ((safeRV-tx.voltageAtLoad)/safeRV)*100 : 0;
                            const hfCheck = physics.calculateHFLoss(safeV, zMinMag, cable, node.length, state.settings.temp_c, limits.hf_freq);
                            const elecLoss = physics.calculateElectricalSPLLoss(tx.voltageAtLoad, safeRV);
                            
                            let status='OK', statusMsg='';
                            if(drop > limits.maxDrop){ status='Warning'; statusMsg='High Drop'; }
                            if(drop > limits.maxDrop*1.5){ status='Error'; statusMsg='Critical Drop'; }
                            if(hfCheck.isAudible && status!=='Error'){ status='Warning'; statusMsg='HF Loss'; }
                            
                            let headroomPct = 0;
                            if(rAmp && !node.parentId) { 
                                const m = db.amplifiers[rAmp.modelId]; 
                                if(m) { 
                                    const totalLoadZ = zMinMag + zCab.real; 
                                    let cap=0; 
                                    if(state.mode==='low-z') { 
                                        if(node.useBridgeMode) { 
                                            cap = totalLoadZ < 6 ? (m.watt_bridge_4||0) : (m.watt_bridge_8||0); 
                                            if(cap===0 && m.watt_bridge_8>0) cap=m.watt_bridge_8; 
                                        } else { 
                                            if(totalLoadZ < 3) cap = m.watt_2||0; 
                                            else if(totalLoadZ < 6) cap = m.watt_4||0; 
                                            else cap = m.watt_8||0; 
                                            if(cap===0) { 
                                                if(totalLoadZ < 6 && m.watt_4) cap = m.watt_4; 
                                                else if(m.watt_8) cap = m.watt_8; 
                                            } 
                                        } 
                                        const reqP = getTotalRMS(node); 
                                        headroomPct = cap>0 ? (reqP / cap) * 100 : 0; 
                                    } else { 
                                        cap = m.watt_100v||m.watt_8; 
                                        headroomPct = cap>0 ? (totalP_100v / cap) * 100 : 0; 
                                    } 
                                    if(headroomPct > (limits.headroom_warn*100)){
                                        status = status==='Error' ? 'Error' : 'Warning'; 
                                        statusMsg = `Headroom ${headroomPct.toFixed(0)}%`;
                                    } 
                                } 
                            }
                            
                            node.results = { 
                                minLoad: zMinMag + zCab.real, 
                                nomLoad: zNomMag + zCab.real, 
                                dropPercent: drop, 
                                dropVolts: safeRV - tx.voltageAtLoad, 
                                headroomPct: headroomPct, 
                                totalPower: totalP_100v, 
                                hfLossDb: hfCheck.lossDb, 
                                elecLossDb: elecLoss, 
                                status: status, 
                                statusMessage: statusMsg 
                            };
                            
                            if(node.children) node.children.forEach(c => calcBranch(c, tx.voltageAtLoad, safeRV, rAmp));
                        } catch(err) { console.error(err); node.results.status='Error'; }
                    };

                    state.lowZRoots.forEach(n => calcBranch(n));
                    state.highVRoots.forEach(n => calcBranch(n));
                }
            };
            
            Object.assign(window.App.Actions, actions);
            
            provide('state', state); 
            provide('addNode', actions.addNode); 
            provide('deleteNode', actions.deleteNode); 
            provide('setMode', actions.setMode);

            // --- 5. REPORTING ---
            const loadImage = (src) => {
                return new Promise((resolve) => {
                    if (!src) { resolve(null); return; }
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        try { resolve({ data: canvas.toDataURL('image/png'), width: img.width, height: img.height }); } catch(e) { resolve({ data: src, width: img.width, height: img.height }); }
                    };
                    img.onerror = () => resolve(null);
                    img.src = src;
                });
            };

            const generateReport = async () => {
                try {
                    const { jsPDF } = window.jspdf; 
                    const doc = new jsPDF('l', 'mm', 'a4');
                    doc.setFillColor(39, 39, 42); doc.rect(0,0,297,35,'F');
                    doc.setFontSize(22); doc.setTextColor(255); doc.text("System Design Report", 15, 18);
                    doc.setFontSize(10); doc.setTextColor(200); 
                    doc.text(`Project: ${state.projectInfo.name}`, 15, 26);
                    doc.text(`Company: ${state.reportInfo.company || '-'}`, 15, 31);
                    doc.text(`Designer: ${state.reportInfo.designer || '-'}`, 120, 26);
                    doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, 31);

                    if (state.reportInfo.logoUrl) {
                        const logoInfo = await loadImage(state.reportInfo.logoUrl);
                        if (logoInfo && logoInfo.data) {
                             let format = 'PNG';
                             if(logoInfo.data.startsWith('data:image/jpeg')) format = 'JPEG';
                             const maxW = 40, maxH = 25;
                             const aspect = logoInfo.width / logoInfo.height;
                             let w = maxW, h = w / aspect;
                             if (h > maxH) { h = maxH; w = h * aspect; }
                             const x = 235 + (maxW - w) / 2;
                             const y = 8 + (maxH - h) / 2;
                             doc.addImage(logoInfo.data, format, x, y, w, h);
                        }
                    }

                    const db = state.database;
                    let spkCounter = 1;

                    const getRows = (nodes) => {
                        let rows = [];
                        nodes.forEach(n => {
                            const speakerID = `S-${spkCounter++}`;
                            const spk = db.speakers[n.speakerId];
                            const spkStr = spk ? `${speakerID} | ${spk.brand} ${spk.model}` : `${speakerID} | ${n.speakerId}`;
                            const cab1 = db.cables[n.cableId];
                            let cabStr = cab1 ? `${cab1.brand} ${cab1.model} (${n.length}m)` : `${n.cableId} (${n.length}m)`;
                            if(n.useCable2 && n.cable2Id) {
                                const cab2 = db.cables[n.cable2Id];
                                cabStr += ` + ${cab2 ? cab2.brand+' '+cab2.model : n.cable2Id} (${n.length2}m)`;
                            }
                            let ampStr = '-';
                            if (n.ampInstanceId) {
                                const inst = state.ampRack[n.ampInstanceId];
                                const m = db.amplifiers[inst?.modelId];
                                ampStr = `${n.ampInstanceId} | ${m?m.brand+' '+m.model:'?'} | Ch${n.ampChannel}`;
                            } else if (n.parentId) {
                                ampStr = '->';
                            }
                            const res = n.results || {};
                            const hr = res.headroomPct > 0 ? `${res.headroomPct.toFixed(0)}%` : '-';
                            rows.push([n.id, n.userLabel||'', ampStr, spkStr, cabStr,
                                state.mode==='low-z' ? `${res.minLoad?.toFixed(2)}Ω` : `${res.totalPower}W`,
                                state.mode==='low-z' ? `${res.nomLoad?.toFixed(2)}Ω` : '-',
                                `${res.dropPercent?.toFixed(2)}%`, `${res.hfLossDb?.toFixed(2)}dB`, `${res.elecLossDb?.toFixed(2)}dB`, hr, res.status || '-']);
                            if(n.children) rows = rows.concat(getRows(n.children));
                        });
                        return rows;
                    };

                    spkCounter = 1;
                    const lowZRows = getRows(state.lowZRoots);
                    const highVRows = getRows(state.highVRoots);

                    doc.autoTable({
                        startY: 40,
                        head: [['ID', 'Label', 'Amplifier', 'Speaker', 'Cable', 'Load', 'Nom Z', 'V-Drop', 'HF Loss', 'Elec Loss', 'Headroom', 'Status']],
                        body: state.mode==='low-z' ? lowZRows : highVRows,
                        styles: { fontSize: 7, halign: 'center' },
                        columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' }, 3: { halign: 'left' }, 4: { halign: 'left' }, 5: { cellWidth: 15 } },
                        headStyles: { fillColor: [63, 63, 70] },
                        alternateRowStyles: { fillColor: [245, 245, 245] }
                    });

                    const bomMap = {}; 
                    const addToBom=(t,b,m,q,u)=>{ const k=`${t}_${b}_${m}`; if(!bomMap[k])bomMap[k]={type:t,brand:b,model:m,qty:0,unit:u}; bomMap[k].qty+=q; };
                    Object.values(state.ampRack).forEach(i=>{const m=state.database.amplifiers[i.modelId];if(m)addToBom('Amplifier',m.brand,m.model,1,'pcs');});
                    const scanBom=(nodes)=>nodes.forEach(n=>{
                        const s=state.database.speakers[n.speakerId];
                        if(s)addToBom('Speaker',s.brand,s.model,state.mode==='low-z'?(parseFloat(n.parallelCount)||1):1,'pcs');
                        const c=state.database.cables[n.cableId];
                        if(c)addToBom('Cable',c.brand,c.model,n.length,'m');
                        if(n.useCable2&&n.cable2Id){const c2=state.database.cables[n.cable2Id];if(c2)addToBom('Cable',c2.brand,c2.model,n.length2,'m');}
                        if(n.children)scanBom(n.children);
                    });
                    scanBom(state.lowZRoots); scanBom(state.highVRoots);
                    const bomRows=[]; Object.values(bomMap).sort((a,b)=>a.type.localeCompare(b.type)).forEach(x=>bomRows.push([x.type, x.brand, x.model, `${x.qty.toFixed(x.unit==='m'?1:0)} ${x.unit}`]));

                    let finalY = doc.lastAutoTable.finalY + 10;
                    if (finalY > 180) { doc.addPage(); finalY = 20; }
                    doc.setFontSize(14); doc.setTextColor(50); doc.text("Bill of Materials", 15, finalY);
                    doc.autoTable({
                        startY: finalY + 5,
                        head: [['Type', 'Brand', 'Model', 'Quantity']],
                        body: bomRows,
                        styles: { fontSize: 8, halign: 'left' },
                        headStyles: { fillColor: [50, 50, 50] },
                        columnStyles: { 3: { halign: 'right' } }
                    });

                    doc.save(`${state.projectInfo.name}_Report.pdf`);
                } catch(e) { alert("PDF Error: " + e.message); }
            };

            const generateXLS = () => {
                const bomMap={}; 
                const addToBom=(t,b,m,q,u)=>{ const k=`${t}_${b}_${m}`; if(!bomMap[k])bomMap[k]={type:t,brand:b,model:m,qty:0,unit:u}; bomMap[k].qty+=q; };
                Object.values(state.ampRack).forEach(i=>{const m=state.database.amplifiers[i.modelId];if(m)addToBom('Amplifier',m.brand,m.model,1,'pcs');});
                let spkCounter = 1;
                const scanBom=(nodes)=>nodes.forEach(n=>{
                    const s=state.database.speakers[n.speakerId];
                    if(s)addToBom('Speaker',s.brand,s.model,state.mode==='low-z'?(parseFloat(n.parallelCount)||1):1,'pcs');
                    const c=state.database.cables[n.cableId];
                    if(c)addToBom('Cable',c.brand,c.model,n.length,'m');
                    if(n.useCable2&&n.cable2Id){const c2=state.database.cables[n.cable2Id];if(c2)addToBom('Cable',c2.brand,c2.model,n.length2,'m');}
                    if(n.children)scanBom(n.children);
                });
                scanBom(state.lowZRoots); scanBom(state.highVRoots);
                const bomRows=[['Type','Brand - Model','Quantity']]; Object.values(bomMap).forEach(x=>bomRows.push([x.type,`${x.brand} ${x.model}`,`${x.qty} ${x.unit}`]));

                const schedRows=[['Line ID','Label','Amp ID','Amp Brand Model','Amp Ch','Speaker ID', 'Speaker Model', 'Cable Brand - Model','Cable mm2','Length']];
                const scanSched=(nodes, rootInfo=null)=>nodes.forEach(n=>{
                    let aInfo=rootInfo;
                    if(!n.parentId){ 
                        const inst=state.ampRack[n.ampInstanceId]; 
                        const m=inst?state.database.amplifiers[inst.modelId]:null; 
                        aInfo={id:n.ampInstanceId||'-',brand:m?m.brand:'-',model:m?m.model:'-',ch:n.ampChannel||'-'}; 
                    }
                    const c1=state.database.cables[n.cableId];
                    const s1=state.database.speakers[n.speakerId];
                    const sID = `S-${spkCounter++}`;
                    schedRows.push([n.id, n.userLabel||'', aInfo.id, `${aInfo.brand} ${aInfo.model}`, aInfo.ch, sID, s1 ? `${s1.brand} ${s1.model}` : n.speakerId, c1?`${c1.brand} ${c1.model}`:n.cableId, c1?.crossSection||'-', n.length]);
                    if(n.useCable2 && n.cable2Id) { 
                        const c2 = state.database.cables[n.cable2Id]; 
                        schedRows.push([n.id + " (Ext)", '', aInfo.id, '', '', '', '', c2?`${c2.brand} ${c2.model}`:n.cable2Id, c2?.crossSection||'-', n.length2]); 
                    }
                    if(n.children)scanSched(n.children,aInfo);
                });
                spkCounter = 1;
                scanSched(state.lowZRoots); scanSched(state.highVRoots);

                const calcRows=[['Line ID','Load (Min)','Load (Nom)','V-Drop %','V-Drop V','Power Loss (W)','Elec Loss (dB)','HF Loss (dB)','Headroom %','Status']];
                const scanCalc=(nodes)=>nodes.forEach(n=>{ calcRows.push([n.id,n.results?.minLoad?.toFixed(2),n.results?.nomLoad?.toFixed(2),n.results?.dropPercent?.toFixed(2),n.results?.dropVolts?.toFixed(2),n.results?.powerLoss?.toFixed(2),n.results?.elecLossDb?.toFixed(2),n.results?.hfLossDb?.toFixed(2),n.results?.headroomPct?.toFixed(0),n.results?.status]); if(n.children)scanCalc(n.children); });
                scanCalc(state.lowZRoots); scanCalc(state.highVRoots);

                window.App.Utils.IO.exportToXLS(state.projectInfo,{'BOM':bomRows,'Cabling Schedule':schedRows,'Calculations':calcRows});
            };

            const saveProject = () => { showSaveModal.value = true; };
            const loadProject = (f) => actions.loadProject(f);

            return {
                state, currentView, showAmpModal, wizardState, missingDataState, showSaveModal,
                generateReport, generateXLS, saveProject, loadProject,
                handleAmpSelect: actions.handleAmpSelection,
                handleWizardSelect: actions.applyWizardSelection,
                handleMissingDataSave: actions.saveMissingData,
                handleSaveSelect: actions.handleSaveSelect,
                currentViewComponent: computed(() => {
                    if (currentView.value === 'calculator') return 'calculator-view';
                    if (currentView.value === 'database') return 'database-view';
                    if (currentView.value === 'reports') return 'reports-view';
                    if (currentView.value === 'manual') return 'user-manual';
                    if (currentView.value === 'techref') return 'tech-reference';
                    return 'calculator-view';
                })
            };
        }
    });

    // Register All Components
    app.component('app-header', window.App.UI.AppHeader);
    app.component('tree-node', window.App.UI.TreeNode);
    app.component('amp-select-modal', window.App.UI.AmpSelectModal);
    app.component('cable-wizard-modal', window.App.UI.CableWizardModal);
    app.component('missing-data-modal', window.App.UI.MissingDataModal);
    app.component('reset-defaults-modal', window.App.UI.ResetDefaultsModal);
    app.component('save-project-modal', window.App.UI.SaveProjectModal);
    app.component('calculator-view', window.App.UI.CalculatorView);
    app.component('database-view', window.App.UI.DatabaseView);
    app.component('reports-view', window.App.UI.ReportsView);
    app.component('user-manual', window.App.UI.UserManual);
    app.component('tech-reference', window.App.UI.TechReference);

    app.mount('#app');
    console.log("Speaker Design Tool v3.0 Started");
})();
