const fs = require('fs');

const fixFile = (file) => {
  let content = fs.readFileSync(file, 'utf8');

  // Fix React import
  if (!content.includes('import React')) {
    content = "import React, { useState, useEffect } from 'react';\n" + content;
  }
  
  // Replace React.useEffect with useEffect
  content = content.replace(/React\.useEffect/g, 'useEffect');

  // Fix missing UI imports
  if (file.includes('Invoices') || file.includes('Orders') || file.includes('Clients') || file.includes('Products')) {
    if (!content.includes('Label')) {
      content = content.replace("import { Button }", "import { Button }\nimport { Label } from '../components/ui/label';");
    }
    if (!content.includes('Input')) {
      content = content.replace("import { Button }", "import { Button }\nimport { Input } from '../components/ui/input';");
    }
  }

  // Hoist states
  const compMatch = content.match(/export default function [A-Za-z]+\(\) \{\n/);
  if (compMatch) {
    const states = content.match(/const \[startDate, setStartDate\][\s\S]*?useState\(1\);/);
    if (states) {
      content = content.replace(states[0], '');
      content = content.replace(compMatch[0], compMatch[0] + states[0] + '\n');
    }
    
    // Also hoist clientsList if it exists and was inserted badly
    const clientsListMatch = content.match(/const \{ data: clientsList \} = useQuery\(\{\s*queryKey: \['adminClientsList'\][\s\S]*?\}\);/);
    if (clientsListMatch) {
      content = content.replace(clientsListMatch[0], '');
      content = content.replace(compMatch[0], compMatch[0] + clientsListMatch[0] + '\n');
    }
  }

  // Fix the map logic for clients
  if (content.includes("typeof clients !== 'undefined'")) {
    content = content.replace(/\{\(\(typeof clients !== 'undefined' \? \(clients\?\.items \|\| clients\) : \(typeof clientsList !== 'undefined' \? \(clientsList\?\.items \|\| clientsList\) : \[\]\)\) \|\| \[\]\)\.map/g,
      '{(((typeof clients !== "undefined" ? clients : null)?.items || (typeof clients !== "undefined" ? clients : null) || (typeof clientsList !== "undefined" ? clientsList : null)?.items || (typeof clientsList !== "undefined" ? clientsList : null)) || []).map'
    );
  }

  // Fix implicit any on e parameter
  content = content.replace(/onChange=\{e =>/g, 'onChange={(e: any) =>');
  
  fs.writeFileSync(file, content);
};

['src/pages/Incidents.tsx', 'src/pages/Orders.tsx', 'src/pages/Quotes.tsx', 'src/pages/Invoices.tsx', 'src/pages/Clients.tsx', 'src/pages/Products.tsx'].forEach(fixFile);
