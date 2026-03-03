select municipio, count(*) from companies group by municipio order by count(*) desc, municipio;  
