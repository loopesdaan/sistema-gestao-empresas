#!/bin/bash

# Script de inicialização do Sistema de Gestão Empresarial

echo "=========================================="
echo "  Iniciando Sistema de Gestão Empresarial "
echo "=========================================="

# 1. Inicia o backend FastAPI
echo "Iniciando Backend FastAPI (Porta 8000)..."
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# 2. Inicia o frontend Vite
echo "Iniciando Frontend Vite (Porta 5173)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo " Sistema iniciado com sucesso!"
echo " - Backend API & Swagger: http://localhost:8000/docs"
echo " - Frontend Web & PWA:    http://localhost:5173"
echo ""
echo "Pressione Ctrl+C para encerrar os servidores."

# Captura Ctrl+C para finalizar ambos
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait

