select situacao, count(*) from company_processes group by situacao order by count(*) desc, situacao asc limit 10;
