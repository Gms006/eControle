#!/usr/bin/env python3
"""Debug script para checar se a coluna senha existe na view."""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import text, inspect
from app.core.config import settings
from app.db.session import SessionLocal

def main():
    db = SessionLocal()
    try:
        # Check columns in view
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'v_certificados_status'
            ORDER BY ordinal_position
        """))
        
        columns = [row[0] for row in result]
        print("Colunas em v_certificados_status:")
        for col in columns:
            print(f"  - {col}")
        
        if 'senha' not in columns:
            print("\n❌ COLUNA 'senha' NÃO ENCONTRADA NA VIEW!")
        else:
            print("\n✅ Coluna 'senha' encontrada na view")
        
        # Test a sample query
        print("\n--- Testando SELECT * ---")
        result = db.execute(text("SELECT * FROM v_certificados_status LIMIT 1"))
        row = result.fetchone()
        if row:
            keys = row.keys()
            print(f"Colunas retornadas: {list(keys)}")
            print(f"Primeira linha: {dict(row)}")
        else:
            print("Nenhuma linha encontrada na view")
            
    except Exception as e:
        print(f"Erro: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    main()
