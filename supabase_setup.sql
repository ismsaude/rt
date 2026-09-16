-- ============================================================
-- ⚠️  ARQUIVO HISTÓRICO — NÃO EXECUTAR
--
-- Este script descreve o schema inicial do projeto e já NÃO
-- corresponde ao banco em produção. Colunas divergem do que o
-- código usa (ex.: VitalSigns grava bp/glucose/temp/spo2, não
-- bloodPressure/bloodGlucose/...).
--
-- O schema vigente é o resultado deste arquivo MAIS as migrações
-- em supabase/migrations/, que são a fonte de verdade a partir de
-- setembro de 2026. Para um banco novo, rode as migrações em ordem.
-- ============================================================

-- 1. Habilitar a extensão de geração de UUID automático
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. TABELAS BASE
-- ==========================================

-- Tabela de Moradores
CREATE TABLE IF NOT EXISTS "Resident" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    "dateOfBirth" DATE,
    allergies TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    cid TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Usuários / Funcionários
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'CUIDADOR',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 3. TABELAS DA ENFERMAGEM
-- ==========================================

-- Tabela de Sinais Vitais
CREATE TABLE IF NOT EXISTS "VitalSigns" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "residentId" TEXT, -- Para vincular ao morador
    "residentName" TEXT, -- Nome do morador (facilita na exibição)
    "userId" TEXT, -- Quem mediu
    "bloodPressure" TEXT,
    "bloodGlucose" INTEGER,
    temperature NUMERIC,
    "oxygenSaturation" INTEGER,
    observation TEXT, -- Adicionado no frontend
    "measuredAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Medicamentos / Estoque
CREATE TABLE IF NOT EXISTS "Medication" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    dosage TEXT,
    stock INTEGER DEFAULT 0,
    "minStock" INTEGER DEFAULT 10,
    origin TEXT, -- Ex: 'SUS' ou 'Farmácia'
    "resident_id" TEXT, -- ID do morador se for medicação individual
    times JSONB, -- Vetor JSON com horários (ex: ["08:00", "20:00"])
    "recipeAttached" BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Agenda e Eventos (Programação)
CREATE TABLE IF NOT EXISTS "Event" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    resident_id TEXT,
    resident_name TEXT,
    date TEXT,
    time TEXT,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- 4. TABELAS OPERACIONAIS
-- ==========================================

-- Tabela de Tarefas
CREATE TABLE IF NOT EXISTS "Task" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    shift TEXT,
    "isDone" BOOLEAN DEFAULT false,
    "doneAt" TIMESTAMP WITH TIME ZONE,
    "doneBy" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Cardápio / Refeições
CREATE TABLE IF NOT EXISTS "Menu" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TEXT, 
    time TEXT,
    "mealType" TEXT,
    items TEXT,
    status TEXT DEFAULT 'pending', -- 'pending' ou 'served'
    "servedAt" TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
