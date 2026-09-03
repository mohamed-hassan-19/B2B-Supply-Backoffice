const fs = require('fs');

const updateFrontendPage = (file, entityName, hasClientFilter, existingFilters = []) => {
  let code = fs.readFileSync(file, 'utf8');
  
  // 1. Add states
  const stateRegex = /const \[.*?\] = useState.*?;/g;
  const states = code.match(stateRegex);
  const lastState = states ? states[states.length - 1] : null;
  
  const newStates = `
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  ${hasClientFilter ? "const [clientFilter, setClientFilter] = useState('');" : ""}
  const [page, setPage] = useState(1);
  `;
  
  if (lastState && !code.includes('setStartDate')) {
    code = code.replace(lastState, lastState + newStates);
  } else if (!code.includes('setStartDate')) {
    code = code.replace('const queryClient = useQueryClient();', 'const queryClient = useQueryClient();' + newStates);
  }

  // Add client query if needed and missing
  if (hasClientFilter && !code.includes('adminClientsList')) {
    code = code.replace('const { role } = useAuth();', `const { role } = useAuth();
  const { data: clientsList } = useQuery({ queryKey: ['adminClientsList'], queryFn: async () => (await api.get('/api/admin/clients')).data.items || (await api.get('/api/admin/clients')).data });`);
  } else if (hasClientFilter) {
    // If it already fetches clients, we can just use them, but let's make sure it handles { items } format correctly
    // It might be `clients?.map` or `clients?.items?.map`. 
  }

  // 2. Update queryKey and queryFn
  const queryMatch = code.match(/useQuery\(\{\s*queryKey:\s*\[.*?\][^}]*\}\)/s) || code.match(/useQuery\(\{[\s\S]*?\}\);/);
  if (queryMatch) {
    let qCode = queryMatch[0];
    
    // Replace queryKey array
    const keyArrayStr = `['admin${entityName}', ${existingFilters.map(f => f).join(', ')}${existingFilters.length ? ', ' : ''}startDate, endDate, ${hasClientFilter ? 'clientFilter, ' : ''}page]`;
    qCode = qCode.replace(/queryKey:\s*\[.*?\],/, `queryKey: ${keyArrayStr},`);

    // Rewrite queryFn
    const urlLine = `let url = \`/api/admin/${entityName.toLowerCase()}?page=\${page}&\`;
      if (startDate) url += \`start_date=\${startDate}&\`;
      if (endDate) url += \`end_date=\${endDate}&\`;
      ${hasClientFilter ? `if (clientFilter) url += \`client_id=\${clientFilter}&\`;` : ''}
      ${existingFilters.map(f => `if (${f}) url += \`${f.replace('Filter', '')}=\${${f}}&\`;`).join('\n      ')}`;
      
    qCode = qCode.replace(/queryFn:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\}/, `queryFn: async () => {
      ${urlLine}
      const res = await api.get(url);
      return res.data;
    }`);

    code = code.replace(queryMatch[0], qCode);
  }

  // 3. Reset page on filter changes (useEffect)
  if (!code.includes('useEffect(() => { setPage(1); }')) {
    const deps = [
      'startDate', 'endDate',
      hasClientFilter ? 'clientFilter' : null,
      ...existingFilters
    ].filter(Boolean).join(', ');
    
    if (deps.length > 0) {
      const effect = `\n  React.useEffect(() => { setPage(1); }, [${deps}]);\n`;
      code = code.replace('return (', effect + '\n  return (');
    }
  }

  // 4. Update data rendering from `data` to `data?.items`
  const mapRegex = new RegExp(`${entityName.toLowerCase()}\\?\\.map`, 'g');
  code = code.replace(mapRegex, `${entityName.toLowerCase()}?.items?.map`);
  
  const lengthRegex = new RegExp(`${entityName.toLowerCase()}\\?\\.length`, 'g');
  code = code.replace(lengthRegex, `${entityName.toLowerCase()}?.items?.length`);
  
  const orArrayRegex = new RegExp(`\\(${entityName.toLowerCase()} \\|\\| \\[\\]\\)\\.map`, 'g');
  code = code.replace(orArrayRegex, `(${entityName.toLowerCase()}?.items || []).map`);

  // 5. Update Export to explicitly fetch
  const exportMatch = code.match(/const handleExport = \(\) => \{[\s\S]*?exportToExcel.*?;[\s\S]*?\};/);
  if (exportMatch) {
    let exportCode = exportMatch[0];
    const newExportCode = `const handleExport = async () => {
    let url = \`/api/admin/${entityName.toLowerCase()}?export=true&\`;
    if (startDate) url += \`start_date=\${startDate}&\`;
    if (endDate) url += \`end_date=\${endDate}&\`;
    ${hasClientFilter ? `if (clientFilter) url += \`client_id=\${clientFilter}&\`;` : ''}
    ${existingFilters.map(f => `if (${f}) url += \`${f.replace('Filter', '')}=\${${f}}&\`;`).join('\n    ')}
    
    const res = await api.get(url);
    const allData = res.data.items || res.data;
    
    const exportData = allData.map((item: any) => ({
      'ID': item.id,
      'Date': new Date(item.createdAt).toLocaleDateString()
      // Note: we can map the fields dynamically or just stringify what's there
    }));
    
    exportToExcel(exportData, '${entityName.toLowerCase()}');
  };`;
    // We don't want to completely overwrite their custom exportData mapping. Let's just patch the data fetching part.
    
    const exportInnerMap = exportCode.match(/const exportData = [\s\S]*?\}\)\);/);
    if (exportInnerMap) {
      let innerMap = exportInnerMap[0];
      innerMap = innerMap.replace(/\(.*\)\.map/, `(allData || []).map`);
      
      const fixedExport = `const handleExport = async () => {
    let url = \`/api/admin/${entityName.toLowerCase()}?export=true&\`;
    if (startDate) url += \`start_date=\${startDate}&\`;
    if (endDate) url += \`end_date=\${endDate}&\`;
    ${hasClientFilter ? `if (clientFilter) url += \`client_id=\${clientFilter}&\`;` : ''}
    ${existingFilters.map(f => `if (${f}) url += \`${f.replace('Filter', '')}=\${${f}}&\`;`).join('\n    ')}
    
    const res = await api.get(url);
    const allData = res.data.items || res.data;
    
    ${innerMap}
    exportToExcel(exportData, '${entityName.toLowerCase()}');
  };`;
      code = code.replace(exportMatch[0], fixedExport);
    }
  }

  // 6. Add Filter UI
  let filterUI = `
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-md border shadow-sm mb-4">
        <div className="space-y-1">
          <Label>Start Date</Label>
          <Input type="date" className="h-9" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>End Date</Label>
          <Input type="date" className="h-9" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        ${hasClientFilter ? `
        <div className="space-y-1">
          <Label>Client</Label>
          <select 
            className="flex h-9 w-48 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="">All Clients</option>
            {/* Some pages already fetch 'clients', some use 'clientsList' */}
            {((typeof clients !== 'undefined' ? (clients?.items || clients) : (typeof clientsList !== 'undefined' ? (clientsList?.items || clientsList) : [])) || []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>` : ''}
  `;
  
  if (code.includes('<div className="flex gap-4 items-center bg-white')) {
    // Inject into existing filter bar
    code = code.replace('<div className="flex gap-4 items-center bg-white p-4 rounded-md border shadow-sm">', `<div className="flex gap-4 items-center bg-white p-4 rounded-md border shadow-sm flex-wrap">\n${filterUI.replace(/<div className="flex flex-wrap.*?">/, '').replace('</div></div>', '')}`);
  } else {
    // Insert before Table
    code = code.replace('<div className="bg-white rounded-md border shadow-sm overflow-hidden">', `${filterUI}\n      </div>\n      <div className="bg-white rounded-md border shadow-sm overflow-hidden">`);
  }

  // 7. Add Pagination UI
  const pagUI = `
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing {${entityName.toLowerCase()}?.items?.length || 0} of {${entityName.toLowerCase()}?.total || 0}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={!${entityName.toLowerCase()}?.items || ${entityName.toLowerCase()}?.items.length < (${entityName.toLowerCase()}?.limit || 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
  `;
  code = code.replace('</Table>\n      </div>', `</Table>\n${pagUI}\n      </div>`);

  fs.writeFileSync(file, code);
  console.log('Updated ' + file);
};

updateFrontendPage('src/pages/Incidents.tsx', 'Incidents', true, ['statusFilter', 'typeFilter']);
updateFrontendPage('src/pages/Orders.tsx', 'Orders', true, []);
updateFrontendPage('src/pages/Quotes.tsx', 'Quotes', true, ['quoteTypeFilter']);
updateFrontendPage('src/pages/Invoices.tsx', 'Invoices', true, []);
updateFrontendPage('src/pages/Clients.tsx', 'Clients', false, []);
updateFrontendPage('src/pages/Products.tsx', 'Products', false, []);
