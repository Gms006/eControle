select count(*) as non_canonical_process from company_processes where situacao is not null and (situacao < or situacao ~ '[a-z0-9_]' or situacao like '%% %%');
