/**
 * Speaker Design Tool v3.0 - View Components
 * Status: Final Production Ready
 */

(function () {
    // ==============================
    // 1. CALCULATOR VIEW
    // ==============================
    window.App.UI.CalculatorView = {
        template: `
            <div class="flex flex-col gap-6 h-full animate-in">
                <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-5 shrink-0 grid grid-cols-1 lg:grid-cols-[1fr_150px_200px_250px_auto] gap-6 items-end shadow-sm">
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Project Name</label>
                        <input v-model="state.projectInfo.name" class="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:border-zinc-500 transition-colors">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Temp</label>
                        <div class="flex items-center bg-zinc-900 border border-zinc-700 rounded-md px-3">
                            <input v-model.number="state.settings.temp_c" type="number" class="w-full bg-transparent border-none py-2 text-sm focus:ring-0 text-center text-white">
                            <span class="text-xs text-zinc-500">°C</span>
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">System Mode</label>
                        <div class="flex bg-zinc-900 rounded-md p-1 border border-zinc-700">
                            <button @click="setMode('low-z')" :class="['flex-1 text-xs font-bold py-1.5 rounded transition-all', state.mode==='low-z'?'bg-zinc-200 text-black shadow-sm':'text-zinc-500 hover:text-white']">Low-Z</button>
                            <button @click="setMode('high-v')" :class="['flex-1 text-xs font-bold py-1.5 rounded transition-all', state.mode==='high-v'?'bg-zinc-200 text-black shadow-sm':'text-zinc-500 hover:text-white']">100V</button>
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Standard</label>
                        <div class="flex bg-zinc-900 rounded-md p-1 border border-zinc-700">
                            <button @click="setQuality('high-end')" :class="['flex-1 text-[10px] font-bold py-1.5 rounded px-2 transition-all', state.qualityMode==='high-end'?'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30':'text-zinc-500 hover:text-white']" title="Strict (5%, 10kHz)">Hi-End</button>
                            <button @click="setQuality('average')" :class="['flex-1 text-[10px] font-bold py-1.5 rounded px-2 transition-all', state.qualityMode==='average'?'bg-amber-500/20 text-amber-400 border border-amber-500/30':'text-zinc-500 hover:text-white']" title="Normal (10%, 6kHz)">BGM</button>
                            <button @click="setQuality('speech')" :class="['flex-1 text-[10px] font-bold py-1.5 rounded px-2 transition-all', state.qualityMode==='speech'?'bg-blue-500/20 text-blue-400 border border-blue-500/30':'text-zinc-500 hover:text-white']" title="Relaxed (15%, 4kHz)">Speech</button>
                        </div>
                    </div>
                    <div class="flex justify-end">
                        <button @click="addNode(null)" class="bg-zinc-200 hover:bg-white text-zinc-900 px-5 py-2.5 rounded-md text-sm font-bold transition-colors shadow-sm flex items-center gap-2">
                            <span>+</span> Add New Line
                        </button>
                    </div>
                </div>

                <div class="bg-zinc-800 border border-zinc-700 rounded-lg flex flex-col flex-1 overflow-hidden shadow-lg">
                    <div class="hidden md:grid grid-cols-[60px_minmax(0,0.8fr)_minmax(0,2.4fr)_minmax(0,2.4fr)_0.7fr_0.7fr_0.7fr_0.7fr_100px_50px] gap-4 px-4 py-3 bg-zinc-700 text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 border-b border-zinc-600">
                        <div>ID</div>
                        <div>Label</div>
                        <div>Equipment</div>
                        <div>Cable Run</div>
                        <div>{{state.mode==='low-z'?'Min Load':'Total Power'}}</div>
                        <div>{{state.mode==='low-z'?'Nom Load':'-'}}</div>
                        <div>{{state.mode==='low-z'?'V-Drop %':'V-Drop V'}}</div>
                        <div>Headroom</div>
                        <div class="text-center">Status</div>
                        <div></div>
                    </div>
                    <div class="overflow-y-auto flex-1 p-0">
                        <div v-if="(state.mode==='low-z' ? state.lowZRoots : state.highVRoots).length === 0" class="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50">
                            <div class="text-4xl mb-2">⚡</div>
                            <p>No calculations started. Click "Add New Line".</p>
                        </div>
                        <tree-node v-for="node in (state.mode==='low-z' ? state.lowZRoots : state.highVRoots)" :key="node.id" :node="node" :depth="0" @add-child="addNode" @delete="deleteNode"></tree-node>
                    </div>
                </div>
            </div>
        `,
        inject: ['state', 'addNode', 'deleteNode', 'setMode'],
        methods: {
            setQuality(q) {
                this.state.qualityMode = q;
                if(window.App.Actions.calculateAll) window.App.Actions.calculateAll();
            }
        }
    };

    // ==============================
    // 2. DATABASE VIEW
    // ==============================
    window.App.UI.DatabaseView = {
        template: `
            <div class="flex flex-col gap-6 h-full animate-in">
                <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-5 shrink-0">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-lg font-bold text-white">Equipment Database</h2>
                        <div class="flex gap-2">
                            <button @click="dbTab='speakers'" :class="['px-4 py-2 text-sm font-bold rounded transition-all', dbTab==='speakers'?'bg-emerald-500 text-black':'bg-zinc-700 text-zinc-300 hover:bg-zinc-600']">Speakers</button>
                            <button @click="dbTab='cables'" :class="['px-4 py-2 text-sm font-bold rounded transition-all', dbTab==='cables'?'bg-emerald-500 text-black':'bg-zinc-700 text-zinc-300 hover:bg-zinc-600']">Cables</button>
                            <button @click="dbTab='amplifiers'" :class="['px-4 py-2 text-sm font-bold rounded transition-all', dbTab==='amplifiers'?'bg-emerald-500 text-black':'bg-zinc-700 text-zinc-300 hover:bg-zinc-600']">Amplifiers</button>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6 flex-1 overflow-hidden">
                    <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-5 overflow-y-auto">
                        <h3 class="text-sm font-bold mb-4 text-emerald-400 uppercase">{{ editMode ? 'Edit' : 'Add New' }} {{ dbTab.slice(0,-1) }}</h3>
                        <form @submit.prevent="saveItem" class="space-y-4">
                            <div class="grid grid-cols-2 gap-3">
                                <div><label class="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Brand</label><input v-model="form.brand" class="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"></div>
                                <div><label class="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Model</label><input v-model="form.model" class="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"></div>
                            </div>

                            <div v-if="dbTab==='cables'" class="space-y-3">
                                <div><label class="text-[9px] font-bold text-zinc-500 uppercase">Cross-Section (mm²)</label><input v-model.number="form.crossSection" step="0.1" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                <div><label class="text-[9px] font-bold text-zinc-500 uppercase">Resistance (Ω/km)</label><input v-model.number="form.resistance" step="0.01" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                            </div>

                            <div v-if="dbTab==='amplifiers'" class="space-y-3">
                                <div class="grid grid-cols-3 gap-2">
                                    <div><label class="text-[9px] font-bold text-zinc-500 uppercase">Ch (Low-Z)</label><input v-model.number="form.channels_lowz" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                    <div><label class="text-[9px] font-bold text-zinc-500 uppercase">Ch (100V)</label><input v-model.number="form.channels_100v" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                    <div><label class="text-[9px] font-bold text-zinc-500 uppercase">Ch (Bridge)</label><input v-model.number="form.channels_bridge" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                </div>
                                <div><label class="text-[9px] font-bold text-zinc-500 uppercase">Rack Units (U)</label><input v-model.number="form.rack_u" step="0.5" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                <div class="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-700">
                                    <div><label class="text-[9px] text-zinc-500">W (8Ω)</label><input v-model.number="form.watt_8" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                    <div><label class="text-[9px] text-zinc-500">W (4Ω)</label><input v-model.number="form.watt_4" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                    <div><label class="text-[9px] text-zinc-500">W (2Ω)</label><input v-model.number="form.watt_2" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div><label class="text-[9px] text-zinc-500">W (Bridge 8Ω)</label><input v-model.number="form.watt_bridge_8" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                    <div><label class="text-[9px] text-zinc-500">W (100V)</label><input v-model.number="form.watt_100v" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                </div>
                            </div>

                            <div v-if="dbTab==='speakers'" class="space-y-3">
                                <div class="grid grid-cols-2 gap-2">
                                    <div><label class="text-[9px] font-bold text-zinc-500 uppercase">Imp (Ω)</label><input v-model.number="form.impedance" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                    <div><label class="text-[9px] font-bold text-zinc-500 uppercase">RMS (W)</label><input v-model.number="form.wattage_rms" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                                </div>
                                <div><label class="text-[9px] font-bold text-zinc-500 uppercase">100V Taps</label><input v-model="form.taps" class="w-full bg-zinc-900 border-zinc-700 rounded text-sm px-2 py-1 text-white"></div>
                            </div>

                            <div class="flex gap-2 pt-4 border-t border-zinc-700">
                                <button type="submit" class="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded font-bold">Save</button>
                                <button v-if="editMode" type="button" @click="cancelEdit" class="px-4 py-2 bg-zinc-700 text-white rounded">Cancel</button>
                            </div>
                        </form>
                        
                        <div class="mt-6 pt-6 border-t border-zinc-700">
                            <h4 class="text-xs font-bold text-zinc-500 uppercase mb-3">Data Tools</h4>
                            <div class="flex flex-col gap-2">
                                <input type="file" ref="dbImport" @change="handleDbImport" class="hidden" accept=".csv">
                                <button @click="$refs.dbImport.click()" class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm font-bold transition-colors flex items-center justify-center gap-2"><span>📂</span> Import CSV</button>
                                <button @click="exportDbCsv" class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm font-bold transition-colors flex items-center justify-center gap-2"><span>💾</span> Export CSV</button>
                                <button @click="resetDefaults" class="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-white rounded text-sm font-bold transition-colors flex items-center justify-center gap-2 border border-red-900"><span>🔄</span> Reset to Defaults</button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden flex flex-col">
                        <div class="overflow-y-auto flex-1">
                            <table class="w-full text-sm">
                                <thead class="bg-zinc-700 sticky top-0">
                                    <tr class="text-[10px] font-bold text-zinc-400 uppercase">
                                        <th class="px-4 py-3 text-left">Brand / Model</th>
                                        <th v-if="dbTab==='speakers'" class="px-4 py-3 text-left">Impedance</th>
                                        <th v-if="dbTab==='speakers'" class="px-4 py-3 text-left">Power</th>
                                        <th v-if="dbTab==='speakers'" class="px-4 py-3 text-left">Taps</th>
                                        <th v-if="dbTab==='amplifiers'" class="px-4 py-3 text-left">Channels</th>
                                        <th v-if="dbTab==='amplifiers'" class="px-4 py-3 text-left">Power Ratings</th>
                                        <th v-if="dbTab==='cables'" class="px-4 py-3 text-left">Size / Res</th>
                                        <th v-if="dbTab==='cables'" class="px-4 py-3 text-left">L / C</th>
                                        <th class="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="item in currentData" :key="item.id" class="border-b border-zinc-700 hover:bg-zinc-750 transition-colors">
                                        <td class="px-4 py-3">
                                            <div class="text-white font-bold">{{ item.brand }}</div>
                                            <div class="text-zinc-400 text-xs">{{ item.model }}</div>
                                        </td>
                                        <td v-if="dbTab==='speakers'" class="px-4 py-3 text-zinc-300 text-xs"><div>Nom: {{ item.impedance }}Ω</div><div class="text-zinc-500">Min: {{ item.z_min || '-' }}Ω</div></td>
                                        <td v-if="dbTab==='speakers'" class="px-4 py-3 text-zinc-300 text-xs"><div>RMS: {{ item.wattage_rms }}W</div><div class="text-zinc-500">Peak: {{ item.wattage_peak || '-' }}W</div></td>
                                        <td v-if="dbTab==='speakers'" class="px-4 py-3 text-zinc-500 text-xs max-w-[100px] truncate">{{ Array.isArray(item.taps) ? item.taps.join(', ') : item.taps }}</td>
                                        <td v-if="dbTab==='amplifiers'" class="px-4 py-3 text-zinc-300 text-xs">LZ: {{item.channels_lowz||0}} | 100V: {{item.channels_100v||0}} | Br: {{item.channels_bridge||0}}</td>
                                        <td v-if="dbTab==='amplifiers'" class="px-4 py-3 text-zinc-300 text-xs"><div>8Ω:{{item.watt_8}}W | 4Ω:{{item.watt_4}}W | 2Ω:{{item.watt_2}}W</div><div class="text-emerald-400">BTL: {{item.watt_bridge_8}}W | 100V: {{item.watt_100v}}W</div></td>
                                        <td v-if="dbTab==='cables'" class="px-4 py-3 text-zinc-300 text-xs"><div>{{ item.crossSection }} mm²</div><div class="text-zinc-500">{{ item.resistance }} Ω/km</div></td>
                                        <td v-if="dbTab==='cables'" class="px-4 py-3 text-zinc-500 text-xs">L: {{ item.inductance || 0.6 }}µH | C: {{ item.capacitance || 100 }}pF</td>
                                        <td class="px-4 py-3 text-center"><button @click="editItem(item.id)" class="text-emerald-400 px-2">✎</button><button @click="deleteItem(item.id)" class="text-red-400 px-2">×</button></td>
                                    </tr>
                                    <tr v-if="currentData.length === 0"><td colspan="5" class="px-4 py-12 text-center text-zinc-600"><div class="text-2xl mb-2">📭</div><div>No items found.</div><div class="text-xs mt-1">Import a CSV or use "Reset to Defaults".</div></td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <reset-defaults-modal :visible="resetModalVisible" :target="dbTab" @close="resetModalVisible = false" @confirm="confirmReset"></reset-defaults-modal>
            </div>
        `,
        inject: ['state'],
        data() { return { dbTab: 'speakers', editMode: false, form: {}, resetModalVisible: false }; },
        computed: { currentData() { return Object.values(this.state.database[this.dbTab] || {}); } },
        methods: {
            saveItem() { if(!this.form.id) this.form.id = window.App.Utils.IO.generateId(this.form.brand, this.form.model); this.state.database[this.dbTab][this.form.id] = { ...this.form }; this.cancelEdit(); },
            editItem(id) { this.form = { ...this.state.database[this.dbTab][id] }; this.editMode = true; },
            deleteItem(id) { delete this.state.database[this.dbTab][id]; },
            cancelEdit() { this.form = {}; this.editMode = false; },
            handleDbImport(e) { const file = e.target.files[0]; if(!file) return; const r = new FileReader(); r.onload = (evt) => { const items = window.App.Utils.IO.parseCSV(evt.target.result); items.forEach(i => this.state.database[this.dbTab][i.id] = i); }; r.readAsText(file); },
            exportDbCsv() { const d = Object.values(this.state.database[this.dbTab]); if(!d.length) return; window.App.Utils.IO.downloadCSV(`${this.dbTab}.csv`, [Object.keys(d[0]), ...d.map(r => Object.values(r))]); },
            resetDefaults() { this.resetModalVisible = true; },
            confirmReset() { const defaults = JSON.parse(JSON.stringify(window.App.Core.Database.DATA[this.dbTab])); this.state.database[this.dbTab] = defaults; this.resetModalVisible = false; }
        }
    };

    // ==============================
    // 3. REPORTS VIEW
    // ==============================
    window.App.UI.ReportsView = {
        template: `
            <div class="flex flex-col gap-6 h-full overflow-y-auto animate-in p-6">
                <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
                    <h2 class="text-xl font-bold mb-6 text-white">System Report</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-zinc-900 p-4 rounded border border-zinc-700">
                        <div><label class="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Company</label><input v-model="state.reportInfo.company" class="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-white"></div>
                        <div><label class="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Designer</label><input v-model="state.reportInfo.designer" class="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-white"></div>
                        <div>
                            <label class="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Logo (Image Link or Upload)</label>
                            <div class="flex gap-2">
                                <input v-model="state.reportInfo.logoUrl" placeholder="https://... or Upload ->" class="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-white">
                                <button @click="$refs.logoInput.click()" class="bg-zinc-700 hover:bg-zinc-600 px-3 rounded text-lg border border-zinc-600" title="Upload Image">📂</button>
                                <input type="file" ref="logoInput" @change="handleLogoUpload" class="hidden" accept="image/*">
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-4 mb-8">
                        <button @click="$emit('generate-report')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded font-bold shadow-lg transition-all flex items-center gap-2"><span>📄</span> Generate PDF</button>
                        <button @click="$emit('generate-xls')" class="bg-zinc-700 hover:bg-zinc-600 text-white px-6 py-3 rounded font-bold shadow-lg transition-all flex items-center gap-2"><span>📊</span> Export Excel (XLS)</button>
                        <button @click="$emit('save-project')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded font-bold shadow-lg transition-all flex items-center gap-2"><span>💾</span> Save Full Project</button>
                    </div>

                    <div v-if="bomRows.length" class="mb-8">
                        <h3 class="text-sm font-bold text-zinc-400 mb-4 uppercase">Bill of Materials</h3>
                        <div class="overflow-x-auto border border-zinc-700 rounded">
                            <table class="w-full text-sm">
                                <thead class="bg-zinc-700 text-[10px] font-bold text-zinc-300 uppercase">
                                    <tr><th class="px-4 py-2 text-left">Type</th><th class="px-4 py-2 text-left">Brand</th><th class="px-4 py-2 text-left">Model</th><th class="px-4 py-2 text-right">Quantity</th></tr>
                                </thead>
                                <tbody class="divide-y divide-zinc-700 bg-zinc-800">
                                    <tr v-for="item in bomRows" :key="item.type + item.model">
                                        <td class="px-4 py-2 text-zinc-400 text-xs">{{ item.type }}</td>
                                        <td class="px-4 py-2 text-white">{{ item.brand }}</td>
                                        <td class="px-4 py-2 text-zinc-300">{{ item.model }}</td>
                                        <td class="px-4 py-2 text-right font-mono">{{ item.qty.toFixed(item.unit==='m'?1:0) }} {{ item.unit }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div v-if="flatNodes.length" class="mb-8">
                        <h3 class="text-sm font-bold text-zinc-400 mb-4 uppercase">Calculations</h3>
                        <div class="overflow-x-auto border border-zinc-700 rounded">
                            <table class="w-full text-sm">
                                <thead class="bg-zinc-700 text-[10px] font-bold text-zinc-300 uppercase">
                                    <tr><th class="px-4 py-2 text-left">ID</th><th class="px-4 py-2 text-left">Amplifier</th><th class="px-4 py-2 text-left">Speaker</th><th class="px-4 py-2 text-left">Cable</th><th class="px-4 py-2 text-left">Load</th><th class="px-4 py-2 text-left">V-Drop</th><th class="px-4 py-2 text-left text-blue-400">HF Loss</th><th class="px-4 py-2 text-left text-amber-400">Elec. Loss</th><th class="px-4 py-2 text-left">Headroom</th><th class="px-4 py-2 text-left">Status</th></tr>
                                </thead>
                                <tbody class="divide-y divide-zinc-700 bg-zinc-800">
                                    <tr v-for="n in flatNodes" :key="n.id">
                                        <td class="px-4 py-2 font-mono text-xs">{{n.id}}</td>
                                        <td class="px-4 py-2 text-zinc-400 text-xs">{{ getAmpLabel(n) }}</td>
                                        <td class="px-4 py-2 text-white text-xs">{{ getSpkLabel(n) }}</td>
                                        <td class="px-4 py-2 text-zinc-400 text-xs">{{ getCableLabel(n.cableId) }} ({{n.length}}m)</td>
                                        <td class="px-4 py-2 font-mono">{{n.results?.minLoad?.toFixed(2) || n.results?.totalPower}} {{state.mode==='low-z'?'Ω':'W'}}</td>
                                        <td class="px-4 py-2 font-mono">{{n.results?.dropPercent?.toFixed(2)}}%</td>
                                        <td class="px-4 py-2 font-mono text-blue-300">{{n.results?.hfLossDb?.toFixed(2)}} dB</td>
                                        <td class="px-4 py-2 font-mono text-amber-300">{{n.results?.elecLossDb?.toFixed(2)}} dB</td>
                                        <td class="px-4 py-2 font-mono">{{ n.results?.headroomPct > 0 ? n.results.headroomPct.toFixed(0) + '%' : '-' }}</td>
                                        <td class="px-4 py-2"><span :class="['px-2 py-0.5 text-[10px] rounded border', getStatusClass(n.results?.status)]">{{n.results?.status}}</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `,
        inject: ['state'],
        computed: { 
            flatNodes() { 
                const all = []; 
                let count = 1;

                const scan = (nodes) => nodes.forEach(n => { 
                    n.reportId = `S-${count++}`; // Assign S-1, S-2 ID
                    all.push(n); 
                    if(n.children) scan(n.children); 
                }); 
                
                scan(this.state.lowZRoots); 
                scan(this.state.highVRoots);
                return all; 
            },
            bomRows() {
                const state = this.state; const db = state.database; const bomMap = {};
                const add = (type, brand, model, qty, unit) => { if (!brand || !model) return; const key = `${type}_${brand}_${model}`; if (!bomMap[key]) bomMap[key] = { type, brand, model, qty: 0, unit }; bomMap[key].qty += qty; };
                Object.values(state.ampRack).forEach(i => { const m = db.amplifiers[i.modelId]; if (m) add('Amplifier', m.brand, m.model, 1, 'pcs'); });
                const scan = (nodes) => { nodes.forEach(n => { const s = db.speakers[n.speakerId]; if (s) add('Speaker', s.brand, s.model, state.mode === 'low-z' ? (n.parallelCount || 1) : 1, 'pcs'); const c = db.cables[n.cableId]; if (c) add('Cable', c.brand, c.model, n.length || 0, 'm'); if (n.useCable2 && n.cable2Id) { const c2 = db.cables[n.cable2Id]; if (c2) add('Cable', c2.brand, c2.model, n.length2 || 0, 'm'); } if (n.children) scan(n.children); }); };
                scan(state.lowZRoots); scan(state.highVRoots);
                return Object.values(bomMap).sort((a, b) => a.type.localeCompare(b.type));
            }
        },
        methods: {
            handleLogoUpload(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    this.state.reportInfo.logoUrl = evt.target.result; // Saves as Base64 Data URL
                };
                reader.readAsDataURL(file);
            },
            getAmpLabel(n) { 
                if (!n.ampInstanceId) return n.parentId ? '->' : '-';
                const rack = this.state.ampRack[n.ampInstanceId];
                const m = this.state.database.amplifiers[rack?.modelId];
                return `${n.ampInstanceId} | ${m?m.brand+' '+m.model:'?'} | Ch${n.ampChannel}`;
            },
            getSpkLabel(n) { 
                const s = this.state.database.speakers[n.speakerId]; 
                // Display: S-1 | Brand Model
                return s ? `${n.reportId} | ${s.brand} ${s.model}` : `${n.reportId} | ${n.speakerId}`; 
            },
            getCableLabel(id) { const c = this.state.database.cables[id]; return c ? `${c.brand} ${c.model}` : id; },
            getStatusClass(s) { if(s==='Error') return 'border-red-500 text-red-500 bg-red-500/10'; if(s==='Warning') return 'border-amber-500 text-amber-500 bg-amber-500/10'; return 'border-emerald-500 text-emerald-500 bg-emerald-500/10'; }
        }
    };

    // ==============================
    // 4. USER MANUAL
    // ==============================
    window.App.UI.UserManual = {
        template: `
            <div class="flex flex-col gap-6 h-full overflow-y-auto animate-in p-6 max-w-6xl mx-auto text-zinc-300 leading-relaxed">
                <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-8 shadow-xl">
                    <h1 class="text-3xl font-bold text-white mb-2">User Manual v3.0</h1>
                    <p class="text-zinc-400 mb-10 text-lg border-b border-zinc-700 pb-6">A complete guide to designing high-performance distributed and direct-drive audio systems.</p>
                    <div class="space-y-16">
                        <section><h2 class="text-2xl font-bold text-emerald-400 mb-6 flex items-center gap-3"><span class="bg-emerald-900/30 border border-emerald-800 rounded-full w-8 h-8 flex items-center justify-center text-sm">1</span> Project Setup & Standards</h2><div class="grid grid-cols-1 lg:grid-cols-2 gap-8"><div><h3 class="font-bold text-white text-lg mb-3">Global Settings (Top Bar)</h3><ul class="space-y-3 text-sm"><li class="bg-zinc-900 p-3 rounded border border-zinc-700"><strong class="text-white block mb-1">Temperature (°C)</strong> The #1 cause of system failure in ceilings. Copper resistance rises by 0.4% per degree. <span class="text-amber-400">Always set this to the max operating temp (e.g., 40°C).</span></li><li class="bg-zinc-900 p-3 rounded border border-zinc-700"><strong class="text-white block mb-1">System Mode</strong> Toggle between <code class="text-emerald-300">Low-Z</code> (4/8Ω Performance Audio) and <code class="text-blue-300">100V</code> (Distributed Paging/BGM).</li></ul></div><div><h3 class="font-bold text-white text-lg mb-3">Quality Standards</h3><table class="w-full text-xs text-left border-collapse"><thead><tr class="border-b border-zinc-600 text-zinc-500"><th class="py-2">Profile</th><th>Max Drop</th><th>HF Check</th></tr></thead><tbody class="divide-y divide-zinc-700/50"><tr><td class="py-2 font-bold text-emerald-400">High-End</td><td>5%</td><td>10 kHz</td></tr><tr><td class="py-2 font-bold text-amber-400">BGM</td><td>10%</td><td>6 kHz</td></tr><tr><td class="py-2 font-bold text-blue-400">Speech</td><td>15%</td><td>4 kHz</td></tr></tbody></table></div></div></section>
                        <section><h2 class="text-2xl font-bold text-emerald-400 mb-6 flex items-center gap-3"><span class="bg-emerald-900/30 border border-emerald-800 rounded-full w-8 h-8 flex items-center justify-center text-sm">2</span> Building the Signal Chain</h2><div class="space-y-8"><div class="flex gap-6"><div class="w-12 flex-shrink-0 flex flex-col items-center pt-2"><div class="w-1 h-full bg-zinc-700/50 rounded"></div></div><div class="flex-1"><h3 class="font-bold text-white text-lg mb-2">A. Amplifier Rack & Channels</h3><p class="text-sm text-zinc-400 mb-3">The tool simulates a physical rack. You create an "Instance" of an amplifier (e.g., <code>A-1</code>), then wire its channels.</p><div class="bg-zinc-900 p-4 rounded border border-zinc-700 text-sm space-y-2"><p>1. Click <strong>+ Add New Line</strong>.</p><p>2. In the Amp dropdown, select <strong>+ Add New Amp...</strong>.</p><p>3. A modal opens. Search your database and select a model (e.g., "Powersoft"). This creates Amp <code>A-1</code>.</p><p>4. Select a <strong>Channel</strong>. If you use Channel 1 on another line, it will be marked as <code>(Used)</code>.</p><p>5. <strong>Bridge Mode (BTL):</strong> Checking this doubles the available power and minimum impedance thresholds.</p></div></div></div><div class="flex gap-6"><div class="w-12 flex-shrink-0 flex flex-col items-center text-zinc-600 font-bold text-xl">filter_alt</div><div class="flex-1"><h3 class="font-bold text-white text-lg mb-2">B. Brand Filters</h3><p class="text-sm text-zinc-400">Above every dropdown (Speaker, Cable, Amp), there is a small <strong>Brand Filter</strong>. Use this to quickly isolate specific manufacturers.</p></div></div><div class="flex gap-6"><div class="w-12 flex-shrink-0 flex flex-col items-center"><div class="w-8 h-8 bg-zinc-700 rounded flex items-center justify-center text-white">↓</div></div><div class="flex-1"><h3 class="font-bold text-white text-lg mb-2">C. Daisy Chaining (Tap Lines)</h3><p class="text-sm text-zinc-400 mb-3">To simulate speakers connected in series/parallel on the same line:</p><ul class="list-disc list-inside text-sm text-zinc-300 space-y-1"><li>Click the <strong>Down Arrow (↓)</strong> button on a row.</li><li>This creates a <strong>Child Node</strong>.</li><li>The child node receives the voltage <em>after</em> the parent's cable loss.</li></ul></div></div></div></section>
                        <section><h2 class="text-2xl font-bold text-emerald-400 mb-6 flex items-center gap-3"><span class="bg-emerald-900/30 border border-emerald-800 rounded-full w-8 h-8 flex items-center justify-center text-sm">3</span> Advanced Tools</h2><div class="bg-zinc-900 border border-zinc-700 rounded p-6 flex gap-6 items-start"><div class="text-4xl">🪄</div><div><h3 class="font-bold text-white text-lg mb-2">The Cable Wizard</h3><p class="text-sm text-zinc-400 mb-4">Don't guess the cable gauge. The Wizard runs a brute-force simulation using your entire database.</p><div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-zinc-300"><div class="bg-zinc-800 p-3 rounded"><strong class="block text-emerald-400 mb-1">1. Simulation</strong> It calculates impedance vectors for every cable in your library at the specified length and temperature.</div><div class="bg-zinc-800 p-3 rounded"><strong class="block text-emerald-400 mb-1">2. Sorting</strong> It filters out cables that fail your Standard (e.g. >5% drop) and ranks the rest by performance.</div></div></div></div></section>
                        <section><h2 class="text-2xl font-bold text-emerald-400 mb-6 flex items-center gap-3"><span class="bg-emerald-900/30 border border-emerald-800 rounded-full w-8 h-8 flex items-center justify-center text-sm">4</span> Reports & Database</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-8"><div><h3 class="font-bold text-white mb-3">Reports Tab</h3><ul class="space-y-3 text-sm text-zinc-400"><li class="flex gap-3"><span class="text-white">📄 PDF:</span> Generates a client-ready document. Supports custom Logo URL. Includes HF Loss analysis.</li><li class="flex gap-3"><span class="text-white">📊 Excel:</span> Exports raw data (Design + Bill of Materials) for costing/purchasing.</li></ul></div><div><h3 class="font-bold text-white mb-3">Saving Projects</h3><div class="bg-indigo-900/20 border border-indigo-800 p-3 rounded text-xs text-indigo-200"><strong>Smart Bundle:</strong> When saving a project (.json), choose <em>"Include Database"</em>. This saves your custom speakers/amps inside the file. When you send it to a colleague, they can merge your products into their library automatically.</div></div></div></section>
                    </div>
                </div>
            </div>
        `
    };

    // ==============================
    // 5. TECH REFERENCE (Scientific Deep Dive)
    // ==============================
    window.App.UI.TechReference = {
        template: `
            <div class="flex flex-col gap-6 h-full overflow-y-auto animate-in p-6 max-w-6xl mx-auto">
                <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-10 shadow-xl">
                    <header class="mb-10 border-b border-zinc-700 pb-6">
                        <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Scientific Reference</h1>
                        <p class="text-zinc-400 text-lg">A deep dive into the physics engine and mathematical models used in this application.</p>
                    </header>

                    <div class="space-y-16 text-zinc-300 leading-relaxed">
                        
                        <section>
                            <h2 class="text-2xl font-bold text-emerald-400 mb-6">1. The Audio Transmission Model</h2>
                            <p class="mb-4">This application does not treat cables as simple resistors. Instead, it models the transmission line as a complex <strong>LCR filter network</strong>. The impedance of the cable ($Z_{cable}$) is calculated as a vector sum of its resistive and reactive components at a specific frequency.</p>
                            
                            <div class="bg-zinc-900 p-6 rounded-lg border border-zinc-700 font-mono text-sm text-emerald-300 mb-6 overflow-x-auto">
                                <div class="mb-2 text-zinc-500">// Complex Impedance Formula</div>
                                Z_{cable} = R_{thermal} + j \cdot (2\pi \cdot f \cdot L)
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h3 class="font-bold text-white mb-2">Resistive Component ($R$)</h3>
                                    <p class="text-sm text-zinc-400">The DC resistance of the copper conductor. This is the primary factor in broad-band <strong>Voltage Drop</strong> (Power Loss). It is highly temperature-dependent.</p>
                                </div>
                                <div>
                                    <h3 class="font-bold text-white mb-2">Reactive Component ($X_L$)</h3>
                                    <p class="text-sm text-zinc-400">The Inductive Reactance caused by the magnetic field generated by current flow. $X_L$ increases with frequency, causing <strong>High-Frequency Roll-off</strong> (Loss of Clarity).</p>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 class="text-2xl font-bold text-amber-400 mb-6">2. Thermal Thermodynamics</h2>
                            <p class="mb-4">Resistance values in datasheets are typically rated at <strong>20°C</strong>. However, ceiling voids and conduits often reach 40°C - 60°C. Copper has a positive temperature coefficient, meaning its resistance increases as it heats up.</p>
                            <p class="mb-4 text-sm">The application automatically applies <strong>Linear Thermal Derating</strong> to all calculations:</p>

                            <div class="bg-zinc-900 p-6 rounded-lg border border-zinc-700 font-mono text-sm text-amber-300 mb-6 overflow-x-auto">
                                R_{hot} = R_{ref} \cdot [1 + \alpha \cdot (T_{amb} - 20)]
                            </div>

                            <ul class="list-disc list-inside text-sm text-zinc-400 space-y-2 bg-zinc-900/50 p-4 rounded">
                                <li><strong>$\alpha$ (Alpha):</strong> Temperature coefficient of Copper ($\approx 0.00393$ per °C).</li>
                                <li><strong>Impact:</strong> A 40°C rise in temperature increases cable resistance by approx <strong>15.7%</strong>.</li>
                                <li>This can push a "Pass" result into a "Fail" (Critical Voltage Drop) in hot environments.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 class="text-2xl font-bold text-blue-400 mb-6">3. Voltage Drop & Decibel Loss</h2>
                            <p class="mb-4">The system calculates the voltage reaching the load ($V_{load}$) using a complex voltage divider network between the Source Impedance, Cable Impedance, and Load Impedance.</p>

                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                <div class="bg-zinc-900 p-5 rounded border border-zinc-700">
                                    <h4 class="text-xs font-bold text-zinc-500 uppercase mb-2">Voltage at Load</h4>
                                    <div class="font-mono text-blue-300 text-sm">V_{load} = V_{source} \cdot \frac{|Z_{load}|}{|Z_{source} + Z_{cable} + Z_{load}|}</div>
                                </div>
                                <div class="bg-zinc-900 p-5 rounded border border-zinc-700">
                                    <h4 class="text-xs font-bold text-zinc-500 uppercase mb-2">SPL Loss (dB)</h4>
                                    <div class="font-mono text-blue-300 text-sm">L_{dB} = 20 \cdot \log_{10} \left( \frac{V_{load}}{V_{source}} \right)</div>
                                </div>
                            </div>

                            <p class="text-sm text-zinc-400"><strong>Note:</strong> We use $20 \log$ (Voltage) rather than $10 \log$ (Power) because Sound Pressure Level (SPL) is proportional to voltage amplitude.</p>
                        </section>

                        <section>
                            <h2 class="text-2xl font-bold text-indigo-400 mb-6">4. Distributed Audio (100V / 70V)</h2>
                            <p class="mb-4">In "High-Z" mode, the application treats speakers as power taps rather than impedance loads. The physics engine converts these wattage ratings back into equivalent impedance to perform Ohm's Law calculations.</p>

                            <div class="bg-zinc-900 p-6 rounded-lg border border-zinc-700 font-mono text-sm text-indigo-300 mb-6 overflow-x-auto">
                                Z_{tap} = \frac{V_{line}^2}{P_{tap}}
                            </div>

                            <div class="bg-zinc-900/50 p-4 rounded border border-zinc-700/50 text-sm">
                                <p class="mb-2"><strong>Example:</strong> A 60W tap on a 100V line:</p>
                                <p class="font-mono text-zinc-300">Z = 100² / 60 = 10,000 / 60 = <strong>166.6 Ω</strong></p>
                                <p class="mt-2 text-zinc-400">This extremely high impedance explains why 100V systems have very low current ($I = V/Z$), allowing for thinner cables over longer distances with minimal $I^2R$ losses.</p>
                            </div>
                        </section>

                        <section>
                            <h2 class="text-2xl font-bold text-rose-400 mb-6">5. Damping Factor</h2>
                            <p class="mb-4">Damping Factor represents the amplifier's ability to control the motion of the speaker cone (specifically, braking the back-EMF). High cable resistance destroys the system's effective damping factor.</p>

                            <div class="bg-zinc-900 p-6 rounded-lg border border-zinc-700 font-mono text-sm text-rose-300 mb-6 overflow-x-auto">
                                DF_{system} = \frac{Z_{load}}{Z_{out} + R_{cable}}
                            </div>

                            <table class="w-full text-sm text-left text-zinc-300 bg-zinc-900 rounded overflow-hidden">
                                <thead class="text-xs text-zinc-500 uppercase bg-zinc-950">
                                    <tr><th class="px-4 py-2">DF Value</th><th class="px-4 py-2">Audible Effect</th></tr>
                                </thead>
                                <tbody class="divide-y divide-zinc-700">
                                    <tr><td class="px-4 py-2 font-bold text-emerald-400">> 20</td><td class="px-4 py-2">Tight, controlled bass.</td></tr>
                                    <tr><td class="px-4 py-2 font-bold text-amber-400">10 - 20</td><td class="px-4 py-2">Noticeable loosening of low frequencies.</td></tr>
                                    <tr><td class="px-4 py-2 font-bold text-rose-400">< 10</td><td class="px-4 py-2">"Muddy" or "boomy" bass response.</td></tr>
                                </tbody>
                            </table>
                        </section>

                    </div>
                </div>
            </div>
        `
    };

    console.log("App.UI Views Loaded (v3.0)");
})();