from __future__ import annotations

import streamlit as st

from core.services import Services

st.set_page_config(page_title="Maria Clara — MVP", layout="wide")

svc = Services(base_dir="data/exports")

st.title("Visão Geral")
metrics = svc.metrics_overview()

col1, col2, col3, col4 = st.columns(4)
col1.metric("Empresas", metrics["empresas"])
col2.metric("Licenças vencendo (30d)", metrics["licencas_vencendo"])
col3.metric("Taxas em aberto", metrics["taxas_em_aberto"])
col4.metric("Processos pendentes", metrics["processos_pendentes"]) 

st.markdown("---")

st.subheader("Empresas")
st.dataframe(
    [{"Razão Social": e.razao_social, "CNPJ": e.cnpj_mascarado, "Categoria": e.categoria} for e in svc.list_empresas()],
    use_container_width=True,
)

with st.expander("Licenças"):
    st.dataframe(
        [
            {
                "Empresa": e.razao_social,
                "Tipo": l.tipo.value,
                "Situação": l.situacao.value,
                "Validade": l.validade.isoformat() if l.validade else "",
            }
            for l in svc.list_licencas()
            for e in svc.list_empresas()
            if str(l.id_empresa) == str(e.id)
        ],
        use_container_width=True,
    )

with st.expander("Taxas"):
    st.dataframe(
        [
            {
                "Empresa": e.razao_social,
                "Tipo": t.tipo.value,
                "Situação": t.situacao.value,
                "Parcelas": f"{t.parcelas_pagas}/{t.parcelas_total}" if t.parcelas_total else "",
                "Anos em aberto": f"{t.ano_inicial_aberto}–{t.ano_final_aberto}" if t.ano_inicial_aberto else "",
            }
            for t in svc.list_taxas()
            for e in svc.list_empresas()
            if str(t.id_empresa) == str(e.id)
        ],
        use_container_width=True,
    )

with st.expander("Processos"):
    st.dataframe(
        [
            {
                "Empresa": e.razao_social,
                "Operação": p.operacao.value,
                "Órgão": p.orgao.value,
                "Serviço": p.servico.value if p.servico else "",
                "Situação": p.situacao.value,
                "Entrada": p.data_entrada.isoformat() if p.data_entrada else "",
                "Protocolo": p.data_protocolo.isoformat() if p.data_protocolo else "",
            }
            for p in svc.list_processos()
            for e in svc.list_empresas()
            if str(p.id_empresa) == str(e.id)
        ],
        use_container_width=True,
    )

st.info(
    "Dados carregados de 'data/exports'. Use 'python -m core.manipulador_dados data/base.xlsx' para atualizar a base.")
