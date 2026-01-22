# Análise Completa do Dashboard.....

## 📍 Localização
- **URL**: `http://localhost:3000/dashboard`
- **Arquivo Principal**: `apps/frontend/src/app/(dashboard)/dashboard/page.tsx`
- **CSS**: `apps/frontend/src/app/(dashboard)/dashboard/dashboard.css`
- **API**: `apps/frontend/src/app/api/dashboard/route.ts`

---

## 🏗️ Estrutura do Componente Principal

### **Estados Principais**
```typescript
- dashboardData: DashboardData | null
- loading: boolean
- error: string | null
- medicoName: string
- selectedDate: Date
- selectedYear: number
- selectedPeriod: string ('7d', '15d', '30d')
- chartPeriodType: 'day' | 'week' | 'month' | 'year'
- chartSelectedDate: string
- chartSelectedMonth: string
- consultationDates: Date[]
```

### **Interface DashboardData**
```typescript
{
  medico: {
    id, name, specialty?, crm?, subscription_type
  },
  estatisticas: {
    totalPacientes, consultasHoje, consultasConcluidasMes,
    duracaoMediaSegundos, taxaSucesso
  },
  distribuicoes: {
    porStatus: Record<string, number>,
    porTipo: Record<string, number>
  },
  atividades: {
    ultimasConsultas: Array<Consulta>,
    proximasConsultas: Array<Consulta>
  },
  graficos: {
    consultasPorDia: Array<{date, total, presencial, telemedicina, concluidas}>
  }
}
```

---

## 🎨 Layout e Estrutura Visual

### **1. Banner de Consulta Ativa** (Topo)
- Componente: `ActiveConsultationBanner`
- Exibe consultas em andamento
- Polling a cada 10 segundos
- Ações: Retornar para consulta / Finalizar consulta

### **2. Saudação do Dashboard**
```tsx
<div className="dashboard-greeting-section">
  <h1 className="dashboard-title">
    {getGreeting()}, Dr {medicoName}
  </h1>
</div>
```
- Saudação dinâmica (Bom dia/Boa tarde/Boa noite)
- CSS: `.dashboard-title` (font-size: 28px, font-weight: 600)

### **3. Linha de KPIs** (`.kpi-row`)
Três cards lado a lado:
- **KPI Ciano** (`.kpi--cyan`): "Consultas Hoje"
  - Background: `/card-cyan.png`
- **KPI Âmbar** (`.kpi--amber`): "Total de Atendimentos"
  - Background: `/card-amber.png`
- **KPI Lilás** (`.kpi--lilac`): "Total de Paciente"
  - Background: `/card-lilac.png`

**CSS dos KPIs:**
- Padding: 20px
- Border-radius: 24px
- Min-height: 100px
- Box-shadow: 0 4px 16px rgba(0,0,0,0.06)
- Gap entre cards: 12px

### **4. Linha de Gráficos + Calendário** (`.data-row`)
Grid 2 colunas (2fr 1fr):

#### **4.1 Card do Gráfico** (`.chart-card.card-dark`)
- Título: "Atendimentos Presencial/Telemedicina"
- Filtros de período:
  - Select: Dia/Semana/Mês/Ano
  - Input date (quando dia/semana selecionado)
  - Input month (quando mês selecionado)
  - Select ano (quando ano selecionado)
- Componente: `Chart3D`
  - Props: `data.presencial`, `data.telemedicina`, `data.labels`
  - Legenda no topo (Presencial roxa / Telemedicina azul tracejada)

**CSS do Gráfico:**
- `.chart-content`: min-height: 280px
- `.chart-area`: min-height: 180px, max-height: 180px
- `.chart-3d-container`: height: 180px
- Legenda: gap: 32px, margin-bottom: 12px

#### **4.2 Card do Calendário** (`.calendar-card.card-dark`)
- Título: "Calendário"
- Botão: "Ver Agenda" (link para `/agenda`)
- Componente: `Calendar`
  - Props: `selectedDate`, `onDateSelect`, `highlightedDates`
  - Destaca datas com consultas

**CSS do Calendário:**
- `.calendar-content`: padding: 16px
- `.dashboard-calendar`: width: 100%
- Células: height: 32px

### **5. Linha Inferior** (`.bottom-row`)
Grid 2 colunas (1fr 2fr):

#### **5.1 Gráfico Semanal** (`.weekly-chart.card-dark`)
- Título: "Atendimentos na Semana"
- Componente: `BarChart3D`
  - Props: `data` (labels, values, colors)
  - Dados: Segunda a Sábado
  - Cores: ['#ff6b35', '#e91e63', '#ffc107', '#4caf50', '#f44336', '#9e9e9e']

**CSS do Gráfico de Barras:**
- `.bar-chart-weekly`: height: 240px
- `.bar-3d`: width: 28px, border-radius: 14px 14px 6px 6px
- Transform 3D: rotateX(15deg) rotateY(-10deg)
- Hover: rotateX(20deg) rotateY(-15deg) scale(1.05)

#### **5.2 Tabela de Consultas** (`.consultations-table.card-dark`)
- Título: "Consultas"
- Tabela com 4 colunas:
  1. Id (primeiros 8 caracteres)
  2. Paciente
  3. Data (formatada pt-BR)
  4. Status (StatusBadge com ícone)
- Exibe últimas 5 consultas

**CSS da Tabela:**
- `.table`: border-spacing: 0 8px
- `.table tbody tr`: border-radius: 16px, box-shadow: 0 4px 12px
- `.table tbody td`: padding: 12px 14px, font-size: 14px

### **6. Painel Lateral Direito** (`.right-panel`)
Largura fixa: 320px, gap: 16px

#### **6.1 ConsultationStatusChart**
- Gráfico de pizza (status das consultas)
- Métricas:
  - Consultas Concluídas
  - Total de Pacientes
- Filtro de período: 7d/15d/30d
- Estatísticas: Created, InProgress, Completed, Cancelled

#### **6.2 Card Unificado** (`.unified-card`)
**Seção de Duração:**
- Duração Média (formatada: Xh Xm)
  - Barra de progresso roxa (`.progress-purple`)
  - Baseado em 5400 segundos (90 min)
- Taxa de Finalização (X%)
  - Barra de progresso azul (`.progress-blue`)
  - Valor direto em percentual

**CSS do Card Unificado:**
- `.unified-card`: border-radius: 18px, padding: 20px
- `.duration-section`: padding: 16px 0 40px 0
- `.duration-value`: font-size: 24px, font-weight: 700
- `.progress-bar`: height: 8px, border-radius: 4px

---

## 🎨 Sistema de Cores e Temas

### **Light Mode** (Padrão)
```css
--dashboard-bg: #f7f2ec
--dashboard-title-color: #1a1a1a
--card-bg: #ffffff
--card-text: #1a1a1a
--card-border: rgba(0, 0, 0, 0.1)
--kpi-bg: transparent
--kpi-text: #111111
```

### **Dark Mode** (`.dark .dashboard-exact`)
```css
--dashboard-bg: #0a0a0a
--dashboard-title-color: #ffffff
--card-bg: #1a1a1a
--card-text: #ffffff
--card-border: rgba(255, 255, 255, 0.08)
--kpi-bg: #000000
--kpi-text: #ffffff
```

### **Cores dos Gráficos**
- **Presencial**: `#8b5cf6` (roxo/violeta)
- **Telemedicina**: `#3b82f6` (azul, tracejado)
- **Barras Semanais**: 
  - Segunda: `#ff6b35` (laranja)
  - Terça: `#e91e63` (rosa)
  - Quarta: `#ffc107` (amarelo)
  - Quinta: `#4caf50` (verde)
  - Sexta: `#f44336` (vermelho)
  - Sábado: `#9e9e9e` (cinza)

---

## 📊 Componentes Importados

### **1. Chart3D** (`components/Chart3D`)
- Gráfico de linha 3D para Presencial/Telemedicina
- Props: `data: { presencial, telemedicina, labels }`

### **2. BarChart3D** (`components/BarChart3D`)
- Gráfico de barras 3D para atendimentos semanais
- Props: `data: { labels, values, colors }`, `useCSS3D?: boolean`

### **3. Calendar** (`components/Calendar`)
- Calendário com datas destacadas
- Props: `selectedDate`, `onDateSelect`, `highlightedDates`, `className`

### **4. ConsultationStatusChart** (`components/ConsultationStatusChart`)
- Gráfico de pizza + métricas + filtro de período
- Props: `data`, `metrics`, `selectedPeriod`, `onPeriodChange`

### **5. StatusBadge** (`components/StatusBadge`)
- Badge de status com ícone
- Props: `status`, `size`, `showIcon`

### **6. ActiveConsultationBanner** (`components/dashboard/ActiveConsultationBanner`)
- Banner de consulta ativa
- Polling automático

---

## 🔄 Fluxo de Dados

### **Fetch Inicial**
```typescript
useEffect(() => {
  if (isMock) { /* dados mockados */ }
  else { fetchDashboardData(); }
}, [isMock, selectedYear, selectedPeriod]);
```

### **Fetch do Gráfico (Separado)**
```typescript
useEffect(() => {
  if (isMock || !dashboardData) return;
  const timeoutId = setTimeout(() => {
    fetchChartData();
  }, 300);
  return () => clearTimeout(timeoutId);
}, [fetchChartData, isMock]);
```

### **API Endpoint**
`GET /api/dashboard?year={year}&period={period}&chartPeriod={type}&chartDate={date}&chartMonth={month}&chartYear={year}`

**Retorna:**
- Dados do médico
- Estatísticas (pacientes, consultas, duração, taxa)
- Distribuições (status, tipo)
- Atividades (últimas e próximas consultas)
- Gráficos (consultas por dia)

---

## 📐 Grid Layout

### **Layout Principal**
```css
.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr 300px; /* Conteúdo + Painel direito */
  gap: 20px;
}
```

### **Main Content**
```css
.main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
```

### **Data Row** (Gráfico + Calendário)
```css
.data-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}
```

### **Bottom Row** (Gráfico Semanal + Tabela)
```css
.bottom-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 16px;
}
```

---

## 🎭 Efeitos 3D

### **Cards**
```css
.card-dark {
  transform-style: preserve-3d;
  box-shadow: 
    0 6px 24px rgba(0,0,0,0.12),
    0 2px 8px rgba(0,0,0,0.08),
    inset 0 1px 2px rgba(255,255,255,0.05);
}

.card-dark:hover {
  transform: translateY(-2px) rotateX(2deg);
}
```

### **Barras 3D**
```css
.bar-3d {
  transform: rotateX(15deg) rotateY(-10deg);
  /* Efeitos ::before e ::after para profundidade */
}
```

### **Gráfico de Pizza 3D**
```css
.pie-chart {
  transform: rotateX(45deg) rotateY(-15deg);
  /* Efeitos ::before e ::after para profundidade */
}
```

---

## 📱 Responsividade

### **Breakpoint 1400px**
- Layout vira coluna única
- Painel direito é ocultado

### **Breakpoint 768px**
- KPIs viram coluna
- Data row e bottom row viram coluna única
- Título reduz para 24px

---

## 🔍 Pontos de Atenção

1. **Mock Mode**: Verifica `process.env.NEXT_PUBLIC_MOCK === 'true'` para usar dados mockados
2. **Polling**: ActiveConsultationBanner faz polling a cada 10s
3. **Datas**: Conversão cuidadosa de datas (YYYY-MM-DD → Date local) para evitar deslocamento de timezone
4. **Filtros**: Gráfico tem filtro separado do período geral do dashboard
5. **Formatação**: Duração formatada como "Xh Xm" ou "Xm" ou "Xs"
6. **Status**: Usa `mapBackendStatus()` para converter status do backend

---

## 📝 Funções Auxiliares

- `getGreeting()`: Retorna saudação baseada na hora
- `formatDuration(seconds)`: Formata duração em horas/minutos
- `getTypeIcon(type)`: Retorna ícone baseado no tipo (Presencial/Telemedicina)
- `getTypeText(type)`: Retorna texto formatado do tipo
- `getWeeklyData()`: Processa dados para o gráfico semanal (Segunda a Sábado)

---

## 🎯 Estrutura de Arquivos Relacionados

```
apps/frontend/src/
├── app/
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       ├── page.tsx          (Componente principal)
│   │       ├── dashboard.css     (Estilos principais)
│   │       └── layout.tsx        (Layout wrapper)
│   └── api/
│       └── dashboard/
│           └── route.ts          (API endpoint)
└── components/
    ├── Chart3D.tsx
    ├── BarChart3D.tsx
    ├── Calendar.tsx
    ├── ConsultationStatusChart.tsx
    ├── StatusBadge.tsx
    ├── dashboard/
    │   └── ActiveConsultationBanner.tsx
    └── shared/
        └── LoadingScreen.tsx
```

---

## ✅ Checklist de Análise

- [x] Estrutura do componente principal
- [x] Estados e interfaces
- [x] Layout e grid system
- [x] Componentes utilizados
- [x] Sistema de cores e temas
- [x] Efeitos 3D e animações
- [x] Fluxo de dados e API
- [x] CSS e estilos principais
- [x] Responsividade
- [x] Funções auxiliares
- [x] Estrutura de arquivos

---

**Análise completa concluída!** ✅

Pronto para receber as mudanças solicitadas.






