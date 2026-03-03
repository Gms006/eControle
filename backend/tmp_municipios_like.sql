select municipio, count(*) from companies where upper(municipio) like 'ANA%%' group by municipio order by municipio;  
