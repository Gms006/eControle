#!/usr/bin/env python3
import os
import sys

# Tentar carregar .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Verificar quantas TPIs têm vencimento
    result = db.execute(text("SELECT COUNT(*) as total, COUNT(vencimento_tpi) as com_vencimento FROM taxas WHERE tipo = 'TPI'"))
    row = result.fetchone()
    total = row[0]
    com_vencimento = row[1]
    sem_vencimento = total - com_vencimento
    
    print(f"Total TPIs: {total}")
    print(f"Com vencimento preenchido: {com_vencimento}")
    print(f"Sem vencimento (NULL): {sem_vencimento}")
    print(f"Percentual com vencimento: {(com_vencimento/total*100):.1f}%")
    
    # Ver alguns exemplos
    print("\n--- Exemplos de TPIs SEM vencimento ---")
    result = db.execute(text("""
        SELECT t.id, e.empresa, t.status, t.vencimento_tpi
        FROM taxas t
        JOIN empresas e ON e.id = t.empresa_id
        WHERE t.tipo = 'TPI' AND t.vencimento_tpi IS NULL
        LIMIT 5
    """))
    for row in result:
        print(f"  {row[0]}: {row[1]} - Status: {row[2]}, Vencimento: {row[3]}")
    
    # Ver alguns com vencimento
    print("\n--- Exemplos de TPIs COM vencimento ---")
    result = db.execute(text("""
        SELECT t.id, e.empresa, t.status, t.vencimento_tpi
        FROM taxas t
        JOIN empresas e ON e.id = t.empresa_id
        WHERE t.tipo = 'TPI' AND t.vencimento_tpi IS NOT NULL
        LIMIT 5
    """))
    # Verificar status dos que não têm vencimento
    print("\n--- Statuses dos TPIs SEM vencimento ---")
    result = db.execute(text("""
        SELECT status, COUNT(*) as qtd
        FROM taxas
        WHERE tipo = 'TPI' AND vencimento_tpi IS NULL
        GROUP BY status
        ORDER BY qtd DESC
    """))
    # Verificar quantas TPIs NÃO-isentas existem
    print("\n--- TPIs NÃO-ISENTAS (deveriam ter vencimento) ---")
    result = db.execute(text("""
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN vencimento_tpi IS NOT NULL THEN 1 END) as com_vencimento
        FROM taxas
        WHERE tipo = 'TPI' AND status != 'ISENTO'
    """))
    row = result.fetchone()
    total = row[0]
    com_vencimento = row[1]
    sem_vencimento = total - com_vencimento
    
    print(f"Total de TPIs NÃO-isentas: {total}")
    print(f"Com vencimento: {com_vencimento}")
    print(f"SEM vencimento: {sem_vencimento}")
    
    # Ver alguns com vencimento faltando
    if sem_vencimento > 0:
        print("\n--- Exemplos de TPIs NÃO-isentas SEM vencimento ---")
        result = db.execute(text("""
            SELECT t.id, e.empresa, t.status, t.vencimento_tpi
            FROM taxas t
            JOIN empresas e ON e.id = t.empresa_id
            WHERE t.tipo = 'TPI' AND t.status != 'ISENTO' AND t.vencimento_tpi IS NULL
            LIMIT 10
        """))
        for row in result:
            print(f"  {row[0]}: {row[1]} - Status: {row[2]}")
        
finally:
    db.close()
