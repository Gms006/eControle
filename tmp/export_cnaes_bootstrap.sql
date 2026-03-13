COPY (
    select cnae_code, replace(coalesce(max(cnae_text), ''), ',', ' ')
    from (
        select
          elem->>'code' as cnae_code,
          elem->>'text' as cnae_text
        from company_profiles cp
        cross join lateral json_array_elements(
          case
            when json_typeof(cp.cnaes_principal) = 'array' then cp.cnaes_principal
            else '[]'::json
          end
        ) elem

        union all

        select
          elem->>'code' as cnae_code,
          elem->>'text' as cnae_text
        from company_profiles cp
        cross join lateral json_array_elements(
          case
            when json_typeof(cp.cnaes_secundarios) = 'array' then cp.cnaes_secundarios
            else '[]'::json
          end
        ) elem
    ) x
    where coalesce(cnae_code, '') <> ''
      and cnae_code <> '00.00-0-00'
    group by cnae_code
    order by cnae_code
) TO '/tmp/cnaes_bootstrap.csv' WITH (FORMAT CSV, HEADER FALSE);
