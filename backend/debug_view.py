#!/usr/bin/env python3
import os
from dotenv import load_dotenv

load_dotenv()

from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    result = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'v_certificados_status' ORDER BY ordinal_position"))
    columns = [row[0] for row in result]
    print("Colunas em v_certificados_status:")
    for c in columns:
        print(f"  - {c}")
    
    print("\n--- Testando SELECT * ---")
    result = db.execute(text("SELECT * FROM v_certificados_status WHERE senha IS NOT NULL LIMIT 1"))
    row = result.fetchone()
    if row:
        data = row._mapping if hasattr(row, '_mapping') else dict(zip(columns, row))
        print(f"Dados com senha: {data}")
        print(f"Senha: {data.get('senha')}")
    else:
        print("Nenhuma linha com senha")
        
        # Verifica linhas sem senha
        result = db.execute(text("SELECT * FROM v_certificados_status LIMIT 1"))
        row = result.fetchone()
        if row:
            data = row._mapping if hasattr(row, '_mapping') else dict(zip(columns, row))
            print(f"\nDados sem filtro: {data}")
            print(f"Senha nula: {data.get('senha')}")
finally:
    db.close()
