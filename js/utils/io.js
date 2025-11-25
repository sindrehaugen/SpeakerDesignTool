/**
 * Speaker Design Tool v3.0 - IO & Math Utils
 * Status: Production Ready
 */

(function () {
    window.App.Utils.IO = {
        awgToMm2(awgInput) {
            let awg = awgInput;
            if (typeof awg === 'string') {
                const match = awg.match(/(\d+)/);
                if (match) awg = parseFloat(match[0]);
            }
            if (!awg || isNaN(awg)) return 0;
            const d = 0.127 * Math.pow(92, (36 - awg) / 39);
            return (Math.PI * Math.pow(d / 2, 2));
        },

        generateId(brand, model) {
            const clean = (str) => (str || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const b = clean(brand).substring(0, 3);
            const m = clean(model);
            if (!b && !m) return `DEV-${Math.floor(Math.random() * 100000)}`;
            return `${b}-${m}`;
        },

        downloadFile(filename, content, mimeType) {
            const link = document.createElement("a");
            const blob = new Blob([content], { type: mimeType });
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
        },

        downloadCSV(filename, rows) {
            const csvContent = rows.map(e => e.join(",")).join("\n");
            this.downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
        },

        exportToXLS(projectInfo, sheets) {
            let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
            xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">';
            xml += '<Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Borders/><Font ss:FontName="Arial" x:Family="Swiss" ss:Size="10"/><Interior/><NumberFormat/><Protection/></Style>';
            xml += '<Style ss:ID="BoldHeader"><Font ss:FontName="Arial" x:Family="Swiss" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/></Style></Styles>';

            for (const [sheetName, rows] of Object.entries(sheets)) {
                xml += `<Worksheet ss:Name="${sheetName}"><Table>`;
                rows.forEach((row, rowIndex) => {
                    xml += '<Row>';
                    row.forEach(cell => {
                        const style = rowIndex === 0 ? 'ss:StyleID="BoldHeader"' : '';
                        const type = typeof cell === 'number' ? 'Number' : 'String';
                        let data = String(cell || '');
                        data = data.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        xml += `<Cell ${style}><Data ss:Type="${type}">${data}</Data></Cell>`;
                    });
                    xml += '</Row>';
                });
                xml += '</Table></Worksheet>';
            }
            xml += '</Workbook>';
            this.downloadFile(`${projectInfo.name.replace(/[^a-z0-9]/gi, '_')}.xls`, xml, 'application/vnd.ms-excel');
        },

        exportProjectJSON(state, includeDb = false) {
            const data = {
                version: '3.0',
                info: state.projectInfo,
                settings: state.settings,
                mode: state.mode,
                ampRack: state.ampRack,
                lowZ: state.lowZRoots,
                highV: state.highVRoots
            };

            if (includeDb) {
                data.database = state.database; 
            }

            this.downloadFile(`${state.projectInfo.name}.json`, JSON.stringify(data, null, 2), 'application/json');
        },

        parseCSV(text) {
            const lines = text.split(/\r\n|\n/);
            if (lines.length < 2) return [];
            const parseLine = (line) => {
                const res = []; let cur = ''; let inQ = false;
                for (let i = 0; i < line.length; i++) {
                    const c = line[i];
                    if (c === '"') inQ = !inQ;
                    else if (c === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
                    else cur += c;
                }
                res.push(cur.trim()); return res;
            };
            const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').toLowerCase().trim());
            const result = [];
            const typeKeywords = ['lo-z', '100v', 'both', 'active', 'passive'];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const vals = parseLine(line).map(v => v.replace(/^"|"$/g, '').trim());
                const obj = {};
                let shiftOffset = 0;
                if (headers.includes('type')) {
                    const foundTypeIdx = vals.findLastIndex(v => typeKeywords.includes(v.toLowerCase()));
                    const expectedTypeIdx = headers.indexOf('type');
                    if (foundTypeIdx > -1 && expectedTypeIdx > -1) shiftOffset = foundTypeIdx - expectedTypeIdx;
                }
                headers.forEach((h, targetIdx) => {
                    let valIndex = targetIdx;
                    if (shiftOffset !== 0 && targetIdx > headers.indexOf('taps')) valIndex += shiftOffset;
                    if (vals[valIndex] !== undefined) {
                        let val = vals[valIndex];
                        if (h === 'taps') {
                            if (shiftOffset > 0) val = vals.slice(targetIdx, targetIdx + shiftOffset + 1).join(',');
                            obj[h] = val.split(',').map(n => parseFloat(n)).filter(n => !isNaN(n));
                        } else if (!['brand', 'model', 'id', 'type', 'category', 'name'].includes(h)) {
                            if (val && !isNaN(parseFloat(val))) obj[h] = parseFloat(val);
                        } else obj[h] = val;
                    }
                });
                if (!obj.brand) obj.brand = 'Generic';
                if (!obj.model) obj.model = obj.name || `Item ${i}`;
                if (!obj.id) obj.id = this.generateId(obj.brand, obj.model);
                if (Object.keys(obj).length > 1) result.push(obj);
            }
            return result;
        }
    };
    console.log("App.Utils.IO Loaded (v3.0)");
})();