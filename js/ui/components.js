/**
 * Speaker Design Tool v3.0 - UI Components
 * Status: Production Ready
 */

(function () {
    // --- 1. APP HEADER ---
    window.App.UI.AppHeader = {
        name: 'AppHeader',
        template: `
            <header class="border-b border-zinc-700 px-6 py-4 bg-zinc-800 flex justify-between items-center shrink-0 z-10 relative shadow-md">
                <div>
                    <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span class="text-2xl">🔊</span> Speaker Design Tool 
                        <span class="px-2 py-0.5 rounded-full bg-indigo-900/50 border border-indigo-700 text-[10px] text-indigo-300 font-mono">v3.0</span>
                    </h1>
                </div>
                <div class="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-700">
                    <button v-for="view in ['calculator', 'database', 'reports', 'manual', 'techref']" 
                        @click="$emit('view-change', view)"
                        :class="['px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all', currentView===view?'bg-zinc-700 text-white shadow':'text-zinc-500 hover:text-white']">
                        {{ view }}
                    </button>
                </div>
                <div class="flex gap-2">
                    <button @click="$emit('save-project')" class="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-all flex items-center gap-2"><span>💾</span> Save</button>
                    <button @click="triggerLoad" class="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md text-emerald-300 bg-zinc-700 hover:bg-zinc-600 transition-all flex items-center gap-2"><span>📂</span> Load</button>
                    <input type="file" ref="fileInput" class="hidden" accept=".json,.csv" @change="handleFile">
                </div>
            </header>
        `,
        props: ['currentView'],
        emits: ['view-change', 'generate-report', 'save-project', 'load-project'],
        methods: {
            triggerLoad() { this.$refs.fileInput.click(); },
            handleFile(event) {
                const file = event.target.files[0];
                if (file) this.$emit('load-project', file);
                event.target.value = '';
            }
        }
    };

    // --- 2. AMP SELECT MODAL ---
    window.App.UI.AmpSelectModal = {
        name: 'AmpSelectModal',
        template: `
            <div v-if="visible" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
                <div class="bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
                    <div class="px-6 py-4 border-b border-zinc-700 flex justify-between items-center shrink-0">
                        <h3 class="text-lg font-bold text-white">Select Amplifier</h3>
                        <button @click="$emit('close')" class="text-zinc-400 hover:text-white text-xl">×</button>
                    </div>
                    <div class="p-4 border-b border-zinc-700 bg-zinc-900/50">
                        <input v-model="search" placeholder="Search brand or model..." class="w-full bg-zinc-800 border border-zinc-600 rounded px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
                    </div>
                    <div class="overflow-y-auto p-2 flex-1">
                        <div v-if="filteredAmps.length === 0" class="text-center py-8 text-zinc-500">No amplifiers found. Check Database.</div>
                        <div v-for="amp in filteredAmps" :key="amp.id" @click="$emit('select', amp.id)" class="group flex items-center justify-between p-3 rounded hover:bg-zinc-700 cursor-pointer transition-colors border-b border-zinc-700/50 last:border-0">
                            <div>
                                <div class="text-sm font-bold text-white">{{ amp.brand }} <span class="text-emerald-400">{{ amp.model }}</span></div>
                                <div class="text-[10px] text-zinc-400 mt-0.5">{{ amp.watt_8 }}W @ 8Ω | {{ amp.channels_lowz || 4 }}ch Low-Z | {{ amp.channels_100v || 0 }}ch 100V</div>
                            </div>
                            <button class="px-3 py-1 bg-zinc-900 group-hover:bg-emerald-600 text-xs font-bold rounded text-zinc-300 group-hover:text-white transition-colors">Select</button>
                        </div>
                    </div>
                </div>
            </div>
        `,
        props: ['visible'],
        emits: ['close', 'select'],
        data() { return { search: '' } },
        computed: {
            filteredAmps() {
                const db = window.App.State.database.amplifiers;
                const term = this.search.toLowerCase();
                return Object.values(db).filter(a => 
                    (a.brand && a.brand.toLowerCase().includes(term)) || 
                    (a.model && a.model.toLowerCase().includes(term))
                ).sort((a,b) => a.brand.localeCompare(b.brand));
            }
        }
    };

    // --- 3. CABLE WIZARD MODAL ---
    window.App.UI.CableWizardModal = {
        name: 'CableWizardModal',
        template: `
            <div v-if="visible" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
                <div class="bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
                    <div class="px-6 py-4 border-b border-zinc-700 flex justify-between items-center shrink-0">
                        <div class="flex items-center gap-3">
                            <h3 class="text-lg font-bold text-white">Cable Wizard</h3>
                            <span class="text-xs bg-zinc-900 text-emerald-400 px-2 py-1 rounded border border-emerald-900/50">Target: < {{limit}}% Drop</span>
                        </div>
                        <button @click="$emit('close')" class="text-zinc-400 hover:text-white text-xl">×</button>
                    </div>
                    <div class="overflow-y-auto p-2 flex-1">
                        <div v-if="candidates.length === 0" class="text-center py-12 text-zinc-500"><div class="text-2xl mb-2">⚠️</div><p>No cables found that meet the standard.</p></div>
                        <div v-for="(cab, idx) in candidates" :key="cab.id" @click="$emit('select', cab.id)" class="group flex items-center justify-between p-4 rounded hover:bg-zinc-700 cursor-pointer transition-colors border-b border-zinc-700/50 last:border-0">
                            <div class="flex items-center gap-4">
                                <div class="w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm" :class="idx===0 ? 'bg-emerald-500 text-black' : 'bg-zinc-900 text-zinc-500'">{{idx+1}}</div>
                                <div>
                                    <div class="text-sm font-bold text-white">{{ cab.brand }} <span class="text-emerald-400">{{ cab.model }}</span></div>
                                    <div class="text-[10px] text-zinc-400 mt-0.5">{{ cab.crossSection ? cab.crossSection + 'mm²' : 'Unknown Size' }}  |  {{ cab.resistance }} Ω/km</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-sm font-mono font-bold" :class="getDropClass(cab.drop)">{{ cab.drop.toFixed(2) }}%</div>
                                <div class="text-[9px] text-zinc-500 uppercase tracking-wide">Drop</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        props: ['visible', 'candidates', 'limit'],
        emits: ['close', 'select'],
        methods: {
            getDropClass(val) {
                const limit = this.limit;
                if(val < limit * 0.5) return 'text-emerald-400'; 
                if(val <= limit) return 'text-emerald-200';
                return 'text-amber-400';
            }
        }
    };

    // --- 4. MISSING DATA MODAL ---
    window.App.UI.MissingDataModal = {
        name: 'MissingDataModal',
        template: `
            <div v-if="visible" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in">
                <div class="bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl w-full max-w-md flex flex-col">
                    <div class="px-6 py-4 border-b border-zinc-700 bg-zinc-900/50 rounded-t-xl">
                        <h3 class="text-lg font-bold text-white flex items-center gap-2"><span class="text-amber-400">⚠️</span> Update Data</h3>
                        <p class="text-xs text-zinc-400 mt-1">Missing specifications for <span class="text-white font-bold">{{ title }}</span>.</p>
                    </div>
                    <div class="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                        <div v-for="field in fields" :key="field.key">
                            <label class="text-[10px] font-bold text-zinc-500 uppercase block mb-1">{{ field.label }}</label>
                            <input v-model.number="formData[field.key]" type="number" step="any" class="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors">
                        </div>
                    </div>
                    <div class="px-6 py-4 border-t border-zinc-700 flex justify-end gap-2 bg-zinc-900/50 rounded-b-xl">
                        <button @click="$emit('save', formData)" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded transition-colors shadow-lg">Save & Update DB</button>
                    </div>
                </div>
            </div>
        `,
        props: ['visible', 'fields', 'title', 'initialData'],
        emits: ['save'],
        data() { return { formData: {} } },
        watch: { visible(newVal) { if (newVal) this.formData = { ...this.initialData }; } }
    };

    // --- 5. RESET DEFAULTS MODAL ---
    window.App.UI.ResetDefaultsModal = {
        name: 'ResetDefaultsModal',
        template: `
            <div v-if="visible" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in">
                <div class="bg-zinc-800 border border-red-900/50 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
                    <div class="px-6 py-4 bg-red-900/20 border-b border-red-900/30">
                        <h3 class="text-lg font-bold text-white flex items-center gap-2"><span class="text-red-500">🗑️</span> Reset {{ target }}?</h3>
                    </div>
                    <div class="p-6 text-zinc-300 text-sm leading-relaxed">
                        <p>Are you sure you want to reset the <strong>{{ target }}</strong> database to factory defaults?</p>
                        <p class="mt-4 text-red-400 font-bold text-xs bg-red-900/10 p-3 rounded border border-red-900/30">⚠️ This action cannot be undone.</p>
                    </div>
                    <div class="px-6 py-4 border-t border-zinc-700 flex justify-end gap-3 bg-zinc-900/50">
                        <button @click="$emit('close')" class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-bold rounded transition-colors">Cancel</button>
                        <button @click="$emit('confirm')" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded transition-colors shadow-lg">Yes, Reset</button>
                    </div>
                </div>
            </div>
        `,
        props: ['visible', 'target'],
        emits: ['close', 'confirm']
    };

    // --- 6. SAVE PROJECT MODAL ---
    window.App.UI.SaveProjectModal = {
        name: 'SaveProjectModal',
        template: `
            <div v-if="visible" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in">
                <div class="bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl w-full max-w-md flex flex-col">
                    <div class="px-6 py-4 border-b border-zinc-700 bg-zinc-900/50 rounded-t-xl">
                        <h3 class="text-lg font-bold text-white flex items-center gap-2"><span>💾</span> Save Project</h3>
                    </div>
                    <div class="p-6 text-zinc-300 text-sm leading-relaxed space-y-4">
                        <p>Do you want to bundle your <strong>Equipment Database</strong> with this project file?</p>
                        <div class="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded text-xs text-indigo-200"><strong>Include:</strong> Best for sharing.</div>
                        <div class="bg-zinc-700/30 border border-zinc-600/30 p-3 rounded text-xs text-zinc-400"><strong>Skip:</strong> Best for local backups.</div>
                    </div>
                    <div class="px-6 py-4 border-t border-zinc-700 flex justify-end gap-3 bg-zinc-900/50 rounded-b-xl">
                        <button @click="$emit('close')" class="px-4 py-2 text-zinc-400 hover:text-white text-sm">Cancel</button>
                        <button @click="$emit('select', false)" class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-bold rounded">Skip</button>
                        <button @click="$emit('select', true)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded shadow-lg">Include</button>
                    </div>
                </div>
            </div>
        `,
        props: ['visible'],
        emits: ['close', 'select']
    };

    // --- 7. TREE NODE ---
    window.App.UI.TreeNode = {
        name: 'TreeNode',
        template: `
            <div class="group border-b border-zinc-700 last:border-0 bg-zinc-800 hover:bg-zinc-750 transition-colors animate-in">
                <div class="grid grid-cols-1 md:grid-cols-[60px_minmax(0,0.8fr)_minmax(0,2.4fr)_minmax(0,2.4fr)_0.7fr_0.7fr_0.7fr_0.7fr_100px_50px] gap-4 px-4 py-3 items-center">
                    
                    <div class="flex items-center">
                        <div class="font-mono text-xs text-zinc-500 font-bold truncate pl-2 border-l-2 border-zinc-600" 
                             :style="{ marginLeft: (depth > 0 ? 15 : 0) + 'px' }">
                             {{ node.id }}
                        </div>
                    </div>
                    
                    <div class="min-w-0"><input v-model="node.userLabel" class="w-full bg-transparent border border-transparent hover:border-zinc-700 rounded px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none truncate" placeholder="Label..."></div>
                    
                    <div class="md:col-span-2 bg-zinc-900/50 border border-zinc-700/50 rounded py-2 px-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <div class="flex flex-col gap-3 pl-2">
                            <div v-if="!node.parentId" class="flex items-center gap-2">
                                <span class="text-[9px] text-zinc-500 uppercase w-8 shrink-0 font-bold">Amp</span>
                                <select v-model="node.ampInstanceId" @change="onAmpChange" class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-emerald-300 font-bold text-ellipsis w-full min-w-0"><option value="">Select...</option><optgroup label="Rack"><option v-for="inst in ampInstances" :value="inst.id">{{inst.id}}: {{inst.modelName}}</option></optgroup><option value="NEW_AMP">+ New...</option></select>
                                
                                <select v-if="node.ampInstanceId" v-model.number="node.ampChannel" @change="recalc" class="w-16 bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-xs text-white shrink-0" :title="ampChannelTooltip">
                                    <option :value="null">Ch</option>
                                    <option v-for="opt in availableChannelOptions" :value="opt.ch" :disabled="opt.disabled">
                                        {{ opt.label }}
                                    </option>
                                </select>

                                <label v-if="node.ampInstanceId && isLowZ" class="cursor-pointer shrink-0" title="Bridge Mode (Pairs Channels)">
                                    <input type="checkbox" v-model="node.useBridgeMode" @change="onBridgeChange" class="accent-emerald-500 w-3 h-3">
                                </label>
                            </div>
                            <div class="flex items-center gap-2">
                                <select v-model="filterSpkBrand" class="w-20 bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-[9px] text-zinc-400 font-medium shrink-0"><option value="">Brand...</option><option v-for="b in uniqueSpkBrands" :value="b">{{b}}</option></select>
                                <select v-model="node.speakerId" @change="onSpeakerChange" class="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-white font-medium text-ellipsis w-full min-w-0"><option value="">Speaker...</option><option v-for="s in filteredSpeakers" :value="s.id" :key="s.id">{{s.brand}} {{s.model}}</option></select>
                                <input v-if="isLowZ" v-model.number="node.parallelCount" @change="recalc" type="number" min="1" class="w-14 bg-zinc-800 border border-zinc-600 rounded px-1 text-center text-xs text-white shrink-0" title="Qty">
                                <select v-else v-model.number="node.tapPower" @change="recalc" class="w-16 bg-zinc-800 border border-zinc-600 rounded px-1 text-xs text-white shrink-0"><option :value="0">Tap</option><option v-for="t in availableTaps" :value="t" :key="t">{{t}}W</option></select>
                            </div>
                        </div>

                        <div class="flex flex-col justify-center gap-2 pr-2 pl-4 md:border-l border-zinc-700/30">
                            
                            <div class="flex items-center gap-2">
                                <select v-model="filterCabBrand" class="w-20 bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-[9px] text-zinc-400 font-medium shrink-0"><option value="">Brand</option><option v-for="b in uniqueCabBrands" :value="b">{{b}}</option></select>
                                <select v-model="node.cableId" @change="onCableChange" class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 text-ellipsis w-full min-w-0"><option value="">Main Cable...</option><option v-for="c in filteredCables" :value="c.id" :key="c.id">{{c.brand}} {{c.model}} ({{c.crossSection}}mm²)</option></select>
                                <input v-model.number="node.length" @change="recalc" type="number" class="w-14 bg-zinc-900 border border-zinc-700 rounded px-1 text-center text-xs text-zinc-300 shrink-0" placeholder="m">
                                <button @click="runWizard" class="w-10 h-6 flex items-center justify-center bg-emerald-400 hover:bg-emerald-300 text-black rounded text-xs shadow-sm transition-colors shrink-0" title="Cable Wizard">🪄</button>
                            </div>

                            <div class="flex items-center gap-2">
                                <div class="w-16 flex justify-center shrink-0" title="Enable 2nd Cable Segment">
                                    <input type="checkbox" v-model="node.useCable2" @change="recalc" class="accent-emerald-500 w-3 h-3">
                                </div>
                                <select v-model="node.cable2Id" @change="recalc" :disabled="!node.useCable2" class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-400 text-ellipsis w-full min-w-0 disabled:opacity-30"><option value="">+ Extension...</option><option v-for="c in filteredCables" :value="c.id" :key="c.id">{{c.brand}} {{c.model}} ({{c.crossSection}}mm²)</option></select>
                                <input v-model.number="node.length2" :disabled="!node.useCable2" @change="recalc" type="number" class="w-14 bg-zinc-900 border border-zinc-700 rounded px-1 text-center text-xs text-zinc-400 shrink-0 disabled:opacity-30" placeholder="m">
                                <div class="w-6 shrink-0"></div>
                            </div>

                        </div>
                    </div>

                    <div class="font-mono text-xs text-zinc-300 text-right pr-2">{{ isLowZ ? format(node.results?.minLoad, 2) + 'Ω' : format(node.results?.totalPower, 1) + 'W' }}</div>
                    <div class="font-mono text-xs text-zinc-500 text-right pr-2">{{ isLowZ ? format(node.results?.nomLoad, 2) + 'Ω' : '-' }}</div>
                    <div class="flex flex-col text-right pr-2"><span :class="['font-mono text-xs font-bold', getLimitClass(node.results?.dropPercent, 5, 10)]">{{ format(node.results?.dropPercent, 2) }}%</span><span class="text-[9px] text-zinc-500">{{ format(node.results?.dropVolts, 2) }}V</span></div>
                    <div class="font-mono text-xs text-center" :class="node.results?.headroomPct > 80 ? 'text-amber-500' : 'text-zinc-400'">{{ node.results?.headroomPct > 0 ? node.results.headroomPct.toFixed(0) + '%' : '-' }}</div>
                    
                    <div class="text-center flex flex-col items-center"><div class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border" :class="statusClass">{{ node.results?.status || '-' }}</div><div v-if="node.results?.statusMessage" class="text-[9px] text-red-400 mt-1 font-medium truncate max-w-[100px]" :title="node.results.statusMessage">{{ node.results.statusMessage }}</div></div>
                    
                    <div class="flex justify-end gap-2">
                        <button @click="$emit('add-child', node.id)" title="Daisy Chain" class="w-6 h-6 flex items-center justify-center rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm">↓</button>
                        <button @click="$emit('delete', node.id)" title="Delete" class="w-6 h-6 flex items-center justify-center rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 text-lg leading-none">×</button>
                    </div>
                </div>
                <div v-if="node.children && node.children.length > 0"><tree-node v-for="child in node.children" :key="child.id" :node="child" :depth="depth + 1" @add-child="$emit('add-child', $event)" @delete="$emit('delete', $event)"></tree-node></div>
            </div>
        `,
        props: ['node', 'depth'],
        emits: ['add-child', 'delete'],
        data() { return { filterSpkBrand: '', filterCabBrand: '' } },
        computed: {
            state() { return window.App.State; },
            db() { return this.state.database; },
            isLowZ() { return this.state.mode === 'low-z'; },
            ampInstances() { return Object.values(this.state.ampRack).map(inst => ({ id: inst.id, modelName: `${this.db.amplifiers[inst.modelId]?.brand || 'Generic'} ${this.db.amplifiers[inst.modelId]?.model || inst.modelId}` })); },
            
            // --- SMART CHANNEL LOGIC ---
            availableChannelOptions() {
                if (!this.node.ampInstanceId || !this.state.ampRack[this.node.ampInstanceId]) return [];
                const inst = this.state.ampRack[this.node.ampInstanceId];
                const model = this.db.amplifiers[inst.modelId];
                if (!model) return [];

                const totalPhys = parseInt(this.isLowZ ? (model.channels_lowz || 4) : (model.channels_100v || 4));
                const usedChannels = new Set();
                const nodes = this.state.mode === 'low-z' ? this.state.lowZRoots : this.state.highVRoots;
                
                const scan = (list) => list.forEach(n => {
                    if (n.id !== this.node.id && n.ampInstanceId === this.node.ampInstanceId && n.ampChannel) {
                        const ch = parseInt(n.ampChannel);
                        usedChannels.add(ch);
                        if (n.useBridgeMode) usedChannels.add(ch + 1); 
                    }
                    if (n.children) scan(n.children);
                });
                scan(nodes);

                const options = [];
                const step = this.node.useBridgeMode ? 2 : 1;

                for (let i = 1; i <= totalPhys; i += step) {
                    let disabled = usedChannels.has(i);
                    if (this.node.useBridgeMode) {
                        if (i + 1 > totalPhys) continue; 
                        if (usedChannels.has(i + 1)) disabled = true;
                    }
                    options.push({
                        ch: i,
                        disabled: disabled,
                        label: this.node.useBridgeMode ? `${i}+${i+1}` : `${i}${disabled ? '*' : ''}`
                    });
                }
                return options;
            },
            
            ampChannelTooltip() {
                if (!this.node.ampInstanceId) return '';
                const inst = this.state.ampRack[this.node.ampInstanceId];
                const model = this.db.amplifiers[inst.modelId];
                const count = this.isLowZ ? (model.channels_lowz || 4) : (model.channels_100v || 4);
                return `Max Channels: ${count}`;
            },

            uniqueSpkBrands() { return [...new Set(Object.values(this.db.speakers).map(i=>i.brand))].sort(); },
            uniqueCabBrands() { return [...new Set(Object.values(this.db.cables).map(i=>i.brand))].sort(); },
            filteredSpeakers() {
                 const m = this.state.mode;
                 return Object.values(this.db.speakers).filter(s => (!s.type || s.type === 'Both' || (m === 'low-z' && s.type === 'Lo-Z') || (m === 'high-v' && s.type === '100V')) && (!this.filterSpkBrand || s.brand === this.filterSpkBrand)).sort((a,b) => a.brand.localeCompare(b.brand));
            },
            filteredCables() { return Object.values(this.db.cables).filter(c => !this.filterCabBrand || c.brand === this.filterCabBrand).sort((a,b) => a.brand.localeCompare(b.brand)); },
            availableTaps() { const s = this.db.speakers[this.node.speakerId]; return s ? (s.taps || []) : []; },
            statusClass() { const s = this.node.results?.status; return s==='Error'?'bg-red-500/10 text-red-500 border-red-500/20':(s==='Warning'?'bg-amber-500/10 text-amber-500 border-amber-500/20':'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'); }
        },
        methods: {
            format(n, d) { return (n !== undefined && n !== null) ? Number(n).toFixed(d) : '-'; },
            recalc() { if(window.App.Actions.calculateAll) window.App.Actions.calculateAll(); },
            getLimitClass(val, warn, err) { if(val >= err) return 'text-red-500'; if(val >= warn) return 'text-amber-500'; return 'text-zinc-300'; },
            runWizard() { window.App.Actions.runCableWizard(this.node, this.filterCabBrand); },
            onAmpChange() { if (this.node.ampInstanceId === 'NEW_AMP') { window.App.Actions.openAmpModal(this.node); this.node.ampInstanceId = ''; } else { this.node.ampChannel = null; this.recalc(); } },
            onBridgeChange() { this.node.ampChannel = null; this.recalc(); },
            onSpeakerChange() { window.App.Actions.validateEquipment('speakers', this.node.speakerId); },
            onCableChange() { window.App.Actions.validateEquipment('cables', this.node.cableId); },
            isChannelUsed(ch) { return false; } // Handled by computed prop
        }
    };
    console.log("App.UI.Components Loaded (v3.0)");
})();