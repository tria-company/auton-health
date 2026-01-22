const fs = require('fs');
const path = require('path');

// Lista de arquivos para migrar
const filesToMigrate = [
  'apps/frontend/src/app/consultas/page.tsx',
  'apps/frontend/src/app/agenda/page.tsx',
  'apps/frontend/src/components/dashboard/ActiveConsultationBanner.tsx',
  'apps/frontend/src/app/(consulta)/consulta/presencial/page.tsx',
  'apps/frontend/src/app/anamnese-inicial/page.tsx',
  'apps/frontend/src/app/pacientes/cadastro/page.tsx',
  'apps/frontend/src/app/administracao/page.tsx',
  'apps/frontend/src/components/ExamesUploadSection.tsx',
  'apps/frontend/src/components/consultas/ConsultaModal.tsx'
];

// Mapea substituições de rotas
const routeReplacements = {
  '/api/anamnese': '/anamnese',
  '/api/diagnostico': '/diagnostico',
  '/api/solucao-mentalidade': '/solucao-mentalidade',
  '/api/solucao-suplementacao': '/solucao-suplementacao',
  '/api/alimentacao': '/alimentacao',
  '/api/atividade-fisica': '/atividade-fisica',
  '/api/lista-exercicios-fisicos': '/lista-exercicios-fisicos',
  '/api/consultations': '/consultations',
  '/api/patients': '/patients',
  '/api/cadastro-anamnese': '/cadastro-anamnese',
  '/api/agenda': '/agenda',
  '/api/admin': '/admin',
  '/api/exames': '/exames',
  '/api/processar-exames': '/processar-exames',
  '/api/anamnese-inicial': '/anamnese-inicial'
};

function migrateFetchToGateway(filePath) {
  console.log(`\n📝 Migrando: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;

  // Adicionar import do gatewayClient se não existir
  if (!content.includes('gatewayClient')) {
    const importRegex = /^import.*from ['"]react['"];?\s*$/m;
    const match = content.match(importRegex);
    if (match) {
      content = content.replace(
        match[0],
        match[0] + "\nimport { gatewayClient } from '@/lib/gatewayClient';"
      );
      changes++;
      console.log('  ✅ Adicionado import do gatewayClient');
    }
  }

  // Substituir fetch por gatewayClient
  // Padrão: fetch(`/api/...`, { method: 'GET', ... })
  const fetchPattern = /const\s+response\s+=\s+await\s+fetch\(`(\/api\/[^`]+)`(?:,\s*\{([^}]+)\})?\);/g;
  
  content = content.replace(fetchPattern, (match, url, options) => {
    // Substituir rota /api por rota do gateway
    let newUrl = url;
    for (const [oldRoute, newRoute] of Object.entries(routeReplacements)) {
      if (url.includes(oldRoute)) {
        newUrl = url.replace(oldRoute, newRoute);
        break;
      }
    }

    // Detectar método HTTP
    let method = 'get';
    if (options) {
      if (options.includes("method: 'POST'") || options.includes('method: "POST"')) {
        method = 'post';
      } else if (options.includes("method: 'PUT'") || options.includes('method: "PUT"')) {
        method = 'put';
      } else if (options.includes("method: 'DELETE'") || options.includes('method: "DELETE"')) {
        method = 'delete';
      } else if (options.includes("method: 'PATCH'") || options.includes('method: "PATCH"')) {
        method = 'patch';
      }
    }

    changes++;
    return `const response = await gatewayClient.${method}(\`${newUrl}\`);`;
  });

  // Padrão mais simples: fetch(`/api/...`)
  const simpleFetchPattern = /await\s+fetch\(`(\/api\/[^`]+)`\)/g;
  content = content.replace(simpleFetchPattern, (match, url) => {
    let newUrl = url;
    for (const [oldRoute, newRoute] of Object.entries(routeReplacements)) {
      if (url.includes(oldRoute)) {
        newUrl = url.replace(oldRoute, newRoute);
        break;
      }
    }
    changes++;
    return `await gatewayClient.get(\`${newUrl}\`)`;
  });

  // Remover checks de response.ok
  content = content.replace(/if\s+\(!response\.ok\)\s*\{[^}]*throw new Error\([^)]+\);?\s*\}/g, (match) => {
    changes++;
    return 'if (!response.success) { throw new Error(response.error || "Erro na requisição"); }';
  });

  // Substituir response.json() por acesso direto
  content = content.replace(/const\s+(\w+)\s*[:=]\s*await\s+response\.json\(\);?/g, (match, varName) => {
    changes++;
    return `const ${varName} = response;`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✅ ${changes} alterações aplicadas`);
  return changes;
}

// Processar todos os arquivos
let totalChanges = 0;
for (const file of filesToMigrate) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    totalChanges += migrateFetchToGateway(fullPath);
  } else {
    console.log(`  ⚠️  Arquivo não encontrado: ${file}`);
  }
}

console.log(`\n✅ Migração completa! Total de alterações: ${totalChanges}`);
